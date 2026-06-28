// composables/useCardScroll.ts

import { onMounted, onUnmounted, nextTick } from 'vue'

const EPS = 2
const STEP = 326
const MIN_CARDS_FOR_ARROWS = 6

export function useCardScroll() {
  // Теперь храним последнее известное кол-во карточек вместо WeakSet
  const cardCounts = new WeakMap<Element, number>()
  const cleanups: Array<() => void> = []
  let observer: MutationObserver | null = null

  function bind(wrap: Element) {
    const track = wrap.querySelector<HTMLElement>('.cards--1-wide')
    const left  = wrap.querySelector<HTMLElement>('.cards-arrow--left')
    const right = wrap.querySelector<HTMLElement>('.cards-arrow--right')
    if (!track || !left || !right) return

    const currentCount = track.querySelectorAll('.card').length

    
    const isVisible = (wrap as HTMLElement).offsetParent !== null
if (!isVisible) return
if (cardCounts.get(wrap) === currentCount) return
    cardCounts.set(wrap, currentCount)

    const trackEl = track
    const leftEl  = left
    const rightEl = right
    const wrapEl  = wrap

    function update() {
  const count = trackEl.querySelectorAll('.card').length
  const tooFew = count < MIN_CARDS_FOR_ARROWS
  const max = Math.max(0, trackEl.scrollWidth - trackEl.clientWidth)

  // Скрываем весь блок стрелок если карточек мало
  const arrowsContainer = wrapEl.querySelector<HTMLElement>('.section__arrows')
  if (arrowsContainer) {
    arrowsContainer.style.visibility = tooFew ? 'hidden' : ''
  }

  leftEl.classList.toggle('is-hidden',  tooFew || trackEl.scrollLeft <= EPS || max <= EPS)
  rightEl.classList.toggle('is-hidden', tooFew || trackEl.scrollLeft >= max - EPS || max <= EPS)
  wrapEl.classList.toggle('has-left-fade',  !tooFew && trackEl.scrollLeft > EPS)
  wrapEl.classList.toggle('has-right-fade', !tooFew && trackEl.scrollLeft < max - EPS && max > EPS)
}

    // Снимаем старые листенеры если они были (при rebind)
    const oldCleanup = (wrap as any).__fzScrollCleanup
    if (oldCleanup) oldCleanup()

    const onLeft   = () => trackEl.scrollBy({ left: -STEP, behavior: 'smooth' })
    const onRight  = () => trackEl.scrollBy({ left:  STEP, behavior: 'smooth' })
    const onScroll = () => requestAnimationFrame(update)
    const onResize = () => requestAnimationFrame(update)

    leftEl.addEventListener('click', onLeft)
    rightEl.addEventListener('click', onRight)
    trackEl.addEventListener('scroll', onScroll)
    window.addEventListener('resize', onResize)

    const cleanup = () => {
      leftEl.removeEventListener('click', onLeft)
      rightEl.removeEventListener('click', onRight)
      trackEl.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
    }
    ;(wrap as any).__fzScrollCleanup = cleanup
    cleanups.push(cleanup)

    update()
  }

  function bindAll() {
    document.querySelectorAll('.cards-wrap').forEach(bind)
  }

  onMounted(async () => {
    await nextTick()
    bindAll()

    observer = new MutationObserver(() => {
      requestAnimationFrame(bindAll)
    })
    observer.observe(document.body, { childList: true, subtree: true })

    window.addEventListener('fz:streams-synced', bindAll)
  })

  onUnmounted(() => {
    cleanups.forEach(fn => fn())
    cleanups.length = 0
    observer?.disconnect()
    observer = null
    window.removeEventListener('fz:streams-synced', bindAll)
  })

  return { refresh: bindAll }
}