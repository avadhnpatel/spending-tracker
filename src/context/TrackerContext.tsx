import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  createCollection as createCollectionRow,
  createTrackerInCollection,
  listCollections,
  listTrackers,
  updateTracker,
} from '../lib/queries'
import type { CollectionKind, Tracker, TrackerCollection } from '../types'
import { useAuth } from './AuthContext'

const STORAGE_KEY = 'spend.activeTrackerId'

type TrackerContextValue = {
  loading: boolean
  error: string | null
  collections: TrackerCollection[]
  trackers: Tracker[]
  activeCollection: TrackerCollection | null
  active: Tracker | null
  activeId: string | null
  setActiveId: (id: string) => void
  setActiveCollectionId: (id: string) => void
  refresh: () => Promise<void>
  createCollection: (input: { name: string; note?: string; color: string; kind: CollectionKind; month?: string; trackerName?: string }) => Promise<Tracker>
  createTracker: (input: { collectionId: string; name?: string; note?: string; month?: string; copyBudgetsFrom?: string }) => Promise<Tracker>
  renameTracker: (id: string, name: string, note: string, color: string) => Promise<void>
  archiveTracker: (id: string, archived: boolean) => Promise<void>
}

const TrackerContext = createContext<TrackerContextValue | null>(null)

export function TrackerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [collections, setCollections] = useState<TrackerCollection[]>([])
  const [trackers, setTrackers] = useState<Tracker[]>([])
  const [activeId, setActiveIdState] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY))

  const refresh = useCallback(async () => {
    if (!user) {
      setCollections([])
      setTrackers([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [collectionRows, trackerRows] = await Promise.all([listCollections(user.id), listTrackers(user.id)])
      setCollections(collectionRows)
      setTrackers(trackerRows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load trackers')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const liveTrackers = useMemo(() => trackers.filter((tracker) => !tracker.archived_at), [trackers])
  const active = useMemo(() => liveTrackers.find((tracker) => tracker.id === activeId) ?? liveTrackers[0] ?? null, [activeId, liveTrackers])
  const activeCollection = useMemo(
    () => collections.find((collection) => collection.id === active?.collection_id) ?? null,
    [active, collections],
  )

  useEffect(() => {
    if (active && active.id !== activeId) {
      setActiveIdState(active.id)
      localStorage.setItem(STORAGE_KEY, active.id)
    }
  }, [active, activeId])

  const setActiveId = useCallback((id: string) => {
    setActiveIdState(id)
    localStorage.setItem(STORAGE_KEY, id)
  }, [])

  const setActiveCollectionId = useCallback((id: string) => {
    const tracker = liveTrackers.find((row) => row.collection_id === id)
    if (tracker) setActiveId(tracker.id)
  }, [liveTrackers, setActiveId])

  const value = useMemo<TrackerContextValue>(() => ({
    loading,
    error,
    collections,
    trackers,
    activeCollection,
    active,
    activeId: active?.id ?? null,
    setActiveId,
    setActiveCollectionId,
    refresh,
    createCollection: async (input) => {
      if (!user) throw new Error('Not signed in')
      const result = await createCollectionRow({ userId: user.id, ...input })
      await refresh()
      setActiveId(result.tracker.id)
      return result.tracker
    },
    createTracker: async (input) => {
      if (!user) throw new Error('Not signed in')
      const collection = collections.find((row) => row.id === input.collectionId)
      if (!collection) throw new Error('Collection not found')
      const tracker = await createTrackerInCollection({ userId: user.id, collection, ...input })
      await refresh()
      setActiveId(tracker.id)
      return tracker
    },
    renameTracker: async (id, name, note, color) => {
      await updateTracker(id, { name, note, color })
      await refresh()
    },
    archiveTracker: async (id, archived) => {
      await updateTracker(id, { archived_at: archived ? new Date().toISOString() : null })
      await refresh()
    },
  }), [active, activeCollection, collections, error, loading, refresh, setActiveCollectionId, setActiveId, trackers, user])

  return <TrackerContext.Provider value={value}>{children}</TrackerContext.Provider>
}

export function useTrackers(): TrackerContextValue {
  const context = useContext(TrackerContext)
  if (!context) throw new Error('useTrackers must be used within TrackerProvider')
  return context
}
