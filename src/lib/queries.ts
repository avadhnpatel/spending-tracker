import type { Category, Recurring, Tracker, Transaction } from '../types'
import { parseAmount } from './format'
import { DEFAULT_CATEGORIES } from './seeds'
import { requireSupabase } from './supabase'

function mapTracker(row: Tracker): Tracker {
  return row
}

function mapCategory(
  row: Omit<Category, 'budget'> & { budget: string | number | null },
): Category {
  return { ...row, budget: row.budget == null ? null : parseAmount(row.budget) }
}

function mapRecurring(row: Omit<Recurring, 'amount'> & { amount: string | number }): Recurring {
  return { ...row, amount: parseAmount(row.amount) }
}

function mapTransaction(
  row: Omit<Transaction, 'amount'> & { amount: string | number },
): Transaction {
  return { ...row, amount: parseAmount(row.amount) }
}

export async function listTrackers(userId: string): Promise<Tracker[]> {
  const { data, error } = await requireSupabase()
    .from('trackers')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapTracker)
}

export async function createTracker(input: {
  userId: string
  name: string
  note?: string
  color: string
}): Promise<Tracker> {
  const db = requireSupabase()
  const { data, error } = await db
    .from('trackers')
    .insert({
      user_id: input.userId,
      name: input.name.trim(),
      note: input.note?.trim() ?? '',
      color: input.color,
    })
    .select('*')
    .single()
  if (error) throw error
  const tracker = mapTracker(data)
  const { error: catError } = await db.from('categories').insert(
    DEFAULT_CATEGORIES.map((c, i) => ({
      tracker_id: tracker.id,
      name: c.name,
      color: c.color,
      kind: c.kind,
      sort_order: i,
    })),
  )
  if (catError) throw catError
  return tracker
}

export async function updateTracker(
  id: string,
  patch: Partial<Pick<Tracker, 'name' | 'note' | 'color' | 'archived_at'>>,
): Promise<void> {
  const { error } = await requireSupabase().from('trackers').update(patch).eq('id', id)
  if (error) throw error
}

export async function duplicateTracker(source: Tracker, userId: string): Promise<Tracker> {
  const db = requireSupabase()
  const copy = await createTracker({
    userId,
    name: `${source.name} copy`,
    note: source.note,
    color: source.color,
  })
  const { data: sourceCats, error: catsErr } = await db
    .from('categories')
    .select('*')
    .eq('tracker_id', source.id)
    .order('sort_order')
  if (catsErr) throw catsErr

  await db.from('categories').delete().eq('tracker_id', copy.id)

  const { data: newCats, error: insertCatsErr } = await db
    .from('categories')
    .insert(
      (sourceCats ?? []).map((c) => ({
        tracker_id: copy.id,
        name: c.name,
        color: c.color,
        kind: c.kind,
        budget: c.budget,
        sort_order: c.sort_order,
      })),
    )
    .select('*')
  if (insertCatsErr) throw insertCatsErr

  const idMap = new Map<string, string>()
  ;(sourceCats ?? []).forEach((old, i) => {
    const neu = newCats?.[i]
    if (neu) idMap.set(old.id, neu.id)
  })

  const { data: recs, error: recsErr } = await db
    .from('recurring')
    .select('*')
    .eq('tracker_id', source.id)
  if (recsErr) throw recsErr

  if (recs?.length) {
    const { error: recInsertErr } = await db.from('recurring').insert(
      recs.map((r) => ({
        tracker_id: copy.id,
        category_id: r.category_id ? (idMap.get(r.category_id) ?? null) : null,
        amount: r.amount,
        kind: r.kind,
        merchant: r.merchant,
        cadence: r.cadence,
        next_due_date: r.next_due_date,
        active: r.active,
      })),
    )
    if (recInsertErr) throw recInsertErr
  }

  return copy
}

export async function listCategories(trackerId: string): Promise<Category[]> {
  const { data, error } = await requireSupabase()
    .from('categories')
    .select('*')
    .eq('tracker_id', trackerId)
    .order('sort_order')
  if (error) throw error
  return (data ?? []).map(mapCategory)
}

