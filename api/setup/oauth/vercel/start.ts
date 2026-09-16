import { randomToken } from '../../../_lib/crypto.js'
import { publicError, setupBaseUrl } from '../../../_lib/http.js'
import { sessionFromRequest, updateSession } from '../../../_lib/store.js'
import type { ApiRequest, ApiResponse } from '../../../_lib/types.js'

export default async function handler(request: ApiRequest, response: ApiResponse) {
  try {
    const session = await sessionFromRequest(request)
    if (!session) return response.redirect(302, '/setup?error=session')
    const slug = process.env.VERCEL_INTEGRATION_SLUG
    if (!slug) throw new Error('Vercel integration is not configured')
    const state = randomToken()
    await updateSession(session.id, { vercel_oauth_state: state, error_message: null })
    const url = new URL(`https://vercel.com/integrations/${slug}/new`)
    url.searchParams.set('state', state)
    url.searchParams.set('redirect_uri', `${setupBaseUrl()}/api/setup/oauth/vercel/callback`)
    response.redirect(302, url.toString())
  } catch (error) {
    response.redirect(302, `/setup?error=${encodeURIComponent(publicError(error))}`)
  }
}
