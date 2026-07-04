<template>
  <div class="stream-page">

    <!-- NOT FOUND -->
    <div v-if="!loading && !streamEvent" class="stream-notfound">
      <p>Stream not found or ended</p>
      <button type="button" class="stream-notfound__back" @click="goBack">← Main</button>
    </div>

    <!-- STREAM -->
    <div v-else class="stream-layout">

      <!-- Player -->
      <div class="stream-player" ref="playerBoxRef">
        <div class="stream-player__header">
          <button class="stream-player__back" type="button" @click="goBack">← Back</button>
          <span class="stream-player__title">{{ streamEvent?.title }}</span>

          <!-- SOURCE SELECTOR -->
          <div ref="sourceMenuRef" class="source-select">
            <button type="button" class="source-select__btn" @click="toggleSourceMenu">
              <svg class="source-select__icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m14.5 12.5-5-5"/><path d="m9.5 12.5 5-5"/><rect width="20" height="14" x="2" y="3" rx="2"/><path d="M12 17v4"/><path d="M8 21h8"/></svg>
              <span class="source-select__label">{{ activeSource.label }}</span>
            </button>

            <div v-if="sourceMenuOpen" class="source-select__menu">
              <button
                v-for="src in otherSources"
                :key="src.id"
                type="button"
                class="source-select__item"
                @click="selectSource(src.id)"
              >
                <svg class="source-select__icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m14.5 12.5-5-5"/><path d="m9.5 12.5 5-5"/><rect width="20" height="14" x="2" y="3" rx="2"/><path d="M12 17v4"/><path d="M8 21h8"/></svg>
                <span class="source-select__label">{{ src.label }}</span>
              </button>
            </div>
          </div>

          <button class="stream-header__btn stream-header__btn--desktop" type="button" @click="helpOpen = true">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
          </button>
        </div>

        <iframe
          v-if="streamIframeSrc"
          :key="iframeKey"
          :src="streamIframeSrc"
          allowfullscreen
          allow="autoplay; fullscreen"
          class="stream-iframe"
          frameborder="0"
        />

        <!-- fake source-switch loader -->
        <div v-if="sourceLoading" class="source-loading">
          <span class="source-loading__spinner"></span>
          <span class="source-loading__text">Switching to {{ activeSource.label }}…</span>
        </div>

        <div class="stream-player__footer">
          <button class="btn-fullscreen" type="button" @click="requestFullscreen">⛶</button>
          <button class="stream-header__btn stream-header__btn--mobile" type="button" @click="helpOpen = true">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
          </button>
        </div>
      </div>

      <!-- Chat (Шаг 3 — навесим следующим) -->
      <div class="stream-chat">
        <ChatBox ref="chatBoxRef" :is-admin="isAdmin" />
      </div>

    </div>

    <!-- Help Modal -->
    <div class="stream-help" v-if="helpOpen" @click.self="helpOpen = false">
      <div class="stream-help__box">
        <h3 class="stream-help__title">Fixing Playback Issues</h3>
        <div class="stream-help__section">
          <strong>Check your connection</strong>
          <p>If you have connection issues, verify your download speed is at minimum 18mbps before continuing.</p>
        </div>
        <div class="stream-help__section">
          <strong>Use a VPN</strong>
          <p>Using a VPN can help by evading blocks and routing around congested Internet links. Try different locations to find what works best.</p>
        </div>
        <div class="stream-help__section">
          <strong>Change your DNS</strong>
          <p>Changing DNS servers to 1.1.1.1 or 8.8.8.8 can bypass ISP level blocks.</p>
        </div>
        <button class="stream-help__dismiss" type="button" @click="helpOpen = false">Dismiss</button>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'

const { isAdmin } = useAuth()

const route = useRoute()
const router = useRouter()

const id = computed(() => String(route.params.id ?? ''))

// ─── Получение события по id (работает и при прямом заходе/refresh) ──────────
const { data: streamEvent, pending: loading } = await useAsyncData(
  () => `stream-${id.value}`,
  async () => {
    const json: any = await $fetch('/api/streams-sync')
    const rawEvents: any[] = json?.events ?? json?.data ?? []
    const found = rawEvents.find((ev: any) => String(ev.id) === id.value)
    if (!found) return null
    return {
      ...found,
      category: found.category || found.category_name,
      iframe_url: found.iframe_url ?? found.iframe,
    }
  },
  { watch: [id] },
)

// ─── iframe src ──────────────────────────────────────────────────────────────
const streamIframeSrc = computed(() => {
  const e: any = streamEvent.value
  if (!e) return ''
  return e.iframe_override || e.iframe || e.iframe_url || `https://pooembed.eu/embed/${e.uri_name}`
})

