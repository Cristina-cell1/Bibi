// composables/useWorkerSync.ts

import { ref, onMounted, onUnmounted } from 'vue'

// ─── Типы (соответствуют реальному API ответу) ────────────────────────────────

export interface StreamEvent {
  id: number
  name: string
  title: string
  tag?: string
  poster?: string
  category: string          // "Ice Hockey", "Football", etc.
  category_id?: number
  category_name?: string
  uri_name?: string
  iframe_url?: string
  iframe?: string
  iframe_override?: string | null
  date_override?: string | null
  starts_at: number         // unix timestamp seconds
  ends_at: number           // unix timestamp seconds
  always_live?: number
  is_live: boolean          // вычисляется на нашей стороне (API не отдаёт)
  is_ended?: boolean
  free?: number
  allowpaststreams?: number
  // Legacy поля для совместимости с другими composables
  premium?: boolean
  api_uri?: string
  stream?: string
}

export interface CardState {
  event: StreamEvent
  timerText: string
  isLive: boolean
  viewers: number
}

// ─── Section types ────────────────────────────────────────────────────────────

export type SectionId =
  | 'liveCards'
  | 'basketballCards'
  | 'footballCards'
  | 'combatCards'
  | 'wrestlingCards'
  | 'motorsportCards'
  | 'hockeyCards'
  | 'dartsCards'
  | 'americanFootballCards'
  | 'baseballCards'
  | 'rugbyCards'
  | 'tennisCards'
  | 'streams247Cards'
  | 'otherCards'
export type SectionsMap = Record<SectionId, CardState[]>

function emptySections(): SectionsMap {
  return {
    liveCards: [],
    basketballCards: [],
    footballCards: [],
    combatCards: [],
    wrestlingCards: [],
    motorsportCards: [],
    hockeyCards: [],
    dartsCards: [],
    americanFootballCards: [],
    baseballCards: [],
    rugbyCards: [],
    tennisCards: [],
    streams247Cards: [],
    otherCards: [],
  }
}
// ─── Countdown formatter ──────────────────────────────────────────────────────

export function formatDiff(ms: number): string {
  if (ms <= 0) return 'LIVE'
  const days = Math.floor(ms / (1000 * 60 * 60 * 24))
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24)
  const minutes = Math.floor((ms / (1000 * 60)) % 60)
  const seconds = Math.floor((ms / 1000) % 60)
  return `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`
}

// ─── Live calc (API не отдаёт is_live — считаем сами) ─────────────────────────

function computeIsLive(e: Partial<StreamEvent>, nowSec: number): boolean {
  if (e.is_ended) return false
  if (e.always_live) return true
  const start = e.starts_at ?? Infinity
  const end = e.ends_at ?? 0
  return nowSec >= start && nowSec < end
}

// ─── Section mapping (по category из API) ────────────────────────────────────

const CATEGORY_SECTION_MAP: Array<[RegExp, SectionId]> = [
  [/streams?247|24\/7/i,              'streams247Cards'],
  [/basket/i,                         'basketballCards'],
  [/combat|mma|box/i,                 'combatCards'],
  [/wrestl/i,                         'wrestlingCards'],
  [/motor|formula|f1|nascar|rally/i,  'motorsportCards'],
  [/ice.?hockey|hockey|nhl|iihf/i,    'hockeyCards'],
  [/darts?/i,                         'dartsCards'],
  [/american.?foot|nfl/i,             'americanFootballCards'],
  [/baseball|mlb/i,                   'baseballCards'],
  [/rugby|nrl/i,                      'rugbyCards'],
  [/tennis|atp|wta/i,                 'tennisCards'],
  [/football|soccer/i,                'footballCards'],
]

export function sectionForEvent(event: StreamEvent): SectionId {
  // Проверяем category и tag
  const haystack = `${event.category || ''} ${event.tag || ''} ${event.category_name || ''}`.toLowerCase()
  for (const [re, id] of CATEGORY_SECTION_MAP) {
    if (re.test(haystack)) return id
  }
  return 'otherCards'
}

// ─── Composable ───────────────────────────────────────────────────────────────

