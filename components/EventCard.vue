<template>
  <div
    class="card"
    :class="{ 'card--glow-ready': glowReady }"
    :style="glowStyle"
    :data-event-id="card.event.id"
    :data-api-uri="card.event.uri_name"
    :data-event="card.event.category"
    @click="handleClick"
  >
    <!-- Poster -->
    <div
      class="card__media--image"
      :style="posterUrl ? `background-image:url('${posterUrl}')` : ''"
    >
      <div v-if="card.isLive" class="card__viewers">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye-icon lucide-eye"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>
        <span>{{ card.viewers.toLocaleString() }}</span>
      </div>
    </div>

    <!-- Footer -->
    <div class="card__footer" :class="{ 'card__footer--single': singleLine }">
      <!-- Title -->
      <div ref="titleEl" class="card__title">{{ card.event.title }}</div>

      <!-- Divider -->
      <div class="card__divider"></div>

      <div class="card__meta">
        <button
          type="button"
          class="card__pin-btn"
          :class="{ 'is-pinned': pinned }"
          @click.stop="togglePin"
        >
          <Star :size="20" :fill="pinned ? '#FFD700' : 'none'" :stroke="pinned ? '#FFD700' : 'currentColor'" stroke-linejoin="round" />
        </button>

        <span class="card__section-sep">|</span>
        <span class="card__section-label" :class="{ 'card__section-label--live': card.isLive }">{{ card.event.category }}</span>

        <div class="card__timer" :data-live-dyn="card.isLive ? '1' : ''">
          <template v-if="card.isLive">
            <span class="liveBadge">LIVE</span>
            <template v-if="isAdmin">
              <button type="button" class="live-arrow live-up" @click.stop="$emit('adjust-viewers', 2)">&#9650;</button>
              <span class="live-num">{{ card.viewers.toLocaleString() }}</span>
              <button type="button" class="live-arrow live-down" @click.stop="$emit('adjust-viewers', -2)">&#9660;</button>
            </template>
          </template>
          <template v-else>
            {{ card.timerText }}
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted, type Ref } from 'vue'
import { Star } from '@lucide/vue'

interface StreamEvent {
  id: number
  title: string
  tag?: string
  poster?: string
  category: string
  uri_name?: string
  starts_at: number
  ends_at: number
  is_live: boolean
  is_ended?: boolean
  free?: number
  premium?: boolean
}

interface CardState {
  event: StreamEvent
  timerText: string
  isLive: boolean
  viewers: number
}

const props = defineProps<{
  card: CardState
  isAdmin?: boolean
  isPinned?: boolean
}>()

const emit = defineEmits<{
  click: []
  'adjust-viewers': [delta: number]
}>()

// --- Pin logic ---
const pinned = ref(false)

// --- Title line detection ---
const titleEl: Ref<HTMLElement | null> = ref(null)
const singleLine = ref(false)

function checkTitleLines() {
  const el = titleEl.value
  if (!el) return
  const lineHeight = parseFloat(getComputedStyle(el).lineHeight)
  singleLine.value = el.offsetHeight <= lineHeight * 1.5
}

watch(() => props.card.event.title, () => {
  nextTick(checkTitleLines)
})

function loadPinState() {
  if (import.meta.client) {
    const stored = localStorage.getItem('fz:pinned')
    const ids: number[] = stored ? JSON.parse(stored) : []
    pinned.value = ids.includes(props.card.event.id)
  }
}

function togglePin() {
  if (!import.meta.client) return
  const stored = localStorage.getItem('fz:pinned')
  const ids: number[] = stored ? JSON.parse(stored) : []

  if (pinned.value) {
    const updated = ids.filter(id => id !== props.card.event.id)
    localStorage.setItem('fz:pinned', JSON.stringify(updated))
    pinned.value = false
  } else {
    ids.push(props.card.event.id)
    localStorage.setItem('fz:pinned', JSON.stringify(ids))
    pinned.value = true
  }

  window.dispatchEvent(new CustomEvent('fz:pinned-changed'))
}

function onPinnedChange() { loadPinState() }

// --- Glow ---
const glowLeft  = ref('transparent')
const glowRight = ref('transparent')
const glowReady = ref(false)

const glowStyle = computed(() => ({
  '--glow-left':  glowLeft.value,
  '--glow-right': glowRight.value,
}))

// --- Poster override ---
const posterUrl = computed(() => {
  const t = props.card.event.title?.toLowerCase() ?? ''

  if (t.includes('rally'))      return '/Rally-tv.jpg'
  if (t.includes('south park')) return '/South_park.webp'
  if (t.includes('simpsons'))   return '/the-simpsons.png'
  if (t.includes('family guy')) return '/Family-guy.jpg'

  return props.card.event.poster
    ? `/proxy-image?url=${encodeURIComponent(props.card.event.poster)}`
    : ''
})

function sampleEdgeColors(img: HTMLImageElement): { left: string; right: string } {
  const SIZE = 60
  const canvas = document.createElement('canvas')
  canvas.width  = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return { left: 'transparent', right: 'transparent' }

  try {
    ctx.drawImage(img, 0, 0, SIZE, SIZE)

    function avgColor(x0: number, y0: number, w: number, h: number): string {
      const d = ctx.getImageData(x0, y0, w, h).data
      let r = 0, g = 0, b = 0, n = 0
      for (let i = 0; i < d.length; i += 4) {
        const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
        if (lum < 18 || lum > 230) continue
        r += d[i]; g += d[i + 1]; b += d[i + 2]; n++
      }
      if (n === 0) return 'transparent'
      return `rgba(${Math.round(r/n)},${Math.round(g/n)},${Math.round(b/n)},0.6)`
    }

    return {
      left:  avgColor(0,                      0, Math.floor(SIZE * 0.3), SIZE),
      right: avgColor(Math.floor(SIZE * 0.7), 0, Math.floor(SIZE * 0.3), SIZE),
    }
  } catch {
    return { left: 'transparent', right: 'transparent' }
  }
}

// --- Lifecycle ---
onMounted(() => {
  loadPinState()
  checkTitleLines()
  if (document.fonts?.ready) {
    document.fonts.ready.then(checkTitleLines)
  }
  window.addEventListener('fz:pinned-changed', onPinnedChange)

  const poster = props.card.event.poster
  if (!poster) return
  const img = new Image()
  img.onload = () => {
    const { left, right } = sampleEdgeColors(img)
    glowLeft.value  = left
    glowRight.value = right
    glowReady.value = true
  }
  img.src = posterUrl.value || `/proxy-image?url=${encodeURIComponent(poster)}`
})

onUnmounted(() => {
  window.removeEventListener('fz:pinned-changed', onPinnedChange)
})

// --- Click ---
function handleClick(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('.live-arrow')) return
  if ((e.target as HTMLElement).closest('.card__pin-btn')) return
  emit('click')
}
</script>