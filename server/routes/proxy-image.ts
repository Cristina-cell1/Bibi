export default defineEventHandler(async (event) => {
  const url = getQuery(event).url as string
  if (!url) throw createError({ statusCode: 400 })

  const response = await fetch(url)
  const contentType = response.headers.get('content-type') ?? 'image/jpeg'

  setHeader(event, 'Content-Type', contentType)
  setHeader(event, 'Cache-Control', 'public, max-age=86400')
  return response.body   // стрим напрямую, без Buffer — работает в Workers
})