import { allowMethods, publicError } from '../_lib/http.js'
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
    response.status(200).json(publicSession(session))
  } catch (error) {
    response.status(500).json({ error: publicError(error) })
  }
}
