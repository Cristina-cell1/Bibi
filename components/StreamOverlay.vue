<template>
  <div id="streamOverlay" ref="overlayRef" class="stream-overlay">

    <!-- HEADER -->
    <div class="stream-overlay__header">
      <button class="stream-overlay__back" type="button" @click="$emit('close')">
        ← Back
      </button>
      <span class="stream-overlay__title">{{ title }}</span>
    </div>

    <!-- STREAM PLAYER -->
    <div class="stream-player-box" ref="playerBoxRef">
      <slot name="player" />
      <button id="btnVideoFullscreen" class="btn-fullscreen" type="button" @click="requestFullscreen">
        ⛶
      </button>
    </div>

    <!-- DRAG HANDLE (mobile only) -->
    <div id="chatDragHandle" ref="handleRef" class="chat-drag-handle">
      <span class="chat-drag-handle__bar"></span>
    </div>

    <!-- CHAT SLOT -->
    <div class="stream-chat">
      <slot name="chat" />
    </div>

  </div>
</template>

<script setup lang="ts">
const { init: initSplitter } = useChatSplitter()

const props = defineProps<{ title?: string }>()
defineEmits<{ close: [] }>()

const overlayRef = ref<HTMLElement | null>(null)
const playerBoxRef = ref<HTMLElement | null>(null)
const handleRef = ref<HTMLElement | null>(null)

// ===== FULLSCREEN =====
async function requestFullscreen() {
  const box = playerBoxRef.value
  if (!box) return
  try {
    if (box.requestFullscreen) await box.requestFullscreen()
    else if ((box as any).webkitRequestFullscreen) (box as any).webkitRequestFullscreen()
  } catch {}
}

// ===== SPLITTER =====
onMounted(() => {
  const overlay = overlayRef.value
  const handle = handleRef.value
  if (overlay && handle) {
    initSplitter(overlay, handle)
  }
})
</script>