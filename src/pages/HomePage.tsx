import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTrackers } from '../context/TrackerContext'
import { formatDate, formatMoney } from '../lib/format'
import { listCategories, listTransactions } from '../lib/queries'
import type { Category, Transaction } from '../types'

export function HomePage() {
  const { active, loading } = useTrackers()
  const [txns, setTxns] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!active) {
      setTxns([])
      setCategories([])
      return
    }
    let cancelled = false
    setBusy(true)
    Promise.all([listTransactions(active.id), listCategories(active.id, active.collection_id)])
      .then(([t, c]) => {
        if (!cancelled) {
          setTxns(t)
          setCategories(c)
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(false)
      })
    return () => {
      cancelled = true
    }
  }, [active])

  const spent = useMemo(
    () => txns.filter((t) => t.kind === 'expense').reduce((s, t) => s + t.amount, 0),
    [txns],
  )
  const earned = useMemo(
    () => txns.filter((t) => t.kind === 'income').reduce((s, t) => s + t.amount, 0),
    [txns],
  )
  const net = earned - spent
  const budgetedCategoryIds = useMemo(
    () => new Set(categories.filter((c) => c.kind === 'expense' && c.budget !== null).map((c) => c.id)),
    [categories],
  )
  const totalBudget = useMemo(
    () =>
      categories
        .filter((c) => c.kind === 'expense')
        .reduce((sum, category) => sum + (category.budget ?? 0), 0),
    [categories],
  )
  const budgetedSpent = useMemo(
    () =>
      txns
        .filter((t) => t.kind === 'expense' && t.category_id && budgetedCategoryIds.has(t.category_id))
        .reduce((sum, transaction) => sum + transaction.amount, 0),
    [budgetedCategoryIds, txns],
  )
  const byCat = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of txns) {
      if (t.kind !== 'expense' || !t.category_id) continue
      map.set(t.category_id, (map.get(t.category_id) ?? 0) + t.amount)
    }
    return [...map.entries()]
      .map(([id, amount]) => ({
        amount,
        category: categories.find((c) => c.id === id),
      }))
      .filter((x) => x.category)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 4)
  }, [txns, categories])

  if (loading) return <p className="py-10 text-center text-stone-500">Loading…</p>

  if (!active) {
    return (
      <div className="mt-10 rounded-3xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Start a collection</h1>
        <p className="mt-2 text-stone-600">
          Separate ledgers for a month, a trip, or a move. Totals stay in their own tracker.
        </p>
        <Link
          to="/more/trackers"
          className="mt-5 inline-flex rounded-2xl bg-teal-800 px-5 py-3 font-semibold text-white"
        >
          Create your first collection
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-4">
      <section
        className="overflow-hidden rounded-[2rem] p-5 text-white shadow-lg"
        style={{ background: `linear-gradient(135deg, ${active.color}, #1c1917)` }}
      >
        <p className="text-sm text-white/70">Spent in {active.name}</p>
        <p className="mt-1 text-4xl font-semibold tracking-tight">{formatMoney(spent)}</p>
        {totalBudget > 0 ? (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs text-white/75">
              <span>{formatMoney(Math.max(totalBudget - budgetedSpent, 0))} left in budgets</span>
              <span>{Math.round((budgetedSpent / totalBudget) * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-white transition-all"
                style={{ width: `${Math.min((budgetedSpent / totalBudget) * 100, 100)}%` }}
              />
            </div>
          </div>
        ) : null}
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-white/65">Earned</p>
            <p className="text-lg font-semibold">{formatMoney(earned)}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-white/65">Net</p>
            <p className="text-lg font-semibold">{formatMoney(net)}</p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Top categories</h2>
          <Link to="/more/categories" className="text-xs font-medium text-teal-800">
            Manage budgets
          </Link>
        </div>
        {busy && txns.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">Loading…</p>
        ) : byCat.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">No expenses yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {byCat.map(({ category, amount }) => (
              <li key={category!.id}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: category!.color }}
                    />
                    {category!.name}
                  </span>
                  <span className="font-semibold">
                    {formatMoney(amount)}
                    {category!.budget !== null ? (
                      <span className="font-normal text-stone-400"> / {formatMoney(category!.budget)}</span>
                    ) : null}
                  </span>
                </div>
                {category!.budget !== null && category!.budget > 0 ? (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-100">
                    <div
                      className="h-full rounded-full"
                      style={{
                        backgroundColor: category!.color,
                        width: `${Math.min((amount / category!.budget) * 100, 100)}%`,
                      }}
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Recent</h2>
          <Link to="/activity" className="text-sm font-medium text-teal-800">
            See all
          </Link>
        </div>
        <div className="mt-2">
          <TransactionList rows={txns.slice(0, 5)} categories={categories} />
        </div>
      </section>
    </div>
  )
}

export function TransactionList({
  rows,
  categories,
  showDate = true,
}: {
  rows: Transaction[]
  categories: Category[]
  showDate?: boolean
}) {
  if (rows.length === 0) {
    return <p className="mt-3 text-sm text-stone-500">Nothing logged yet.</p>
  }
  const byId = new Map(categories.map((c) => [c.id, c]))
  return (
    <ul className="divide-y divide-stone-100">
      {rows.map((t) => {
        const cat = t.category_id ? byId.get(t.category_id) : undefined
        return (
          <li key={t.id}>
            <Link to={`/add/${t.id}`} className="flex min-h-16 items-center gap-3 py-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold text-white"
                style={{ backgroundColor: cat?.color ?? '#78716c' }}
              >
                {(t.merchant || cat?.name || '?').charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {t.merchant || cat?.name || 'Unnamed transaction'}
                </p>
                <p className="truncate text-xs text-stone-500">
                  {showDate ? `${formatDate(t.date)}${cat ? ' · ' : ''}` : ''}
                  {cat?.name ?? (!showDate ? 'Uncategorized' : '')}
                </p>
              </div>
              <p
                className={`shrink-0 font-semibold ${t.kind === 'income' ? 'text-emerald-700' : 'text-stone-900'}`}
              >
                {t.kind === 'income' ? '+' : '−'}
                {formatMoney(t.amount)}
              </p>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
