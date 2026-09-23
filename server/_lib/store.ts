import { decryptSecret, encryptSecret, hashSecret, randomToken } from './crypto.js'
import { getCookie, setSessionCookie } from './http.js'
import type { ApiRequest, ApiResponse, PrivateApp, Provider, SetupSession } from './types.js'

function databaseConfig(): { url: string; key: string } {
  const url = process.env.SETUP_SUPABASE_URL?.replace(/\/$/, '')
  const key = process.env.SETUP_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('The provisioning database is not configured')
  return { url, key }
}

async function dbRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, key } = databaseConfig()
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  if (!response.ok) throw new Error(`Provisioning database request failed (${response.status})`)
  const text = await response.text()
  return (text ? JSON.parse(text) : null) as T
}

export async function createSession(response: ApiResponse, owner?: { id: string; email: string }): Promise<SetupSession> {
  const secret = randomToken()
  const rows = await dbRequest<SetupSession[]>('provisioning_sessions', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ secret_hash: hashSecret(secret), status: 'connecting', directory_user_id: owner?.id ?? null, directory_email: owner?.email ?? null }),
  })
  const session = rows[0]
  if (!session) throw new Error('Could not create setup session')
  setSessionCookie(response, `${session.id}.${secret}`)
  return session
}

export async function createMobileSession(owner: { id: string; email: string }, recover = false): Promise<{ session: SetupSession; browserToken: string; claimCode: string }> {
  const sessionSecret = randomToken()
  const browserToken = randomToken()
  const claimCode = randomToken()
  const rows = await dbRequest<SetupSession[]>('provisioning_sessions', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      secret_hash: hashSecret(sessionSecret),
      status: recover ? 'recover_project' : 'connecting',
      mobile_handoff_hash: hashSecret(browserToken),
      mobile_handoff_secret_encrypted: encryptSecret(sessionSecret),
      mobile_claim_hash: hashSecret(claimCode),
      directory_user_id: owner?.id ?? null,
      directory_email: owner?.email ?? null,
    }),
  })
  const session = rows[0]
  if (!session) throw new Error('Could not create mobile setup session')
  return { session, browserToken, claimCode }
}

export async function privateAppForUser(userId: string, email?: string): Promise<PrivateApp | null> {
  const rows = await dbRequest<PrivateApp[]>(`private_apps?directory_user_id=eq.${encodeURIComponent(userId)}&select=*`)
  if (rows[0] || !email) return rows[0] ?? null
  // Older directory rows can predate a recreated directory Auth user. The
  // email has just been verified by the control-plane Supabase project, so an
  // exact email match is a safe recovery path for that owner's private app.
  const matchingEmail = await dbRequest<PrivateApp[]>(`private_apps?email=eq.${encodeURIComponent(email.trim().toLowerCase())}&select=*`)
  // Only the directory mapping is authoritative. A completed setup session
  // must not recreate a link that the owner intentionally cleared.
  return matchingEmail[0] ?? null
}

export async function savePrivateApp(session: SetupSession): Promise<void> {
  if (!session.directory_user_id || !session.directory_email || !session.deployment_url || !session.supabase_project_ref || !session.supabase_publishable_key) {
    throw new Error('Private app details are incomplete')
  }
  const email = session.directory_email.trim().toLowerCase()
  const [projectRows, emailRows] = await Promise.all([
    dbRequest<PrivateApp[]>(`private_apps?supabase_project_ref=eq.${encodeURIComponent(session.supabase_project_ref)}&select=*`),
    dbRequest<PrivateApp[]>(`private_apps?email=eq.${encodeURIComponent(email)}&select=*`),
  ])
  const projectOwner = projectRows[0]
  if (projectOwner && projectOwner.email.toLowerCase() !== email) {
    throw new Error('That Supabase project is already linked to another Spending Tracker account')
  }

  const existing = projectOwner ?? emailRows[0]
  const app = {
    directory_user_id: session.directory_user_id,
    email,
    deployment_url: session.deployment_url,
    supabase_project_ref: session.supabase_project_ref,
    supabase_publishable_key: session.supabase_publishable_key,
    vercel_project_id: session.vercel_project_id,
    repository_full_name: session.repository_full_name,
    updated_at: new Date().toISOString(),
  }
  await dbRequest<PrivateApp[]>(existing
    ? `private_apps?directory_user_id=eq.${encodeURIComponent(existing.directory_user_id)}`
    : 'private_apps', {
    method: existing ? 'PATCH' : 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(app),
  })
}

