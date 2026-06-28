/**
 * Fightzone Streams Worker (bibi)
 * ------------------------------
 * Endpoints:
 *  - GET /                  -> "ok"
 *  - GET /api/ping          -> "ok"
 *  - GET /api/streams-sync  -> fetches ppv (or streamed.pk fallback) and normalizes for Fightzone
 *
 * Cloudflare env (plaintext):
 *  - (none required for streams-sync; PPV/Streamed are public)
 */

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

function readOrigin(request) {
  const origin = request.headers.get("Origin") || "";

  const allowed = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "https://bibi.st",
    "https://www.bibi.st",
    "https://e6c24aef.bibi-super1.pages.dev/",
  ];

  if (allowed.includes(origin)) return origin;

  return "https://tiny-glitter-8d9e.solfetka2345.workers.dev";
}

function corsHeaders(request) {
  const allowOrigin = readOrigin(request);
  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": "GET,OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
  };
}

function withCors(request, res) {
  return new Response(res.body, {
    status: res.status,
    headers: {
      ...Object.fromEntries(res.headers),
      ...corsHeaders(request),
    },
  });
}

function uniqueStrings(arr) {
  return [...new Set((Array.isArray(arr) ? arr : []).filter(Boolean).map((x) => String(x).trim()))];
}

/* -------------------- PPV API source -------------------- */

async function getPpvStreams() {
  const DOMAINS = [
    "api.ppv.to",
    "api.ppv.st",
    "api.ppv.cx",
    "api.ppv.is",
    "api.ppv.lc",
  ];
  const errors = [];

  for (const domain of DOMAINS) {
    try {
      const res = await fetch(`https://${domain}/api/streams`, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) FightzoneWorker/1.0",
        },
      });

      if (!res.ok) {
        errors.push(`${domain}=${res.status}`);
        continue;
      }

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        errors.push(`${domain}=bad_json[${text.slice(0, 80).replace(/\s+/g, " ")}]`);
        continue;
      }

      const streamsArr = Array.isArray(data?.streams) ? data.streams : [];
      if (streamsArr.length > 0) {
        return { source_domain: domain, data };
      }
      errors.push(`${domain}=empty_streams body[${text.slice(0, 200).replace(/\s+/g, " ")}]`);
    } catch (e) {
      errors.push(`${domain}=${String(e?.message || e)}`);
    }
  }

  throw new Error("All PPV domains failed: " + errors.join(", "));
}

/* -------------------- Streamed.pk fallback source -------------------- */

