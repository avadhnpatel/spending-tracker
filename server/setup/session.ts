import { allowMethods, getCookie, publicError, setSessionCookie } from '../_lib/http.js'
import { publicSession, sessionFromRequest } from '../_lib/store.js'
import type { ApiRequest, ApiResponse } from '../_lib/types.js'

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (!allowMethods(request, response, ['GET', 'POST'])) return
  try {
    if (request.method === 'POST') {
      response.status(403).json({ error: 'Start from the Spending Tracker account page so we can securely link your private app.' })
      return
    }
    const session = await sessionFromRequest(request)
    if (!session) {
      response.status(404).json({ error: 'No active setup session' })
      return
    }
    // Sessions created before the shared-domain cookie fix may still have a
    // www-only cookie. Reissue a validated cookie so OAuth callbacks through
    // the apex domain can recover the same setup session.
    const cookie = getCookie(request, 'spend_setup_session')
    if (cookie) setSessionCookie(response, cookie)
    response.status(200).json(publicSession(session))
  } catch (error) {
    response.status(500).json({ error: publicError(error) })
  }
}
