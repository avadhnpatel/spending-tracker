const environment = Deno.env.get('PLAID_ENV') ?? 'production'
const baseUrl = environment === 'sandbox'
  ? 'https://sandbox.plaid.com'
  : environment === 'development'
    ? 'https://development.plaid.com'
    : 'https://production.plaid.com'

export async function plaidRequest<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const clientId = Deno.env.get('PLAID_CLIENT_ID')
  const secret = Deno.env.get('PLAID_SECRET')
  if (!clientId || !secret) throw new Error('Plaid is not configured')
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, secret, ...payload }),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.display_message || result.error_message || 'Plaid request failed')
  return result as T
}
