import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTrackers } from '../context/TrackerContext'
import { formatMoney } from '../lib/format'
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
    Promise.all([listTransactions(active.id), listCategories(active.id)])
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
        <h1 className="text-2xl font-semibold">Start a tracker</h1>
        <p className="mt-2 text-stone-600">
          Separate ledgers for a month, a trip, or a move. Totals stay in their own tracker.
        </p>
        <Link
          to="/more/trackers"
          className="mt-5 inline-flex rounded-2xl bg-teal-800 px-5 py-3 font-semibold text-white"
        >
          Create your first tracker
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-4">
      <section className="rounded-3xl bg-teal-800 p-5 text-white shadow-sm">
        <p className="text-sm text-teal-100">Net in this tracker</p>
        <p className="mt-1 text-4xl font-semibold tracking-tight">{formatMoney(net)}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-teal-100">Spent</p>
            <p className="text-lg font-semibold">{formatMoney(spent)}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-teal-100">Earned</p>
            <p className="text-lg font-semibold">{formatMoney(earned)}</p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Top categories</h2>
        {busy && txns.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">Loading…</p>
        ) : byCat.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">No expenses yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {byCat.map(({ category, amount }) => (
              <li key={category!.id} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: category!.color }}
                  />
                  {category!.name}
                </span>
                <span className="font-medium">{formatMoney(amount)}</span>
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
        <TransactionList rows={txns.slice(0, 5)} categories={categories} />
      </section>
    </div>
  )
}

export function TransactionList({
  rows,
  categories,
}: {
  rows: Transaction[]
  categories: Category[]
}) {
  if (rows.length === 0) {
    return <p className="mt-3 text-sm text-stone-500">Nothing logged yet.</p>
  }
  const byId = new Map(categories.map((c) => [c.id, c]))
  return (
    <ul className="mt-3 divide-y divide-stone-100">
      {rows.map((t) => {
        const cat = t.category_id ? byId.get(t.category_id) : undefined
        return (
          <li key={t.id}>
            <Link to={`/add/${t.id}`} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium">{t.merchant || cat?.name || 'Untitled'}</p>
                <p className="text-xs text-stone-500">
                  {t.date}
                  {cat ? ` · ${cat.name}` : ''}
                </p>
              </div>
              <p
                className={`font-semibold ${t.kind === 'income' ? 'text-teal-800' : 'text-stone-900'}`}
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
