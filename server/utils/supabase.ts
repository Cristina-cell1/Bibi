import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getServerSupabase(): SupabaseClient {
  if (_client) return _client;

  const config = useRuntimeConfig();
  const url = config.supabaseUrl as string;
  const key = config.supabaseServiceKey as string;

  if (!url || !key) {
    throw new Error("[server] Missing supabaseUrl or supabaseServiceKey");
  }

  _client = createClient(url, key, {
    auth: { persistSession: false },
  });
  return _client;
}