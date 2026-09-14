import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useTrackers } from '../context/TrackerContext'
import { formatDate, formatMoney } from '../lib/format'
import { listCategories, listTransactions } from '../lib/queries'
import type { Category, Kind, Transaction } from '../types'

type Range = '7' | '30' | 'all'

export function InsightsPage() {
  const { active } = useTrackers()
  const [txns, setTxns] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [kind, setKind] = useState<Kind>('expense')
  const [range, setRange] = useState<Range>('30')

  useEffect(() => {
    if (!active) return
    Promise.all([listTransactions(active.id), listCategories(active.id)]).then(([t, c]) => {
      setTxns(t)
      setCategories(c)
    })
  }, [active])

  const filtered = useMemo(() => {
    const matchingKind = txns.filter((transaction) => transaction.kind === kind)
    if (range === 'all' || matchingKind.length === 0) return matchingKind
    const latestDate = matchingKind.reduce(
      (latest, transaction) => (transaction.date > latest ? transaction.date : latest),
      matchingKind[0].date,
    )
    const cutoffDate = new Date(`${latestDate}T12:00:00`)
    cutoffDate.setDate(cutoffDate.getDate() - (Number(range) - 1))
    const cutoff = cutoffDate.toISOString().slice(0, 10)
    return matchingKind.filter((transaction) => transaction.date >= cutoff)
  }, [kind, range, txns])

  const byCategory = useMemo(() => {
    const totals = new Map<string, number>()
    for (const transaction of filtered) {
      const key = transaction.category_id ?? 'uncategorized'
      totals.set(key, (totals.get(key) ?? 0) + transaction.amount)
    }
    return [...totals.entries()]
      .map(([id, amount]) => {
        const category = categories.find((row) => row.id === id)
        return {
          id,
          name: category?.name ?? 'Uncategorized',
          fill: category?.color ?? '#78716c',
          amount,
        }
      })
      .sort((left, right) => right.amount - left.amount)
  }, [categories, filtered])

  const overTime = useMemo(() => {
    const totals = new Map<string, number>()
    for (const transaction of filtered) {
      totals.set(transaction.date, (totals.get(transaction.date) ?? 0) + transaction.amount)
    }
    return [...totals.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, amount]) => ({ name: date.slice(5), date, amount }))
  }, [filtered])

  const total = filtered.reduce((sum, transaction) => sum + transaction.amount, 0)
  const largest = filtered.reduce<Transaction | null>(
    (current, transaction) => (!current || transaction.amount > current.amount ? transaction : current),
    null,
  )
  const peakDay = overTime.reduce<(typeof overTime)[number] | null>(
    (current, day) => (!current || day.amount > current.amount ? day : current),
    null,
  )
  const average = overTime.length > 0 ? total / overTime.length : 0

  if (!active) return <p className="py-8 text-stone-500">Create a tracker first.</p>

  return (
    <div className="space-y-4 pb-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Insights</h1>
        <p className="mt-1 text-sm text-stone-500">Patterns inside {active.name}</p>
      </div>

      <div className="rounded-3xl bg-white p-2 shadow-sm">
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-stone-100 p-1">
          {(['expense', 'income'] as const).map((choice) => (
            <button
              key={choice}
              type="button"
              onClick={() => setKind(choice)}
              className={`min-h-10 rounded-xl text-sm font-medium capitalize transition ${
                kind === choice ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
              }`}
            >
              {choice}
            </button>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1">
          {([
            ['7', '7 days'],
            ['30', '30 days'],
            ['all', 'All time'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setRange(value)}
              className={`min-h-10 rounded-xl text-xs font-medium transition ${
                range === value ? 'bg-stone-900 text-white' : 'text-stone-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <section
        className="rounded-[2rem] p-5 text-white shadow-lg"
        style={{ background: `linear-gradient(135deg, ${active.color}, #1c1917)` }}
      >
        <p className="text-sm text-white/70">Total {kind === 'expense' ? 'spent' : 'earned'}</p>
        <p className="mt-1 text-4xl font-semibold tracking-tight">{formatMoney(total)}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-xs text-white/60">Average active day</p>
            <p className="mt-1 font-semibold">{formatMoney(average)}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-xs text-white/60">Transactions</p>
            <p className="mt-1 font-semibold">{filtered.length}</p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-semibold">By category</h2>
          <span className="text-xs text-stone-400">{byCategory.length} categories</span>
        </div>
        {byCategory.length === 0 ? (
          <EmptyChart kind={kind} />
        ) : (
          <>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byCategory}
                    dataKey="amount"
                    nameKey="name"
                    innerRadius="57%"
                    outerRadius="82%"
                    paddingAngle={2}
                    stroke="none"
                  >
                    {byCategory.map((row) => (
                      <Cell key={row.id} fill={row.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatMoney(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-3">
              {byCategory.map((row) => {
                const percent = total > 0 ? (row.amount / total) * 100 : 0
                return (
                  <li key={row.id}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2 font-medium">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: row.fill }}
                        />
                        <span className="truncate">{row.name}</span>
                      </span>
                      <span className="shrink-0 font-semibold">
                        {formatMoney(row.amount)}{' '}
                        <span className="font-normal text-stone-400">{Math.round(percent)}%</span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-stone-100">
                      <div
                        className="h-full rounded-full"
                        style={{ backgroundColor: row.fill, width: `${percent}%` }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-semibold">Over time</h2>
          {peakDay ? <span className="text-xs text-stone-400">Peak {formatDate(peakDay.date)}</span> : null}
        </div>
        {overTime.length === 0 ? (
          <EmptyChart kind={kind} />
        ) : (
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={overTime} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={active.color} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={active.color} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e7e5e4" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#78716c' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#78716c' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={compactMoney}
                />
                <Tooltip
                  formatter={(value) => formatMoney(Number(value))}
                  labelFormatter={(_label, payload) =>
                    payload[0]?.payload.date ? formatDate(payload[0].payload.date) : ''
                  }
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke={active.color}
                  strokeWidth={3}
                  fill="url(#spendFill)"
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {largest ? (
        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold tracking-wide text-stone-400 uppercase">Largest transaction</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold">{largest.merchant || 'Untitled'}</p>
              <p className="text-sm text-stone-500">{formatDate(largest.date)}</p>
            </div>
            <p className="shrink-0 text-lg font-semibold">{formatMoney(largest.amount)}</p>
          </div>
        </section>
      ) : null}
    </div>
  )
}

function EmptyChart({ kind }: { kind: Kind }) {
  return (
    <div className="py-10 text-center">
      <p className="font-medium">No {kind} data in this range</p>
      <p className="mt-1 text-sm text-stone-500">Try another range or add a transaction.</p>
    </div>
  )
}

function compactMoney(value: number): string {
  if (Math.abs(value) >= 1000) return `$${Math.round(value / 1000)}k`
  return `$${Math.round(value)}`
}
