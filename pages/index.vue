<template>
  <div>
    <!-- ─── Pinned ─────────────────────────────────────────── -->
    <div v-if="pinnedCards.length > 0" class="cards-wrap section">
      <div class="section__header">
        <div class="section__title-wrap">
          <h2 class="section__title">⭐ Pinned</h2>
        </div>
        <div class="section__arrows"></div>
      </div>
      <div class="cards--1-wide" id="pinnedCards">
        <EventCard
          v-for="card in pinnedCards"
          :key="card.event.id"
          :card="card"
          :is-admin="isAdmin"
          :is-pinned="true"
          @click="openStream(card.event)"
          @adjust-viewers="(delta: number) => adjustViewerCount(String(card.event.id), delta)"
        />
      </div>
    </div>

    <!-- ─── Jump to Section ──────────────────────────────────────── -->
<div class="jump-nav">
  <a class="jump-nav__item" @click="scrollTo('liveCards')">
    <span class="jump-nav__count jump-nav__count--live">
      <span class="liveDotSmall" />
    </span>
    <span class="jump-nav__label">LIVE</span>
  </a>
  
    <a v-for="section in jumpSections"
    :key="section.id"
    class="jump-nav__item"
    @click="scrollTo(section.id)"
    >
    <span class="jump-nav__label">{{ section.label }}</span>
    <span class="jump-nav__count">{{ section.count }}</span>

  </a>
</div>
    <!-- ─── Live Section ──────────────────────────────────────────── -->
<div class="cards-wrap">
  <div class="section__header">
    <div class="section__title-wrap">
      <h2 class="section__title">🔴 LIVE</h2>
      <button v-if="liveSection.length > 6" class="section__view-all" @click="toggleExpand('liveCards')">
        {{ expandedSections.has('liveCards') ? 'Collapse' : 'View all' }}
      </button>
    </div>
    <div class="section__arrows" v-if="liveSection.length > 0">
      <button class="section__arrow section__arrow--left cards-arrow--left" type="button">
        <ChevronLeft :size="32" />
      </button>
      <button class="section__arrow section__arrow--right cards-arrow--right" type="button">
        <ChevronRight :size="32" />
      </button>
    </div>
  </div>
  <div
    v-if="liveSection.length > 0"
    class="cards--1-wide"
    :class="{ 'cards--expanded': expandedSections.has('liveCards') }"
    id="liveCards"
  >
    <EventCard
      v-for="card in liveSection"
      :key="card.event.id"
      :card="card"
      :is-admin="isAdmin"
      @click="openStream(card.event)"
      @adjust-viewers="(delta: number) => adjustViewerCount(String(card.event.id), delta)"
    />
  </div>
  <div v-else class="live-empty">
    Nothing is Live now. You can pin smth for later)
  </div>
</div>

    <!-- ─── Sport Sections ────────────────────────────────────────── -->
    <div
      v-for="section in sportSections"
      :key="section.id"
      v-show="section.cards.length > 0"
      class="cards-wrap section"
    >
      <div class="section__header">
  <div class="section__title-wrap">
    <h2 class="section__title">{{ section.label }}</h2>
    <button v-if="section.cards.length > 6" class="section__view-all" @click="toggleExpand(section.id)">
      {{ expandedSections.has(section.id) ? 'Collapse' : 'View all' }}
    </button>
  </div>
  <div class="section__arrows">
    <button class="section__arrow section__arrow--left cards-arrow--left" type="button">
      <ChevronLeft :size="32" />
    </button>
    <button class="section__arrow section__arrow--right cards-arrow--right" type="button">
      <ChevronRight :size="32" />
    </button>
  </div>
</div>
      <div class="cards--1-wide" :class="{ 'cards--expanded': expandedSections.has(section.id) }" :id="section.id">
        <EventCard
          v-for="card in section.cards"
          :key="card.event.id"
          :card="card"
          :is-admin="isAdmin"
          @click="openStream(card.event)"
          @adjust-viewers="(delta: number) => adjustViewerCount(String(card.event.id), delta)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import {
  useWorkerSync,
  sectionForEvent,
  formatDiff,
  type SectionId,
  type CardState,
  type StreamEvent,
  type SectionsMap,
} from '~/composables/useWorkerSync'
import { useAuth } from '~/composables/useAuth'
import { useCardScroll } from '~/composables/useCardScroll'

// ─── Auth ───────────────────────────────────────────────────────────────────
const { user } = useAuth()
const isAdmin = computed(() =>
  !!user.value?.user_metadata?.is_admin || user.value?.app_metadata?.role === 'admin'
)

