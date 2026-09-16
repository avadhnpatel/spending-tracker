import { publicError, queryValue, setSessionCookie } from '../../_lib/http.js'
import { mobileSessionCookieValue, sessionByMobileHandoff, updateSession } from '../../_lib/store.js'
import type { ApiRequest, ApiResponse } from '../../_lib/types.js'

export default async function handler(request: ApiRequest, response: ApiResponse) {
  try {
    const token = queryValue(request.query.token)
    const session = token ? await sessionByMobileHandoff(token) : null
    if (!session) throw new Error('This mobile setup link has expired. Return to Spend and start setup again.')
    setSessionCookie(response, mobileSessionCookieValue(session))
    await updateSession(session.id, { mobile_handoff_hash: null })
    response.redirect(302, '/setup')
  } catch (error) {
    response.redirect(302, `/setup?error=${encodeURIComponent(publicError(error))}`)
  }
}
