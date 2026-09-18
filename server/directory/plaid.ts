import { directoryUserFromRequest } from '../_lib/directory.js'
import { allowMethods, publicError } from '../_lib/http.js'
import { createSession, privateAppForUser, publicSession, updateSession } from '../_lib/store.js'
import type { ApiRequest, ApiResponse } from '../_lib/types.js'

/** Begins a short-lived Supabase reauthorization solely to write Edge secrets. */
export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (!allowMethods(request, response, ['POST'])) return
  try {
    const user = await directoryUserFromRequest(request)
    const app = await privateAppForUser(user.id, user.email)
    if (!app) throw new Error('Set up your private database before enabling bank sync')
    const created = await createSession(response, user)
    const session = await updateSession(created.id, {
      status: 'plaid_connecting',
      supabase_project_ref: app.supabase_project_ref,
    })
    response.status(201).json(publicSession(session))
  } catch (error) {
    response.status(401).json({ error: publicError(error) })
  }
}