// ─── SSR prefetch — данные доступны сразу при первом рендере ────────────────
const { data: prefetchedEvents } = await useAsyncData('streams', async () => {
  const res = await fetch('/api/streams-sync')
  if (!res.ok) return []
  const json = await res.json()
  const rawEvents = json?.events ?? json?.data ?? []
  const now = Date.now() / 1000
  return rawEvents.map((ev: any) => ({
    ...ev,
    category: ev.category || ev.category_name,
    iframe_url: ev.iframe_url ?? ev.iframe,
    is_live: !!ev.always_live || (now >= ev.starts_at && now < ev.ends_at),
  })) as StreamEvent[]
}, { default: () => [] as StreamEvent[] })
// TEMP DEBUG
console.log('[index] prefetched events:', prefetchedEvents.value?.length ?? 'null')
// ─── Worker sync ────────────────────────────────────────────────────────────
const { sections, adjustViewerCount } = useWorkerSync(prefetchedEvents.value ?? [])
const { refresh: refreshScroll } = useCardScroll()

// ─── Live section ───────────────────────────────────────────────────────────
const liveSection = computed<CardState[]>(() => sections.value.liveCards ?? [])

// ─── Sport sections ─────────────────────────────────────────────────────────
interface SportSection {
  id: SectionId
  label: string
  cards: CardState[]
}

const SPORT_SECTION_DEFS: Array<{ id: SectionId; label: string }> = [
  { id: 'footballCards',         label: '⚽ Football'          },
  { id: 'basketballCards',       label: '🏀 Basketball'       },
  { id: 'hockeyCards',           label: '🏒 Hockey'            },
  { id: 'combatCards',           label: '🥊 Combat Sports'     },
  { id: 'wrestlingCards',        label: '🤼 Wrestling'         },
  { id: 'motorsportCards',       label: '🏎️ Motorsport'        },
  { id: 'dartsCards',            label: '🎯 Darts'             },
  { id: 'americanFootballCards', label: '🏈 American Football' },
  { id: 'baseballCards',         label: '⚾ Baseball'          },
  { id: 'rugbyCards',            label: '🏉 Rugby'             },
  { id: 'streams247Cards',       label: '📡 24/7 Streams'      },
]

const sportSections = computed<SportSection[]>(() =>
  SPORT_SECTION_DEFS.map(s => ({
    id: s.id,
    label: s.label,
    cards: sections.value[s.id] ?? [],
  }))
)

// ─── Pinned ──────────────────────────────────────────────────────────────────
const pinnedIds = ref<Set<number>>(new Set())

function loadPinned() {
  if (import.meta.client) {
    const stored = localStorage.getItem('fz:pinned')
    pinnedIds.value = new Set(stored ? JSON.parse(stored) : [])
  }
}

function onPinnedChange() { loadPinned() }

onMounted(() => {
  loadPinned()
  window.addEventListener('fz:pinned-changed', onPinnedChange)
})

onUnmounted(() => {
  window.removeEventListener('fz:pinned-changed', onPinnedChange)
})

const pinnedCards = computed<CardState[]>(() => {
  const seen = new Set<number>()
  const allCards = [
    ...liveSection.value,
    ...sportSections.value.flatMap(s => s.cards),
  ]
  return allCards.filter(c => {
    if (!pinnedIds.value.has(c.event.id)) return false
    if (seen.has(c.event.id)) return false
    seen.add(c.event.id)
    return true
  })
})

// ─── Open stream page ────────────────────────────────────────────────────────
function openStream(event: StreamEvent) {
  navigateTo(`/stream/${event.id}`)
}
// ─── Jump to Section ─────────────────────────────────────────────────────────
const jumpSections = computed(() =>
  sportSections.value
    .filter(s => s.cards.length > 0)
    .map(s => ({ id: s.id, label: s.label, count: s.cards.length }))
)

function scrollTo(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  const y = el.getBoundingClientRect().top + window.scrollY - 120
  window.scrollTo({ top: y, behavior: 'smooth' })
}

const expandedSections = ref(new Set<string>([
  'liveCards',
  ...SPORT_SECTION_DEFS.map(s => s.id),
]))

function toggleExpand(id: string) {
  if (expandedSections.value.has(id)) {
    expandedSections.value.delete(id)
  } else {
    expandedSections.value.add(id)
  }
  
  expandedSections.value = new Set(expandedSections.value)
}

</script>