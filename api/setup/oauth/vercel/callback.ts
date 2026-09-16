import { encryptSecret } from '../../../_lib/crypto.js'
import { publicError, queryValue, setupBaseUrl } from '../../../_lib/http.js'
import { sessionByOAuthState, sessionFromRequest, updateSession } from '../../../_lib/store.js'
import type { ApiRequest, ApiResponse } from '../../../_lib/types.js'

export default async function handler(request: ApiRequest, response: ApiResponse) {
  try {
    const code = queryValue(request.query.code)
    const state = queryValue(request.query.state)
    const session = state ? await sessionByOAuthState('vercel', state) : null
    if (!code || !session) throw new Error('Vercel authorization could not be verified')
    const cookieSession = await sessionFromRequest(request)
    if (cookieSession?.id !== session.id) throw new Error('Vercel authorization session expired')
    const tokenResponse = await fetch('https://api.vercel.com/v2/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.VERCEL_INTEGRATION_CLIENT_ID ?? '',
        client_secret: process.env.VERCEL_INTEGRATION_CLIENT_SECRET ?? '',
        code,
        redirect_uri: `${setupBaseUrl()}/api/setup/oauth/vercel/callback`,
      }),
    })
    const tokens = await tokenResponse.json() as { access_token?: string; team_id?: string | null; error?: { message?: string } }
    if (!tokens.access_token) throw new Error(tokens.error?.message || 'Vercel did not return an access token')
    await updateSession(session.id, {
      vercel_connected_at: new Date().toISOString(),
      vercel_token_encrypted: encryptSecret(tokens.access_token),
      vercel_team_id: tokens.team_id ?? null,
      vercel_oauth_state: null,
      status: 'ready_to_provision',
      error_message: null,
    })
    response.redirect(302, '/setup?connected=vercel')
  } catch (error) {
    response.redirect(302, `/setup?error=${encodeURIComponent(publicError(error))}`)
  }
}