// ─── SEO / заголовок вкладки ──────────────────────────────────────────────────
useHead(() => ({
  title: streamEvent.value?.title ? `${streamEvent.value.title} — BIBILIVE` : 'BIBILIVE',
}))

// ─── Source selector (заглушки, как в оверлее) ───────────────────────────────
interface StreamSource { id: string; label: string }
const sources = ref<StreamSource[]>([
  { id: '1', label: 'Source 1' },
  { id: '2', label: 'Source 2' },
  { id: '3', label: 'Source 3' },
])
const activeSourceId = ref('1')
const sourceMenuOpen = ref(false)
const sourceMenuRef = ref<HTMLElement | null>(null)

const activeSource = computed(
  () => sources.value.find(s => s.id === activeSourceId.value) ?? sources.value[0],
)
const otherSources = computed(
  () => sources.value.filter(s => s.id !== activeSourceId.value),
)

function toggleSourceMenu() {
  sourceMenuOpen.value = !sourceMenuOpen.value
}

const sourceLoading = ref(false)
const iframeKey = ref(0)

function selectSource(sid: string) {
  if (sid === activeSourceId.value) { sourceMenuOpen.value = false; return }
  activeSourceId.value = sid
  sourceMenuOpen.value = false
  sourceLoading.value = true
  iframeKey.value++
  setTimeout(() => { sourceLoading.value = false }, 800)
}

function onSourceDocClick(e: MouseEvent) {
  const el = sourceMenuRef.value
  if (el && !el.contains(e.target as Node)) sourceMenuOpen.value = false
}

// ─── Fullscreen ───────────────────────────────────────────────────────────────
const playerBoxRef = ref<HTMLElement | null>(null)
async function requestFullscreen() {
  const box = playerBoxRef.value
  if (!box) return
  try {
    if (box.requestFullscreen) await box.requestFullscreen()
    else if ((box as any).webkitRequestFullscreen) (box as any).webkitRequestFullscreen()
  } catch {}
}

// ─── Help ─────────────────────────────────────────────────────────────────────
const helpOpen = ref(false)

// ─── Navigation ───────────────────────────────────────────────────────────────
function goBack() {
  if (window.history.length > 1) router.back()
  else navigateTo('/')
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
const chatBoxRef = ref<{ switchRoom: (room: string) => Promise<void> } | null>(null)

onMounted(async () => {
  document.addEventListener('click', onSourceDocClick)
  window.addEventListener('keydown', onEsc)

  // подключаем чат к комнате этого события
  if (streamEvent.value) {
    await nextTick()
    await chatBoxRef.value?.switchRoom(id.value)
  }
})
onUnmounted(() => {
  document.removeEventListener('click', onSourceDocClick)
  window.removeEventListener('keydown', onEsc)
})
function onEsc(e: KeyboardEvent) {
  if (e.key === 'Escape') goBack()
}
</script>

<style scoped>
.stream-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 49px);
}

.stream-layout {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.stream-player {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #0b002b;
  min-width: 0;
  height: 100%;
}

.stream-player__header {
  height: 55px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  background: #0a0030;
  border-bottom: 1px solid #222;
  flex-shrink: 0;
}

.stream-player__back {
  background: transparent;
  border: 1px solid rgba(255,255,255,.15);
  color: #fff;
  border-radius: 8px;
  height: 34px;
  padding: 0 12px;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  flex: 0 0 auto;
}
.stream-player__back:hover { background: rgba(255,255,255,.1); }

.stream-player__title {
  font-size: 24px;
  font-weight: 500;
  color: #fff;
  font-family: 'Mozilla Text', sans-serif;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stream-iframe {
  flex: 1;
  width: 100%;
  min-height: 0;
  border: none;
  display: block;
}

.stream-player__footer {
  height: 40px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  background: #0a0030;
  border-top: 1px solid #222;
  flex-shrink: 0;
  gap: 8px;
}

.btn-fullscreen {
  background: transparent;
  border: none;
  color: rgba(255,255,255,.5);
  cursor: pointer;
  font-size: 18px;
}
.btn-fullscreen:hover { color: #fff; }

.stream-chat {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #111;
  border-left: 1px solid #222;
  min-height: 0;
}

.stream-notfound {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  flex: 1;
  color: #aaa;
}
.stream-notfound__back {
  background: rgba(255,255,255,.08);
  border: 1px solid rgba(255,255,255,.2);
  color: #fff;
  padding: 10px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
}

@media (max-width: 768px) {
  .stream-layout { flex-direction: column; height: auto; }
  .stream-player { flex: 0 0 50vh; height: 50vh; }
  .stream-chat {
    width: 100%;
    flex: 1 1 auto;
    border-left: none;
    border-top: 1px solid #222;
  }
}
</style>