const ACCESS_CODE = "671488"; // <-- поменяй код здесь

export function usePaywall() {
  const { $sb } = useNuxtApp();

  const isVisible = useState<boolean>("paywall_visible", () => false);
  const currentEventId = useState<string>("paywall_event_id", () => "");

  // ===== STORAGE =====

  function getStorageKey(eventId: string): string {
    return `fz_code_unlocked:${String(eventId || "global")}`;
  }

  function isUnlocked(eventId: string): boolean {
    try {
      return localStorage.getItem(getStorageKey(eventId)) === "1";
    } catch {
      return false;
    }
  }

  function setUnlocked(eventId: string): void {
    try {
      localStorage.setItem(getStorageKey(eventId), "1");
    } catch {}
  }

  // ===== ACCESS CHECK =====

  async function checkAccess(eventId: string): Promise<boolean> {
    if (isUnlocked(eventId)) return true;

    try {
      const { data: authData } = await $sb.auth.getUser();
      if (!authData?.user) return false;

      const { data, error } = await $sb.rpc("has_access", {
        p_event_id: eventId,
      });

      if (error) {
        console.warn("[paywall] has_access error:", error);
        return false;
      }

      return !!data;
    } catch (e) {
      console.warn("[paywall] checkAccess failed:", e);
      return false;
    }
  }

  // ===== CODE SUCCESS API =====

  async function recordCorrectCode(codeName = "main_code"): Promise<void> {
    try {
      const { data } = await $sb.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) return;

      const apiBase = (import.meta as any).env?.VITE_FZ_API_BASE || "https://api.fzpv.st";

      const res = await fetch(`${apiBase}/api/code-success`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code_name: codeName }),
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok || result?.ok !== true) {
        console.log("[code-success] failed:", result);
        return;
      }

      console.log("[code-success] recorded:", codeName);
    } catch (err) {
      console.log("[code-success] request error:", err);
    }
  }

  // ===== VERIFY CODE =====

  function verifyCode(inputCode: string): boolean {
    return inputCode.trim() === ACCESS_CODE;
  }

  async function submitCode(inputCode: string): Promise<{ success: boolean }> {
    if (!verifyCode(inputCode)) {
      return { success: false };
    }

    setUnlocked(currentEventId.value);
    await recordCorrectCode("main_code");
    isVisible.value = false;

    return { success: true };
  }

  // ===== REFRESH =====

  async function refresh(): Promise<void> {
    if (!currentEventId.value) return;
    const allowed = await checkAccess(currentEventId.value);
    isVisible.value = !allowed;
  }

  // ===== SHOW FOR EVENT =====

  async function showForEvent(eventId: string): Promise<void> {
    currentEventId.value = String(eventId || "").trim();
    if (!currentEventId.value) {
      console.warn("[paywall] showForEvent called without eventId");
      return;
    }
    await refresh();
  }

  // ===== AUTH LISTENER =====

  function listenToAuthChanges(): void {
    $sb.auth.onAuthStateChange(() => {
      refresh();
    });
  }

  return {
    isVisible,
    currentEventId,
    showForEvent,
    submitCode,
    refresh,
    listenToAuthChanges,
  };
}