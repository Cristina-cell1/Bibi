<template>
  <div>
    <!-- LIVE SECTION -->
    <div v-if="liveCards.length > 0" class="cards-wrap live-cards-wrap">
      <button class="cards-arrow cards-arrow--left" :class="{ 'is-hidden': !canScrollLeft }" @click="scrollLeft">◀</button>
      <button class="cards-arrow cards-arrow--right" :class="{ 'is-hidden': !canScrollRight }" @click="scrollRight">▶</button>

      <div ref="liveTrackRef" class="cards--1-wide" :class="{ 'has-left-fade': canScrollLeft, 'has-right-fade': canScrollRight }" @scroll="updateArrows">
        <div
          v-for="card in liveCards"
          :key="card.id"
          class="card"
          :data-event-id="card.eventId"
          :data-event="card.event"
          :data-id="card.id"
        >
          <slot name="card" :card="card">
            <!-- default card content -->
            <div class="card__date">{{ card.dateLabel }}</div>
            <div class="card__title">{{ card.title }}</div>
            <div class="card__timer">
              <span class="liveDotSmall"></span>
              <span v-if="card.viewerCount !== undefined" class="live-num">
                {{ card.viewerCount.toLocaleString() }}
              </span>
            </div>
          </slot>
        </div>
      </div>
    </div>

    <!-- NO LIVE placeholder -->
    <div v-else id="noLiveBox" class="no-live-box">
      No events live right now.
    </div>

    <!-- ALL CARDS (sorted, with countdowns) -->
    <div class="section" v-for="(group, idx) in groupedCards" :key="idx">
      <div class="cards-wrap">
        <div class="cards--1-wide">
          <div
            v-for="card in group.cards"
            :key="card.id"
            class="card"
            :data-event-id="card.eventId"
            :data-event="card.event"
            :data-start="card.startIso"
            :data-ends-at="card.endsAt"
          >
            <slot name="card" :card="card">
              <div class="card__date" :style="card.event?.includes('streams247') ? 'display:none' : ''">
                {{ card.dateLabel }}
              </div>
              <div class="card__title">{{ card.title }}</div>
              <div class="card__timer" :class="{ 'is-live': card.isLive }">
                <template v-if="card.isLive">
                  <span class="liveDotSmall"></span>
                  <span v-if="card.viewerCount !== undefined" class="live-num">
                    {{ card.viewerCount.toLocaleString() }}
                  </span>
                </template>
                <template v-else>
                  {{ card.countdown }}
                </template>
              </div>
            </slot>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { EventCard } from "~/composables/useEventCards"

const props = defineProps<{
  initialCards: EventCard[]
}>()

const { cards, liveCards, init, startTick, stopTick } = useEventCards()

// ===== SCROLL ARROWS =====
const liveTrackRef = ref<HTMLElement | null>(null)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)
const SCROLL_STEP = 326
const EPS = 2

function updateArrows() {
  const track = liveTrackRef.value
  if (!track) return
  const max = Math.max(0, track.scrollWidth - track.clientWidth)
  canScrollLeft.value = track.scrollLeft > EPS
  canScrollRight.value = track.scrollLeft < max - EPS
}

function scrollLeft() {
  liveTrackRef.value?.scrollBy({ left: -SCROLL_STEP, behavior: "smooth" })
}
function scrollRight() {
  liveTrackRef.value?.scrollBy({ left: SCROLL_STEP, behavior: "smooth" })
}

// ===== GROUP CARDS BY SECTION =====
// Simple grouping: all cards in one group. Extend if you have multiple sections.
const groupedCards = computed(() => [
  { title: "Upcoming", cards: cards.value }
])

// ===== LIFECYCLE =====

onMounted(async () => {
  await init(props.initialCards)
  await nextTick()
  updateArrows()
  window.addEventListener("resize", updateArrows)
  window.addEventListener("fz:streams-synced", updateArrows)
  window.addEventListener("fz:overlay-open", stopTick)
  window.addEventListener("fz:overlay-close", startTick)

  // pause on hidden tab
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopTick()
    else startTick()
  })
})

onUnmounted(() => {
  stopTick()
  window.removeEventListener("resize", updateArrows)
  window.removeEventListener("fz:streams-synced", updateArrows)
  window.removeEventListener("fz:overlay-open", stopTick)
  window.removeEventListener("fz:overlay-close", startTick)
})
</script>