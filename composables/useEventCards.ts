// ===== TIMEZONE HELPERS =====

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
}

function tzOffsetMinutes(timeZone: string, dateUtcMs: number): number {
  const dtf = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  })
  const parts = dtf.formatToParts(new Date(dateUtcMs))
  const map: Record<string, string> = {}
  for (const p of parts) if (p.type !== "literal") map[p.type] = p.value
  const asIfUtc = Date.UTC(
    Number(map.year), Number(map.month) - 1, Number(map.day),
    Number(map.hour), Number(map.minute), Number(map.second)
  )
  return (asIfUtc - dateUtcMs) / 60000
}

function parseBerlinLocalToDate(s: string): Date | null {
  const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (!m) return null
  const y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3])
  const h = Number(m[4]), mi = Number(m[5]), se = Number(m[6] || "0")

  let utcMs = Date.UTC(y, mo, d, h, mi, se)
  for (let i = 0; i < 3; i++) {
    const off = tzOffsetMinutes("Europe/Berlin", utcMs)
    const next = Date.UTC(y, mo, d, h, mi, se) - off * 60000
    if (Math.abs(next - utcMs) < 1000) { utcMs = next; break }
    utcMs = next
  }
  const out = new Date(utcMs)
  return isNaN(out.getTime()) ? null : out
}

export function parseEventStart(s: string): Date | null {
  if (!s) return null
  const str = String(s).trim()
  if (/[zZ]$/.test(str) || /[+\-]\d{2}:\d{2}$/.test(str)) {
    const d = new Date(str)
    return isNaN(d.getTime()) ? null : d
  }
  return parseBerlinLocalToDate(str)
}

// ===== FORMAT =====

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "LIVE"
  const days = Math.floor(ms / (1000 * 60 * 60 * 24))
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24)
  const minutes = Math.floor((ms / (1000 * 60)) % 60)
  const seconds = Math.floor((ms / 1000) % 60)
  return `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`
}

// ===== VIEWER COUNT =====

