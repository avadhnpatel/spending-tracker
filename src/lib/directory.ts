import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_DIRECTORY_SUPABASE_URL?.replace(/\/$/, '')
const key = import.meta.env.VITE_DIRECTORY_SUPABASE_PUBLISHABLE_KEY

export const directorySupabase: SupabaseClient | null = url && key
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' } })
  : null

// This configuration exists only on spendingtrkr.com. Private deployments do
// not receive these variables and therefore run the tracker directly. The
// hostname guard also ensures the public product can never fall back to a
// shared tracker if its directory variables are accidentally omitted.
const isPublicSpendDomain = typeof window !== 'undefined' && (
  window.location.hostname === 'spendingtrkr.com' ||
  window.location.hostname.endsWith('.spendingtrkr.com')
)
export const isPrivateAppGateway = Boolean(directorySupabase) || isPublicSpendDomain

export async function directorySession(): Promise<Session | null> {
  if (!directorySupabase) return null
  const { data } = await directorySupabase.auth.getSession()
  return data.session
}

export function directoryCallbackUrl(): string {
  return `${window.location.origin}/account/callback`
}