async function getStreamedStreams() {
  const BASE = "https://streamed.pk";

  const res = await fetch(`${BASE}/api/matches/all`, {
    headers: {
      Accept: "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!res.ok) {
    throw new Error(`Streamed fetch failed ${res.status}`);
  }

  const matches = await res.json();
  if (!Array.isArray(matches) || matches.length === 0) {
    throw new Error("Streamed returned no matches");
  }

  const nowMs = Date.now();
  const out = [];

  for (const m of matches) {
    const id = String(m?.id || "").trim();
    if (!id) continue;

    const src = Array.isArray(m?.sources) && m.sources[0] ? m.sources[0] : null;
    if (!src?.source || !src?.id) continue;

    const startMs = Number(m?.date || 0);
    const startsAt = startMs > 0 ? Math.floor(startMs / 1000) : 0;
    const poster = m?.poster ? `${BASE}${m.poster}` : "";
    const embedUrl = `https://embed.st/embed/${src.source}/${src.id}/1`;

    const isLive = startMs > 0 && nowMs >= startMs && (nowMs - startMs) < 4 * 60 * 60 * 1000;
    const isEnded = startMs > 0 && (nowMs - startMs) >= 4 * 60 * 60 * 1000;

    out.push({
      category: String(m?.category || "").trim(),
      category_id: null,
      id,
      name: String(m?.title || "").trim(),
      title: String(m?.title || "").trim(),
      tag: "",
      poster,
      uri_name: id,
      starts_at: startsAt,
      ends_at: 0,
      always_live: 0,
      category_name: String(m?.category || "").trim(),
      allowpaststreams: 0,
      iframe_url: embedUrl,
      free: 0,
      is_live: isLive,
      is_ended: isEnded,
    });
  }

  return { source_domain: "streamed.pk", events: out };
}

/* -------------------- Normalize PPV -------------------- */

function normalizeFightzoneStreams(apiData) {
  const out = [];
  const groups = Array.isArray(apiData?.streams) ? apiData.streams : [];
  const nowMs = Date.now();

  for (const group of groups) {
    const category = String(group?.category || "").trim();
    const categoryId = group?.id ?? null;
    const groupAlwaysLive = Number(group?.always_live || 0);

    const streams = Array.isArray(group?.streams) ? group.streams : [];
    for (const s of streams) {
      const uri = String(s?.uri_name || "").trim();
      if (!uri) continue;

      const startsAt = Number(s?.starts_at || 0);
      const endsAt = Number(s?.ends_at || 0);
      const startsMs = startsAt > 0 ? startsAt * 1000 : 0;
      const endsMs = endsAt > 0 ? endsAt * 1000 : 0;
      const alwaysLive = Number(s?.always_live || groupAlwaysLive || 0) === 1;

      const isForcedFree = Number(s?.always_live || groupAlwaysLive || 0) === 1;

      out.push({
        category,
        category_id: categoryId,
        id: s?.id ?? null,
        name: String(s?.name || "").trim(),
        title: String(s?.name || "").trim(),
        tag: String(s?.tag || "").trim(),
        poster: String(s?.poster || "").trim(),
        uri_name: uri,
        starts_at: startsAt,
        ends_at: endsAt,
        always_live: alwaysLive ? 1 : 0,
        category_name: String(s?.category_name || category || "").trim(),
        allowpaststreams: Number(s?.allowpaststreams || 0),
        iframe_url: s?.iframe || `https://pooembed.eu/embed/${uri}`,
        free: isForcedFree ? 1 : 0,
        is_live: alwaysLive || (startsMs > 0 && endsMs > 0 && nowMs >= startsMs && nowMs <= endsMs),
        is_ended: !alwaysLive && endsMs > 0 && nowMs > endsMs,
      });
    }
  }

  return out;
}

/* -------------------- Filter / sort -------------------- */

function filterFightzoneStreams(events, url) {
  const categoryParam = url.searchParams.get("category");
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const includeEnded = url.searchParams.get("includeEnded") === "1";

  let filtered = events;

  if (categoryParam) {
    const wanted = uniqueStrings(categoryParam.split(",").map((x) => x.toLowerCase()));
    filtered = filtered.filter((e) => wanted.includes(String(e.category || "").toLowerCase()));
  }

  if (q) {
    filtered = filtered.filter((e) => {
      const hay = [e.title, e.tag, e.category, e.category_name, e.uri_name]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  if (!includeEnded) {
    filtered = filtered.filter((e) => !e.is_ended);
  }

  filtered.sort((a, b) => Number(a.starts_at || 0) - Number(b.starts_at || 0));

  const FOOTBALL_LIMIT = 18;

  const football = [];
  const darts = [];
  const americanFootball = [];
  const baseball = [];
  const streams247 = [];
  const other = [];

  for (const e of filtered) {
    const cat = [e.category, e.category_name, e.title, e.name, e.uri_name]
      .join(" ")
      .toLowerCase();

    if (
      Number(e.always_live) === 1 ||
      cat.includes("24/7") ||
      cat.includes("south park") ||
      cat.includes("family guy") ||
      cat.includes("simpsons") ||
      cat.includes("spongebob") ||
      cat.includes("rally")
    ) {
      streams247.push(e);
    } else if (cat.includes("american football")) {
      americanFootball.push(e);
    } else if (
      cat.includes("darts") ||
      cat.includes("dart") ||
      cat.includes("pdc") ||
      cat.includes("players championship")
    ) {
      darts.push(e);
    } else if (cat.includes("baseball")) {
      baseball.push(e);
    } else if (
      cat.includes("football") ||
      cat.includes("soccer") ||
      cat.includes("premier league") ||
      cat.includes("laliga") ||
      cat.includes("la liga") ||
      cat.includes("serie a") ||
      cat.includes("bundesliga") ||
      cat.includes("champions league") ||
      cat.includes("uefa") ||
      cat.includes("europa league") ||
      cat.includes("conference league") ||
      cat.includes("fa cup") ||
      cat.includes("carabao cup") ||
      cat.includes("league cup") ||
      cat.includes("copa del rey") ||
      cat.includes("mls") ||
      cat.includes("ligue 1") ||
      cat.includes("fifa") ||
      cat.includes("world cup") ||
      cat.includes("nations league")
    ) {
      football.push(e);
    } else {
      other.push(e);
    }
  }

  function sortWithPosterFirst(arr) {
    arr.sort((a, b) => {
      const aHasPoster = String(a.poster || "").trim() ? 0 : 1;
      const bHasPoster = String(b.poster || "").trim() ? 0 : 1;
      if (aHasPoster !== bHasPoster) return aHasPoster - bHasPoster;
      return Number(a.starts_at || 0) - Number(b.starts_at || 0);
    });
  }

  sortWithPosterFirst(football);
  sortWithPosterFirst(darts);
  sortWithPosterFirst(americanFootball);
  sortWithPosterFirst(baseball);
  sortWithPosterFirst(streams247);

  return [
    ...other,
    ...football.slice(0, FOOTBALL_LIMIT),
    ...darts,
    ...americanFootball,
    ...baseball,
    ...streams247,
  ];
}

/* -------------------- streams-sync handler (with cache) -------------------- */

async function handleStreamsSync(request, env, ctx) {
  const url = new URL(request.url);
  const cache = caches.default;
  const cacheKey = new Request(request.url, request);

  async function buildFreshResponse() {
    let source_domain;
    let normalized;

    try {
      const ppv = await getPpvStreams();
      source_domain = ppv.source_domain;
      normalized = normalizeFightzoneStreams(ppv.data);
    } catch (ppvErr) {
      console.log("PPV failed, trying Streamed:", String(ppvErr?.message || ppvErr));
      const streamed = await getStreamedStreams();
      source_domain = streamed.source_domain;
      normalized = streamed.events;
    }

    const events = filterFightzoneStreams(normalized, url);

    return json(
      {
        success: true,
        source_domain,
        timestamp: Math.floor(Date.now() / 1000),
        count: events.length,
        events,
      },
      200,
      {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
      }
    );
  }

  // 1. Отдаём из кеша, при необходимости обновляя в фоне (SWR)
  const cached = await cache.match(cacheKey);
  if (cached) {
    const age = parseInt(cached.headers.get("Age") || "0", 10);
    if (age > 280) {
      ctx.waitUntil(
        (async () => {
          try {
            const fresh = await buildFreshResponse();
            await cache.put(cacheKey, fresh.clone());
          } catch (err) {
            console.log("SWR refresh failed:", String(err?.message || err));
          }
        })()
      );
    }
    return cached;
  }

  // 2. Кеша нет — тянем свежее
  try {
    const fresh = await buildFreshResponse();
    ctx.waitUntil(cache.put(cacheKey, fresh.clone()));
    return fresh;
  } catch (err) {
    console.log("Initial fetch failed:", err);

    const fallback = await cache.match(cacheKey);
    if (fallback) return fallback;

    return json(
      { success: false, error: String(err?.message || err), events: [] },
      200,
      { "Cache-Control": "no-store" }
    );
  }
}

/* -------------------- Worker entry -------------------- */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(request) });
    }

    if (url.pathname === "/") {
      return new Response("ok", { status: 200 });
    }

    if (url.pathname === "/api/ping") {
      return new Response("ok", { status: 200 });
    }

    try {
      if (url.pathname === "/api/streams-sync" && request.method === "GET") {
        return withCors(request, await handleStreamsSync(request, env, ctx));
      }

      return new Response("Not found", { status: 404 });
    } catch (e) {
      console.log("WORKER ERROR:", String(e?.message || e));
      return withCors(request, json({ error: String(e?.message || e) }, 500));
    }
  },
};