import { encryptSecret, pkceChallenge, randomToken } from '../../../_lib/crypto.js'
import { publicError, setupBaseUrl } from '../../../_lib/http.js'
import { sessionFromRequest, updateSession } from '../../../_lib/store.js'
import type { ApiRequest, ApiResponse } from '../../../_lib/types.js'

export default async function handler(request: ApiRequest, response: ApiResponse) {
  try {
    const session = await sessionFromRequest(request)
    if (!session) return response.redirect(302, '/setup?error=session')
    const clientId = process.env.SUPABASE_OAUTH_CLIENT_ID
    if (!clientId) throw new Error('Supabase OAuth is not configured')
    const state = randomToken()
    const verifier = randomToken(48)
    await updateSession(session.id, {
      supabase_oauth_state: state,
      supabase_pkce_verifier_encrypted: encryptSecret(verifier),
      error_message: null,
    })
    const url = new URL('https://api.supabase.com/v1/oauth/authorize')
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', `${setupBaseUrl()}/api/setup/oauth/supabase/callback`)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('state', state)
    url.searchParams.set('code_challenge', pkceChallenge(verifier))
    url.searchParams.set('code_challenge_method', 'S256')
    response.redirect(302, url.toString())
  } catch (error) {
    response.redirect(302, `/setup?error=${encodeURIComponent(publicError(error))}`)
  }
}
