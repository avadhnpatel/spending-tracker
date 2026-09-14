import { useEffect, useMemo, useState } from 'react'
import { useTrackers } from '../context/TrackerContext'
import { formatDate, formatMoney } from '../lib/format'
import { listCategories, listTransactions } from '../lib/queries'
import type { Category, Transaction } from '../types'
import { TransactionList } from './HomePage'

export function ActivityPage() {
  const { active } = useTrackers()
  const [txns, setTxns] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<'all' | 'expense' | 'income'>('all')
  const [categoryId, setCategoryId] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    if (!active) return
    let cancelled = false
    Promise.all([listTransactions(active.id), listCategories(active.id)]).then(([t, c]) => {
      if (!cancelled) {
        setTxns(t)
        setCategories(c)
      }
    })
    return () => {
      cancelled = true
    }
  }, [active])

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return txns.filter((transaction) => {
      if (kind !== 'all' && transaction.kind !== kind) return false
      if (categoryId !== 'all' && transaction.category_id !== categoryId) return false
      if (fromDate && transaction.date < fromDate) return false
      if (toDate && transaction.date > toDate) return false
      if (!normalizedQuery) return true
      const category = categories.find((row) => row.id === transaction.category_id)?.name ?? ''
      return `${transaction.merchant} ${transaction.notes} ${category}`
        .toLowerCase()
        .includes(normalizedQuery)
    })
  }, [txns, query, kind, categoryId, fromDate, toDate, categories])

  const groups = useMemo(() => {
    const byDate = new Map<string, Transaction[]>()
    for (const transaction of filtered) {
      const rows = byDate.get(transaction.date) ?? []
      rows.push(transaction)
      byDate.set(transaction.date, rows)
    }
    return [...byDate.entries()].sort(([left], [right]) => right.localeCompare(left))
  }, [filtered])

  const hasAdvancedFilters = categoryId !== 'all' || Boolean(fromDate) || Boolean(toDate)

  if (!active) {
    return <p className="py-8 text-stone-500">Create a tracker first.</p>
  }

  return (
    <div className="space-y-4 pb-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Activity</h1>
        <p className="mt-1 text-sm text-stone-500">{filtered.length} transactions in this view</p>
      </div>

      <div className="rounded-3xl bg-white p-3 shadow-sm">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search transactions"
            className="min-w-0 flex-1 rounded-2xl bg-stone-50 px-4 py-3 outline-none"
          />
          <button
            type="button"
            onClick={() => setShowFilters((current) => !current)}
            className={`min-h-11 rounded-2xl px-4 text-sm font-medium ${
              showFilters || hasAdvancedFilters ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-700'
            }`}
            aria-expanded={showFilters}
          >
            Filter{hasAdvancedFilters ? ' •' : ''}
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          {(['all', 'expense', 'income'] as const).map((choice) => (
            <button
              key={choice}
              type="button"
              onClick={() => setKind(choice)}
              className={`min-h-10 flex-1 rounded-xl px-3 text-sm font-medium capitalize transition ${
                kind === choice ? 'bg-teal-800 text-white' : 'bg-stone-50 text-stone-600'
              }`}
            >
              {choice}
            </button>
          ))}
        </div>
        {showFilters ? (
          <div className="mt-3 space-y-3 border-t border-stone-100 pt-3">
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-xl bg-stone-50 px-3 py-3 outline-none"
              aria-label="Filter by category"
            >
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-stone-500">
                From
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-stone-50 px-3 py-3 text-sm text-stone-800 outline-none"
                />
              </label>
              <label className="text-xs text-stone-500">
                To
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-stone-50 px-3 py-3 text-sm text-stone-800 outline-none"
                />
              </label>
            </div>
            {hasAdvancedFilters ? (
              <button
                type="button"
                onClick={() => {
                  setCategoryId('all')
                  setFromDate('')
                  setToDate('')
                }}
                className="min-h-10 w-full text-sm font-medium text-teal-800"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {groups.length === 0 ? (
        <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
          <p className="font-medium">No transactions found</p>
          <p className="mt-1 text-sm text-stone-500">Try changing your search or filters.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(([date, rows]) => {
            const spent = rows
              .filter((row) => row.kind === 'expense')
              .reduce((sum, row) => sum + row.amount, 0)
            const earned = rows
              .filter((row) => row.kind === 'income')
              .reduce((sum, row) => sum + row.amount, 0)
            return (
              <section key={date}>
                <div className="mb-2 flex items-end justify-between px-1">
                  <div>
                    <h2 className="font-semibold">{formatDate(date)}</h2>
                    <p className="text-xs text-stone-400">
                      {rows.length} {rows.length === 1 ? 'transaction' : 'transactions'}
                    </p>
                  </div>
                  <p className="text-xs font-medium text-stone-500">
                    {spent > 0 ? `−${formatMoney(spent)}` : ''}
                    {spent > 0 && earned > 0 ? ' · ' : ''}
                    {earned > 0 ? `+${formatMoney(earned)}` : ''}
                  </p>
                </div>
                <div className="rounded-3xl bg-white px-4 shadow-sm">
                  <TransactionList rows={rows} categories={categories} showDate={false} />
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