function hash32(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function jitterFor(eventId: string, jump: number, bucket: number): number {
  let x = hash32(eventId + ":" + bucket)
  x ^= x << 13; x >>>= 0
  x ^= x >>> 17; x >>>= 0
  x ^= x << 5; x >>>= 0
  return (x % (jump * 2 + 1)) - jump
}

export interface EventCard {
  id: string
  eventId: string
  startIso: string
  endsAt?: string
  event?: string       // e.g. "streams247"
  dateLabel?: string
  title?: string
  isLive?: boolean
  countdown?: string
  viewerCount?: number
}

export function useEventCards() {
  const { $sb } = useNuxtApp()

  const cards = useState<EventCard[]>("event_cards", () => [])

  // ===== VIEWER COUNT REALTIME =====

  const viewerCountState = new Map<string, number>()
  const viewerCountListeners = new Map<string, Set<(v: number) => void>>()
  let viewerChannel: any = null

  async function ensureViewerChannel() {
    if (viewerChannel) return
    viewerChannel = $sb.channel("viewer-count-global")
    viewerChannel
      .on("postgres_changes", { event: "*", schema: "public", table: "viewer_count" }, (payload: any) => {
        const row = payload?.new
        const eventId = String(row?.event_id || "").trim()
        const value = row?.value
        if (!eventId || typeof value !== "number") return

        viewerCountState.set(eventId, value)
        viewerCountListeners.get(eventId)?.forEach(fn => { try { fn(value) } catch (_) {} })

        // update reactive cards
        const card = cards.value.find(c => c.eventId === eventId)
        if (card) card.viewerCount = value
      })
      .subscribe()
  }

  async function loadViewerCount(eventId: string): Promise<number> {
    const { data } = await $sb
      .from("viewer_count")
      .select("value")
      .eq("event_id", eventId)
      .maybeSingle()
    return typeof data?.value === "number" ? data.value : 0
  }

  // ===== INFER START FROM DATE LABEL =====

  function inferStartFromLabel(dateLabel: string, existingStart?: string): string | undefined {
    if (existingStart) return existingStart
    if (!dateLabel || dateLabel === "TBA") return undefined

    const m = dateLabel.match(/,\s*([A-Za-z]{3})\s+(\d{1,2})\s*$/)
    if (!m) return undefined

    const mon = MONTHS[m[1]]
    const day = Number(m[2])
    if (mon === undefined || !day) return undefined

    const now = new Date()
    let year = now.getFullYear()
    let d = new Date(year, mon, day, 0, 0, 0, 0)
    if (d.getTime() < now.getTime() - 60 * 1000) {
      year += 1
      d = new Date(year, mon, day, 0, 0, 0, 0)
    }

    const pad = (n: number) => String(n).padStart(2, "0")
    return `${year}-${pad(mon + 1)}-${pad(day)}T00:00:00`
  }

  // ===== IS LIVE =====

  function isCardLive(card: EventCard, nowMs: number): boolean {
    const start = parseEventStart(card.startIso)
    if (!start) return false
    if (start.getTime() > nowMs) return false

    if (card.endsAt) {
      const ends = parseEventStart(card.endsAt)
      if (ends) return nowMs < ends.getTime()
    }

    // fallback: live for 4 hours after start
    return nowMs < start.getTime() + 4 * 60 * 60 * 1000
  }

  // ===== SORT =====

  function sortedCards(list: EventCard[]): EventCard[] {
    return [...list].sort((a, b) => {
      const aStart = parseEventStart(a.startIso)
      const bStart = parseEventStart(b.startIso)
      if (!aStart && !bStart) return 0
      if (!aStart) return 1
      if (!bStart) return -1
      return aStart.getTime() - bStart.getTime()
    })
  }

  // ===== TICK =====

  let tickInterval: ReturnType<typeof setInterval> | null = null

  function updateCountdowns() {
    const nowMs = Date.now()
    for (const card of cards.value) {
      const isWorker = card.event?.includes("streams247")
      const start = parseEventStart(card.startIso)
      const diff = start ? start.getTime() - nowMs : 0

      if (isWorker) {
        card.countdown = formatCountdown(diff)
        card.isLive = false
        continue
      }

      const live = isCardLive(card, nowMs)
      card.isLive = live
      card.countdown = live ? "LIVE" : formatCountdown(diff)

      // jitter viewer count for live cards
      if (live && typeof card.viewerCount === "number") {
        const JUMP = 5
        const bucket = Math.floor(nowMs / 20000)
        card.viewerCount = Math.max(0, card.viewerCount + jitterFor(card.eventId, JUMP, bucket))
      }
    }
  }

  function startTick() {
    if (tickInterval) return
    tickInterval = setInterval(updateCountdowns, 1000)
  }

  function stopTick() {
    if (!tickInterval) return
    clearInterval(tickInterval)
    tickInterval = null
  }

  // ===== INIT =====

  async function init(rawCards: EventCard[]) {
    // resolve start from label if missing
    const resolved = rawCards.map(c => ({
      ...c,
      startIso: inferStartFromLabel(c.dateLabel || "", c.startIso) || c.startIso,
    }))

    cards.value = sortedCards(resolved)

    // load viewer counts for live cards
    await ensureViewerChannel()
    for (const card of cards.value) {
      if (card.isLive || isCardLive(card, Date.now())) {
        const count = await loadViewerCount(card.eventId)
        card.viewerCount = count
        viewerCountState.set(card.eventId, count)
      }
    }

    updateCountdowns()
    startTick()
  }

  const liveCards = computed(() => cards.value.filter(c => c.isLive))

  return {
    cards,
    liveCards,
    init,
    startTick,
    stopTick,
    updateCountdowns,
    parseEventStart,
    formatCountdown,
  }
}