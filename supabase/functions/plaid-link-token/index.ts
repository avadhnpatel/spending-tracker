import { optionsResponse, json } from '../_shared/http.ts'
import { plaidRequest } from '../_shared/plaid.ts'
import { requireUser } from '../_shared/supabase.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return optionsResponse()
  try {
    const { user } = await requireUser(request)
    const redirectUri = Deno.env.get('PLAID_REDIRECT_URI')
    const webhook = Deno.env.get('PLAID_WEBHOOK_URL')
    const result = await plaidRequest<{ link_token: string }>('/link/token/create', {
      user: { client_user_id: user.id },
      client_name: 'Spend',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
      ...(redirectUri ? { redirect_uri: redirectUri } : {}),
      ...(webhook ? { webhook } : {}),
    })
    return json({ link_token: result.link_token })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not start Plaid Link' }, 400)
  }
})
