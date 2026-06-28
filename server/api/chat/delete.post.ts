// server/api/chat/delete.post.ts
// Удаление сообщения. Только для админов (проверка профиля по токену).

import { getServerSupabase } from "~/server/utils/supabase";

const CHAT_TABLE = "chat_messages";

export default defineEventHandler(async (event) => {
  const serverSupabase = getServerSupabase();
  const body = await readBody(event);
  const messageId = body?.messageId;
  if (messageId === undefined || messageId === null || messageId === "") {
    throw createError({ statusCode: 400, statusMessage: "Missing messageId" });
  }

  const authHeader = getHeader(event, "authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: "Missing auth token" });
  }

  const { data: userData, error: userErr } = await serverSupabase.auth.getUser(token);
  if (userErr || !userData?.user) {
    throw createError({ statusCode: 401, statusMessage: "Invalid session" });
  }

  const { data: profile } = await serverSupabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    throw createError({ statusCode: 403, statusMessage: "Forbidden" });
  }

  const { error: delErr } = await serverSupabase
    .from(CHAT_TABLE)
    .delete()
    .eq("id", messageId);

  if (delErr) {
    throw createError({ statusCode: 500, statusMessage: delErr.message });
  }

  return { ok: true };
});