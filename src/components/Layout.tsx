import { Outlet } from 'react-router-dom'
import { useTrackers } from '../context/TrackerContext'
import { BottomNav } from './BottomNav'
import { TrackerSwitcher } from './TrackerSwitcher'

export function Layout() {
  const { active } = useTrackers()

  return (
    <div
      className="mx-auto min-h-dvh max-w-lg"
      style={{
        '--tracker-color': active?.color ?? '#0f766e',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'calc(6.25rem + env(safe-area-inset-bottom))',
      } as React.CSSProperties}
    >
      <header className="app-header sticky top-0 z-10 px-3 py-2 backdrop-blur-xl">
        <TrackerSwitcher />
      </header>
      <main className="px-4">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
