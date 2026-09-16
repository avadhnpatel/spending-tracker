import { encryptSecret } from '../../../_lib/crypto.js'
import { publicError, queryValue, setupBaseUrl } from '../../../_lib/http.js'
import { sessionByOAuthState, sessionFromRequest, updateSession } from '../../../_lib/store.js'
import type { ApiRequest, ApiResponse } from '../../../_lib/types.js'

export default async function handler(request: ApiRequest, response: ApiResponse) {
  try {
    const code = queryValue(request.query.code)
    const state = queryValue(request.query.state)
    const session = state ? await sessionByOAuthState('github', state) : null
    if (!code || !session) throw new Error('GitHub authorization could not be verified')
    const cookieSession = await sessionFromRequest(request)
    if (cookieSession?.id !== session.id) throw new Error('GitHub authorization session expired')
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.GITHUB_APP_CLIENT_ID,
        client_secret: process.env.GITHUB_APP_CLIENT_SECRET,
        code,
        redirect_uri: `${setupBaseUrl()}/api/setup/oauth/github/callback`,
      }),
    })
    const tokens = await tokenResponse.json() as { access_token?: string; error_description?: string }
    if (!tokens.access_token) throw new Error(tokens.error_description || 'GitHub did not return an access token')
    const userResponse = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/vnd.github+json' },
    })
    const user = await userResponse.json() as { login?: string }
    if (!user.login) throw new Error('Could not read the authorized GitHub user')
    await updateSession(session.id, {
      github_connected_at: new Date().toISOString(),
      github_login: user.login,
      github_token_encrypted: encryptSecret(tokens.access_token),
      github_oauth_state: null,
      status: 'connecting',
      error_message: null,
    })
    response.redirect(302, '/setup?connected=github')
  } catch (error) {
    response.redirect(302, `/setup?error=${encodeURIComponent(publicError(error))}`)
  }
}
