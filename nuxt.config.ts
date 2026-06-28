export default defineNuxtConfig({
  ssr: true,

  app: {
    head: {
      charset: "utf-8",
      viewport: "width=device-width, initial-scale=1",
      title: "Free Sport Streaming",
      link: [
        { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon.webp?v=4" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Bebas+Neue&family=Barlow:wght@400;600&family=Barlow+Condensed:wght@700&family=Madimi+One&display=swap",
        },
        { rel: "stylesheet", href: "/styles.css" },
        { rel: "stylesheet", href: "/paywall.css" },
        { rel: "stylesheet", href: "/cards.css" },
      ],
    },
  },

  nitro: process.env.VERCEL
    ? {
        preset: "vercel",
      }
    : {
        preset: "cloudflare-pages",
        cloudflare: {
          pages: {
            routes: {
              include: ["/*"],
              exclude: ["/_nuxt/*", "/fonts/*"],
            },
          },
        },
      },

  runtimeConfig: {
    // приватные (только сервер) — НЕ уходят в браузер
    supabaseUrl: "",            // из env SUPABASE_URL / NUXT_SUPABASE_URL
    supabaseServiceKey: "",     // из env SUPABASE_SERVICE_KEY / NUXT_SUPABASE_SERVICE_KEY
    public: {
      fzApiBase: "https://api.fzpv.st",
      supabaseUrl: "",          // публичный URL для клиента
      supabaseAnonKey: "",      // anon-ключ для клиента
    },
  },

  compatibilityDate: "2024-11-01",
  devtools: { enabled: true },
})