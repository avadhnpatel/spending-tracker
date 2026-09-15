import { useTrackers } from '../context/TrackerContext'

export function TrackerSwitcher() {
  const { collections, trackers, activeCollection, active, setActiveCollectionId, setActiveId } = useTrackers()
  const liveCollections = collections.filter((collection) => !collection.archived_at)
  const collectionTrackers = trackers.filter(
    (tracker) => tracker.collection_id === activeCollection?.id && !tracker.archived_at,
  )

  if (!active || !activeCollection) return <p className="text-sm text-stone-500">No tracker yet</p>

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: activeCollection.color }} />
      <div className="min-w-0">
        <label className="block">
          <span className="sr-only">Active collection</span>
          <select
            value={activeCollection.id}
            onChange={(event) => setActiveCollectionId(event.target.value)}
            className="block max-w-[62vw] appearance-none bg-transparent text-xs font-semibold tracking-wide text-stone-500 uppercase outline-none"
          >
            {liveCollections.map((collection) => (
              <option key={collection.id} value={collection.id}>{collection.name}</option>
            ))}
          </select>
        </label>
        <label className="relative block">
          <span className="sr-only">Active tracker</span>
          <select
            value={active.id}
            onChange={(event) => setActiveId(event.target.value)}
            className="block min-h-7 max-w-[62vw] appearance-none bg-transparent pr-5 text-base font-semibold text-stone-900 outline-none"
          >
            {collectionTrackers.map((tracker) => (
              <option key={tracker.id} value={tracker.id}>{tracker.name}</option>
            ))}
          </select>
          <span className="pointer-events-none absolute top-1/2 right-0 -translate-y-1/2 text-stone-400">⌄</span>
        </label>
      </div>
    </div>
  )
}
