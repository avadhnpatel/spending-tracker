import { useTrackers } from '../context/TrackerContext'

export function TrackerSwitcher() {
  const { trackers, active, setActiveId } = useTrackers()
  const live = trackers.filter((t) => !t.archived_at)

  if (!active) {
    return <p className="text-sm text-stone-500">No tracker yet</p>
  }

  return (
    <label className="relative block">
      <span className="sr-only">Active tracker</span>
      <span
        className="pointer-events-none absolute top-1/2 left-3 z-10 h-2.5 w-2.5 -translate-y-1/2 rounded-full"
        style={{ backgroundColor: active.color }}
      />
      <select
        value={active.id}
        onChange={(e) => setActiveId(e.target.value)}
        className="tracker-select min-h-11 max-w-[70vw] appearance-none rounded-full border border-white/80 py-2 pr-9 pl-8 text-base font-semibold text-stone-900 shadow-sm outline-none"
        style={{ backgroundImage: 'none' }}
      >
        {live.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-stone-400"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="m5.5 7.5 4.5 4.5 4.5-4.5" />
      </svg>
    </label>
  )
}
