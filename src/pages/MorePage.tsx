import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTrackers } from '../context/TrackerContext'
import { downloadCsv, transactionsToCsv } from '../lib/csv'
import { listCategories, listTransactions } from '../lib/queries'

export function MorePage() {
  const { signOut } = useAuth()
  const { active } = useTrackers()

  async function exportCsv() {
    if (!active) return
    const [txns, cats] = await Promise.all([
      listTransactions(active.id),
      listCategories(active.id),
    ])
    const slug = active.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    downloadCsv(`${slug || 'tracker'}.csv`, transactionsToCsv(txns, cats))
  }

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">More</h1>
      <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
        <Row to="/more/trackers" label="Trackers" hint="Create, switch, duplicate, archive" />
        <Row to="/more/categories" label="Categories" hint="Per tracker, with colors" />
        <Row to="/more/recurring" label="Recurring" hint="Bills and subscriptions" />
      </div>
      <button
        type="button"
        onClick={() => void exportCsv()}
        disabled={!active}
        className="w-full rounded-3xl bg-white px-4 py-4 text-left font-medium shadow-sm disabled:opacity-50"
      >
        Export CSV
        <p className="text-sm font-normal text-stone-500">Download this tracker’s transactions</p>
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

function Row({ to, label, hint }: { to: string; label: string; hint: string }) {
  return (
    <Link to={to} className="block border-b border-stone-100 px-4 py-4 last:border-0">
      <p className="font-medium">{label}</p>
      <p className="text-sm text-stone-500">{hint}</p>
    </Link>
  )
}
