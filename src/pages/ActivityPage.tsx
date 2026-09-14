import { useEffect, useMemo, useState } from 'react'
import { useTrackers } from '../context/TrackerContext'
import { listCategories, listTransactions } from '../lib/queries'
import type { Category, Transaction } from '../types'
import { TransactionList } from './HomePage'

export function ActivityPage() {
  const { active } = useTrackers()
  const [txns, setTxns] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<'all' | 'expense' | 'income'>('all')

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
    const q = query.trim().toLowerCase()
    return txns.filter((t) => {
      if (kind !== 'all' && t.kind !== kind) return false
      if (!q) return true
      const cat = categories.find((c) => c.id === t.category_id)?.name ?? ''
      return `${t.merchant} ${t.notes} ${cat}`.toLowerCase().includes(q)
    })
  }, [txns, query, kind, categories])

  if (!active) {
    return <p className="py-8 text-stone-500">Create a tracker first.</p>
  }

  return (
    <div className="space-y-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search merchant, notes, category"
        className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none"
      />
      <div className="flex gap-2">
        {(['all', 'expense', 'income'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize ${
              kind === k ? 'bg-teal-800 text-white' : 'bg-white text-stone-600'
            }`}
          >
            {k}
          </button>
        ))}
      </div>
      <div className="rounded-3xl bg-white px-4 shadow-sm">
        <TransactionList rows={filtered} categories={categories} />
      </div>
    </div>
  )
}