export async function createCategory(input: {
  trackerId: string
  name: string
  color: string
  kind: Category['kind']
  budget?: number | null
  sortOrder: number
}): Promise<Category> {
  const { data, error } = await requireSupabase()
    .from('categories')
    .insert({
      tracker_id: input.trackerId,
      name: input.name.trim(),
      color: input.color,
      kind: input.kind,
      budget: input.kind === 'expense' ? (input.budget ?? null) : null,
      sort_order: input.sortOrder,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapCategory(data)
}

export async function updateCategory(
  id: string,
  patch: Partial<Pick<Category, 'name' | 'color' | 'budget'>>,
): Promise<void> {
  const { error } = await requireSupabase().from('categories').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await requireSupabase().from('categories').delete().eq('id', id)
  if (error) throw error
}

export async function listTransactions(trackerId: string): Promise<Transaction[]> {
  const { data, error } = await requireSupabase()
    .from('transactions')
    .select('*')
    .eq('tracker_id', trackerId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapTransaction)
}

export async function getTransaction(id: string): Promise<Transaction | null> {
  const { data, error } = await requireSupabase()
    .from('transactions')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? mapTransaction(data) : null
}

export async function upsertTransaction(
  input: Omit<Transaction, 'created_at' | 'id'> & { id?: string },
): Promise<Transaction> {
  const db = requireSupabase()
  const payload = {
    tracker_id: input.tracker_id,
    category_id: input.category_id,
    recurring_id: input.recurring_id,
    amount: input.amount,
    kind: input.kind,
    date: input.date,
    merchant: input.merchant,
    notes: input.notes,
    receipt_path: input.receipt_path,
  }
  if (input.id) {
    const { data, error } = await db
      .from('transactions')
      .update(payload)
      .eq('id', input.id)
      .select('*')
      .single()
    if (error) throw error
    return mapTransaction(data)
  }
  const { data, error } = await db.from('transactions').insert(payload).select('*').single()
  if (error) throw error
  return mapTransaction(data)
}

export async function deleteTransaction(id: string, receiptPath?: string | null): Promise<void> {
  const db = requireSupabase()
  if (receiptPath) {
    await db.storage.from('receipts').remove([receiptPath])
  }
  const { error } = await db.from('transactions').delete().eq('id', id)
  if (error) throw error
}

export async function uploadReceipt(userId: string, trackerId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${userId}/${trackerId}/${crypto.randomUUID()}.${ext}`
  const { error } = await requireSupabase().storage.from('receipts').upload(path, file, {
    contentType: file.type || 'image/jpeg',
    upsert: false,
  })
  if (error) throw error
  return path
}

export async function removeReceipt(path: string): Promise<void> {
  const { error } = await requireSupabase().storage.from('receipts').remove([path])
  if (error) throw error
}

export async function receiptUrl(path: string): Promise<string | null> {
  const { data, error } = await requireSupabase().storage.from('receipts').createSignedUrl(path, 3600)
  if (error) return null
  return data.signedUrl
}

export async function listRecurring(trackerId: string): Promise<Recurring[]> {
  const { data, error } = await requireSupabase()
    .from('recurring')
    .select('*')
    .eq('tracker_id', trackerId)
    .order('next_due_date')
  if (error) throw error
  return (data ?? []).map(mapRecurring)
}

export async function upsertRecurring(
  input: Omit<Recurring, 'id'> & { id?: string },
): Promise<Recurring> {
  const db = requireSupabase()
  const payload = {
    tracker_id: input.tracker_id,
    category_id: input.category_id,
    amount: input.amount,
    kind: input.kind,
    merchant: input.merchant,
    cadence: input.cadence,
    next_due_date: input.next_due_date,
    active: input.active,
  }
  if (input.id) {
    const { data, error } = await db
      .from('recurring')
      .update(payload)
      .eq('id', input.id)
      .select('*')
      .single()
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
