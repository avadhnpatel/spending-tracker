import { allowMethods, publicError } from '../_lib/http.js'
import { applySpendSchema, configureSupabaseAuth, createSupabaseProject, createVercelDeployment, createVercelProject, deploySpendFunctions, getSupabasePublishableKey, linkVercelRepository } from '../_lib/providers.js'
import { publicSession, savePrivateApp, sessionFromRequest, updateSession } from '../_lib/store.js'
import { parseSupabaseRegionGroup } from '../_lib/supabase-project.js'
import type { ApiRequest, ApiResponse, SetupSession } from '../_lib/types.js'

type Input = { organizationSlug?: string; projectName?: string; regionGroup?: string }

function ready(session: SetupSession): boolean {
  return Boolean(session.repository_full_name && session.github_token_encrypted && session.supabase_token_encrypted && session.vercel_token_encrypted)
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (!allowMethods(request, response, ['POST'])) return
  let session = await sessionFromRequest(request)
  if (!session || !ready(session)) return response.status(409).json({ error: 'Connect all three services and create the repository first' })
  try {
    const input = (request.body ?? {}) as Input
    if (!session.supabase_project_ref) {
      const organizationSlug = input.organizationSlug?.trim()
      const projectName = input.projectName?.trim() || session.repository_full_name!.split('/')[1]!
      if (!organizationSlug) return response.status(400).json({ error: 'Choose a Supabase organization' })
      session = await updateSession(session.id, { status: 'creating_supabase', error_message: null })
      const project = await createSupabaseProject(session, organizationSlug, projectName, parseSupabaseRegionGroup(input.regionGroup))
      session = await updateSession(session.id, { supabase_project_ref: project.ref, status: 'configuring_supabase' })
      return response.status(202).json(publicSession(session))
    }

    if (!session.vercel_project_id) {
      session = await updateSession(session.id, { status: 'configuring_supabase', error_message: null })
      await applySpendSchema(session)
      await deploySpendFunctions(session)
      const publishableKey = await getSupabasePublishableKey(session)
      const project = await createVercelProject(session, publishableKey)
      session = await updateSession(session.id, { vercel_project_id: project.id, supabase_publishable_key: publishableKey, status: 'linking_vercel' })
      return response.status(202).json(publicSession(session))
    }

    if (session.status === 'linking_vercel') {
      const project = await linkVercelRepository(session)
      if (project.id !== session.vercel_project_id) {
        session = await updateSession(session.id, { vercel_project_id: project.id, error_message: null })
      }
      // Vercel OAuth integration tokens cannot modify Vercel Authentication.
      // New personal projects are public by default, so this account-level
      // setting must not block repository linking or deployment.
      session = await updateSession(session.id, { status: 'deploying', error_message: null })
      return response.status(202).json(publicSession(session))
    }

    if (!session.deployment_url) {
      const deployment = await createVercelDeployment(session)
      const previewUrl = `https://${deployment.url}`
      const deploymentUrl = `https://${deployment.projectName}.vercel.app`
      await configureSupabaseAuth(session, deploymentUrl, previewUrl)
      session = await updateSession(session.id, {
        deployment_url: deploymentUrl,
        status: 'complete',
        error_message: null,
        github_token_encrypted: null,
        supabase_token_encrypted: null,
        supabase_refresh_token_encrypted: null,
        vercel_token_encrypted: null,
      })
      await savePrivateApp(session)
      return response.status(200).json(publicSession(session))
    }

    response.status(200).json(publicSession(session))
  } catch (error) {
    const message = publicError(error)
    session = await updateSession(session.id, { error_message: message })
    response.status(500).json({ error: message, session: publicSession(session) })
  }
}
