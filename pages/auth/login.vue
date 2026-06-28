<template>
  <div class="auth-page">
    <div class="auth-modal__dialog">
      <NuxtLink to="/" class="auth-modal__close" aria-label="Close">×</NuxtLink>

      <div class="auth-card">
        <div class="auth-card__head">
          <h2 class="auth-card__title">Welcome back!</h2>
          <div class="auth-card__sub">Sign in to your account</div>
        </div>
        <div class="auth-card__body">
          <div v-if="error" class="auth-note" style="color:#ff6b6b; margin-bottom:8px;">{{ error }}</div>
          <form @submit.prevent="handleLogin" autocomplete="on">

            <div class="auth-field">
              <label class="auth-label" for="loginEmail">Email</label>
              <div class="auth-input">
                <span class="input-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/><rect x="2" y="4" width="20" height="16" rx="2"/></svg>
                </span>
                <input
                  id="loginEmail"
                  v-model="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  autocomplete="email"
                  required
                />
              </div>
            </div>

            <div class="auth-field">
              <label class="auth-label" for="loginPassword">Password</label>
              <div class="auth-input">
                <input
                  id="loginPassword"
                  v-model="password"
                  name="password"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="••••••••"
                  autocomplete="current-password"
                  required
                />
                <button type="button" class="eye-btn" @click="showPassword = !showPassword" tabindex="-1">
                  <svg v-if="showPassword" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-.722-3.25"/><path d="M2 8a10.645 10.645 0 0 0 20 0"/><path d="m20 15-1.726-2.05"/><path d="m4 15 1.726-2.05"/><path d="m9 18 .722-3.25"/></svg>
                </button>
              </div>
            </div>

            <button class="auth-primary" type="submit" :disabled="loading">
              {{ loading ? 'Signing in…' : 'Sign in' }}
            </button>
          </form>
          <div class="auth-divider"><span>or login with</span></div>
          <div class="auth-oauth">
            <button type="button" class="auth-oauth__btn auth-oauth__btn--discord" @click="handleDiscord">
              <span class="oauth-ic"><img src="/discord.png" alt="" width="18" height="18" /></span>
              <span class="oauth-text">Discord</span>
            </button>
          </div>
          <div class="auth-foot">
            <span>Don't have an account?</span>
          <NuxtLink class="auth-link" to="/auth/register">Register</NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { signIn, signInWithDiscord, isLoggedIn } = useAuth()

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const showPassword = ref(false)

watchEffect(() => {
  if (isLoggedIn.value) navigateTo('/')
})

async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    await signIn(email.value, password.value)
    navigateTo('/')
  } catch (e: any) {
    error.value = e?.message || 'Login failed'
  } finally {
    loading.value = false
  }
}

async function handleDiscord() {
  await signInWithDiscord()
}
</script>

<style scoped>
* { font-family: 'Mozilla Text', sans-serif; }

.auth-page {
  flex: 1;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 2vh 16px 16px;
}

.auth-modal__dialog {
  position: relative;
  width: 100%;
  max-width: 340px;
  border-radius: 16px;
  border: 1px solid rgba(245,168,0,.30);
  background: rgba(26,26,26,.95);
  box-shadow: 0 28px 90px rgba(0,0,0,.65);
  overflow: hidden;
}

.auth-modal__close {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,.18);
  background: rgba(0,0,0,.25);
  color: rgba(234,240,255,.9);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
}
.auth-modal__close:hover { background: rgba(255,255,255,.08); }

.auth-card__head {
  padding: 18px 20px 12px;
  text-align: center;
  border-bottom: 1px solid rgba(255,255,255,.08);
}
.auth-card__title { margin: 0; font-size: 20px; font-weight: 800; color: var(--text); }
.auth-card__sub { margin-top: 4px; font-size: 12px; color: var(--muted); }
.auth-card__body { padding: 14px 20px 18px; }

.auth-field { margin-top: 10px; }
.auth-label {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: rgba(234,240,255,.85);
  margin-bottom: 4px;
}

.auth-input {
  position: relative;
  width: 100%;
}

.input-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: rgba(255,255,255,.4);
  display: flex;
  align-items: center;
  pointer-events: none;
}

.auth-input input {
  width: 100%;
  height: 36px;
  padding: 0 36px 0 32px;
  border-radius: 8px;
  border: 1px solid rgba(245,168,0,.25);
  background: #252525;
  color: #fff;
  outline: none;
  font-family: 'Mozilla Text', sans-serif;
  font-size: 13px;
  min-width: 0;
}
.auth-input input::placeholder { color: rgba(255,255,255,.35); }
.auth-input input:focus { border-color: rgba(245,168,0,.65); background: #2a2a2a; }

.eye-btn {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  color: rgba(255,255,255,.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  line-height: 1;
  transition: color .15s ease;
}
.eye-btn:hover { color: rgba(255,255,255,.85); }

.auth-primary {
  width: 100%;
  height: 36px;
  margin-top: 12px;
  border: 0;
  border-radius: 10px;
  cursor: pointer;
  background: rgba(245,168,0,.88);
  color: var(--text);
  font-weight: 800;
  font-family: 'Mozilla Text', sans-serif;
  font-size: 13px;
  transition: background .2s ease, transform .05s ease;
}
.auth-primary:hover { background: rgba(255,208,0,.95); }
.auth-primary:active { transform: translateY(1px); }

.auth-divider {
  position: relative;
  margin: 12px 0 10px;
  text-align: center;
}
.auth-divider::before {
  content: "";
  position: absolute;
  left: 0; right: 0; top: 50%;
  height: 1px;
  background: rgba(255,255,255,.10);
}
.auth-divider span {
  position: relative;
  padding: 0 10px;
  font-size: 11px;
  color: rgba(234,240,255,.55);
  background: rgba(26,26,26,.95);
}

.auth-oauth { display: grid; grid-template-columns: 1fr; gap: 8px; }
.auth-oauth__btn {
  height: 36px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,.14);
  color: #fff;
  font-weight: 800;
  font-size: 13px;
  font-family: 'Mozilla Text', sans-serif;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.auth-oauth__btn--discord {
  background: rgba(88,101,242,.35);
  border-color: rgba(88,101,242,.65);
}
.auth-oauth__btn--discord:hover { background: rgba(88,101,242,.5); }

.oauth-ic img {
  width: 18px;
  height: 18px;
  display: block;
  object-fit: contain;
}

.auth-foot {
  margin-top: 12px;
  display: flex;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(234,240,255,.6);
  flex-wrap: wrap;
}
.auth-link { color: var(--red-hover); text-decoration: none; font-weight: 700; }
.auth-link:hover { text-decoration: underline; }

.auth-note {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(0,0,0,.22);
  color: rgba(234,240,255,.75);
  font-size: 12px;
}
</style>