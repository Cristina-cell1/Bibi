import { getServerSupabase } from "~/server/utils/supabase"

export default defineEventHandler(async (event) => {
  const serverSupabase = getServerSupabase()

  const token = getHeader(event, "authorization")?.replace("Bearer ", "")
  if (!token) throw createError({ statusCode: 401, message: "Unauthorized" })

  const { data: { user }, error: authError } = await serverSupabase.auth.getUser(token)
  if (authError || !user) throw createError({ statusCode: 401, message: "Invalid token" })

  const { data, error } = await serverSupabase
    .from("profiles")
    .select("id, username, is_admin, created_at")
    .eq("id", user.id)
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })

  return data
})