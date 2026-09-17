import { encryptSecret } from '../../../_lib/crypto.js'
import { githubOAuthConfig, hasRequiredGitHubScope } from '../../../_lib/github-oauth.js'
import { publicError, queryValue } from '../../../_lib/http.js'
import { sessionByOAuthState, sessionFromRequest, updateSession } from '../../../_lib/store.js'
import type { ApiRequest, ApiResponse } from '../../../_lib/types.js'

export default async function handler(request: ApiRequest, response: ApiResponse) {
  try {
    const oauthError = queryValue(request.query.error_description) || queryValue(request.query.error)
    if (oauthError) throw new Error(oauthError === 'access_denied' ? 'GitHub authorization was cancelled' : oauthError)
    const code = queryValue(request.query.code)
    const state = queryValue(request.query.state)
    const session = state ? await sessionByOAuthState('github', state) : null
    if (!code || !session) throw new Error('GitHub authorization could not be verified')
    const cookieSession = await sessionFromRequest(request)
    if (cookieSession?.id !== session.id) throw new Error('GitHub authorization session expired')
    const { clientId, clientSecret, callbackUrl } = githubOAuthConfig()
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: callbackUrl }),
    })
    const tokens = await tokenResponse.json() as { access_token?: string; scope?: string; token_type?: string; error_description?: string }
    if (!tokenResponse.ok || !tokens.access_token) throw new Error(tokens.error_description || 'GitHub did not return an access token')
    if (!hasRequiredGitHubScope(tokens.scope)) throw new Error('GitHub did not grant private repository access. Reconnect GitHub and approve repository access.')
    const userResponse = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    })
    const user = await userResponse.json() as { login?: string }
    if (!userResponse.ok || !user.login) throw new Error('Could not read the authorized GitHub user')
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
