<template>
 <div :class="{ 'fz-loading-events': isLoadingEvents }">

    <header class="topbar">
  <div class="container topbar__inner">
    <div class="topbar__brand" @click="$route.path.startsWith('/auth') ? navigateTo('/') : showPage('main')">
      <img src="/bibi-logo.webp" alt="FZ" />
      <span class="brand__name">BIBILIVE</span>
    </div>

    <!-- Десктоп nav -->
    <div class="topbar__nav-wrap">
      <nav class="topbar__nav">
        <a v-for="item in navItems"
         :key="item.page"
         class="nav__item"
        :class="{ active: activePage === item.page }"
          :data-page="item.page"
          href="#"
          @click.prevent="showPage(item.page)"
         >{{ item.label }}</a>

         <!-- Discord  -->
         <a class="nav__item nav__item--discord"
         href="https://discord.gg/bTaKQYm4mg"
          target="_blank"
         rel="noopener noreferrer"
         >Discord</a>
      </nav>
    </div>

    <div class="auth-actions">
  <template v-if="!isLoggedIn">
    <button class="auth-btn auth-btn--login" type="button" @click="goAuth('/auth/register')">Register</button>
    <button class="auth-btn auth-btn--logout" type="button" @click="goAuth('/auth/login')">Login</button>
  </template>
  <template v-else>
    <span class="topbar__nickname">{{ nickname }}</span>
    <button class="auth-btn auth-btn--logout" type="button" @click="signOut">Logout</button>
  </template>

  <button class="burger-btn" type="button" @click="menuOpen = !menuOpen" v-show="isMobile">
    <span></span><span></span><span></span>
  </button>
</div>
  </div>
</header>

<!-- Slide-up menu -->
<Transition name="slide-up">
  <div v-if="menuOpen" class="mobile-menu" @click.self="menuOpen = false">
    <div class="mobile-menu__sheet">
      <div class="mobile-menu__handle"></div>
      <nav class="mobile-menu__nav">
  <a v-for="item in navItems"
    :key="item.page"
    class="mobile-menu__item"
    :class="{ active: activePage === item.page }"
    href="#"
    @click.prevent="showPage(item.page); menuOpen = false"
  >{{ item.label }}</a>

  <!-- Discord -->
  
    <a class="mobile-menu__item mobile-menu__item--discord"
    href="https://discord.gg/bTaKQYm4mg"
    target="_blank"
    rel="noopener noreferrer"
    @click="menuOpen = false"
    >Discord</a>
</nav>
    </div>
  </div>
</Transition>

   

    <main>
      <div id="page-main" class="page is-active">
        <NuxtPage />
      </div>

      <div id="page-archive" class="page">
        <div class="archive-empty">
          <div class="archive-icon">
            <svg fill="none" height="28" viewBox="0 0 24 24" width="28">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" />
              <line stroke="currentColor" stroke-linecap="round" stroke-width="2" x1="12" x2="12" y1="10" y2="16" />
              <circle cx="12" cy="7" fill="currentColor" r="1.5" />
            </svg>
          </div>
          <div class="archive-text">If you want this feature added, vote in discord</div>
        </div>
      </div>

      <div id="page-discord" class="page"></div>
    </main>

    <footer class="footer">
      <div class="footer__inner">
        <div class="footer__left">
          <img src="/Bibi-logo2.webp" alt="Fightzone" class="footer__logo" />
        </div>
        <div class="footer__center">You miss 100 percent of the shots you dont take</div>
        <div class="footer__right">
          <a href="https://discord.gg/bTaKQYm4mg" target="_blank" rel="noopener noreferrer">
            <img src="/discord.png" alt="Discord" class="footer__discord" />
          </a>
        </div>
      </div>
    </footer>

    <div id="cryptoModal" class="crypto-modal"></div>

<!-- ─── Stream Overlay ─────────────────────────────────────────── -->
<div class="stream-overlay" :class="{ 'is-open': streamOpen }">



  <div class="stream-layout">

<!-- Player -->
<div class="stream-player">
  <div class="stream-player__header">
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
    v-if="streamOpen && streamIframeSrc"
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
    <button class="stream-header__btn stream-header__btn--mobile" type="button" @click="helpOpen = true">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
    </button>
  </div>
</div>

   <!-- Chat -->
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
 </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useChat } from '~/composables/useChat'
const { user, nickname, isLoggedIn, isAdmin, fetchUser, signOut, listenToAuthChanges } = useAuth()

