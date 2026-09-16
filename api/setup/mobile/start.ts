import { setupBaseUrl, publicError } from '../../_lib/http.js'
import { createMobileSession } from '../../_lib/store.js'
import type { ApiRequest, ApiResponse } from '../../_lib/types.js'

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    response.status(405).json({ error: 'Method not allowed' })
    return
  }
  try {
    const { session, browserToken, claimCode } = await createMobileSession()
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
