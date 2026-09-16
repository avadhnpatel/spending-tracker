import { createClient } from 'npm:@supabase/supabase-js@2'

export function adminClient() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Supabase function environment is not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function requireUser(request: Request) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) throw new Error('Unauthorized')
  const admin = adminClient()
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw new Error('Unauthorized')
  return { admin, user: data.user }
}