useHead({
  link: [
    { rel: "stylesheet", href: "/styles.css" },
    { rel: "stylesheet", href: "/paywall.css" },
  ],
  script: [
    { src: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/dist/twemoji.min.js', crossorigin: 'anonymous' }
  ]
})

// ─── Loading ─────────────────────────────────────────────────────
const isLoadingEvents = ref(true)

// ─── Nav ─────────────────────────────────────────────────────────
const navItems = [
  { page: "main",    label: "Main" },
  { page: "archive", label: "Multiview" },
]
const activePage = ref("main")
const menuOpen = ref(false)
const helpOpen = ref(false)
const isMobile = ref(false)

function showPage(pageName: string) {
  activePage.value = pageName
  document.querySelectorAll(".page").forEach(p => {
    p.classList.toggle("is-active", p.id === "page-" + pageName)
  })
  document.querySelectorAll(".topbar__nav .nav__item[data-page]").forEach((a: any) => {
    a.classList.toggle("active", a.dataset.page === pageName)
  })
  if ((window as any).closeOverlay) (window as any).closeOverlay()
  window.scrollTo({ top: 0, behavior: "smooth" })
}

// ─── Stream overlay ───────────────────────────────────────────────
// ─── Stream overlay ───────────────────────────────────────────────
const streamOpen = ref(false)
const streamEvent = ref<any>(null)
const streamIframeSrc = ref('')
const chatBoxRef = ref<{ switchRoom: (room: string) => Promise<void> } | null>(null)

// ─── Source selector (заглушки — реальные источники подключим позже) ──
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
  () => sources.value.find(s => s.id === activeSourceId.value) ?? sources.value[0]
)
const otherSources = computed(
  () => sources.value.filter(s => s.id !== activeSourceId.value)
)

function toggleSourceMenu() {
  sourceMenuOpen.value = !sourceMenuOpen.value
}

const sourceLoading = ref(false)
const iframeKey = ref(0)

function selectSource(id: string) {
  if (id === activeSourceId.value) { sourceMenuOpen.value = false; return }
  activeSourceId.value = id
  sourceMenuOpen.value = false

  // фейковое обновление: показываем лоадер и перезагружаем плеер
  sourceLoading.value = true
  iframeKey.value++   // пересоздаёт iframe -> реальная перезагрузка
  setTimeout(() => {
    sourceLoading.value = false
  }, 800)
}

function onSourceDocClick(e: MouseEvent) {
  const el = sourceMenuRef.value
  if (el && !el.contains(e.target as Node)) {
    sourceMenuOpen.value = false
  }
}

async function openStream(event: any) {
  streamEvent.value = event
  const src = event.iframe_override || event.iframe || event.iframe_url || `https://pooembed.eu/embed/${event.uri_name}`
  streamIframeSrc.value = src
  streamOpen.value = true
  document.documentElement.style.overflow = 'hidden'
  document.body.classList.add('stream-open')
  await chatBoxRef.value?.switchRoom(String(event.id))
}


function closeStream() {
  streamOpen.value = false
  streamIframeSrc.value = ''
  streamEvent.value = null
  document.documentElement.style.overflow = ''
  document.body.classList.remove('stream-open')
  window.scrollTo({ top: 0 })
}

function goAuth(path: string) {
  if (streamOpen.value) closeStream()
  navigateTo(path)
}

// ─── Init ─────────────────────────────────────────────────────────
onMounted(async () => {
  await fetchUser()
  listenToAuthChanges()
  isMobile.value = window.innerWidth <= 768
  window.addEventListener('resize', () => { isMobile.value = window.innerWidth <= 768 })
  window.addEventListener("fz:streams-synced", () => { isLoadingEvents.value = false })
  setTimeout(() => { isLoadingEvents.value = false }, 7000)

  window.addEventListener("fz:open-stream", (e: Event) => {
    openStream((e as CustomEvent).detail)
  })

  document.addEventListener('click', onSourceDocClick)

  ;(window as any).closeOverlay = closeStream

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && streamOpen.value) closeStream()
  })

  if ((window as any).twemoji) {
    (window as any).twemoji.parse(document.body, { folder: 'svg', ext: '.svg' })
  }
})

onUnmounted(() => {
  document.removeEventListener('click', onSourceDocClick)
})
</script>



<style>
.page { display: none; }
.page.is-active { display: block; }

