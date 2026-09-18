import { directoryUserFromRequest } from '../_lib/directory.js'
import { allowMethods, publicError } from '../_lib/http.js'
import { createSession, privateAppForUser, publicSession } from '../_lib/store.js'
import type { ApiRequest, ApiResponse } from '../_lib/types.js'

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (!allowMethods(request, response, ['POST'])) return
  try {
    const user = await directoryUserFromRequest(request)
    const app = await privateAppForUser(user.id, user.email)
    const replace = Boolean((request.body as { replace?: unknown } | undefined)?.replace)
    if (app && !replace) return response.status(409).json({ error: 'You already have a private Spending Tracker app', app })
    response.status(201).json(publicSession(await createSession(response, user)))
  } catch (error) {
    response.status(401).json({ error: publicError(error) })
  }
}
