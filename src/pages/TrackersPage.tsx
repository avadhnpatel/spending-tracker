import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTrackers } from '../context/TrackerContext'
import { monthBounds } from '../lib/queries'
import { TRACKER_COLORS, type CollectionKind, type Tracker } from '../types'

function currentMonth(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function TrackersPage() {
  const { collections, trackers, activeId, setActiveId, createCollection, createTracker, renameTracker, archiveTracker } = useTrackers()
  const [name, setName] = useState('')
  const [kind, setKind] = useState<CollectionKind>('monthly')
  const [color, setColor] = useState<string>(TRACKER_COLORS[0])
  const [month, setMonth] = useState(currentMonth())
  const [firstTrackerName, setFirstTrackerName] = useState('')
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const [childName, setChildName] = useState('')
  const [childMonth, setChildMonth] = useState(currentMonth())
  const [editing, setEditing] = useState<Tracker | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onCreateCollection(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      await createCollection({
        name,
        color,
        kind,
        month: kind === 'monthly' ? month : undefined,
        trackerName: kind === 'custom' ? firstTrackerName || name : undefined,
      })
      setName('')
      setFirstTrackerName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create collection')
    } finally {
      setBusy(false)
    }
  }

  async function onAddTracker(event: FormEvent, collectionId: string) {
    event.preventDefault()
    const collection = collections.find((row) => row.id === collectionId)
    if (!collection) return
    const siblings = trackers.filter((tracker) => tracker.collection_id === collectionId)
    if (collection.kind === 'monthly') {
      const bounds = monthBounds(childMonth)
      if (siblings.some((tracker) => tracker.period_start === bounds.start)) {
        setError(`${bounds.name} already exists in ${collection.name}`)
        return
      }
    }
    setBusy(true)
    setError(null)
    try {
      await createTracker({
        collectionId,
        name: collection.kind === 'custom' ? childName : undefined,
        month: collection.kind === 'monthly' ? childMonth : undefined,
        copyBudgetsFrom: siblings[0]?.id,
      })
      setAddingTo(null)
      setChildName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add tracker')
    } finally {
      setBusy(false)
    }
  }

  async function onSaveEdit(event: FormEvent) {
    event.preventDefault()
    if (!editing) return
    await renameTracker(editing.id, editing.name, editing.note, editing.color)
    setEditing(null)
  }

  return (
    <div className="space-y-5 pb-6">
      <div>
        <Link to="/more" className="text-sm font-medium text-teal-800">← More</Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Collections & trackers</h1>
        <p className="mt-1 text-sm text-stone-600">Group monthly budgets, trips, and projects without mixing their totals.</p>
      </div>

      <form onSubmit={onCreateCollection} className="space-y-4 rounded-3xl bg-white p-4 shadow-sm">
        <p className="font-semibold">New collection</p>
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-stone-100 p-1">
          {([
            ['monthly', 'Monthly'],
            ['custom', 'Trips & projects'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setKind(value)}
              className={`min-h-11 rounded-xl text-sm font-medium ${kind === value ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder={kind === 'monthly' ? 'Monthly spending' : 'Vacations'} className="w-full rounded-2xl bg-stone-50 px-4 py-3 outline-none" />
        {kind === 'monthly' ? (
          <label className="block text-sm text-stone-500">
            First month
            <input type="month" required value={month} onChange={(event) => setMonth(event.target.value)} className="mt-1 w-full rounded-2xl bg-stone-50 px-4 py-3 text-stone-800 outline-none" />
          </label>
        ) : (
          <input value={firstTrackerName} onChange={(event) => setFirstTrackerName(event.target.value)} placeholder="First tracker, e.g. Japan 2026" className="w-full rounded-2xl bg-stone-50 px-4 py-3 outline-none" />
        )}
        <ColorRow value={color} onChange={setColor} />
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button type="submit" disabled={busy || !name.trim()} className="w-full rounded-2xl bg-teal-800 py-3 font-semibold text-white disabled:opacity-50">
          {busy ? 'Creating…' : 'Create collection'}
        </button>
      </form>

      <div className="space-y-4">
        {collections.filter((collection) => !collection.archived_at).map((collection) => {
          const children = trackers.filter((tracker) => tracker.collection_id === collection.id)
          const liveChildren = children.filter((tracker) => !tracker.archived_at)
          const archivedChildren = children.filter((tracker) => tracker.archived_at)
          return (
            <section key={collection.id} className="overflow-hidden rounded-3xl bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-stone-100 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="h-10 w-10 shrink-0 rounded-2xl" style={{ backgroundColor: collection.color }} />
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold">{collection.name}</h2>
                    <p className="text-xs text-stone-500">{collection.kind === 'monthly' ? 'Monthly collection' : 'Custom collection'} · {liveChildren.length} {liveChildren.length === 1 ? 'tracker' : 'trackers'}</p>
                  </div>
                </div>
                <button type="button" onClick={() => { setAddingTo(addingTo === collection.id ? null : collection.id); setError(null) }} className="min-h-11 rounded-xl bg-stone-100 px-3 text-sm font-medium">+ Add</button>
              </div>

              {addingTo === collection.id ? (
                <form onSubmit={(event) => void onAddTracker(event, collection.id)} className="space-y-3 border-b border-stone-100 bg-stone-50 p-4">
                  {collection.kind === 'monthly' ? (
                    <label className="block text-sm text-stone-500">Month<input type="month" required value={childMonth} onChange={(event) => setChildMonth(event.target.value)} className="mt-1 w-full rounded-xl bg-white px-3 py-3 text-stone-800 outline-none" /></label>
                  ) : (
                    <input required value={childName} onChange={(event) => setChildName(event.target.value)} placeholder="Tracker name" className="w-full rounded-xl bg-white px-3 py-3 outline-none" />
                  )}
                  <p className="text-xs text-stone-500">Categories are shared. Budgets copy from the most recent tracker and can be changed afterward.</p>
                  {error ? <p className="text-sm text-red-700">{error}</p> : null}
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setAddingTo(null)} className="min-h-11 rounded-xl bg-white font-medium">Cancel</button>
                    <button type="submit" disabled={busy} className="min-h-11 rounded-xl bg-teal-800 font-medium text-white disabled:opacity-50">Add tracker</button>
                  </div>
                </form>
              ) : null}

              <ul className="divide-y divide-stone-100 px-4">
                {liveChildren.map((tracker) => (
                  <li key={tracker.id} className="py-3">
                    <div className="flex items-center justify-between gap-3">
                      <button type="button" onClick={() => setActiveId(tracker.id)} className="min-w-0 flex-1 text-left">
                        <p className="truncate font-medium">{tracker.name}{tracker.id === activeId ? <span className="ml-2 text-xs text-teal-800">Active</span> : null}</p>
                        {tracker.period_start && tracker.period_end ? <p className="text-xs text-stone-400">{tracker.period_start} – {tracker.period_end}</p> : null}
                      </button>
                      <button type="button" onClick={() => setEditing(tracker)} className="min-h-10 px-2 text-sm font-medium text-teal-800">Edit</button>
                      <button type="button" onClick={() => void archiveTracker(tracker.id, true)} className="min-h-10 text-sm font-medium text-stone-500">Archive</button>
                    </div>
                  </li>
                ))}
              </ul>
              {archivedChildren.length ? (
                <details className="border-t border-stone-100 px-4 py-3">
                  <summary className="cursor-pointer text-sm font-medium text-stone-500">
                    Archived ({archivedChildren.length})
                  </summary>
                  <ul className="mt-2 divide-y divide-stone-100">
                    {archivedChildren.map((tracker) => (
                      <li key={tracker.id} className="flex items-center justify-between gap-3 py-3">
                        <p className="min-w-0 truncate text-sm text-stone-500">{tracker.name}</p>
                        <button type="button" onClick={() => void archiveTracker(tracker.id, false)} className="min-h-10 px-2 text-sm font-medium text-teal-800">Restore</button>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </section>
          )
        })}
      </div>

      {editing ? (
        <form onSubmit={onSaveEdit} className="space-y-3 rounded-3xl bg-white p-4 shadow-sm">
          <p className="font-semibold">Edit tracker</p>
          <input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} className="w-full rounded-2xl bg-stone-50 px-4 py-3 outline-none" />
          <input value={editing.note} onChange={(event) => setEditing({ ...editing, note: event.target.value })} placeholder="Optional note" className="w-full rounded-2xl bg-stone-50 px-4 py-3 outline-none" />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setEditing(null)} className="min-h-11 rounded-xl bg-stone-100 font-medium">Cancel</button>
            <button type="submit" className="min-h-11 rounded-xl bg-teal-800 font-medium text-white">Save</button>
          </div>
        </form>
      ) : null}
    </div>
  )
}

function ColorRow({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {TRACKER_COLORS.slice(0, 10).map((choice) => (
        <button key={choice} type="button" onClick={() => onChange(choice)} className={`h-9 w-9 rounded-full border-4 border-white ${value === choice ? 'ring-2 ring-stone-900' : ''}`} style={{ backgroundColor: choice }} aria-label={`Use color ${choice}`} aria-pressed={value === choice} />
      ))}
      <label className="flex h-9 items-center gap-1 rounded-full bg-stone-100 px-2 text-xs font-medium text-stone-600">Custom<input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-6 w-6 border-0 bg-transparent p-0" /></label>
    </div>
  )
}
