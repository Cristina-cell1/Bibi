// Supabase Presence — passive viewer count for live cards
// Subscribes to watching:{eventId} channels without opening the overlay

export function usePresence() {
  const { $sb } = useNuxtApp()

  const passiveChannels = new Map<string, any>()
  const viewerCounts = useState<Record<string, number>>("presence_counts", () => ({}))

  // канал, в который ТЕКУЩИЙ клиент трекает себя как зрителя
  let activeChannel: any = null
  let activeEventId = ""

  // стабильный id вкладки (для анонимов тоже работает)
  function getClientKey(): string {
    if (!import.meta.client) return "server"
    try {
      let k = sessionStorage.getItem("fz_presence_key")
      if (!k) {
        k = "v_" + Math.random().toString(36).slice(2) + Date.now().toString(36)
        sessionStorage.setItem("fz_presence_key", k)
      }
      return k
    } catch {
      return "v_" + Math.random().toString(36).slice(2)
    }
  }

  function updateCount(eventId: string, count: number) {
    viewerCounts.value = { ...viewerCounts.value, [eventId]: count }
  }

  function subscribePassive(eventId: string) {
    if (!eventId || passiveChannels.has(eventId)) return

    const ch = $sb.channel(`watching:${eventId}`)

    function renderCount() {
      const state = ch.presenceState()
      let count = 0
      Object.values(state).forEach((list: any) => {
        if (Array.isArray(list)) count += list.length
      })
      updateCount(eventId, count)
    }

    ch.on("presence", { event: "sync" }, renderCount)
      .on("presence", { event: "join" }, renderCount)
      .on("presence", { event: "leave" }, renderCount)
      .subscribe()

    passiveChannels.set(eventId, ch)
  }

  function unsubscribeAll() {
    passiveChannels.forEach(async (ch) => {
      try { await $sb.removeChannel(ch) } catch {}
    })
    passiveChannels.clear()
  }

  // Subscribe to all currently live cards (by eventId)
  function subscribeToLiveCards(liveEventIds: string[]) {
    for (const id of liveEventIds) {
      subscribePassive(id)
    }
  }
  // ── активный трекинг: текущий зритель смотрит eventId ──
  async function trackSelf(eventId: string) {
    const id = String(eventId || "").trim()
    if (!id || !import.meta.client) return

    // если уже трекаем этот же ивент — ничего не делаем
    if (activeChannel && activeEventId === id) return

    // ушли со старого ивента
    await untrackSelf()

    activeEventId = id
    const key = getClientKey()
    const ch = $sb.channel(`watching:${id}`, {
      config: { presence: { key } },
    })

    function renderCount() {
      const state = ch.presenceState()
      let count = 0
      Object.values(state).forEach((list: any) => {
        if (Array.isArray(list)) count += list.length
      })
      updateCount(id, count)
    }

    ch.on("presence", { event: "sync" }, renderCount)
      .on("presence", { event: "join" }, renderCount)
      .on("presence", { event: "leave" }, renderCount)
      .subscribe(async (status: string) => {
        if (status === "SUBSCRIBED") {
          await ch.track({ at: Date.now() })
        }
      })

    activeChannel = ch
  }

  async function untrackSelf() {
    if (!activeChannel) return
    try { await activeChannel.untrack() } catch {}
    try { await $sb.removeChannel(activeChannel) } catch {}
    activeChannel = null
    activeEventId = ""
  }
 return {
    viewerCounts,
    subscribePassive,
    subscribeToLiveCards,
    unsubscribeAll,
    trackSelf,   
    untrackSelf,    
  }
}