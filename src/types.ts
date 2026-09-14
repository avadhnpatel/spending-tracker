export type Kind = 'expense' | 'income'
export type Cadence = 'weekly' | 'monthly' | 'yearly'

export type Tracker = {
  id: string
  user_id: string
  name: string
  note: string
  color: string
  archived_at: string | null
  created_at: string
}

export type Category = {
  id: string
  tracker_id: string
  name: string
  color: string
  kind: Kind
  sort_order: number
}

export type Recurring = {
  id: string
  tracker_id: string
  category_id: string | null
  amount: number
  kind: Kind
  merchant: string
  cadence: Cadence
  next_due_date: string
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
  created_at: string
}

export const TRACKER_COLORS = [
  '#0f766e',
  '#1d4ed8',
  '#7c3aed',
  '#be123c',
  '#c2410c',
  '#a16207',
  '#365314',
  '#0e7490',
] as const
