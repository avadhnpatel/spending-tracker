import { useTrackers } from '../context/TrackerContext'

export function TrackerSwitcher() {
  const { trackers, active, setActiveId } = useTrackers()
  const live = trackers.filter((t) => !t.archived_at)

  if (!active) {
    return <p className="text-sm text-stone-500">No tracker yet</p>
  }

  return (
    <label className="block">
      <span className="sr-only">Active tracker</span>
      <select
        value={active.id}
        onChange={(e) => setActiveId(e.target.value)}
        className="max-w-[70vw] appearance-none rounded-full border-0 bg-white/80 py-1.5 pr-8 pl-3 text-base font-semibold text-stone-900 shadow-sm"
        style={{ backgroundImage: 'none' }}
      >
        {live.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </label>
  )
}
