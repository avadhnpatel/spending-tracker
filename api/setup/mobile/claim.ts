import { publicError } from '../../_lib/http.js'
import { sessionByMobileClaim, updateSession } from '../../_lib/store.js'
import type { ApiRequest, ApiResponse } from '../../_lib/types.js'

type Input = { sessionId?: string; claimCode?: string }

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    response.status(405).json({ error: 'Method not allowed' })
    return
  }
  try {
    const input = (request.body ?? {}) as Input
    const session = input.sessionId && input.claimCode ? await sessionByMobileClaim(input.sessionId, input.claimCode) : null
    if (!session?.supabase_project_ref || !session.supabase_publishable_key) {
      return response.status(409).json({ error: 'This private app is not ready yet' })
    }
    await updateSession(session.id, {
      mobile_claim_hash: null,
      mobile_handoff_secret_encrypted: null,
    })
    response.status(200).json({
      supabaseUrl: `https://${session.supabase_project_ref}.supabase.co`,
      publishableKey: session.supabase_publishable_key,
      deploymentUrl: session.deployment_url,
    })
  } catch (error) {
    response.status(500).json({ error: publicError(error) })
  }
}
