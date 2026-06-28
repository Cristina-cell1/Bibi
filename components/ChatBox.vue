<template>
  <div class="chat-wrap">
    <!-- MESSAGES -->
    <div id="chatBody" ref="chatBodyRef" class="chat-body">
 
      <!-- system welcome — guest -->
      <div class="chat-msg chat-msg--system" v-if="!isEnabled">
        <div class="chat-msg__meta">
          <span class="chat-msg__name">
            <svg class="chat-sys-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z"/></svg>
            SYSTEM
          </span>
        </div>
        <div class="chat-msg__text">Welcome to BIBILIVE chat. Please login to interact with other viewers.</div>
      </div>

      <!-- system welcome — logged in -->
      <div class="chat-msg chat-msg--system" v-else>
        <div class="chat-msg__meta">
          <span class="chat-msg__name">
            <svg class="chat-sys-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z"/></svg>
            SYSTEM
          </span>
        </div>
        <div class="chat-msg__text">Enjoy! Join our <a class="chat-sys-link" style="color: #5865F2;" href="https://discord.gg/bTaKQYm4mg" target="_blank" rel="noopener noreferrer">Discord</a>.</div>
      </div>
 
      <!-- messages -->
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="chat-msg"
        :class="{
          'chat-msg--system': msg.is_system,
          'chat-msg--elite': msg.is_elite,
        }"
        :data-id="msg.id"
      >
        <div class="chat-msg__meta">
          <span
            class="chat-msg__name"
            :class="{
              'chat-msg__name--admin': msg.admin_name,
              'chat-msg__name--elite': msg.is_elite && !msg.admin_name,
            }"
            :style="{ color: msg.is_system ? '#a855f7' : getNameColor(msg) }"
          >
            {{ msg.is_system ? '🛠 SYSTEM' : (msg.username || 'User') }}
          </span>
          <span class="chat-msg__time">{{ formatTime(msg.created_at) }}</span>
        </div>
        <div class="chat-msg__text">{{ msg.content }}</div>
 
        <!-- admin delete button -->
        <button
          v-if="isAdmin && !msg.is_system"
          class="chat-admin-delete"
          @click="handleDelete(msg.id)"
        >
          Delete
        </button>
      </div>
    </div>
 
    <!-- INPUT -->
    <form id="chatForm" class="chat-form" @submit.prevent="handleSend">
      <div class="chat-form__pill">
        <input
          id="chatMessage"
          v-model="inputText"
          class="chat-input"
          :disabled="!isEnabled"
          :placeholder="isEnabled ? 'Type a message…' : 'Register to get in contact with people'"
          maxlength="300"
          autocomplete="off"
        />
        <button type="button" class="chat-emoji-btn" :disabled="!isEnabled" aria-label="Emoji">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-smile-icon lucide-smile"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/></svg>
        </button>
      </div>
      <button id="chatSend" type="submit" :disabled="!isEnabled" aria-label="Send">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-send-icon lucide-send"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/></svg>
      </button>
    </form>
  </div>
</template>
 
<script setup lang="ts">
const props = defineProps<{
  isAdmin?: boolean
  adminAlias?: string
}>()
 
const { messages, isEnabled, getNameColor, init, sendMessage, deleteMessage, switchRoom, stopRealtime } = useChat()
 
const chatBodyRef = ref<HTMLElement | null>(null)
const inputText = ref("")
 
function formatTime(isoString?: string): string {
  if (!isoString) return ""
  return new Date(isoString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}
 
function isNearBottom(): boolean {
  const el = chatBodyRef.value
  if (!el) return true
  return (el.scrollHeight - el.scrollTop - el.clientHeight) < 120
}
 
function scrollToBottom() {
  const el = chatBodyRef.value
  if (el) el.scrollTop = el.scrollHeight
}
 
async function handleSend() {
  if (!inputText.value.trim()) return
  try {
    await sendMessage(inputText.value, props.isAdmin, props.adminAlias || "")
    inputText.value = ""
  } catch (err: any) {
    alert(err?.message || "Failed to send message")
  }
}
 
async function handleDelete(id: string | number | undefined) {
  if (!id) return
  try {
    await deleteMessage(id)
  } catch (err: any) {
    alert(err?.message || "Failed to delete message")
  }
}
 
// auto-scroll when new messages arrive
watch(messages, async () => {
  await nextTick()
  if (isNearBottom()) scrollToBottom()
}, { deep: true })
 
onMounted(async () => {
  await init()
  scrollToBottom()
 
  // fz overlay events (если используешь)
  window.addEventListener("fz:overlay-open", init)
  window.addEventListener("fz:overlay-close", stopRealtime)
})
 
onUnmounted(() => {
  stopRealtime()
  window.removeEventListener("fz:overlay-open", init)
  window.removeEventListener("fz:overlay-close", stopRealtime)
})
 
// expose switchRoom so parent can call it
defineExpose({ switchRoom })
</script>