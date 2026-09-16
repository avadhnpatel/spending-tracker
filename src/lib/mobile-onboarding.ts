import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Preferences } from '@capacitor/preferences'
import { isNativePlatform, provisioningBaseUrl } from './platform'
import { saveRuntimeSupabaseConfig } from './runtime-config'

type MobileSetupStart = { sessionId: string; claimCode: string; setupUrl: string; expiresAt: string }
type MobileSetupClaim = { supabaseUrl: string; publishableKey: string; deploymentUrl?: string }
const PENDING_KEY = 'spend.pendingMobileSetup.v1'

async function getPending(): Promise<MobileSetupStart | null> {
  try {
    const value = isNativePlatform()
      ? (await Preferences.get({ key: PENDING_KEY })).value
      : window.localStorage.getItem(PENDING_KEY)
    if (!value) return null
    const parsed = JSON.parse(value) as MobileSetupStart
    return parsed.sessionId && parsed.claimCode && parsed.expiresAt ? parsed : null
  } catch { return null }
}

async function setPending(value: MobileSetupStart | null) {
  if (isNativePlatform()) {
    if (value) await Preferences.set({ key: PENDING_KEY, value: JSON.stringify(value) })
    else await Preferences.remove({ key: PENDING_KEY })
    return
  }
  if (value) window.localStorage.setItem(PENDING_KEY, JSON.stringify(value))
  else window.localStorage.removeItem(PENDING_KEY)
}

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(data.error || 'Private setup could not continue')
  return data
}

async function finishFromUrl(url: string): Promise<boolean> {
  const parsed = new URL(url)
  if (parsed.protocol !== 'spend:' || parsed.hostname !== 'setup' || parsed.pathname !== '/complete') return false
  const sessionId = parsed.searchParams.get('session')
  const pending = await getPending()
  if (!sessionId || !pending || pending.sessionId !== sessionId) return false
  const response = await fetch(`${provisioningBaseUrl()}/api/setup/mobile/claim`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, claimCode: pending.claimCode }),
  })
  const config = await readJson<MobileSetupClaim>(response)
  await saveRuntimeSupabaseConfig({ url: config.supabaseUrl, publishableKey: config.publishableKey, deploymentUrl: config.deploymentUrl })
  await setPending(null)
  await Browser.close()
  window.location.replace('/login?setup=complete')
  return true
}

export async function startPrivateSetup(): Promise<void> {
  if (!isNativePlatform()) { window.location.assign('/setup'); return }
  const response = await fetch(`${provisioningBaseUrl()}/api/setup/mobile/start`, { method: 'POST' })
  const setup = await readJson<MobileSetupStart>(response)
  await setPending(setup)
  await Browser.open({ url: setup.setupUrl, presentationStyle: 'fullscreen' })
}

async function handleNativeUrl(url: string): Promise<boolean> {
  if (await finishFromUrl(url)) return true
  const parsed = new URL(url)
  if (parsed.protocol === 'spend:' && parsed.hostname === 'auth' && parsed.pathname === '/callback') {
    window.location.replace(`/auth/callback${parsed.search}${parsed.hash}`)
    return true
  }
  return false
}

export async function initializeMobileOnboarding(): Promise<void> {
  if (!isNativePlatform()) return
  const launch = await App.getLaunchUrl()
  if (launch?.url) await handleNativeUrl(launch.url)
  await App.addListener('appUrlOpen', ({ url }) => {
    void handleNativeUrl(url).catch((error: unknown) => console.error('Could not finish native Spend link', error))
  })
}
