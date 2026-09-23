import { allowMethods, publicError } from '../_lib/http.js'
import { listSupabaseOrganizations, listSupabaseProjects } from '../_lib/providers.js'
import { sessionFromRequest } from '../_lib/store.js'
import { isControlPlaneProject } from '../_lib/supabase-project.js'
import type { ApiRequest, ApiResponse } from '../_lib/types.js'

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (!allowMethods(request, response, ['GET'])) return
  try {
    const session = await sessionFromRequest(request)
    if (!session?.supabase_token_encrypted) return response.status(409).json({ error: 'Connect Supabase first' })
    const [organizations, projects] = await Promise.all([listSupabaseOrganizations(session), listSupabaseProjects(session)])
    response.status(200).json({ organizations, projects: projects.filter((project) => !isControlPlaneProject(project.ref)) })
  } catch (error) {
    response.status(500).json({ error: publicError(error) })
  }
}
