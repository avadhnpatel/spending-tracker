import { clearSessionCookie, allowMethods, publicError, setupBaseUrl } from '../../_lib/http.js'
import { setPlaidSecrets } from '../../_lib/providers.js'
import { privateAppForUser, sessionFromRequest, updateSession } from '../../_lib/store.js'
import type { ApiRequest, ApiResponse } from '../../_lib/types.js'

type Input = { clientId?: unknown; secret?: unknown; environment?: unknown }

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (!allowMethods(request, response, ['POST'])) return
  try {
    const session = await sessionFromRequest(request)
    if (!session || session.status !== 'plaid_connected' || !session.directory_user_id || !session.directory_email) {
      throw new Error('Reconnect Supabase before saving Plaid credentials')
    }
    const app = await privateAppForUser(session.directory_user_id, session.directory_email)
    if (!app || app.supabase_project_ref !== session.supabase_project_ref) throw new Error('This setup session is not authorized for your private project')
    const input = (request.body ?? {}) as Input
    const clientId = typeof input.clientId === 'string' ? input.clientId.trim() : ''
    const secret = typeof input.secret === 'string' ? input.secret.trim() : ''
    const environment = input.environment
    if (!clientId || !secret || !['sandbox', 'development', 'production'].includes(String(environment))) {
      throw new Error('Enter a Plaid Client ID, Secret, and environment')
    }
    await setPlaidSecrets(session, {
      clientId,
      secret,
      environment: environment as 'sandbox' | 'development' | 'production',
      redirectUri: `${setupBaseUrl()}/import`,
    })
    await updateSession(session.id, {
      status: 'complete',
      error_message: null,
      supabase_token_encrypted: null,
      supabase_refresh_token_encrypted: null,
    })
    clearSessionCookie(response)
    response.status(200).json({ configured: true })
  } catch (error) {
    response.status(400).json({ error: publicError(error) })
  }
}
