import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { isNativePlatform, provisioningBaseUrl } from './platform'
import { provisioningJson } from './provisioning-request'

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
export const isPrivateAppGateway = Boolean(directorySupabase) || isPublicSpendDomain || isNativePlatform()

export async function directorySession(): Promise<Session | null> {
  if (!directorySupabase) return null
  const { data } = await directorySupabase.auth.getSession()
  return data.session
}

export function directoryCallbackUrl(): string {
  return isNativePlatform() ? 'spend://account/callback' : `${window.location.origin}/account/callback`
}

export type DirectoryPrivateApp = {
  deployment_url: string
  supabase_project_ref: string
  supabase_publishable_key: string
}

export async function directoryRequest<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await provisioningJson<T>(`${isNativePlatform() ? provisioningBaseUrl() : ''}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (response.status < 200 || response.status >= 300) throw new Error(response.body.error || 'Account request failed')
  return response.body
}
