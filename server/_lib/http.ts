import type { ApiRequest, ApiResponse } from './types.js'

export function allowMethods(request: ApiRequest, response: ApiResponse, methods: string[]): boolean {
  if (request.method && methods.includes(request.method)) return true
  response.setHeader('Allow', methods)
  response.status(405).json({ error: 'Method not allowed' })
  return false
}

export function queryValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

export function getCookie(request: ApiRequest, name: string): string | null {
  const raw = request.headers.cookie
  const cookie = Array.isArray(raw) ? raw.join(';') : raw ?? ''
  for (const part of cookie.split(';')) {
    const [key, ...value] = part.trim().split('=')
    if (key === name) return decodeURIComponent(value.join('='))
  }
  return null
}

export function setSessionCookie(response: ApiResponse, value: string): void {
  const secure = setupBaseUrl().startsWith('https://') ? '; Secure' : ''
  response.setHeader('Set-Cookie', `spend_setup_session=${encodeURIComponent(value)}; HttpOnly${secure}; SameSite=Lax${setupCookieDomain()}; Path=/; Max-Age=7200`)
}

export function clearSessionCookie(response: ApiResponse): void {
  const secure = setupBaseUrl().startsWith('https://') ? '; Secure' : ''
  response.setHeader('Set-Cookie', `spend_setup_session=; HttpOnly${secure}; SameSite=Lax${setupCookieDomain()}; Path=/; Max-Age=0`)
}

function setupCookieDomain(): string {
  const hostname = new URL(setupBaseUrl()).hostname
  return hostname === 'spendingtrkr.com' || hostname === 'www.spendingtrkr.com'
    ? '; Domain=spendingtrkr.com'
    : ''
}

export function setupBaseUrl(): string {
  const value = process.env.SETUP_BASE_URL?.replace(/\/$/, '')
  if (!value) throw new Error('SETUP_BASE_URL is not configured')
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('SETUP_BASE_URL must be a complete public URL')
  }
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
    throw new Error('SETUP_BASE_URL must use HTTPS outside local development')
  }
  if (url.hostname.endsWith('.vercel.app')) {
    throw new Error('SETUP_BASE_URL must use the public Spend domain, not a Vercel deployment URL')
  }
  return url.origin
}

export function publicError(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Unexpected setup error'
}
