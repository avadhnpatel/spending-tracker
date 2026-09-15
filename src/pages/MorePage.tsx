import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTrackers } from '../context/TrackerContext'
import { downloadCsv, transactionsToCsv } from '../lib/csv'
import { listCategories, listTransactions } from '../lib/queries'
import {
  applyTheme,
  getThemePreference,
  saveThemePreference,
  watchSystemTheme,
  type ThemePreference,
} from '../lib/theme'

export function MorePage() {
  const { signOut } = useAuth()
  const { active } = useTrackers()
  const [theme, setTheme] = useState<ThemePreference>(getThemePreference)

  useEffect(() => {
    applyTheme(theme)
    return watchSystemTheme(theme, () => applyTheme('system'))
  }, [theme])

  function chooseTheme(next: ThemePreference) {
    setTheme(next)
    saveThemePreference(next)
  }

  async function exportCsv() {
    if (!active) return
    const [txns, cats] = await Promise.all([
      listTransactions(active.id),
      listCategories(active.id, active.collection_id),
    ])
    const slug = active.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    downloadCsv(`${slug || 'tracker'}.csv`, transactionsToCsv(txns, cats))
  }

  return (
    <div className="space-y-4 pb-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">More</h1>
        <p className="mt-1 text-sm text-stone-500">Manage your tracker and data.</p>
      </div>
      <section className="rounded-3xl bg-white p-4 shadow-sm">
        <div className="mb-3">
          <h2 className="font-medium">Appearance</h2>
          <p className="text-sm text-stone-500">Choose how Spend looks on this device.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-stone-100 p-1">
          {([
            ['system', '◐', 'System'],
            ['light', '☀', 'Light'],
            ['dark', '☾', 'Dark'],
          ] as const).map(([value, icon, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => chooseTheme(value)}
              className={`flex min-h-14 flex-col items-center justify-center rounded-xl text-xs font-medium transition ${
                theme === value ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
              }`}
              aria-pressed={theme === value}
            >
              <span className="text-lg leading-none">{icon}</span>
              <span className="mt-1">{label}</span>
            </button>
          ))}
        </div>
      </section>
      <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
        <Row icon="◫" to="/more/trackers" label="Collections & trackers" hint="Group months, trips, and projects" />
        <Row icon="◉" to="/more/categories" label="Categories & budgets" hint="Organize spending and set targets" />
        <Row icon="↻" to="/more/recurring" label="Recurring" hint="Bills and subscriptions" />
      </div>
      <button
        type="button"
        onClick={() => void exportCsv()}
        disabled={!active}
        className="flex min-h-16 w-full items-center gap-3 rounded-3xl bg-white px-4 py-4 text-left font-medium shadow-sm disabled:opacity-50"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-100 text-lg">↓</span>
        <span className="min-w-0 flex-1">
          Export CSV
          <span className="block text-sm font-normal text-stone-500">Download this tracker’s transactions</span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => void signOut()}
        className="w-full py-3 text-sm font-medium text-red-700"
      >
        Sign out
      </button>
    </div>
  )
}

function Row({
  icon,
  to,
  label,
  hint,
}: {
  icon: string
  to: string
  label: string
  hint: string
}) {
  return (
    <Link to={to} className="flex min-h-16 items-center gap-3 border-b border-stone-100 px-4 py-4 last:border-0">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-stone-100 text-lg text-stone-600">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{label}</span>
        <span className="block text-sm text-stone-500">{hint}</span>
      </span>
      <span className="text-xl text-stone-300">›</span>
    </Link>
  )
}
