// server/api/streams-sync.get.ts
// Перенос логики Cloudflare-воркера в Nitro-роут (Vercel).
// PPV (перебор доменов) -> normalize -> filter/секции, со streamed.pk как fallback.
// Кеш 5 минут через defineCachedEventHandler (заменяет caches.default из воркера).

interface NormalizedEvent {
  category: string
  category_id: number | null
  id: number | string | null
  name: string
  title: string
  tag: string
  poster: string
  uri_name: string
  starts_at: number
  ends_at: number
  always_live: number
  category_name: string
  allowpaststreams: number
  iframe_url: string
  free: number
  is_live: boolean
  is_ended: boolean
}

function uniqueStrings(arr: unknown[]): string[] {
  return [
    ...new Set(
      (Array.isArray(arr) ? arr : [])
        .filter(Boolean)
        .map((x) => String(x).trim()),
    ),
  ]
}

/* -------------------- PPV API source -------------------- */

async function getPpvStreams(): Promise<{ source_domain: string; data: any }> {
  const DOMAINS = [
    'api.ppv.to',
    'api.ppv.st',
    'api.ppv.cx',
    'api.ppv.is',
    'api.ppv.lc',
  ]
  const errors: string[] = []

  for (const domain of DOMAINS) {
    try {
      const res = await fetch(`https://${domain}/api/streams`, {
        headers: {
          Accept: 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        },
      })

      if (!res.ok) {
        errors.push(`${domain}=${res.status}`)
        continue
      }

      const text = await res.text()
      let data: any
      try {
        data = JSON.parse(text)
      } catch {
        errors.push(`${domain}=bad_json[${text.slice(0, 80).replace(/\s+/g, ' ')}]`)
        continue
      }

      const streamsArr = Array.isArray(data?.streams) ? data.streams : []
      if (streamsArr.length > 0) {
        return { source_domain: domain, data }
      }
      errors.push(`${domain}=empty_streams body[${text.slice(0, 200).replace(/\s+/g, ' ')}]`)
    } catch (e: any) {
      errors.push(`${domain}=${String(e?.message || e)}`)
    }
  }

  throw new Error('All PPV domains failed: ' + errors.join(', '))
}

/* -------------------- Streamed.pk fallback source -------------------- */

