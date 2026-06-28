<template>
  <div
    v-if="isOpen"
    id="authModal"
    class="auth-modal"
    :aria-hidden="!isOpen"
    @keydown.esc="close"
    @click.self="close"
  >
    <!-- LOGIN CARD -->
    <div v-if="activeCard === 'login'" id="authLoginCard" class="auth-card">
      <button class="auth-close" data-auth-close @click="close">✕</button>
      <h2>Login</h2>
 
      <form id="loginForm" @submit.prevent="handleLogin">
        <input id="loginEmail" v-model="loginEmail" type="email" placeholder="Email" />
        <input id="loginPassword" v-model="loginPassword" type="password" placeholder="Password" />
        <div v-if="loginMsg" class="auth-msg" :class="{ error: loginError }">{{ loginMsg }}</div>
        <button type="submit" :disabled="loginLoading">
          {{ loginLoading ? "Logging in..." : "Login" }}
        </button>
      </form>
 
      <button class="auth-oauth-btn auth-oauth-btn--discord" @click="handleDiscord">
        Login with Discord
      </button>
 
      <p>
        No account?
        <a href="#" @click.prevent="activeCard = 'register'">Sign up</a>
      </p>
    </div>
 
    <!-- REGISTER CARD -->
    <div v-if="activeCard === 'register'" id="authRegisterCard" class="auth-card">
      <button class="auth-close" data-auth-close @click="close">✕</button>
      <h2>Sign up</h2>
 
      <form id="registerForm" @submit.prevent="handleRegister">
        <input
          id="regUsername"
          v-model="regUsername"
          type="text"
          placeholder="Username"
          :maxlength="USERNAME_MAX_LEN"
        />
        <input id="regEmail" v-model="regEmail" type="email" placeholder="Email" />
        <input id="regPassword" v-model="regPassword" type="password" placeholder="Password" />
        <input id="regPassword2" v-model="regPassword2" type="password" placeholder="Repeat password" />
        <div v-if="regMsg" class="auth-msg" :class="{ error: regError }">{{ regMsg }}</div>
        <button type="submit" :disabled="regLoading">
          {{ regLoading ? "Registering..." : "Register" }}
        </button>
      </form>
 
      <button class="auth-oauth-btn auth-oauth-btn--discord" @click="handleDiscord">
        Register with Discord
      </button>
 
      <p>
        Already have an account?
        <a id="btnBackToLogin" href="#" @click.prevent="activeCard = 'login'">Login</a>
      </p>
    </div>
  </div>
</template>
 
<script setup lang="ts">
const { signIn, signUp, signInWithDiscord, USERNAME_MAX_LEN } = useAuth();
 
const isOpen = ref(false);
const activeCard = ref<"login" | "register">("login");
 
// Login state
const loginEmail = ref("");
const loginPassword = ref("");
const loginMsg = ref("");
const loginError = ref(false);
const loginLoading = ref(false);
 
// Register state
const regUsername = ref("");
const regEmail = ref("");
const regPassword = ref("");
const regPassword2 = ref("");
const regMsg = ref("");
const regError = ref(false);
const regLoading = ref(false);
 
function open(mode: "login" | "register" = "login") {
  activeCard.value = mode;
  isOpen.value = true;
}
 
function close() {
  isOpen.value = false;
}
 
async function handleLogin() {
  loginMsg.value = "";
  if (!loginEmail.value || !loginPassword.value) {
    loginMsg.value = "Enter email and password.";
    loginError.value = true;
    return;
  }
  loginLoading.value = true;
  try {
    await signIn(loginEmail.value, loginPassword.value);
    loginMsg.value = "Logged in.";
    loginError.value = false;
    close();
  } catch (err: any) {
    loginMsg.value = err?.message || "Login failed.";
    loginError.value = true;
  } finally {
    loginLoading.value = false;
  }
}
 
async function handleRegister() {
  regMsg.value = "";
  const username = regUsername.value.trim();
 
  if (!username) { regMsg.value = "Enter a username."; regError.value = true; return; }
  if (username.length > USERNAME_MAX_LEN) { regMsg.value = `Max ${USERNAME_MAX_LEN} characters.`; regError.value = true; return; }
  if (!regEmail.value) { regMsg.value = "Enter an email."; regError.value = true; return; }
  if (!regPassword.value) { regMsg.value = "Enter a password."; regError.value = true; return; }
  if (regPassword.value.length < 6) { regMsg.value = "Password min 6 characters."; regError.value = true; return; }
  if (regPassword.value !== regPassword2.value) { regMsg.value = "Passwords do not match."; regError.value = true; return; }
 
  regLoading.value = true;
  try {
    await signUp(regEmail.value, regPassword.value, username);
    regMsg.value = "Registered. You can sign in now.";
    regError.value = false;
    activeCard.value = "login";
    loginEmail.value = regEmail.value;
  } catch (err: any) {
    regMsg.value = err?.message || "Register failed.";
    regError.value = true;
  } finally {
    regLoading.value = false;
  }
}
 
async function handleDiscord() {
  await signInWithDiscord();
}
 
// expose open/close so parent can call them
defineExpose({ open, close });
</script>
 