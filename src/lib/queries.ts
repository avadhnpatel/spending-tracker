import type {
  Category,
  CollectionKind,
  Recurring,
  Tracker,
  TrackerCollection,
  Transaction,
} from '../types'
import { parseAmount } from './format'
import { DEFAULT_CATEGORIES } from './seeds'
import { requireSupabase } from './supabase'

function mapTracker(row: Tracker): Tracker {
  return { ...row, collection_id: row.collection_id ?? row.id, period_start: row.period_start ?? null, period_end: row.period_end ?? null }
}

function mapCategory(row: Category, budget?: string | number | null): Category {
  return { ...row, collection_id: row.collection_id ?? '', budget: budget == null ? null : parseAmount(budget) }
}

function mapRecurring(row: Omit<Recurring, 'amount'> & { amount: string | number }): Recurring {
  return { ...row, collection_id: row.collection_id ?? '', amount: parseAmount(row.amount), end_date: row.end_date ?? null }
}

function mapTransaction(row: Omit<Transaction, 'amount'> & { amount: string | number }): Transaction {
  return { ...row, amount: parseAmount(row.amount) }
}

export function monthBounds(month: string): { start: string; end: string; name: string } {
  const [year, monthNumber] = month.split('-').map(Number)
  const endDay = new Date(year, monthNumber, 0).getDate()
  return {
    start: `${year}-${String(monthNumber).padStart(2, '0')}-01`,
    end: `${year}-${String(monthNumber).padStart(2, '0')}-${endDay}`,
    name: new Date(year, monthNumber - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
  }
}

export async function listCollections(userId: string): Promise<TrackerCollection[]> {
  const { data, error } = await requireSupabase().from('tracker_collections').select('*').eq('user_id', userId).order('created_at')
  if (error) throw error
  return data ?? []
}

export async function listTrackers(userId: string): Promise<Tracker[]> {
  const { data, error } = await requireSupabase().from('trackers').select('*').eq('user_id', userId).order('period_start', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapTracker)
}

export async function createCollection(input: {
  userId: string
  name: string
  note?: string
  color: string
  kind: CollectionKind
  month?: string
  trackerName?: string
}): Promise<{ collection: TrackerCollection; tracker: Tracker }> {
  const db = requireSupabase()
  const { data: collection, error } = await db.from('tracker_collections').insert({
    user_id: input.userId,
    name: input.name.trim(),
    note: input.note?.trim() ?? '',
    color: input.color,
    kind: input.kind,
  }).select('*').single()
  if (error) throw error

  const bounds = input.kind === 'monthly' && input.month ? monthBounds(input.month) : null
  const { data: trackerRow, error: trackerError } = await db.from('trackers').insert({
    user_id: input.userId,
    collection_id: collection.id,
    name: bounds?.name ?? input.trackerName?.trim() ?? input.name.trim(),
    note: '',
    color: input.color,
    period_start: bounds?.start ?? null,
    period_end: bounds?.end ?? null,
  }).select('*').single()
  if (trackerError) throw trackerError
  const tracker = mapTracker(trackerRow)

  const { error: categoryError } = await db.from('categories').insert(DEFAULT_CATEGORIES.map((category, index) => ({
    tracker_id: tracker.id,
    collection_id: collection.id,
    name: category.name,
    color: category.color,
    kind: category.kind,
    sort_order: index,
  })))
  if (categoryError) throw categoryError
  return { collection, tracker }
}

export async function createTrackerInCollection(input: {
  userId: string
  collection: TrackerCollection
  name?: string
  note?: string
  month?: string
  copyBudgetsFrom?: string
}): Promise<Tracker> {
  const db = requireSupabase()
  const bounds = input.collection.kind === 'monthly' && input.month ? monthBounds(input.month) : null
  const { data, error } = await db.from('trackers').insert({
    user_id: input.userId,
    collection_id: input.collection.id,
    name: bounds?.name ?? input.name?.trim() ?? 'New tracker',
    note: input.note?.trim() ?? '',
    color: input.collection.color,
    period_start: bounds?.start ?? null,
    period_end: bounds?.end ?? null,
  }).select('*').single()
  if (error) throw error
  const tracker = mapTracker(data)
  if (input.copyBudgetsFrom) {
    const { data: budgets, error: budgetError } = await db.from('category_budgets').select('category_id, amount').eq('tracker_id', input.copyBudgetsFrom)
    if (budgetError) throw budgetError
    if (budgets?.length) {
      const { error: copyError } = await db.from('category_budgets').insert(budgets.map((budget) => ({ tracker_id: tracker.id, category_id: budget.category_id, amount: budget.amount })))
      if (copyError) throw copyError
    }
  }
  return tracker
}

export async function updateTracker(id: string, patch: Partial<Pick<Tracker, 'name' | 'note' | 'color' | 'archived_at'>>): Promise<void> {
  const { error } = await requireSupabase().from('trackers').update(patch).eq('id', id)
  if (error) throw error
}

export async function listCategories(trackerId: string, collectionId: string): Promise<Category[]> {
  const db = requireSupabase()
  const [{ data: categories, error }, { data: budgets, error: budgetError }] = await Promise.all([
    db.from('categories').select('*').eq('collection_id', collectionId).order('sort_order'),
    db.from('category_budgets').select('category_id, amount').eq('tracker_id', trackerId),
  ])
  if (error) throw error
  if (budgetError) throw budgetError
  const budgetByCategory = new Map((budgets ?? []).map((budget) => [budget.category_id, budget.amount]))
  return (categories ?? []).map((category) => mapCategory(category, budgetByCategory.get(category.id)))
}

export async function createCategory(input: {
  trackerId: string
  collectionId: string
  name: string
  color: string
  kind: Category['kind']
  budget?: number | null
  sortOrder: number
}): Promise<Category> {
  const db = requireSupabase()
  const { data, error } = await db.from('categories').insert({
    tracker_id: input.trackerId,
    collection_id: input.collectionId,
    name: input.name.trim(),
    color: input.color,
    kind: input.kind,
    budget: null,
    sort_order: input.sortOrder,
  }).select('*').single()
  if (error) throw error
  if (input.kind === 'expense' && input.budget !== null && input.budget !== undefined) {
    const { error: budgetError } = await db.from('category_budgets').upsert({ tracker_id: input.trackerId, category_id: data.id, amount: input.budget })
    if (budgetError) throw budgetError
  }
  return mapCategory(data, input.budget)
}

export async function updateCategory(id: string, patch: Partial<Pick<Category, 'name' | 'color' | 'budget'>>, trackerId: string): Promise<void> {
  const db = requireSupabase()
  const { budget, ...categoryPatch } = patch
  if (Object.keys(categoryPatch).length) {
    const { error } = await db.from('categories').update(categoryPatch).eq('id', id)
    if (error) throw error
  }
  if (budget === null) {
    const { error } = await db.from('category_budgets').delete().eq('tracker_id', trackerId).eq('category_id', id)
    if (error) throw error
  } else if (budget !== undefined) {
    const { error } = await db.from('category_budgets').upsert({ tracker_id: trackerId, category_id: id, amount: budget })
    if (error) throw error
  }
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await requireSupabase().from('categories').delete().eq('id', id)
  if (error) throw error
}

export async function listTransactions(trackerId: string): Promise<Transaction[]> {
  const { data, error } = await requireSupabase().from('transactions').select('*').eq('tracker_id', trackerId).order('date', { ascending: false }).order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapTransaction)
}

