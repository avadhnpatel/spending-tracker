import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTrackers } from '../context/TrackerContext'
import { downloadCsv, transactionsToCsv } from '../lib/csv'
import { directorySupabase } from '../lib/directory'
import { getDataFootprint, listCategories, listTransactions, purgeReviewedImportCandidates, type DataFootprint } from '../lib/queries'
import { clearRuntimeSupabaseConfig } from '../lib/runtime-config'
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
  const [footprint, setFootprint] = useState<DataFootprint | null>(null)
  const [retentionDays, setRetentionDays] = useState(365)
  const [storageBusy, setStorageBusy] = useState(false)
  const [storageNotice, setStorageNotice] = useState<string | null>(null)
  const [storageError, setStorageError] = useState<string | null>(null)
  const [switchingAccount, setSwitchingAccount] = useState(false)
  const [switchError, setSwitchError] = useState<string | null>(null)

  useEffect(() => {
    applyTheme(theme)
    return watchSystemTheme(theme, () => applyTheme('system'))
  }, [theme])

  async function refreshFootprint() {
    try {
      setStorageError(null)
      setFootprint(await getDataFootprint())
    } catch (err) {
      setStorageError(err instanceof Error ? err.message : 'Could not load data usage')
    }
  }

  useEffect(() => {
    void refreshFootprint()
  }, [])

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

  async function cleanReviewedImports() {
    setStorageBusy(true)
    setStorageError(null)
    setStorageNotice(null)
    try {
      const deleted = await purgeReviewedImportCandidates(retentionDays)
      setStorageNotice(deleted ? `Removed ${deleted} reviewed import ${deleted === 1 ? 'record' : 'records'}. Duplicate protection remains.` : 'There are no reviewed import records this old to remove.')
      await refreshFootprint()
    } catch (err) {
      setStorageError(err instanceof Error ? err.message : 'Could not clean import history')
    } finally {
      setStorageBusy(false)
    }
  }

  async function switchPrivateAccount() {
    setSwitchingAccount(true)
    setSwitchError(null)
    try {
      await signOut()
      if (directorySupabase) {
        const { error } = await directorySupabase.auth.signOut()
        if (error) throw error
      }
      await clearRuntimeSupabaseConfig()
      window.location.replace('/account')
    } catch (error) {
      setSwitchError(error instanceof Error ? error.message : 'Could not switch private accounts')
      setSwitchingAccount(false)
    }
  }

  const estimatedMegabytes = footprint ? footprint.estimatedBytes / (1024 * 1024) : 0
  const capacityPercent = Math.min(100, (estimatedMegabytes / 500) * 100)

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
      <section className="rounded-3xl bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-medium">Data & storage</h2>
            <p className="mt-1 text-sm text-stone-500">A conservative estimate of your data within the shared 500 MB project limit.</p>
          </div>
          <button type="button" onClick={() => void refreshFootprint()} disabled={storageBusy} className="min-h-10 shrink-0 rounded-xl bg-stone-100 px-3 text-sm font-semibold text-teal-800 disabled:opacity-50">Refresh</button>
        </div>
        {footprint ? (
          <>
            <div className="mt-4 flex items-end justify-between gap-3">
              <p className="text-2xl font-semibold tracking-tight">~{estimatedMegabytes < 0.1 ? '<0.1' : estimatedMegabytes.toFixed(1)} MB</p>
              <p className="text-sm font-medium text-stone-500">of 500 MB</p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full rounded-full bg-teal-700 transition-[width]" style={{ width: `${Math.max(capacityPercent, footprint.estimatedBytes ? 1 : 0)}%` }} />
            </div>
            <p className="mt-3 text-xs leading-5 text-stone-500">{footprint.transactionCount.toLocaleString()} tracker transactions · {footprint.importCandidateCount.toLocaleString()} import records · {footprint.dedupKeyCount.toLocaleString()} compact duplicate safeguards</p>
          </>
        ) : <p className="mt-4 text-sm text-stone-500">Loading your data estimate…</p>}

        <div className="mt-5 border-t border-stone-100 pt-4">
          <p className="font-medium">Clean reviewed import history</p>
          <p className="mt-1 text-sm text-stone-500">Remove old imported, skipped, and removed records. Your tracker transactions and duplicate protection stay intact.</p>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {([
              [180, '6 months'],
              [365, '1 year'],
              [730, '2 years'],
            ] as const).map(([days, label]) => (
              <button key={days} type="button" onClick={() => setRetentionDays(days)} className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold ${retentionDays === days ? 'bg-teal-800 text-white' : 'bg-stone-100 text-stone-600'}`}>{label}</button>
            ))}
          </div>
          <button type="button" disabled={storageBusy} onClick={() => void cleanReviewedImports()} className="mt-3 min-h-11 w-full rounded-xl bg-stone-100 px-4 text-sm font-semibold text-stone-700 disabled:opacity-50">
            {storageBusy ? 'Cleaning…' : `Remove reviewed imports older than ${retentionDays === 180 ? '6 months' : retentionDays === 365 ? '1 year' : '2 years'}`}
          </button>
          {storageNotice ? <p className="mt-3 rounded-xl bg-teal-50 p-3 text-sm text-teal-900">{storageNotice}</p> : null}
        </div>
        {storageError ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{storageError}</p> : null}
      </section>
      <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
        <Row icon="◫" to="/more/trackers" label="Collections & trackers" hint="Group months, trips, and projects" />
        <Row icon="◉" to="/more/categories" label="Categories & budgets" hint="Organize spending and set targets" />
        <Row icon="↻" to="/more/recurring" label="Recurring" hint="Bills and subscriptions" />
        <Row icon="⇩" to="/import" label="Import transactions" hint="CSV statements and automatic bank sync" />
        <Row icon="↗" to="/setup" label="Create a private copy" hint="Set up Spend for a friend" />
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
        onClick={() => void switchPrivateAccount()}
        disabled={switchingAccount}
        className="flex min-h-16 w-full items-center gap-3 rounded-3xl bg-white px-4 py-4 text-left font-medium shadow-sm disabled:opacity-50"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-100 text-lg">⇄</span>
        <span className="min-w-0 flex-1">
          Switch private account
          <span className="block text-sm font-normal text-stone-500">Sign in with another email and open its private database</span>
        </span>
      </button>
      {switchError ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{switchError}</p> : null}
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
