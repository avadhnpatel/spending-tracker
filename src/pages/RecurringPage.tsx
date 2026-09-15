import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTrackers } from '../context/TrackerContext'
import { advanceDate, formatDate, formatMoney, todayISO } from '../lib/format'
import {
  deleteRecurring,
  listCategories,
  listRecurring,
  upsertRecurring,
  upsertTransaction,
} from '../lib/queries'
import type { Cadence, Category, Kind, Recurring } from '../types'

export function RecurringPage() {
  const { active, activeCollection, trackers } = useTrackers()
  const [rows, setRows] = useState<Recurring[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [kind, setKind] = useState<Kind>('expense')
  const [cadence, setCadence] = useState<Cadence>('monthly')
  const [due, setDue] = useState(todayISO())
  const [endDate, setEndDate] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!active || !activeCollection) return
    const [recurring, categoryRows] = await Promise.all([
      listRecurring(activeCollection.id),
      listCategories(active.id, active.collection_id),
    ])
    setRows(recurring)
    setCategories(categoryRows)
  }, [active, activeCollection])

  useEffect(() => {
    void refresh()
  }, [refresh])

  function resetForm() {
    setEditingId(null)
    setName('')
    setAmount('')
    setKind('expense')
    setCadence('monthly')
    setDue(todayISO())
    setEndDate('')
    setCategoryId(null)
    setError(null)
  }

  function editRecurring(row: Recurring) {
    setEditingId(row.id)
    setName(row.merchant)
    setAmount(String(row.amount))
    setKind(row.kind)
    setCadence(row.cadence)
    setDue(row.next_due_date)
    setEndDate(row.end_date ?? '')
    setCategoryId(row.category_id)
    setError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function onSave(e: FormEvent) {
    e.preventDefault()
    if (!active || !activeCollection) return
    const parsedAmount = Number.parseFloat(amount)
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Enter an amount greater than 0')
      return
    }
    if (endDate && endDate < due) {
      setError('End date must be on or after the next due date')
      return
    }

    setBusy(true)
    setError(null)
    try {
      await upsertRecurring({
        id: editingId ?? undefined,
        tracker_id: active.id,
        collection_id: activeCollection.id,
        category_id: categoryId,
        amount: parsedAmount,
        kind,
        merchant: name.trim(),
        cadence,
        next_due_date: due,
        end_date: endDate || null,
        active: true,
      })
      resetForm()
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save recurring item')
    } finally {
      setBusy(false)
    }
  }

  async function markPaid(row: Recurring) {
    if (!active || !activeCollection || !row.active) return
    const targetTracker = activeCollection.kind === 'monthly'
      ? trackers.find((tracker) =>
          tracker.collection_id === activeCollection.id &&
          tracker.period_start && tracker.period_end &&
          row.next_due_date >= tracker.period_start && row.next_due_date <= tracker.period_end,
        )
      : active
    if (!targetTracker) {
      setError(`Create the ${formatDate(row.next_due_date)} monthly tracker before marking this paid.`)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await upsertTransaction({
        tracker_id: targetTracker.id,
        category_id: row.category_id,
        recurring_id: row.id,
        amount: row.amount,
        kind: row.kind,
        date: row.next_due_date,
        merchant: row.merchant,
        notes: `Recurring (${row.cadence})`,
        receipt_path: null,
      })
      const nextDueDate = advanceDate(row.next_due_date, row.cadence)
      await upsertRecurring({
        ...row,
        next_due_date: nextDueDate,
        active: !row.end_date || nextDueDate <= row.end_date,
      })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not mark this item paid')
    } finally {
      setBusy(false)
    }
  }

  if (!active || !activeCollection) return <p className="py-8 text-stone-500">Create a tracker first.</p>

  if (activeCollection.kind !== 'monthly') {
    return (
      <div className="space-y-4 pb-6">
        <Link to="/more" className="text-sm font-medium text-teal-800">← More</Link>
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">Recurring is for monthly collections</h1>
          <p className="mt-2 text-stone-500">
            Switch to a monthly collection to manage bills and repeating income across its months.
          </p>
        </div>
      </div>
    )
  }

  const matchingCategories = categories.filter((category) => category.kind === kind)
  const orderedRows = [...rows].sort(
    (left, right) => Number(right.active) - Number(left.active) || left.next_due_date.localeCompare(right.next_due_date),
  )

  return (
    <div className="space-y-5 pb-6">
      <div>
        <Link to="/more" className="text-sm font-medium text-teal-800">
          ← More
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Recurring</h1>
        <p className="mt-1 text-sm text-stone-500">Keep bills and repeating income on schedule.</p>
      </div>

      <form onSubmit={onSave} className="space-y-4 rounded-3xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="font-semibold">{editingId ? 'Edit recurring item' : 'New recurring item'}</p>
          {editingId ? (
            <button type="button" onClick={resetForm} className="min-h-10 text-sm font-medium text-stone-500">
              Cancel
            </button>
          ) : null}
        </div>
        <label className="block">
          <span className="mb-1 block text-sm text-stone-500">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Netflix, rent, paycheck…"
            className="w-full rounded-2xl bg-stone-50 px-4 py-3 outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-stone-500">Amount</span>
          <div className="flex items-center rounded-2xl bg-stone-50 px-4">
            <span className="text-stone-400">$</span>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="min-w-0 flex-1 bg-transparent px-2 py-3 outline-none"
            />
          </div>
        </label>
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-stone-100 p-1">
          {(['expense', 'income'] as const).map((choice) => (
            <button
              key={choice}
              type="button"
              onClick={() => {
                setKind(choice)
                setCategoryId(null)
              }}
              className={`min-h-11 rounded-xl font-medium capitalize transition ${
                kind === choice ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
              }`}
            >
              {choice}
            </button>
          ))}
        </div>
        <label className="block">
          <span className="mb-1 block text-sm text-stone-500">Repeats</span>
          <select
            value={cadence}
            onChange={(e) => setCadence(e.target.value as Cadence)}
            className="w-full rounded-2xl bg-stone-50 px-4 py-3 outline-none"
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm text-stone-500">
            Next due
            <input
              type="date"
              required
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="mt-1 w-full rounded-2xl bg-stone-50 px-3 py-3 text-sm text-stone-800 outline-none"
            />
          </label>
          <label className="text-sm text-stone-500">
            End date <span className="text-stone-400">(optional)</span>
            <input
              type="date"
              value={endDate}
              min={due}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 w-full rounded-2xl bg-stone-50 px-3 py-3 text-sm text-stone-800 outline-none"
            />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm text-stone-500">Category</span>
          <select
            value={categoryId ?? ''}
            onChange={(e) => setCategoryId(e.target.value || null)}
            className="w-full rounded-2xl bg-stone-50 px-4 py-3 outline-none"
          >
            <option value="">No category</option>
            {matchingCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-2xl py-3 font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: active.color }}
        >
          {busy ? 'Saving…' : editingId ? 'Save changes' : 'Add recurring item'}
        </button>
      </form>

      {orderedRows.length === 0 ? (
        <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
          <p className="font-medium">No recurring items yet</p>
          <p className="mt-1 text-sm text-stone-500">Add a bill, subscription, or repeating income above.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {orderedRows.map((row) => (
            <li key={row.id} className={`rounded-3xl bg-white p-4 shadow-sm ${row.active ? '' : 'opacity-65'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{row.merchant || 'Unnamed recurring item'}</p>
                  <p className="mt-0.5 text-sm text-stone-500">
                    {formatMoney(row.amount)} · {row.cadence}
                  </p>
                  <p className="mt-1 text-xs text-stone-400">
                    {row.active ? `Next ${formatDate(row.next_due_date)}` : 'Completed'}
                    {row.end_date ? ` · Ends ${formatDate(row.end_date)}` : ' · No end date'}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    row.active ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'
                  }`}
                >
                  {row.active ? row.kind : 'Ended'}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-sm font-medium">
                {row.active ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="min-h-10 text-teal-800 disabled:opacity-50"
                    onClick={() => void markPaid(row)}
                  >
                    Mark paid
                  </button>
                ) : null}
                <button type="button" className="min-h-10 text-teal-800" onClick={() => editRecurring(row)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="min-h-10 text-red-700"
                  onClick={async () => {
                    if (!confirm('Delete this recurring item?')) return
                    await deleteRecurring(row.id)
                    await refresh()
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
