import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTrackers } from '../context/TrackerContext'
import { advanceDate, formatMoney, todayISO } from '../lib/format'
import {
  deleteRecurring,
  listCategories,
  listRecurring,
  upsertRecurring,
  upsertTransaction,
} from '../lib/queries'
import type { Cadence, Category, Kind, Recurring } from '../types'

export function RecurringPage() {
  const { active } = useTrackers()
  const [rows, setRows] = useState<Recurring[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [merchant, setMerchant] = useState('')
  const [amount, setAmount] = useState('')
  const [kind, setKind] = useState<Kind>('expense')
  const [cadence, setCadence] = useState<Cadence>('monthly')
  const [due, setDue] = useState(todayISO())
  const [categoryId, setCategoryId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!active) return
    const [r, c] = await Promise.all([listRecurring(active.id), listCategories(active.id)])
    setRows(r)
    setCategories(c)
  }, [active])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!active) return
    const n = Number.parseFloat(amount)
    if (!Number.isFinite(n) || n <= 0) return
    await upsertRecurring({
      tracker_id: active.id,
      category_id: categoryId,
      amount: n,
      kind,
      merchant: merchant.trim(),
      cadence,
      next_due_date: due,
      active: true,
    })
    setMerchant('')
    setAmount('')
    await refresh()
  }

  async function markPaid(row: Recurring) {
    if (!active) return
    await upsertTransaction({
      tracker_id: active.id,
      category_id: row.category_id,
      recurring_id: row.id,
      amount: row.amount,
      kind: row.kind,
      date: row.next_due_date,
      merchant: row.merchant,
      notes: `Recurring (${row.cadence})`,
      receipt_path: null,
    })
    await upsertRecurring({
      ...row,
      next_due_date: advanceDate(row.next_due_date, row.cadence),
    })
    await refresh()
  }

  if (!active) return <p className="py-8 text-stone-500">Create a tracker first.</p>

  const cats = categories.filter((c) => c.kind === kind)

  return (
    <div className="space-y-4 pb-6">
      <Link to="/more" className="text-sm font-medium text-teal-800">
        ← More
      </Link>
      <h1 className="text-2xl font-semibold">Recurring</h1>

      <form onSubmit={onCreate} className="space-y-3 rounded-3xl bg-white p-4 shadow-sm">
        <input
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          placeholder="Name (Netflix, rent…)"
          className="w-full rounded-2xl bg-stone-50 px-4 py-3 outline-none"
        />
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
          className="w-full rounded-2xl bg-stone-50 px-4 py-3 outline-none"
        />
        <div className="grid grid-cols-2 gap-2">
          {(['expense', 'income'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-xl py-2 capitalize ${kind === k ? 'bg-teal-800 text-white' : 'bg-stone-50'}`}
            >
              {k}
            </button>
          ))}
        </div>
        <select
          value={cadence}
          onChange={(e) => setCadence(e.target.value as Cadence)}
          className="w-full rounded-2xl bg-stone-50 px-4 py-3"
        >
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
        <input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className="w-full rounded-2xl bg-stone-50 px-4 py-3"
        />
        <select
          value={categoryId ?? ''}
          onChange={(e) => setCategoryId(e.target.value || null)}
          className="w-full rounded-2xl bg-stone-50 px-4 py-3"
        >
          <option value="">No category</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="submit" className="w-full rounded-2xl bg-teal-800 py-3 font-semibold text-white">
          Add recurring
        </button>
      </form>

      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded-3xl bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{r.merchant || 'Untitled'}</p>
                <p className="text-sm text-stone-500">
                  {formatMoney(r.amount)} · {r.cadence} · next {r.next_due_date}
                </p>
              </div>
              <p className="text-xs text-stone-400">{r.kind}</p>
            </div>
            <div className="mt-3 flex gap-4 text-sm font-medium">
              <button type="button" className="text-teal-800" onClick={() => void markPaid(r)}>
                Mark paid
              </button>
              <button
                type="button"
                className="text-red-700"
                onClick={async () => {
                  if (!confirm('Delete this recurring item?')) return
                  await deleteRecurring(r.id)
                  await refresh()
                }}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
