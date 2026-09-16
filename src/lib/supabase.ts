import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { initializeSupabaseClient, type RuntimeSupabaseConfig } from './runtime-config'

export let isConfigured = false
export let supabase: SupabaseClient | null = null
export let activeSupabaseConfig: RuntimeSupabaseConfig | null = null

function createConfiguredClient(url: string, publicKey: string): SupabaseClient {
  return createClient(url, publicKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'implicit',
      },
    })
}

export async function initializeSupabase(): Promise<void> {
  await initializeSupabaseClient(createConfiguredClient, (client, config) => {
    supabase = client
    activeSupabaseConfig = config
    isConfigured = Boolean(client)
  })
}

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error('Supabase is not configured')
  }
  return supabase
}
