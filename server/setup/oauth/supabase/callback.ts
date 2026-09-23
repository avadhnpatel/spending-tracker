import { decryptSecret, encryptSecret } from '../../../_lib/crypto.js'
import { publicError, queryValue, setupBaseUrl } from '../../../_lib/http.js'
import { sessionByOAuthState, sessionFromRequest, updateSession } from '../../../_lib/store.js'
import type { ApiRequest, ApiResponse } from '../../../_lib/types.js'

export default async function handler(request: ApiRequest, response: ApiResponse) {
  let plaidSetup = false
  try {
    const code = queryValue(request.query.code)
    const state = queryValue(request.query.state)
    const session = state ? await sessionByOAuthState('supabase', state) : null
    plaidSetup = session?.status === 'plaid_connecting'
    if (!code || !session?.supabase_pkce_verifier_encrypted) throw new Error('Supabase authorization could not be verified')
    const cookieSession = await sessionFromRequest(request)
    if (cookieSession?.id !== session.id) throw new Error('Supabase authorization session expired')
    const clientId = process.env.SUPABASE_OAUTH_CLIENT_ID ?? ''
    const clientSecret = process.env.SUPABASE_OAUTH_CLIENT_SECRET ?? ''
    const tokenResponse = await fetch('https://api.supabase.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${setupBaseUrl()}/api/setup/oauth/supabase/callback`,
        code_verifier: decryptSecret(session.supabase_pkce_verifier_encrypted),
      }),
    })
    const tokens = await tokenResponse.json() as { access_token?: string; refresh_token?: string; error_description?: string }
    if (!tokens.access_token) throw new Error(tokens.error_description || 'Supabase did not return an access token')
    await updateSession(session.id, {
      supabase_connected_at: new Date().toISOString(),
      supabase_token_encrypted: encryptSecret(tokens.access_token),
      supabase_refresh_token_encrypted: tokens.refresh_token ? encryptSecret(tokens.refresh_token) : null,
      supabase_oauth_state: null,
      supabase_pkce_verifier_encrypted: null,
      status: plaidSetup ? 'plaid_connected' : session.status === 'recover_project' ? 'recover_project' : 'connecting',
      error_message: null,
    })
    response.redirect(302, plaidSetup ? '/account?plaid=connected' : '/setup?connected=supabase')
  } catch (error) {
    response.redirect(302, `${plaidSetup ? '/account?plaid=1&error=' : '/setup?error='}${encodeURIComponent(publicError(error))}`)
  }
}
