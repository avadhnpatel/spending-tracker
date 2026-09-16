import { optionsResponse, json } from '../_shared/http.ts'
import { plaidRequest } from '../_shared/plaid.ts'
import { requireUser } from '../_shared/supabase.ts'

type PlaidAccount = { account_id: string; name: string; mask: string | null; type: string; subtype: string }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return optionsResponse()
  try {
    const { admin, user } = await requireUser(request)
    const body = await request.json()
    if (!body.public_token) throw new Error('Missing public token')
    const exchange = await plaidRequest<{ access_token: string; item_id: string }>('/item/public_token/exchange', {
      public_token: body.public_token,
    })
    const { data: existing } = await admin.from('financial_connections').select('id,user_id').eq('provider', 'plaid').eq('provider_item_id', exchange.item_id).maybeSingle()
    if (existing && existing.user_id !== user.id) throw new Error('This connection belongs to another user')
    const connectionValues = {
      user_id: user.id,
      provider: 'plaid',
      provider_item_id: exchange.item_id,
      access_token: exchange.access_token,
      institution_name: body.institution?.name ?? '',
      status: 'active',
      error_code: null,
    }
    const connectionResult = existing
      ? await admin.from('financial_connections').update(connectionValues).eq('id', existing.id).select('id').single()
      : await admin.from('financial_connections').insert(connectionValues).select('id').single()
    if (connectionResult.error) throw connectionResult.error

    const accountResult = await plaidRequest<{ accounts: PlaidAccount[] }>('/accounts/get', { access_token: exchange.access_token })
    if (accountResult.accounts.length) {
      const { error } = await admin.from('financial_accounts').upsert(accountResult.accounts.map((account) => ({
        user_id: user.id,
        connection_id: connectionResult.data.id,
        provider_account_id: account.account_id,
        name: account.name,
        mask: account.mask,
        type: account.type,
        subtype: account.subtype,
      })), { onConflict: 'connection_id,provider_account_id' })
      if (error) throw error
    }
    return json({ connected: true })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not connect account' }, 400)
  }
})