export async function getTransaction(id: string): Promise<Transaction | null> {
  const { data, error } = await requireSupabase().from('transactions').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? mapTransaction(data) : null
}

export async function upsertTransaction(input: Omit<Transaction, 'created_at' | 'id'> & { id?: string }): Promise<Transaction> {
  const db = requireSupabase()
  const payload = { tracker_id: input.tracker_id, category_id: input.category_id, recurring_id: input.recurring_id, amount: input.amount, kind: input.kind, date: input.date, merchant: input.merchant, notes: input.notes, receipt_path: input.receipt_path }
  if (input.id) {
    const { data, error } = await db.from('transactions').update(payload).eq('id', input.id).select('*').single()
    if (error) throw error
    return mapTransaction(data)
  }
  const { data, error } = await db.from('transactions').insert(payload).select('*').single()
  if (error) throw error
  return mapTransaction(data)
}

export async function deleteTransaction(id: string, receiptPath?: string | null): Promise<void> {
  const db = requireSupabase()
  if (receiptPath) await db.storage.from('receipts').remove([receiptPath])
  const { error } = await db.from('transactions').delete().eq('id', id)
  if (error) throw error
}

export async function uploadReceipt(userId: string, trackerId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${userId}/${trackerId}/${crypto.randomUUID()}.${ext}`
  const { error } = await requireSupabase().storage.from('receipts').upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false })
  if (error) throw error
  return path
}

export async function removeReceipt(path: string): Promise<void> {
  const { error } = await requireSupabase().storage.from('receipts').remove([path])
  if (error) throw error
}

export async function receiptUrl(path: string): Promise<string | null> {
  const { data, error } = await requireSupabase().storage.from('receipts').createSignedUrl(path, 3600)
  return error ? null : data.signedUrl
}

export async function listRecurring(collectionId: string): Promise<Recurring[]> {
  const { data, error } = await requireSupabase().from('recurring').select('*').eq('collection_id', collectionId).order('next_due_date')
  if (error) throw error
  return (data ?? []).map(mapRecurring)
}

export async function upsertRecurring(input: Omit<Recurring, 'id'> & { id?: string }): Promise<Recurring> {
  const db = requireSupabase()
  const payload = { tracker_id: input.tracker_id, collection_id: input.collection_id, category_id: input.category_id, amount: input.amount, kind: input.kind, merchant: input.merchant, cadence: input.cadence, next_due_date: input.next_due_date, end_date: input.end_date, active: input.active }
  if (input.id) {
    const { data, error } = await db.from('recurring').update(payload).eq('id', input.id).select('*').single()
    if (error) throw error
    return mapRecurring(data)
  }
  const { data, error } = await db.from('recurring').insert(payload).select('*').single()
  if (error) throw error
  return mapRecurring(data)
}

export async function deleteRecurring(id: string): Promise<void> {
  const { error } = await requireSupabase().from('recurring').delete().eq('id', id)
  if (error) throw error
}
