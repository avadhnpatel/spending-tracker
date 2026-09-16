import { useTrackers } from '../context/TrackerContext'

export function TrackerSwitcher() {
  const { collections, trackers, activeCollection, active, setActiveCollectionId, setActiveId } = useTrackers()
  const liveCollections = collections.filter((collection) => !collection.archived_at)
  const collectionTrackers = trackers.filter(
    (tracker) => tracker.collection_id === activeCollection?.id && !tracker.archived_at,
  )

  if (!active || !activeCollection) return <p className="text-sm text-stone-500">No tracker yet</p>

  const collectionLabel = activeCollection.name.trim().toLowerCase() === active.name.trim().toLowerCase()
    ? 'Current tracker'
    : activeCollection.name

  return (
    <div className="tracker-select flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-white/70 px-3 py-2 shadow-sm">
      <span className="h-9 w-1 shrink-0 rounded-full" style={{ backgroundColor: activeCollection.color }} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <label className="block">
          <span className="sr-only">Active collection</span>
          <select
            value={activeCollection.id}
            onChange={(event) => setActiveCollectionId(event.target.value)}
            className="block w-full appearance-none truncate bg-transparent text-[10px] font-bold tracking-[0.12em] text-stone-500 uppercase outline-none"
          >
            {liveCollections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.id === activeCollection.id ? collectionLabel : collection.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="sr-only">Active tracker</span>
          <select
            value={active.id}
            onChange={(event) => setActiveId(event.target.value)}
            className="block min-h-6 w-full appearance-none truncate bg-transparent text-[15px] font-semibold text-stone-900 outline-none"
          >
            {collectionTrackers.map((tracker) => (
              <option key={tracker.id} value={tracker.id}>{tracker.name}</option>
            ))}
          </select>
        </label>
      </div>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-500" aria-hidden="true">
        <ChevronIcon />
      </span>
    </div>
  )
}

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m7 10 5 5 5-5" />
    </svg>
  )
}
