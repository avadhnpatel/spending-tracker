import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_DIRECTORY_SUPABASE_URL?.replace(/\/$/, '')
const key = import.meta.env.VITE_DIRECTORY_SUPABASE_PUBLISHABLE_KEY

export const directorySupabase: SupabaseClient | null = url && key
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' } })
  : null

export async function directorySession(): Promise<Session | null> {
  if (!directorySupabase) return null
  const { data } = await directorySupabase.auth.getSession()
  return data.session
}

export function directoryCallbackUrl(): string {
  return `${window.location.origin}/account/callback`
}
