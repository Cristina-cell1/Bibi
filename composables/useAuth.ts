const USERNAME_MAX_LEN = 12

function getNicknameFromUser(user: any): string {
  const meta = user?.user_metadata || {}
  let nick = (meta.custom_claims?.global_name || "").trim()
  if (!nick) nick = (meta.global_name || "").trim()
  if (!nick) nick = (meta.full_name || "").trim()
  if (!nick) nick = (meta.name || "").trim()
  if (!nick) nick = "Account"
  return nick.slice(0, USERNAME_MAX_LEN)
}

export function useAuth() {
  const { $sb } = useNuxtApp()

  const user = useState<any>("auth_user", () => null)
  const profile = useState<any>("auth_profile", () => null)

  async function fetchProfile() {
    try {
      const { data: { session } } = await $sb.auth.getSession()
      if (!session?.access_token) return
      const data = await $fetch("/api/profile", {
        headers: { authorization: `Bearer ${session.access_token}` }
      })
      profile.value = data
    } catch {
      profile.value = null
    }
  }

  async function fetchUser() {
    try {
      const { data, error } = await $sb.auth.getUser()
      if (error) throw error
      user.value = data.user ?? null
      if (user.value) await fetchProfile()
    } catch {
      user.value = null
      profile.value = null
    }
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await $sb.auth.signInWithPassword({ email, password })
    if (error) throw error
    user.value = data.user ?? data.session?.user ?? null
    if (user.value) await fetchProfile()
    return data
  }

  async function signUp(email: string, password: string, username: string) {
    const { data, error } = await $sb.auth.signUp({
      email,
      password,
      options: { data: { username } },
    })
    if (error) throw error
    return data
  }

  async function signOut() {
    const { error } = await $sb.auth.signOut()
    if (error) throw error
    user.value = null
    profile.value = null
  }

  async function signInWithDiscord() {
    await $sb.auth.signInWithOAuth({
      provider: "discord",
      options: { redirectTo: window.location.origin },
    })
  }

  function listenToAuthChanges() {
    $sb.auth.onAuthStateChange(async (_event: any, session: any) => {
      user.value = session?.user ?? null
      if (user.value) await fetchProfile()
      else profile.value = null
    })
  }

  const nickname = computed(() =>
    profile.value?.username || (user.value ? getNicknameFromUser(user.value) : null)
  )

  const isLoggedIn = computed(() => !!user.value)
  const isAdmin = computed(() => !!profile.value?.is_admin)

  return {
    user,
    profile,
    nickname,
    isLoggedIn,
    isAdmin,
    fetchUser,
    fetchProfile,
    signIn,
    signUp,
    signOut,
    signInWithDiscord,
    listenToAuthChanges,
    USERNAME_MAX_LEN,
  }
}