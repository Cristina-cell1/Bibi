// server/api/chat/messages.get.ts
// Возвращает последние 60 сообщений комнаты. Service key, без клиентского ключа.

import { getServerSupabase } from "~/server/utils/supabase";

const CHAT_TABLE = "chat_messages";
const MAX_MESSAGES = 60;

export default defineEventHandler(async (event) => {
  const serverSupabase = getServerSupabase();
  const query = getQuery(event);
  const room = String(query.room || "global").trim() || "global";

  const { data, error } = await serverSupabase
    .from(CHAT_TABLE)
    .select("id, created_at, user_id, username, content, room, is_elite, admin_name, is_system")
    .eq("room", room)
    .order("created_at", { ascending: false })
    .limit(MAX_MESSAGES);

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  // возвращаем в хронологическом порядке (старые сверху)
  const messages = (data || []).slice().reverse();
  return { ok: true, messages };
});