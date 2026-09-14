import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  createTracker as createTrackerRow,
  duplicateTracker as duplicateTrackerRow,
  listTrackers,
  updateTracker,
} from '../lib/queries'
import type { Tracker } from '../types'
import { useAuth } from './AuthContext'

const STORAGE_KEY = 'spend.activeTrackerId'

type TrackerContextValue = {
  loading: boolean
  error: string | null
  trackers: Tracker[]
  active: Tracker | null
  activeId: string | null
  setActiveId: (id: string) => void
  refresh: () => Promise<void>
  createTracker: (input: { name: string; note?: string; color: string }) => Promise<Tracker>
  renameTracker: (id: string, name: string, note: string, color: string) => Promise<void>
  archiveTracker: (id: string, archived: boolean) => Promise<void>
  duplicateTracker: (id: string) => Promise<Tracker>
}

const TrackerContext = createContext<TrackerContextValue | null>(null)

export function TrackerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [trackers, setTrackers] = useState<Tracker[]>([])
  const [activeId, setActiveIdState] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEY),
  )

  const refresh = useCallback(async () => {
    if (!user) {
      setTrackers([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const rows = await listTrackers(user.id)
      setTrackers(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load trackers')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const activeTrackers = useMemo(
    () => trackers.filter((t) => !t.archived_at),
    [trackers],
  )

  const active = useMemo(() => {
    const fromId = trackers.find((t) => t.id === activeId && !t.archived_at)
    return fromId ?? activeTrackers[0] ?? null
  }, [activeId, activeTrackers, trackers])

  useEffect(() => {
    if (active && active.id !== activeId) {
      setActiveIdState(active.id)
      localStorage.setItem(STORAGE_KEY, active.id)
    }
  }, [active, activeId])

  const setActiveId = (id: string) => {
    setActiveIdState(id)
    localStorage.setItem(STORAGE_KEY, id)
  }

  const value = useMemo<TrackerContextValue>(
    () => ({
      loading,
      error,
      trackers,
      active,
      activeId: active?.id ?? null,
      setActiveId,
      refresh,
      createTracker: async (input) => {
        if (!user) throw new Error('Not signed in')
        const row = await createTrackerRow({ userId: user.id, ...input })
        await refresh()
        setActiveId(row.id)
        return row
      },
      renameTracker: async (id, name, note, color) => {
        await updateTracker(id, { name, note, color })
        await refresh()
      },
      archiveTracker: async (id, archived) => {
        await updateTracker(id, { archived_at: archived ? new Date().toISOString() : null })
        await refresh()
      },
      duplicateTracker: async (id) => {
        if (!user) throw new Error('Not signed in')
        const source = trackers.find((t) => t.id === id)
        if (!source) throw new Error('Tracker not found')
        const copy = await duplicateTrackerRow(source, user.id)
        await refresh()
        setActiveId(copy.id)
        return copy
      },
    }),
    [active, loading, error, refresh, trackers, user],
  )

  return <TrackerContext.Provider value={value}>{children}</TrackerContext.Provider>
}

export function useTrackers(): TrackerContextValue {
  const ctx = useContext(TrackerContext)
  if (!ctx) throw new Error('useTrackers must be used within TrackerProvider')
  return ctx
}