async function getStreamedStreams(): Promise<{ source_domain: string; events: NormalizedEvent[] }> {
  const BASE = 'https://streamed.pk'

  const res = await fetch(`${BASE}/api/matches/all`, {
    headers: {
      Accept: 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  })

  if (!res.ok) {
    throw new Error(`Streamed fetch failed ${res.status}`)
  }

  const matches = await res.json()
  if (!Array.isArray(matches) || matches.length === 0) {
    throw new Error('Streamed returned no matches')
  }

  const nowMs = Date.now()
  const out: NormalizedEvent[] = []

  for (const m of matches) {
    const id = String(m?.id || '').trim()
    if (!id) continue

    const src = Array.isArray(m?.sources) && m.sources[0] ? m.sources[0] : null
    if (!src?.source || !src?.id) continue

    const startMs = Number(m?.date || 0)
    const startsAt = startMs > 0 ? Math.floor(startMs / 1000) : 0
    const poster = m?.poster ? `${BASE}${m.poster}` : ''
    const embedUrl = `https://embed.st/embed/${src.source}/${src.id}/1`

    const isLive = startMs > 0 && nowMs >= startMs && nowMs - startMs < 4 * 60 * 60 * 1000
    const isEnded = startMs > 0 && nowMs - startMs >= 4 * 60 * 60 * 1000

    out.push({
      category: String(m?.category || '').trim(),
      category_id: null,
      id,
      name: String(m?.title || '').trim(),
      title: String(m?.title || '').trim(),
      tag: '',
      poster,
      uri_name: id,
      starts_at: startsAt,
      ends_at: 0,
      always_live: 0,
      category_name: String(m?.category || '').trim(),
      allowpaststreams: 0,
      iframe_url: embedUrl,
      free: 0,
      is_live: isLive,
      is_ended: isEnded,
    })
  }

  return { source_domain: 'streamed.pk', events: out }
}

/* -------------------- Normalize PPV -------------------- */

function normalizeFightzoneStreams(apiData: any): NormalizedEvent[] {
  const out: NormalizedEvent[] = []
  const groups = Array.isArray(apiData?.streams) ? apiData.streams : []
  const nowMs = Date.now()

  for (const group of groups) {
    const category = String(group?.category || '').trim()
    const categoryId = group?.id ?? null
    const groupAlwaysLive = Number(group?.always_live || 0)

    const streams = Array.isArray(group?.streams) ? group.streams : []
    for (const s of streams) {
      const uri = String(s?.uri_name || '').trim()
      if (!uri) continue

      const startsAt = Number(s?.starts_at || 0)
      const endsAt = Number(s?.ends_at || 0)
      const startsMs = startsAt > 0 ? startsAt * 1000 : 0
      const endsMs = endsAt > 0 ? endsAt * 1000 : 0
      const alwaysLive = Number(s?.always_live || groupAlwaysLive || 0) === 1

      const isForcedFree = Number(s?.always_live || groupAlwaysLive || 0) === 1

      out.push({
        category,
        category_id: categoryId,
        id: s?.id ?? null,
        name: String(s?.name || '').trim(),
        title: String(s?.name || '').trim(),
        tag: String(s?.tag || '').trim(),
        poster: String(s?.poster || '').trim(),
        uri_name: uri,
        starts_at: startsAt,
        ends_at: endsAt,
        always_live: alwaysLive ? 1 : 0,
        category_name: String(s?.category_name || category || '').trim(),
        allowpaststreams: Number(s?.allowpaststreams || 0),
        iframe_url: s?.iframe || `https://pooembed.eu/embed/${uri}`,
        free: isForcedFree ? 1 : 0,
        is_live: alwaysLive || (startsMs > 0 && endsMs > 0 && nowMs >= startsMs && nowMs <= endsMs),
        is_ended: !alwaysLive && endsMs > 0 && nowMs > endsMs,
      })
    }
  }

  return out
}

/* -------------------- Filter / sort -------------------- */

function filterFightzoneStreams(events: NormalizedEvent[], query: Record<string, any>): NormalizedEvent[] {
  const categoryParam = query.category ? String(query.category) : ''
  const q = (query.q ? String(query.q) : '').trim().toLowerCase()
  const includeEnded = String(query.includeEnded || '') === '1'

  let filtered = events

  if (categoryParam) {
    const wanted = uniqueStrings(categoryParam.split(',').map((x) => x.toLowerCase()))
    filtered = filtered.filter((e) => wanted.includes(String(e.category || '').toLowerCase()))
  }

  if (q) {
    filtered = filtered.filter((e) => {
      const hay = [e.title, e.tag, e.category, e.category_name, e.uri_name]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }

  if (!includeEnded) {
    filtered = filtered.filter((e) => !e.is_ended)
  }

  filtered.sort((a, b) => Number(a.starts_at || 0) - Number(b.starts_at || 0))

  const FOOTBALL_LIMIT = 18

  const football: NormalizedEvent[] = []
  const darts: NormalizedEvent[] = []
  const americanFootball: NormalizedEvent[] = []
  const baseball: NormalizedEvent[] = []
  const streams247: NormalizedEvent[] = []
  const other: NormalizedEvent[] = []

  for (const e of filtered) {
    const cat = [e.category, e.category_name, e.title, e.name, e.uri_name]
      .join(' ')
      .toLowerCase()

    if (
      Number(e.always_live) === 1 ||
      cat.includes('24/7') ||
      cat.includes('south park') ||
      cat.includes('family guy') ||
      cat.includes('simpsons') ||
      cat.includes('spongebob') ||
      cat.includes('rally')
    ) {
      streams247.push(e)
    } else if (cat.includes('american football')) {
      americanFootball.push(e)
    } else if (
      cat.includes('darts') ||
      cat.includes('dart') ||
      cat.includes('pdc') ||
      cat.includes('players championship')
    ) {
      darts.push(e)
    } else if (cat.includes('baseball')) {
      baseball.push(e)
    } else if (
      cat.includes('football') ||
      cat.includes('soccer') ||
      cat.includes('premier league') ||
      cat.includes('laliga') ||
      cat.includes('la liga') ||
      cat.includes('serie a') ||
      cat.includes('bundesliga') ||
      cat.includes('champions league') ||
      cat.includes('uefa') ||
      cat.includes('europa league') ||
      cat.includes('conference league') ||
      cat.includes('fa cup') ||
      cat.includes('carabao cup') ||
      cat.includes('league cup') ||
      cat.includes('copa del rey') ||
      cat.includes('mls') ||
      cat.includes('ligue 1') ||
      cat.includes('fifa') ||
      cat.includes('world cup') ||
      cat.includes('nations league')
    ) {
      football.push(e)
    } else {
      other.push(e)
    }
  }

  function sortWithPosterFirst(arr: NormalizedEvent[]) {
    arr.sort((a, b) => {
      const aHasPoster = String(a.poster || '').trim() ? 0 : 1
      const bHasPoster = String(b.poster || '').trim() ? 0 : 1
      if (aHasPoster !== bHasPoster) return aHasPoster - bHasPoster
      return Number(a.starts_at || 0) - Number(b.starts_at || 0)
    })
  }

  sortWithPosterFirst(football)
  sortWithPosterFirst(darts)
  sortWithPosterFirst(americanFootball)
  sortWithPosterFirst(baseball)
  sortWithPosterFirst(streams247)

  return [
    ...other,
    ...football.slice(0, FOOTBALL_LIMIT),
    ...darts,
    ...americanFootball,
    ...baseball,
    ...streams247,
  ]
}

/* -------------------- Cached handler -------------------- */

export default defineCachedEventHandler(
  async (event) => {
    const query = getQuery(event)

    let source_domain: string
    let normalized: NormalizedEvent[]
    let ppv_error: string | null = null
    let streamed_error: string | null = null

    try {
      const ppv = await getPpvStreams()
      source_domain = ppv.source_domain
      normalized = normalizeFightzoneStreams(ppv.data)
    } catch (ppvErr: any) {
      ppv_error = String(ppvErr?.message || ppvErr)
      console.log('PPV failed, trying Streamed:', ppv_error)
      try {
        const streamed = await getStreamedStreams()
        source_domain = streamed.source_domain
        normalized = streamed.events
      } catch (streamedErr: any) {
        streamed_error = String(streamedErr?.message || streamedErr)
        console.log('Streamed also failed:', streamed_error)
        source_domain = 'none'
        normalized = []
      }
    }

    const events = filterFightzoneStreams(normalized, query)

    return {
      success: true,
      source_domain,
      ppv_error,
      streamed_error,
      timestamp: Math.floor(Date.now() / 1000),
      count: events.length,
      events,
    }
  },
  {
    // кеш 5 минут; ключ учитывает query-параметры (category/q/includeEnded)
    maxAge: 300,
    staleMaxAge: 600,
    name: 'streams-sync',
    getKey: (event) => {
      const q = getQuery(event)
      return `${q.category || ''}|${q.q || ''}|${q.includeEnded || ''}`
    },
  },
)
