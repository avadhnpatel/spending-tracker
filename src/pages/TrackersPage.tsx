import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTrackers } from '../context/TrackerContext'
import { TRACKER_COLORS, type Tracker } from '../types'

export function TrackersPage() {
  const {
    trackers,
    activeId,
    setActiveId,
    createTracker,
    renameTracker,
    archiveTracker,
    duplicateTracker,
  } = useTrackers()
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [color, setColor] = useState<string>(TRACKER_COLORS[0])
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<Tracker | null>(null)

  const live = trackers.filter((t) => !t.archived_at)
  const archived = trackers.filter((t) => t.archived_at)

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    try {
      await createTracker({ name, note, color })
      setName('')
      setNote('')
    } finally {
      setBusy(false)
    }
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault()
    if (!editing) return
    await renameTracker(editing.id, editing.name, editing.note, editing.color)
    setEditing(null)
  }

  return (
    <div className="space-y-5 pb-6">
      <div>
        <Link to="/more" className="text-sm font-medium text-teal-800">
          ← More
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Trackers</h1>
        <p className="mt-1 text-sm text-stone-600">
          Keep months, trips, and projects in separate ledgers.
        </p>
      </div>

      <form onSubmit={onCreate} className="space-y-3 rounded-3xl bg-white p-4 shadow-sm">
        <p className="font-semibold">New tracker</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Month of October"
          className="w-full rounded-2xl bg-stone-50 px-4 py-3 outline-none"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note"
          className="w-full rounded-2xl bg-stone-50 px-4 py-3 outline-none"
        />
        <ColorRow value={color} onChange={setColor} />
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-2xl bg-teal-800 py-3 font-semibold text-white"
        >
          Create
        </button>
      </form>

      <ul className="space-y-2">
        {live.map((t) => (
          <li
            key={t.id}
            className="rounded-3xl border bg-white p-4 shadow-sm"
            style={{ borderColor: t.id === activeId ? `${t.color}80` : 'transparent' }}
          >
            <div className="flex items-start justify-between gap-3">
              <button type="button" className="text-left" onClick={() => setActiveId(t.id)}>
                <p className="font-semibold">
                  <span
                    className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: t.color }}
                  />
                  {t.name}
                  {t.id === activeId ? (
                    <span
                      className="ml-2 rounded-full px-2 py-0.5 text-xs font-medium text-white"
                      style={{ backgroundColor: t.color }}
                    >
                      Active
                    </span>
                  ) : null}
                </p>
                {t.note ? <p className="mt-1 text-sm text-stone-500">{t.note}</p> : null}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-sm font-medium text-teal-800">
              <button type="button" onClick={() => setEditing(t)}>
                Edit
              </button>
              <button type="button" onClick={() => void duplicateTracker(t.id)}>
                Duplicate
              </button>
              <button type="button" onClick={() => void archiveTracker(t.id, true)}>
                Archive
              </button>
            </div>
          </li>
        ))}
      </ul>

      {editing ? (
        <form onSubmit={onSaveEdit} className="space-y-3 rounded-3xl bg-white p-4 shadow-sm">
          <p className="font-semibold">Edit tracker</p>
          <input
            value={editing.name}
            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            className="w-full rounded-2xl bg-stone-50 px-4 py-3 outline-none"
          />
          <input
            value={editing.note}
            onChange={(e) => setEditing({ ...editing, note: e.target.value })}
            className="w-full rounded-2xl bg-stone-50 px-4 py-3 outline-none"
          />
          <ColorRow
            value={editing.color}
            onChange={(c) => setEditing({ ...editing, color: c })}
          />
          <div className="flex gap-2">
            <button type="submit" className="flex-1 rounded-2xl bg-teal-800 py-3 font-semibold text-white">
              Save
            </button>
            <button type="button" onClick={() => setEditing(null)} className="flex-1 py-3">
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {archived.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-stone-500">Archived</h2>
          <ul className="space-y-2">
            {archived.map((t) => (
              <li key={t.id} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
                <span>{t.name}</span>
                <button
                  type="button"
                  className="text-sm font-medium text-teal-800"
                  onClick={() => void archiveTracker(t.id, false)}
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function ColorRow({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" aria-label="Preset tracker colors">
        {TRACKER_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={`h-10 w-10 rounded-full border-4 border-white ${
              value === c ? 'ring-2 ring-stone-900' : ''
            }`}
            style={{ background: c }}
            aria-label={`Use color ${c}`}
            aria-pressed={value === c}
          />
        ))}
      </div>
      <label className="flex min-h-11 items-center justify-between rounded-2xl bg-stone-50 px-3 py-2 text-sm font-medium text-stone-700">
        <span>Choose any color</span>
        <span className="flex items-center gap-2 font-mono text-xs uppercase text-stone-500">
          {value}
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 w-12 cursor-pointer rounded-lg border-0 bg-transparent p-0"
            aria-label="Open custom tracker color picker"
          />
        </span>
      </label>
    </div>
  )
}
