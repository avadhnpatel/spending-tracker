import { randomToken } from '../../../_lib/crypto.js'
import { publicError, setupBaseUrl } from '../../../_lib/http.js'
import { sessionFromRequest, updateSession } from '../../../_lib/store.js'
import type { ApiRequest, ApiResponse } from '../../../_lib/types.js'

export default async function handler(request: ApiRequest, response: ApiResponse) {
  try {
    const session = await sessionFromRequest(request)
    if (!session) return response.redirect(302, '/setup?error=session')
    const clientId = process.env.GITHUB_APP_CLIENT_ID
    if (!clientId) throw new Error('GitHub App is not configured')
    const state = randomToken()
    await updateSession(session.id, { github_oauth_state: state, error_message: null })
    const url = new URL('https://github.com/login/oauth/authorize')
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', `${setupBaseUrl()}/api/setup/oauth/github/callback`)
    url.searchParams.set('state', state)
    response.redirect(302, url.toString())
  } catch (error) {
    response.redirect(302, `/setup?error=${encodeURIComponent(publicError(error))}`)
  }
}