export function useWorkerSync(initialEvents: StreamEvent[] = []) {
  const { viewerCounts, subscribeToLiveCards } = usePresence()

  const sections = ref<SectionsMap>(emptySections())

  let tickInterval: ReturnType<typeof setInterval> | null = null
  let allEvents: StreamEvent[] = initialEvents

  // ── Fetch ───────────────────────────────────────────────────────────────────

  async function fetchEvents() {
    try {
      const res = await fetch('/api/streams-sync')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()

      // Прокси api.fzpv.st отдаёт ПЛОСКИЙ массив: { success, count, events: [...] }
      // (в отличие от сырого api.ppv.to с вложенными streams[].streams[])
      const rawEvents: any[] = json?.events ?? json?.data ?? []
      const now = Date.now() / 1000

      const parsed: StreamEvent[] = rawEvents.map((ev: any) => {
        return {
          ...ev,
          category: ev.category || ev.category_name,
          iframe_url: ev.iframe_url ?? ev.iframe,
          is_live: computeIsLive(ev, now),
        }
      })

      console.log('[useWorkerSync] fetched:', parsed.length)

      // не затираем рабочие данные пустотой (например при временном сбое прокси)
      if (parsed.length > 0) {
        allEvents = parsed
      }

      rebuildSections()
      // Сообщаем app.vue что данные загружены (убирает fz-loading-events)
      if (import.meta.client) {
        window.dispatchEvent(new Event('fz:streams-synced'))
      }
    } catch (e) {
      console.warn('[useWorkerSync] fetch error:', e)
      // не трогаем allEvents — оставляем то, что уже было (prefetch)
    }
  }

  // ── Tick ────────────────────────────────────────────────────────────────────

  // Таймеры + актуальные Presence-цифры зрителей
  function tick() {
    const nowMs = Date.now()

    for (const sid of Object.keys(sections.value) as SectionId[]) {
      if (sid === 'liveCards') continue // live обновляется только через fetchEvents
      const cards = sections.value[sid]
      for (const card of cards) {
        if (card.isLive) {
          const eid = String(card.event.id)
          card.viewers = viewerCounts.value[eid] ?? 0
        } else {
          const diffMs = card.event.starts_at ? card.event.starts_at * 1000 - nowMs : Infinity
          card.timerText = isFinite(diffMs) ? formatDiff(diffMs) : 'TBA'
        }
      }
    }
    // Обновляем цифры зрителей и в liveCards тоже, но не трогаем сам массив
    for (const card of sections.value.liveCards) {
      const eid = String(card.event.id)
      card.viewers = viewerCounts.value[eid] ?? 0
    }
  }

  // Полный пересчёт секций — вызывается только при fetchEvents
  function rebuildSections() {
    const nowMs = Date.now()
    const nowSec = nowMs / 1000
    const next = emptySections()
    const live: CardState[] = []

    const sorted = [...allEvents].sort((a, b) => {
      const al = computeIsLive(a, nowSec)
      const bl = computeIsLive(b, nowSec)
      if (al && !bl) return -1
      if (!al && bl) return 1
      return (a.starts_at ?? 0) - (b.starts_at ?? 0)
    })

    for (const event of sorted) {
      const sid = sectionForEvent(event)
      const eid = String(event.id)
      const isLive = computeIsLive(event, nowSec)

      let timerText: string
      let viewers = 0

      if (isLive) {
        timerText = 'LIVE'
        viewers = viewerCounts.value[eid] ?? 0
      } else {
        const diffMs = event.starts_at ? event.starts_at * 1000 - nowMs : Infinity
        timerText = isFinite(diffMs) ? formatDiff(diffMs) : 'TBA'
      }

      const card: CardState = { event, timerText, isLive, viewers }
      // 24/7 и always_live не попадают в Live секцию
      const is247 = sid === 'streams247Cards' || !!event.always_live
      if (isLive && !is247) live.push(card)
      // Пропускаем секции которых нет в карте (cricket, other и т.д.)
      if (sid in next) next[sid].push(card)
    }

    next.liveCards = live
    sections.value = next

    // подписываемся на реальные Presence-каналы всех живых карточек
    subscribeToLiveCards(live.map(c => String(c.event.id)))
  }

  // ── Tick control ────────────────────────────────────────────────────────────

  function startTick() {
    if (tickInterval) return
    tickInterval = setInterval(tick, 1000)
  }

  function stopTick() {
    if (!tickInterval) return
    clearInterval(tickInterval)
    tickInterval = null
  }

  const onVisibility = () => document.hidden ? stopTick() : startTick()

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  let fetchInterval: ReturnType<typeof setInterval> | null = null

  onMounted(async () => {
    if (allEvents.length > 0) {
      rebuildSections()
    } else {
      await fetchEvents()
    }
    startTick()
    fetchInterval = setInterval(fetchEvents, 30_000)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('fz:overlay-open', stopTick)
    window.addEventListener('fz:overlay-close', startTick)
  })

  onUnmounted(() => {
    stopTick()
    if (fetchInterval) { clearInterval(fetchInterval); fetchInterval = null }
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('fz:overlay-open', stopTick)
    window.removeEventListener('fz:overlay-close', startTick)
  })

  return { sections, refetch: fetchEvents, tick }
}