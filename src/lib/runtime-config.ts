import { Preferences } from '@capacitor/preferences'
import type { SupabaseClient } from '@supabase/supabase-js'
import { directorySession, directorySupabase, isPrivateAppGateway, type DirectoryPrivateApp } from './directory'
import { isNativePlatform, provisioningBaseUrl } from './platform'
import { provisioningJson } from './provisioning-request'

export type RuntimeSupabaseConfig = {
  url: string
  publishableKey: string
  deploymentUrl?: string
}

const STORAGE_KEY = 'spend.runtimeSupabaseConfig.v1'

function fallbackConfig(): RuntimeSupabaseConfig | null {
  if (isPrivateAppGateway) return null
  const url = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || __SUPABASE_URL__ || ''
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || __SUPABASE_PUBLISHABLE_KEY__ || ''
  return url && publishableKey ? { url, publishableKey } : null
}

export function isValidRuntimeSupabaseConfig(value: unknown): value is RuntimeSupabaseConfig {
  if (!value || typeof value !== 'object') return false
  const config = value as Partial<RuntimeSupabaseConfig>
  try {
    const url = new URL(config.url ?? '')
    return url.protocol === 'https:' && Boolean(config.publishableKey?.trim())
  } catch {
    return false
  }
}

async function readStoredConfig(): Promise<RuntimeSupabaseConfig | null> {
  if (isNativePlatform()) {
    const { value } = await Preferences.get({ key: STORAGE_KEY })
    if (!value) return null
    try {
      const parsed: unknown = JSON.parse(value)
      return isValidRuntimeSupabaseConfig(parsed) ? parsed : null
    } catch {
      return null
    }
  }
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    if (!value) return null
    const parsed: unknown = JSON.parse(value)
    return isValidRuntimeSupabaseConfig(parsed) ? parsed : null
  } catch {
    return null
  }
}

async function writeStoredConfig(config: RuntimeSupabaseConfig): Promise<void> {
  const value = JSON.stringify(config)
  if (isNativePlatform()) {
    await Preferences.set({ key: STORAGE_KEY, value })
    return
  }
  window.localStorage.setItem(STORAGE_KEY, value)
}

export async function getRuntimeSupabaseConfig(): Promise<RuntimeSupabaseConfig | null> {
  const stored = await readStoredConfig()
  if (!isPrivateAppGateway) return stored ?? fallbackConfig()

  if (!directorySupabase) {
    if (stored) await clearRuntimeSupabaseConfig()
    return null
  }
  const session = await directorySession()
  if (!session) {
    if (stored) await clearRuntimeSupabaseConfig()
    return null
  }

  const response = await provisioningJson<{ app: DirectoryPrivateApp | null }>(`${isNativePlatform() ? provisioningBaseUrl() : ''}/api/directory/me`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (response.status === 401) {
    if (stored) await clearRuntimeSupabaseConfig()
    await directorySupabase.auth.signOut()
    return null
  }
  if (response.status < 200 || response.status >= 300) throw new Error('Could not verify which private database belongs to this account')
  const { app } = response.body
  if (!app) {
    if (stored) await clearRuntimeSupabaseConfig()
    return null
  }
  const current = runtimeConfigForPrivateApp(app)
  if (!sameRuntimeConfig(stored, current)) await writeStoredConfig(current)
  return current
}

export function runtimeConfigForPrivateApp(app: DirectoryPrivateApp): RuntimeSupabaseConfig {
  if (!/^[a-z0-9]{20}$/.test(app.supabase_project_ref)) throw new Error('Your private database reference is invalid')
  const config = {
    url: `https://${app.supabase_project_ref}.supabase.co`,
    publishableKey: app.supabase_publishable_key,
    deploymentUrl: app.deployment_url,
  }
  if (!isValidRuntimeSupabaseConfig(config)) throw new Error('Your private database configuration is invalid')
  return config
}

export function sameRuntimeConfig(left: RuntimeSupabaseConfig | null, right: RuntimeSupabaseConfig): boolean {
  return left?.url === right.url && left.publishableKey === right.publishableKey && left.deploymentUrl === right.deploymentUrl
}

export async function saveRuntimeSupabaseConfig(config: RuntimeSupabaseConfig): Promise<void> {
  if (!isValidRuntimeSupabaseConfig(config)) throw new Error('The private Spend configuration is invalid')
  await writeStoredConfig(config)
}

export async function clearRuntimeSupabaseConfig(): Promise<void> {
  if (isNativePlatform()) {
    await Preferences.remove({ key: STORAGE_KEY })
    return
  }
  window.localStorage.removeItem(STORAGE_KEY)
}

export async function initializeSupabaseClient(
  create: (url: string, key: string) => SupabaseClient,
  set: (client: SupabaseClient | null, config: RuntimeSupabaseConfig | null) => void,
): Promise<void> {
  const config = await getRuntimeSupabaseConfig()
  set(config ? create(config.url, config.publishableKey) : null, config)
}
