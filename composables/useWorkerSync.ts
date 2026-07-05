// composables/useWorkerSync.ts

import { ref, onMounted, onUnmounted } from 'vue'
import type { SupabaseClient } from '@supabase/supabase-js'

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

// ─── Viewer count jitter ──────────────────────────────────────────────────────

function hash32(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

function jitterFor(eventId: string, jump: number, bucket: number): number {
  let x = hash32(`${eventId}:${bucket}`)
  x ^= x << 13; x >>>= 0; x ^= x >>> 17; x >>>= 0; x ^= x << 5; x >>>= 0
  return (x % (jump * 2 + 1)) - jump
}

export function fakeViewerCount(eventId: string, base: number, jumpSize = 5): number {
  const bucket = Math.floor(Date.now() / 20_000)
  return Math.max(0, base + jitterFor(eventId, jumpSize, bucket))
}

// ─── Composable ───────────────────────────────────────────────────────────────

export function useWorkerSync(initialEvents: StreamEvent[] = []) {
  const { $sb } = useNuxtApp()
  const sb = $sb as SupabaseClient

  const sections = ref<SectionsMap>(emptySections())
  const viewerBases = ref<Record<string, number>>({})

  let tickInterval: ReturnType<typeof setInterval> | null = null
  let realtimeChannel: ReturnType<typeof sb.channel> | null = null
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

  // ── Viewer count ────────────────────────────────────────────────────────────

  async function loadViewerBase(eventId: string) {
    const { data } = await sb
      .from('viewer_count')
      .select('value')
      .eq('event_id', eventId)
      .maybeSingle()
    if (data && typeof (data as { value: number }).value === 'number') {
      viewerBases.value[eventId] = (data as { value: number }).value
    }
  }

  function setupRealtime() {
    if (realtimeChannel) return
    realtimeChannel = sb.channel('viewer-count-global')
    realtimeChannel
      .on(
        'postgres_changes' as Parameters<typeof realtimeChannel.on>[0],
        { event: '*', schema: 'public', table: 'viewer_count' },
        (payload: { new: { event_id?: string; value?: number } }) => {
          const row = payload?.new
          const eid = String(row?.event_id || '').trim()
          if (!eid || typeof row?.value !== 'number') return
          viewerBases.value[eid] = row.value
        },
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') console.log('[useWorkerSync] realtime ok')
      })
  }

  async function adjustViewerCount(eventId: string, delta: number) {
    const next = Math.max(0, (viewerBases.value[eventId] ?? 0) + delta)
    viewerBases.value[eventId] = next
    await sb.from('viewer_count').upsert(
      { event_id: eventId, value: next },
      { onConflict: 'event_id' },
    )
  }

  // ── Tick ────────────────────────────────────────────────────────────────────

  // Только таймеры — не трогаем liveCards, чтобы не мигало
  function tick() {
    const nowMs = Date.now()

    for (const sid of Object.keys(sections.value) as SectionId[]) {
      if (sid === 'liveCards') continue // live обновляется только через fetchEvents
      const cards = sections.value[sid]
      for (const card of cards) {
        if (card.isLive) {
          const eid = String(card.event.id)
          card.viewers = fakeViewerCount(eid, viewerBases.value[eid] ?? 0)
        } else {
          const diffMs = card.event.starts_at ? card.event.starts_at * 1000 - nowMs : Infinity
          card.timerText = isFinite(diffMs) ? formatDiff(diffMs) : 'TBA'
        }
      }
    }
    // Обновляем таймеры и в liveCards тоже, но не трогаем сам массив
    for (const card of sections.value.liveCards) {
      const eid = String(card.event.id)
      card.viewers = fakeViewerCount(eid, viewerBases.value[eid] ?? 0)
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
        viewers = fakeViewerCount(eid, viewerBases.value[eid] ?? 0)
        if (!(eid in viewerBases.value)) loadViewerBase(eid)
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
    // Если есть prefetch (из useAsyncData) — строим из него сразу.
    // rebuildSections сам пересчитает is_live по текущему времени,
    // поэтому замороженный is_live из prefetch не страшен.
    // Фетчим на старте только если данных нет.
    if (allEvents.length > 0) {
      rebuildSections()
    } else {
      await fetchEvents()
    }
    setupRealtime()
    startTick()
    fetchInterval = setInterval(fetchEvents, 30_000)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('fz:overlay-open', stopTick)
    window.addEventListener('fz:overlay-close', startTick)
  })

  onUnmounted(() => {
    stopTick()
    if (fetchInterval) { clearInterval(fetchInterval); fetchInterval = null }
    if (realtimeChannel) { sb.removeChannel(realtimeChannel); realtimeChannel = null }
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('fz:overlay-open', stopTick)
    window.removeEventListener('fz:overlay-close', startTick)
  })

  return { sections, viewerBases, adjustViewerCount, refetch: fetchEvents, tick }
}