export async function sessionFromRequest(request: ApiRequest): Promise<SetupSession | null> {
  const cookie = getCookie(request, 'spend_setup_session')
  if (!cookie) return null
  const separator = cookie.indexOf('.')
  if (separator < 1) return null
  const id = cookie.slice(0, separator)
  const secret = cookie.slice(separator + 1)
  const rows = await dbRequest<SetupSession[]>(`provisioning_sessions?id=eq.${encodeURIComponent(id)}&secret_hash=eq.${hashSecret(secret)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=*`)
  return rows[0] ?? null
}

export async function sessionByOAuthState(provider: Provider, state: string): Promise<SetupSession | null> {
  const column = `${provider}_oauth_state`
  const rows = await dbRequest<SetupSession[]>(`provisioning_sessions?${column}=eq.${encodeURIComponent(state)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=*`)
  return rows[0] ?? null
}

export async function sessionByMobileHandoff(token: string): Promise<SetupSession | null> {
  const rows = await dbRequest<SetupSession[]>(`provisioning_sessions?mobile_handoff_hash=eq.${hashSecret(token)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=*`)
  return rows[0] ?? null
}

export async function sessionByMobileClaim(id: string, claimCode: string): Promise<SetupSession | null> {
  const rows = await dbRequest<SetupSession[]>(`provisioning_sessions?id=eq.${encodeURIComponent(id)}&mobile_claim_hash=eq.${hashSecret(claimCode)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&status=eq.complete&select=*`)
  return rows[0] ?? null
}

export function mobileSessionCookieValue(session: SetupSession): string {
  if (!session.mobile_handoff_secret_encrypted) throw new Error('Mobile setup session is unavailable')
  return `${session.id}.${decryptSecret(session.mobile_handoff_secret_encrypted)}`
}

export async function updateSession(id: string, patch: Partial<SetupSession>): Promise<SetupSession> {
  const rows = await dbRequest<SetupSession[]>(`provisioning_sessions?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  })
  const session = rows[0]
  if (!session) throw new Error('Setup session is unavailable')
  return session
}

export type ProvisioningClaim = {
  session: SetupSession
  step: string
  claimedAt: string
}

const PROVISIONING_LEASE_MS = 90_000

function visibleStatus(status: string): string {
  return status.startsWith('running:') ? status.slice('running:'.length) : status
}

export async function claimProvisioningStep(session: SetupSession): Promise<ProvisioningClaim | null> {
  const step = visibleStatus(session.status)
  if (session.status.startsWith('running:')) {
    const updatedAt = Date.parse(session.updated_at)
    if (Number.isFinite(updatedAt) && Date.now() - updatedAt < PROVISIONING_LEASE_MS) return null
  }

  const claimedAt = new Date().toISOString()
  const params = new URLSearchParams({
    id: `eq.${session.id}`,
    status: `eq.${session.status}`,
    updated_at: `eq.${session.updated_at}`,
  })
  const rows = await dbRequest<SetupSession[]>(`provisioning_sessions?${params.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      status: `running:${step}`,
      error_message: null,
      updated_at: claimedAt,
      expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    }),
  })
  const claimed = rows[0]
  return claimed ? { session: claimed, step, claimedAt } : null
}

export async function finishProvisioningStep(claim: ProvisioningClaim, patch: Partial<SetupSession>): Promise<SetupSession> {
  const params = new URLSearchParams({
    id: `eq.${claim.session.id}`,
    status: `eq.running:${claim.step}`,
    updated_at: `eq.${claim.claimedAt}`,
  })
  const rows = await dbRequest<SetupSession[]>(`provisioning_sessions?${params.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  })
  const session = rows[0]
  if (!session) throw new Error('This setup step was already resumed in another request')
  return session
}

export function publicSession(session: SetupSession) {
  return {
    id: session.id,
    status: visibleStatus(session.status),
    connections: {
      github: Boolean(session.github_connected_at),
      supabase: Boolean(session.supabase_connected_at),
      vercel: Boolean(session.vercel_connected_at),
    },
    githubLogin: session.github_login,
    repository: session.repository_full_name,
    supabaseProjectRef: session.supabase_project_ref,
    vercelProjectId: session.vercel_project_id,
    deploymentUrl: session.deployment_url,
    mobileHandoff: Boolean(session.mobile_claim_hash),
    error: session.error_message,
    expiresAt: session.expires_at,
  }
}
