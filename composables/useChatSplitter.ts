// Drag-to-resize stream/chat splitter (mobile only)
// Sets --fz-stream-h CSS variable on <html>

const KEY = "fz_split_stream_percent"
const DEFAULT_STREAM = 60
const MIN_PCT = 40
const MAX_PCT = 80

export function useChatSplitter() {
  const isDragging = ref(false)

  function isMobile(): boolean {
    return window.matchMedia?.("(max-width: 768px)").matches ?? false
  }

  function clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n))
  }

  function applyPercent(p: number | string) {
    const pct = clamp(Number(p) || DEFAULT_STREAM, MIN_PCT, MAX_PCT)
    document.documentElement.style.setProperty("--fz-stream-h", pct + "%")
    try { localStorage.setItem(KEY, String(pct)) } catch {}
  }

  function loadSaved() {
    try {
      const saved = localStorage.getItem(KEY)
      applyPercent(saved ? saved : DEFAULT_STREAM)
    } catch {
      applyPercent(DEFAULT_STREAM)
    }
  }

  function getClientY(e: PointerEvent | TouchEvent): number {
    if ("touches" in e && e.touches[0]) return e.touches[0].clientY
    if ("changedTouches" in e && e.changedTouches[0]) return e.changedTouches[0].clientY
    return (e as PointerEvent).clientY
  }

  function init(overlayEl: HTMLElement, handleEl: HTMLElement) {
    loadSaved()

    function onDown(e: PointerEvent | TouchEvent) {
      if (!isMobile()) return
      isDragging.value = true
      handleEl.classList.add("is-dragging")
      document.body.classList.add("is-splitting")
      e.preventDefault()
    }

    function onMove(e: PointerEvent | TouchEvent) {
      if (!isDragging.value || !isMobile()) return
      const rect = overlayEl.getBoundingClientRect()
      const y = getClientY(e)
      const pct = clamp(((y - rect.top) / (rect.height || 1)) * 100, MIN_PCT, MAX_PCT)
      applyPercent(pct)
      e.preventDefault()
    }

    function onUp() {
      if (!isDragging.value) return
      isDragging.value = false
      handleEl.classList.remove("is-dragging")
      document.body.classList.remove("is-splitting")
    }

    handleEl.addEventListener("pointerdown", onDown as any, { passive: false })
    window.addEventListener("pointermove", onMove as any, { passive: false })
    window.addEventListener("pointerup", onUp)

    handleEl.addEventListener("touchstart", onDown as any, { passive: false })
    window.addEventListener("touchmove", onMove as any, { passive: false })
    window.addEventListener("touchend", onUp)

    document.addEventListener("keydown", (e) => { if (e.key === "Escape") onUp() })
  }

  return { isDragging, init, applyPercent, loadSaved }
}