.nav__item--discord,
.mobile-menu__item--discord { color: #868686 !important; }
.nav__item--discord:hover,
.mobile-menu__item--discord:hover { color: #4752c4 !important; }

/* ===== STREAM OVERLAY ===== */
.stream-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 25000;
  background: #0e0e0e;
}

.stream-overlay.is-open {
  display: flex;
  flex-direction: column;
  top: 49px;
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

/* Chat */
.stream-chat {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #111;
  border-left: 1px solid #222;
  min-height: 0;
}
.stream-chat .chat-wrap {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.stream-chat__header {
  padding: 12px 16px;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  border-bottom: 1px solid #222;
  flex-shrink: 0;
}
.stream-chat__messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.stream-chat__messages::-webkit-scrollbar { width: 4px; }
.stream-chat__messages::-webkit-scrollbar-track { background: transparent; }
.stream-chat__messages::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
.chat-msg {
  font-size: 13px;
  line-height: 1.45;
  word-break: break-word;
}
.chat-msg__name {
  font-weight: 700;
  margin-right: 6px;
}
.chat-msg__text { color: #ccc; }
.chat-empty {
  color: #444;
  font-size: 13px;
  text-align: center;
  margin-top: 20px;
}

.stream-chat__input {
  display: flex;
  border-top: 50px solid #ec1a1a;
  padding: 14px 8px;
  gap: 8px;
  flex-shrink: 0;
}

.chat-input:focus { border-color: #555; }
.chat-input::placeholder { color: #555; }

.chat-send {
  background: #cc2222;
  border: none;
  border-radius: 6px;
  color: #fff;
  padding: 0 14px;
  cursor: pointer;
  font-size: 16px;
  transition: background .15s;
  flex-shrink: 0;
}
.chat-send:hover { background: #e83333; }



body.stream-open main,
body.stream-open .promo-track {
  pointer-events: none;
}

body.stream-open > div,
body.stream-open #__nuxt {
  pointer-events: none;
}

body.stream-open .topbar {
  pointer-events: auto;
  z-index: 30000;
}


body.stream-open .stream-overlay {
  pointer-events: all;
}

@media (max-width: 768px) {
  .stream-layout {
    flex-direction: column;
    height: 100vh;
  }

  .stream-player {
    flex: 0 0 50vh;
    height: 50vh;
  }

  .stream-chat {
    display: flex;
    width: 100%;
    flex: 1 1 auto;
    border-left: none;
    border-top: 1px solid #222;
  }

  .stream-player__top { padding: 8px 12px; }
}

.stream-player__title {
  font-size: 24px;
  font-weight: 500;
  color: #fff;
  font-family: 'Mozilla Text', sans-serif;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}


.stream-player__header {
  height: 55px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  background: #0a0030;
  border-bottom: 1px solid #222;
  flex-shrink: 0;
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

.stream-overlay .topbar {
  flex-shrink: 0;
  display: flex !important;
}

.stream-header__btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: rgba(255,255,255,.5);
  padding: 0;
  display: flex;
  align-items: center;
  margin-left: auto;
  transition: color .2s;
}

.stream-header__btn:hover {
  color: #fff;
}

.stream-header__btn svg {
  width: 20px;
  height: 20px;
}

.stream-header__btn--mobile {
  display: none;
}

@media (max-width: 768px) {
  .stream-header__btn--desktop {
    display: none;
  }
  .stream-header__btn--mobile {
    display: flex;
  }
}

.stream-iframe {
  flex: 1;
  width: 100%;
  min-height: 0;
  border: none;
  display: block;
}

.stream-help {
  position: absolute;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,.6);
}

.stream-help__box {
  background: #0e0c00;
  border: 1px solid rgba(255, 220, 50, 0.3);
  border-radius: 12px;
  padding: 28px;
  max-width: 520px;
  width: 90%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-shadow: 0 0 40px rgba(255, 220, 50, 0.08);
}

.stream-help__title {
  font-size: 18px;
  font-weight: 700;
  color: rgba(255, 220, 50, 1);
  margin: 0;
}

.stream-help__section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stream-help__section strong {
  color: rgba(255, 220, 50, 0.85);
  font-size: 14px;
}

.stream-help__section p {
  color: #aaa;
  font-size: 13px;
  margin: 0;
  line-height: 1.5;
}

.stream-help__dismiss {
  background: rgba(255, 220, 50, 0.1);
  border: 1px solid rgba(255, 220, 50, 0.4);
  color: rgba(255, 220, 50, 0.9);
  padding: 10px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  text-align: center;
  transition: background .15s;
}

.stream-help__dismiss:hover {
  background: rgba(255, 220, 50, 0.2);
}

.stream-help__dismiss:hover {
  background: #2a2a4e;
}

.source-select {
  position: relative;
  margin-left: auto;
  flex: 0 0 auto;
}

.source-select__btn,
.source-select__item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  transition: background .15s ease, border-color .15s ease;
}

.source-select__btn:hover,
.source-select__item:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.3);
}

.source-select__icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.source-select__label { line-height: 1; }

.source-select__menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(20, 20, 28, 0.97);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.source-select__menu .source-select__item {
  width: 100%;
  justify-content: flex-start;
  border-color: transparent;
  background: transparent;
}

.source-select__menu .source-select__item:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: transparent;
}

.source-loading {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  background: rgba(0, 0, 0, 0.82);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
}

.source-loading__spinner {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 3px solid rgba(255, 255, 255, 0.18);
  border-top-color: #fff;
  animation: source-spin 0.7s linear infinite;
}

.source-loading__text {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
  font-family: inherit;
}

@keyframes source-spin {
  to { transform: rotate(360deg); }
}
</style>