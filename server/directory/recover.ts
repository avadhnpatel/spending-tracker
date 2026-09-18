import { directoryUserFromRequest } from '../_lib/directory.js'
import { allowMethods, publicError } from '../_lib/http.js'
import { createSession, publicSession, updateSession } from '../_lib/store.js'
import type { ApiRequest, ApiResponse } from '../_lib/types.js'

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (!allowMethods(request, response, ['POST'])) return
  try {
    const user = await directoryUserFromRequest(request)
    const created = await createSession(response, user)
    const session = await updateSession(created.id, { status: 'recover_project' })
    response.status(201).json(publicSession(session))
  } catch (error) {
    response.status(401).json({ error: publicError(error) })
  }
}
