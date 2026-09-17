import { allowMethods, publicError, setupBaseUrl } from '../_lib/http.js'
import { applySpendSchema, configureSupabaseAuth, createSupabaseProject, deploySpendFunction, getSupabasePublishableKey } from '../_lib/providers.js'
import { claimProvisioningStep, finishProvisioningStep, publicSession, savePrivateApp, sessionFromRequest } from '../_lib/store.js'
import { parseSupabaseRegionGroup, resumableSupabaseProjectName } from '../_lib/supabase-project.js'
import type { ApiRequest, ApiResponse, SetupSession } from '../_lib/types.js'

type Input = { organizationSlug?: string; projectName?: string; regionGroup?: string }

function ready(session: SetupSession): boolean {
  return Boolean(session.supabase_token_encrypted)
}

function normalizedStep(session: SetupSession, claimedStep: string): string {
  if (!session.supabase_project_ref) return 'ready_to_provision'
  if (claimedStep === 'connecting' || claimedStep === 'creating_supabase') return 'applying_schema'
  if (['configuring_supabase', 'linking_vercel', 'deploying'].includes(claimedStep)) return 'applying_schema'
  return claimedStep
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (!allowMethods(request, response, ['POST'])) return
  let session = await sessionFromRequest(request)
  if (!session || !ready(session)) return response.status(409).json({ error: 'Connect Supabase first' })
  if (session.status === 'complete') return response.status(200).json(publicSession(session))

  const claim = await claimProvisioningStep(session)
  if (!claim) return response.status(202).json(publicSession(session))

  const step = normalizedStep(claim.session, claim.step)
  try {
    const input = (request.body ?? {}) as Input
    if (step === 'ready_to_provision') {
      const organizationSlug = input.organizationSlug?.trim()
      const projectName = resumableSupabaseProjectName(input.projectName?.trim() || 'spend-private', claim.session.id)
      if (!organizationSlug) {
        session = await finishProvisioningStep(claim, { status: 'ready_to_provision', error_message: 'Choose a Supabase organization' })
        return response.status(400).json({ error: 'Choose a Supabase organization', session: publicSession(session) })
      }
      const project = await createSupabaseProject(claim.session, organizationSlug, projectName, parseSupabaseRegionGroup(input.regionGroup))
      session = await finishProvisioningStep(claim, { supabase_project_ref: project.ref, status: 'applying_schema' })
    } else if (step === 'applying_schema') {
      await applySpendSchema(claim.session)
      session = await finishProvisioningStep(claim, { status: 'deploying_plaid_link_token' })
    } else if (step === 'deploying_plaid_link_token') {
      await deploySpendFunction(claim.session, 'plaid-link-token')
      session = await finishProvisioningStep(claim, { status: 'deploying_plaid_exchange' })
    } else if (step === 'deploying_plaid_exchange') {
      await deploySpendFunction(claim.session, 'plaid-exchange')
      session = await finishProvisioningStep(claim, { status: 'deploying_plaid_sync' })
    } else if (step === 'deploying_plaid_sync') {
      await deploySpendFunction(claim.session, 'plaid-sync')
      session = await finishProvisioningStep(claim, { status: 'reading_supabase_key' })
    } else if (step === 'reading_supabase_key') {
      const publishableKey = await getSupabasePublishableKey(claim.session)
      session = await finishProvisioningStep(claim, { supabase_publishable_key: publishableKey, status: 'configuring_auth' })
    } else if (step === 'configuring_auth') {
      const deploymentUrl = setupBaseUrl()
      await configureSupabaseAuth(claim.session, deploymentUrl)
      const completed: SetupSession = { ...claim.session, deployment_url: deploymentUrl, status: 'complete', error_message: null }
      await savePrivateApp(completed)
      session = await finishProvisioningStep(claim, {
        deployment_url: deploymentUrl,
        status: 'complete',
        error_message: null,
        github_token_encrypted: null,
        supabase_token_encrypted: null,
        supabase_refresh_token_encrypted: null,
        vercel_token_encrypted: null,
      })
      return response.status(200).json(publicSession(session))
    } else {
      throw new Error(`Setup cannot resume from status “${step}”`)
    }

    response.status(202).json(publicSession(session))
  } catch (error) {
    const message = publicError(error)
    try {
      session = await finishProvisioningStep(claim, { status: step, error_message: message })
    } catch {
      session = (await sessionFromRequest(request)) ?? session
    }
    response.status(500).json({ error: message, session: publicSession(session) })
  }
}
