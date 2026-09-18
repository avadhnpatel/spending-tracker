import { directoryUserFromRequest } from '../_lib/directory.js'
import { allowMethods, publicError } from '../_lib/http.js'
import { privateAppForUser } from '../_lib/store.js'
import type { ApiRequest, ApiResponse } from '../_lib/types.js'

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (!allowMethods(request, response, ['GET'])) return
  try {
    const user = await directoryUserFromRequest(request)
    response.status(200).json({ email: user.email, app: await privateAppForUser(user.id, user.email) })
  } catch (error) {
    response.status(401).json({ error: publicError(error) })
  }
}
