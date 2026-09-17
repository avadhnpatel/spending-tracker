import { randomToken } from '../../../_lib/crypto.js'
import { publicError } from '../../../_lib/http.js'
import { sessionFromRequest, updateSession } from '../../../_lib/store.js'
import type { ApiRequest, ApiResponse } from '../../../_lib/types.js'
import { vercelIntegrationUrl } from '../../../_lib/vercel-integration.js'

export default async function handler(request: ApiRequest, response: ApiResponse) {
  try {
    const session = await sessionFromRequest(request)
    if (!session) return response.redirect(302, '/setup?error=session')
    const state = randomToken()
    await updateSession(session.id, { vercel_oauth_state: state, error_message: null })
    response.redirect(302, vercelIntegrationUrl(state))
  } catch (error) {
    response.redirect(302, `/setup?error=${encodeURIComponent(publicError(error))}`)
  }
}
