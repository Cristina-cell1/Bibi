export default defineEventHandler(async () => {
  const DOMAINS = [
    "api.ppv.to",
    "api.ppv.st",
    "api.ppv.cx",
    "api.ppv.is",
    "api.ppv.lc",
  ];

  const results: Record<string, unknown> = {};

  for (const domain of DOMAINS) {
    try {
      const res = await fetch(`https://${domain}/api/streams`, {
        headers: {
          Accept: "application/json",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        },
      });

      const text = await res.text();
      let streamsCount: number | null = null;
      try {
        const data = JSON.parse(text);
        streamsCount = Array.isArray(data?.streams) ? data.streams.length : null;
      } catch {
        // not JSON
      }

      results[domain] = {
        http: res.status,
        streamsCount,
        bodyPreview: text.slice(0, 200),
      };
    } catch (e: any) {
      results[domain] = { error: String(e?.message || e) };
    }
  }

  return {
    runtime: process.env.VERCEL ? "vercel" : "other",
    checkedAt: new Date().toISOString(),
    results,
  };
});