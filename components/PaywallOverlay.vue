<template>
  <Teleport to="body">
    <div v-if="isVisible" class="fz-paywall is-visible" role="dialog" aria-modal="true">
      <div class="fz-paywall__card" :class="{ 'is-error': isError }">

        <!-- Lock icon -->
        <div class="fz-paywall__lock" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="42" height="42">
            <path d="M7 10V8a5 5 0 0 1 10 0v2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
            <rect x="5.5" y="10" width="13" height="10" rx="2.2" fill="none" stroke="currentColor" stroke-width="2.4" />
            <path d="M12 14v2.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
          </svg>
        </div>

        <h3 class="fz-paywall__title">ENTER ACCESS CODE</h3>

        <p class="fz-paywall__text">
          Get code via
          <a class="fz-paywall__discord-link" href="https://discord.gg/Q356he4WUu" target="_blank" rel="noopener noreferrer">
            Discord
          </a>.
        </p>

        <form class="fz-code-form" autocomplete="off" @submit.prevent="handleSubmit">
          <input
            ref="inputRef"
            v-model="inputCode"
            class="fz-code-input"
            type="text"
            inputmode="numeric"
            maxlength="6"
            placeholder="000000"
            aria-label="Access code"
            @input="onInput"
          />

          <button class="fz-paywall__btn fz-paywall__btn--primary" type="submit">
            Unlock stream
          </button>
        </form>

        <p v-if="isError" class="fz-paywall__hint is-visible">
          Wrong code. Try again.
        </p>

      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
const { isVisible, showForEvent, submitCode, listenToAuthChanges } = usePaywall()

const inputCode = ref("")
const isError = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

function onInput() {
  inputCode.value = inputCode.value.replace(/\D/g, "").slice(0, 6)
  isError.value = false
}

async function handleSubmit() {
  const { success } = await submitCode(inputCode.value)

  if (!success) {
    isError.value = true
    await nextTick()
    // сбрасываем анимацию shake
    isError.value = false
    await nextTick()
    isError.value = true
    inputRef.value?.focus()
    inputRef.value?.select()
  }
}

// фокус на инпут когда пейволл появляется
watch(isVisible, async (val) => {
  if (val) {
    await nextTick()
    setTimeout(() => inputRef.value?.focus(), 80)
  }
})

onMounted(() => {
  listenToAuthChanges()
})

// позволяет вызвать showForEvent из родителя
defineExpose({ showForEvent })
</script>