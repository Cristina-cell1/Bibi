import { createClient } from "@supabase/supabase-js";

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();

  console.log('[supabase] url:', config.public.supabaseUrl)
  console.log('[supabase] anonKey len:', config.public.supabaseAnonKey?.length ?? 'undefined')

  const sb = createClient(
    config.public.supabaseUrl,
    config.public.supabaseAnonKey,
  );

  return {
    provide: { sb },
  };
});