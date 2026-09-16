import { allowMethods, publicError } from '../_lib/http.js'
import { listSupabaseOrganizations } from '../_lib/providers.js'
import { sessionFromRequest } from '../_lib/store.js'
import type { ApiRequest, ApiResponse } from '../_lib/types.js'

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (!allowMethods(request, response, ['GET'])) return
  try {
    const session = await sessionFromRequest(request)
    if (!session?.supabase_token_encrypted) return response.status(409).json({ error: 'Connect Supabase first' })
    response.status(200).json({ organizations: await listSupabaseOrganizations(session) })
  } catch (error) {
    response.status(500).json({ error: publicError(error) })
  }
}
