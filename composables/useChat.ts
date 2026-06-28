const CHAT_TABLE = "chat_messages";
const CHAT_POLL_MS = 30000;
const USE_CHAT_REALTIME = true;
const ROOM_KEY = "fz_chat_room";

const NAME_COLORS = [
  "#FF0000", "#005BFF", "#00FF00", "#FFD700", "#FF00FF",
  "#7A00FF", "#FF7A00", "#00FFFF", "#B6FF00", "#001AFF",
];

const CUSTOM_NAME_COLORS: Record<string, string> = {
  uderp: "#FF0000",
  zorokyd: "#00FF00",
  t4yl: "#FF7A00",
  sami: "#7A00FF",
};

export interface ChatMessage {
  id: string | number;
  created_at?: string;
  user_id?: string;
  username?: string;
  content?: string;
  room?: string;
  is_elite?: boolean;
  admin_name?: boolean;
  is_system?: boolean;
}

export function useChat() {
  const { $sb } = useNuxtApp();
  const { user } = useAuth();

  const messages = useState<ChatMessage[]>("chat_messages", () => []);
  const activeRoom = useState<string>("chat_room", () => "global");
  const isEnabled = useState<boolean>("chat_enabled", () => false);
  const seenIds = useState<Set<string | number>>("chat_seen_ids", () => new Set());

  let realtimeChannel: any = null;
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  // ===== HELPERS =====

  function hashStringToInt(str: string): number {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }

  function getNameColor(msg: ChatMessage): string {
    const name = (msg.username || "").toLowerCase();
    if (CUSTOM_NAME_COLORS[name]) return CUSTOM_NAME_COLORS[name];
    const key = msg.user_id || msg.username || "";
    const idx = hashStringToInt(key) % NAME_COLORS.length;
    return NAME_COLORS[idx];
  }

  function normalizeRoom(roomId: string): string {
    const r = String(roomId || "").trim();
    return r || "global";
  }

  // токен текущей сессии для server/api вызовов
  async function getToken(): Promise<string | null> {
    const { data } = await $sb.auth.getSession();
    return data?.session?.access_token ?? null;
  }

  // ===== MESSAGES =====

  async function loadRecent() {
    try {
      const res = await $fetch<{ ok: boolean; messages: ChatMessage[] }>(
        "/api/chat/messages",
        { query: { room: activeRoom.value } }
      );

      const rows = (res?.messages || []) as ChatMessage[];

      seenIds.value.clear();
      for (const msg of rows) {
        if (msg?.id) seenIds.value.add(msg.id);
      }

      messages.value = rows;
    } catch (err) {
      console.error("[Chat] load error:", err);
    }
  }

  async function sendMessage(text: string, isAdmin = false, adminAlias = "") {
    const content = text.trim();
    if (!content) return;

    const token = await getToken();
    if (!token) {
      isEnabled.value = false;
      throw new Error("Not authenticated — please log in again");
    }

    try {
      // сервер сам проставит username / is_elite / admin_name по токену и профилю
      await $fetch("/api/chat/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: {
          text: content,
          room: activeRoom.value,
          isAdmin,
          adminAlias,
        },
      });
      // вставку в messages делает realtime INSERT — здесь ничего не пушим
    } catch (err: any) {
      console.error("[Chat] send error:", err);
      throw new Error(err?.data?.statusMessage || err?.message || "Send failed");
    }
  }

  async function deleteMessage(messageId: string | number) {
    const token = await getToken();
    if (!token) throw new Error("Not authenticated");

    try {
      await $fetch("/api/chat/delete", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: { messageId },
      });
    } catch (err: any) {
      console.error("[Chat] delete error:", err);
      throw new Error(err?.data?.statusMessage || err?.message || "Delete failed");
    }

    // оптимистично убираем локально (realtime DELETE подтвердит)
    messages.value = messages.value.filter((m) => m.id !== messageId);
    seenIds.value.delete(messageId);
  }

  // ===== REALTIME =====

  async function startRealtime() {
    if (realtimeChannel) {
      try { await $sb.removeChannel(realtimeChannel); } catch (_e) {}
      realtimeChannel = null;
    }

    realtimeChannel = $sb.channel("fightzone-chat-" + activeRoom.value);

    // NEW MESSAGES
    realtimeChannel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: CHAT_TABLE, filter: `room=eq.${activeRoom.value}` },
      (payload: any) => {
        const msg = payload?.new as ChatMessage;
        if (!msg?.id) return;
        if (seenIds.value.has(msg.id)) return;

        seenIds.value.add(msg.id);
        messages.value.push(msg);

        // max 60 messages
        if (messages.value.length > 60) {
          const removed = messages.value.shift();
          if (removed?.id) seenIds.value.delete(removed.id);
        }
      }
    );

    // DELETED MESSAGES
    realtimeChannel.on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: CHAT_TABLE },
      (payload: any) => {
        const deletedId = payload?.old?.id;
        if (!deletedId) return;
        messages.value = messages.value.filter((m) => m.id !== deletedId);
        seenIds.value.delete(deletedId);
      }
    );

    realtimeChannel.subscribe((status: string) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn("[Chat] realtime status:", status);
        setTimeout(() => startRealtime(), 1500);
      }
    });
  }

  async function stopRealtime() {
    if (realtimeChannel && $sb) {
      try { await $sb.removeChannel(realtimeChannel); } catch (_e) {}
      realtimeChannel = null;
    }
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  // ===== ROOM =====

  async function switchRoom(roomId: string) {
    activeRoom.value = normalizeRoom(roomId);
    if (import.meta.client) {
      try { localStorage.setItem(ROOM_KEY, activeRoom.value); } catch (_e) {}
    }

    await loadRecent();
    await stopRealtime();

    if (USE_CHAT_REALTIME) {
      await startRealtime();
    } else {
      pollInterval = setInterval(() => loadRecent(), CHAT_POLL_MS);
    }
  }

  // ===== INIT =====

  async function init() {
    if (import.meta.client) {
      try {
        const saved = localStorage.getItem(ROOM_KEY);
        if (saved) activeRoom.value = normalizeRoom(saved);
      } catch (_e) {}
    }

    const { data } = await $sb.auth.getSession();
    isEnabled.value = !!data?.session;

    $sb.auth.onAuthStateChange((_event: any, session: any) => {
      isEnabled.value = !!session;
    });

    await loadRecent();

    if (USE_CHAT_REALTIME) {
      await startRealtime();
    } else {
      pollInterval = setInterval(() => loadRecent(), CHAT_POLL_MS);
    }
  }

  return {
    messages,
    activeRoom,
    isEnabled,
    getNameColor,
    init,
    loadRecent,
    sendMessage,
    deleteMessage,
    switchRoom,
    startRealtime,
    stopRealtime,
  };
}