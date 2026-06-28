// Manages --topbar-h CSS variable and nav fog (left/right fade)
// Use in your layout or app.vue

export function useTopbar() {
  function setTopbarHeight() {
    if (!import.meta.client) return
    const topbar = document.querySelector(".topbar")
    if (!topbar) return
    const h = Math.ceil(topbar.getBoundingClientRect().height)
    document.documentElement.style.setProperty("--topbar-h", h + "px")
  }

  function initTopbarHeight() {
    setTopbarHeight()
    window.addEventListener("load", setTopbarHeight)
    window.addEventListener("resize", setTopbarHeight)
  }

  // Nav fog (left/right fade on horizontal scroll)
  function initNavFog() {
    if (!import.meta.client) return
    const wrap = document.querySelector(".topbar__nav-wrap")
    const nav = document.querySelector(".topbar__nav")
    if (!wrap || !nav) return

    const EPS = 2

    function updateFog() {
      const max = nav.scrollWidth - nav.clientWidth
      wrap.classList.toggle("has-right-fade", nav.scrollLeft < max - EPS)
      wrap.classList.toggle("has-left-fade", nav.scrollLeft > EPS)
    }

    nav.addEventListener("scroll", () => requestAnimationFrame(updateFog))
    window.addEventListener("resize", () => requestAnimationFrame(updateFog))
    updateFog()
  }

  return { initTopbarHeight, initNavFog }
}