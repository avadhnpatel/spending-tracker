import type { ApiRequest, DirectoryUser } from './types.js'

function setupUrl(): string {
  const url = process.env.SETUP_SUPABASE_URL?.replace(/\/$/, '')
  if (!url) throw new Error('The account directory is not configured')
  return url
}

function serviceKey(): string {
  const key = process.env.SETUP_SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('The account directory is not configured')
  return key
}

export async function directoryUserFromRequest(request: ApiRequest): Promise<{ id: string; email: string }> {
  const authorization = request.headers.authorization
  const raw = Array.isArray(authorization) ? authorization[0] : authorization
  const token = raw?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) throw new Error('Sign in to your Spending Tracker account first')
  const response = await fetch(`${setupUrl()}/auth/v1/user`, {
    headers: { apikey: serviceKey(), Authorization: `Bearer ${token}` },
  })
  if (!response.ok) throw new Error('Your account session has expired. Request another email link.')
  const user = await response.json() as DirectoryUser
  const email = user.email?.trim().toLowerCase()
  if (!user.id || !email) throw new Error('Your account is missing an email address')
  return { id: user.id, email }
}
