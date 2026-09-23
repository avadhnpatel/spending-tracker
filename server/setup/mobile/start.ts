import { setupBaseUrl, publicError } from '../../_lib/http.js'
import { directoryUserFromRequest } from '../../_lib/directory.js'
import { createMobileSession } from '../../_lib/store.js'
import type { ApiRequest, ApiResponse } from '../../_lib/types.js'

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    response.status(405).json({ error: 'Method not allowed' })
    return
  }
  try {
    const owner = await directoryUserFromRequest(request)
    const recover = (request.body as { recover?: unknown } | undefined)?.recover === true
    const { session, browserToken, claimCode } = await createMobileSession(owner, recover)
    const url = new URL('/api/setup/mobile/activate', setupBaseUrl())
    url.searchParams.set('token', browserToken)
    response.status(201).json({
      sessionId: session.id,
      claimCode,
      setupUrl: url.toString(),
      expiresAt: session.expires_at,
    })
  } catch (error) {
    response.status(500).json({ error: publicError(error) })
  }
}
