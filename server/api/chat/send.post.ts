// server/api/chat/send.post.ts
// Проверяет юзера по access-token, читает профиль, вставляет сообщение.
// Клиент НЕ может выставить себе is_elite — это решает сервер.

import { getServerSupabase } from "~/server/utils/supabase";

const CHAT_TABLE = "chat_messages";
const MAX_LEN = 300;
const NAME_MAX = 24;

// elite-алиасы (та же логика, что была на клиенте, но теперь серверная)
const ELITE_ALIASES = new Set(["aheht2001", "steeleydan888"]);

function getDisplayName(u: any): string {
  const md = u?.user_metadata || {};
  const custom = md?.custom_claims || md?.customClaims || null;
  const globalName = custom?.global_name || md?.global_name || null;
  const name =
    globalName || md?.username || md?.full_name || md?.name || md?.preferred_username || "User";
  return String(name).slice(0, NAME_MAX);
}

export default defineEventHandler(async (event) => {
  const serverSupabase = getServerSupabase();
  const body = await readBody(event);
  const rawText = String(body?.text || "");
  const room = String(body?.room || "global").trim() || "global";
  const isAdmin = !!body?.isAdmin;
  const adminAlias = String(body?.adminAlias || "").trim();

  const content = rawText.trim().slice(0, MAX_LEN);
  if (!content) {
    throw createError({ statusCode: 400, statusMessage: "Empty message" });
  }

  // ── авторизация по токену ──
  const authHeader = getHeader(event, "authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: "Missing auth token" });
  }

  const { data: userData, error: userErr } = await serverSupabase.auth.getUser(token);
  if (userErr || !userData?.user) {
    throw createError({ statusCode: 401, statusMessage: "Invalid session" });
  }
  const user = userData.user;

  // ── профиль (доверенный, с сервера) ──
  const { data: profile } = await serverSupabase
    .from("profiles")
    .select("is_elite, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  const profileIsAdmin = !!profile?.is_admin;
  const profileIsElite = !!profile?.is_elite;

  // алиас разрешён только реальным админам
  const useAlias = isAdmin && profileIsAdmin && !!adminAlias;
  const username = useAlias ? adminAlias.slice(0, NAME_MAX) : getDisplayName(user);

  // elite: либо профиль elite, либо elite-алиас (только для админа)
  const aliasIsElite = useAlias && ELITE_ALIASES.has(adminAlias.toLowerCase());
  const isElite = profileIsElite || aliasIsElite;

  const { data: inserted, error: insErr } = await serverSupabase
    .from(CHAT_TABLE)
    .insert([
      {
        content,
        username,
        user_id: user.id,
        room,
        is_elite: isElite,
        admin_name: useAlias,
      },
    ])
    .select("id, created_at, user_id, username, content, room, is_elite, admin_name, is_system")
    .single();

  if (insErr) {
    throw createError({ statusCode: 500, statusMessage: insErr.message });
  }

  return { ok: true, message: inserted };
});