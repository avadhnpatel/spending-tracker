import { optionsResponse, json } from '../_shared/http.ts'
import { plaidRequest } from '../_shared/plaid.ts'
import { adminClient, requireUser } from '../_shared/supabase.ts'

type Connection = { id: string; user_id: string; access_token: string; cursor: string | null }
type PlaidTransaction = {
  transaction_id: string
  account_id: string
  date: string
  amount: number
  name: string
  merchant_name: string | null
  pending: boolean
  personal_finance_category?: { primary?: string } | null
}

async function syncConnection(admin: ReturnType<typeof adminClient>, connection: Connection): Promise<number> {
  let cursor = connection.cursor
  let hasMore = true
  const changed: PlaidTransaction[] = []
  const removed: Array<{ transaction_id: string }> = []
  while (hasMore) {
    const page = await plaidRequest<{
      added: PlaidTransaction[]
      modified: PlaidTransaction[]
      removed: Array<{ transaction_id: string }>
      next_cursor: string
      has_more: boolean
    }>('/transactions/sync', {
      access_token: connection.access_token,
      cursor: cursor ?? undefined,
      count: 500,
      options: { include_personal_finance_category: true, days_requested: 730 },
    })
    changed.push(...page.added, ...page.modified)
    removed.push(...page.removed)
    cursor = page.next_cursor
    hasMore = page.has_more
  }

  const { data: accounts, error: accountError } = await admin.from('financial_accounts').select('provider_account_id,name').eq('connection_id', connection.id)
  if (accountError) throw accountError
  const accountNames = new Map((accounts ?? []).map((account) => [account.provider_account_id, account.name]))
  const ids = changed.map((transaction) => transaction.transaction_id)
  const { data: existing, error: existingError } = ids.length
    ? await admin.from('import_candidates').select('id,external_id').eq('user_id', connection.user_id).eq('provider', 'plaid').in('external_id', ids)
    : { data: [], error: null }
  if (existingError) throw existingError
  const existingById = new Map((existing ?? []).map((row) => [row.external_id, row.id]))
  const values = (transaction: PlaidTransaction) => ({
    user_id: connection.user_id,
    provider: 'plaid',
    external_id: transaction.transaction_id,
    connection_id: connection.id,
    account_id: transaction.account_id,
    account_name: accountNames.get(transaction.account_id) ?? '',
    date: transaction.date,
    amount: Math.abs(transaction.amount),
    kind: transaction.amount >= 0 ? 'expense' : 'income',
    merchant: transaction.merchant_name || transaction.name,
    category_hint: transaction.personal_finance_category?.primary?.replaceAll('_', ' ') ?? '',
    pending: transaction.pending,
    updated_at: new Date().toISOString(),
  })
  const newRows = changed.filter((transaction) => !existingById.has(transaction.transaction_id)).map((transaction) => ({ ...values(transaction), status: 'pending' }))
  if (newRows.length) {
    const { error } = await admin.from('import_candidates').insert(newRows)
    if (error) throw error
  }
  for (const transaction of changed.filter((row) => existingById.has(row.transaction_id))) {
    const { user_id: _userId, provider: _provider, external_id: _externalId, ...patch } = values(transaction)
    const { error } = await admin.from('import_candidates').update(patch).eq('id', existingById.get(transaction.transaction_id))
    if (error) throw error
  }
  if (removed.length) {
    const { error } = await admin.from('import_candidates').update({ status: 'removed', updated_at: new Date().toISOString() })
      .eq('user_id', connection.user_id).eq('provider', 'plaid').eq('status', 'pending')
      .in('external_id', removed.map((row) => row.transaction_id))
    if (error) throw error
  }
  const { error: connectionError } = await admin.from('financial_connections').update({
    cursor,
    status: 'active',
    error_code: null,
    last_synced_at: new Date().toISOString(),
  }).eq('id', connection.id)
  if (connectionError) throw connectionError
  return newRows.length
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return optionsResponse()
  try {
    const cronSecret = Deno.env.get('PLAID_CRON_SECRET')
    const isCron = Boolean(cronSecret && request.headers.get('x-cron-secret') === cronSecret)
    const admin = adminClient()
    let userId: string | null = null
    if (!isCron) userId = (await requireUser(request)).user.id
    let query = admin.from('financial_connections').select('id,user_id,access_token,cursor').eq('provider', 'plaid').eq('status', 'active')
    if (userId) query = query.eq('user_id', userId)
    const { data: connections, error } = await query
    if (error) throw error
    let staged = 0
    for (const connection of connections ?? []) staged += await syncConnection(admin, connection)
    return json({ staged })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not sync transactions' }, 400)
  }
})
