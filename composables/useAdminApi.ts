// Admin API calls: iframe override, date override
// Requires authenticated Supabase session

export function useAdminApi() {
  const { $sb } = useNuxtApp()

  const apiBase = (import.meta as any).env?.VITE_FZ_API_BASE || "https://api.fzpv.st"

  async function getToken(): Promise<string> {
    const { data } = await $sb.auth.getSession()
    const token = data?.session?.access_token
    if (!token) throw new Error("Missing auth session")
    return token
  }

  async function apiFetch(path: string, method: string, body: object): Promise<any> {
    const token = await getToken()
    const res = await fetch(`${apiBase}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data?.ok !== true) {
      throw new Error(data?.error || `Request failed: ${path}`)
    }
    return data
  }

  async function saveIframeOverride(eventId: string, iframe: string) {
    if (!eventId) throw new Error("Missing eventId")
    return apiFetch("/api/iframe-override", "POST", { eventId, iframe })
  }

  async function deleteIframeOverride(eventId: string) {
    if (!eventId) throw new Error("Missing eventId")
    return apiFetch("/api/iframe-override", "DELETE", { eventId })
  }

  async function saveDateOverride(eventId: string, date: string) {
    if (!eventId) throw new Error("Missing eventId")
    return apiFetch("/api/date-override", "POST", { eventId, date })
  }

  async function deleteDateOverride(eventId: string) {
    if (!eventId) throw new Error("Missing eventId")
    return apiFetch("/api/date-override", "DELETE", { eventId })
  }

  return {
    saveIframeOverride,
    deleteIframeOverride,
    saveDateOverride,
    deleteDateOverride,
  }
}