export type Kind = 'expense' | 'income'
export type Cadence = 'weekly' | 'monthly' | 'yearly'
export type CollectionKind = 'monthly' | 'custom'

export type TrackerCollection = {
  id: string
  user_id: string
  name: string
  note: string
  color: string
  kind: CollectionKind
  archived_at: string | null
  created_at: string
}

export type Tracker = {
  id: string
  user_id: string
  collection_id: string
  name: string
  note: string
  color: string
  period_start: string | null
  period_end: string | null
  archived_at: string | null
  created_at: string
}

export type Category = {
  id: string
  tracker_id: string
  collection_id: string
  name: string
  color: string
  kind: Kind
  budget: number | null
  sort_order: number
}

export type Recurring = {
  id: string
  tracker_id: string
  collection_id: string
  category_id: string | null
  amount: number
  kind: Kind
  merchant: string
  cadence: Cadence
  next_due_date: string
  end_date: string | null
  active: boolean
}

export type Transaction = {
  id: string
  tracker_id: string
  category_id: string | null
  recurring_id: string | null
  amount: number
  kind: Kind
  date: string
  merchant: string
  notes: string
  receipt_path: string | null
  import_candidate_id: string | null
  source_provider: string | null
  source_transaction_id: string | null
  source_account_id: string | null
  created_at: string
}

export type ImportProvider = 'csv' | 'plaid'
export type ImportStatus = 'pending' | 'imported' | 'excluded' | 'removed'

export type ImportCandidate = {
  id: string
  user_id: string
  provider: ImportProvider
  external_id: string
  connection_id: string | null
  account_id: string | null
  account_name: string
  date: string
  amount: number
  kind: Kind
  merchant: string
  category_hint: string
  pending: boolean
  status: ImportStatus
  imported_transaction_id: string | null
  created_at: string
  updated_at: string
}

export type FinancialAccount = {
  id: string
  user_id: string
  connection_id: string
  provider_account_id: string
  name: string
  mask: string | null
  type: string
  subtype: string
  created_at: string
}

export const TRACKER_COLORS = [
  '#0f766e',
  '#059669',
  '#16a34a',
  '#65a30d',
  '#1d4ed8',
  '#0284c7',
  '#7c3aed',
  '#9333ea',
  '#db2777',
  '#be123c',
  '#dc2626',
  '#c2410c',
  '#a16207',
  '#365314',
  '#0e7490',
  '#475569',
] as const
