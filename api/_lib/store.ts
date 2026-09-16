import { hashSecret, randomToken } from './crypto.js'
import { getCookie, setSessionCookie } from './http.js'
import type { ApiRequest, ApiResponse, Provider, SetupSession } from './types.js'

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

export async function createSession(response: ApiResponse): Promise<SetupSession> {
  const secret = randomToken()
  const rows = await dbRequest<SetupSession[]>('provisioning_sessions', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ secret_hash: hashSecret(secret), status: 'connecting' }),
  })
  const session = rows[0]
  if (!session) throw new Error('Could not create setup session')
  setSessionCookie(response, `${session.id}.${secret}`)
  return session
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

export function publicSession(session: SetupSession) {
  return {
    id: session.id,
    status: session.status,
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
    error: session.error_message,
    expiresAt: session.expires_at,
  }
}
