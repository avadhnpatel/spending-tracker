import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useTrackers } from '../context/TrackerContext'
import { formatMoney } from '../lib/format'
import { listCategories, listTransactions } from '../lib/queries'
import type { Category, Transaction } from '../types'

export function InsightsPage() {
  const { active } = useTrackers()
  const [txns, setTxns] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    if (!active) return
    Promise.all([listTransactions(active.id), listCategories(active.id)]).then(([t, c]) => {
      setTxns(t)
      setCategories(c)
    })
  }, [active])

  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of txns) {
      if (t.kind !== 'expense' || !t.category_id) continue
      map.set(t.category_id, (map.get(t.category_id) ?? 0) + t.amount)
    }
    return [...map.entries()]
      .map(([id, amount]) => {
        const cat = categories.find((c) => c.id === id)
        return { name: cat?.name ?? 'Other', fill: cat?.color ?? '#57534e', amount }
      })
      .sort((a, b) => b.amount - a.amount)
  }, [txns, categories])

  const overTime = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of txns) {
      if (t.kind !== 'expense') continue
      const key = t.date
      map.set(key, (map.get(key) ?? 0) + t.amount)
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({ name: date.slice(5), date, amount }))
  }, [txns])

  if (!active) return <p className="py-8 text-stone-500">Create a tracker first.</p>

  return (
    <div className="space-y-4 pb-4">
      <h1 className="text-2xl font-semibold">Insights</h1>
      <section className="rounded-3xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 font-semibold">Spend by category</h2>
        {byCategory.length === 0 ? (
          <p className="text-sm text-stone-500">No expense data yet.</p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCategory} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-25} height={50} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v) => formatMoney(Number(v))}
                  labelFormatter={(_label, payload) => payload[0]?.payload.date ?? ''}
                />
                <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                  {byCategory.map((row) => (
                    <Cell key={row.name} fill={row.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
      <section className="rounded-3xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 font-semibold">Spend over time</h2>
        {overTime.length === 0 ? (
          <p className="text-sm text-stone-500">No expense data yet.</p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overTime} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => formatMoney(Number(v))} />
                <Bar dataKey="amount" fill="#0f766e" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  )
}
