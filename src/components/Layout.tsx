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
        paddingBottom: 'calc(5.75rem + env(safe-area-inset-bottom))',
      } as React.CSSProperties}
    >
      <header className="sticky top-0 z-10 flex items-center justify-between bg-[#f4f1ec]/85 px-4 pt-3 pb-3 backdrop-blur-xl">
        <TrackerSwitcher />
        <span className="text-xs font-bold tracking-[0.16em] text-stone-400 uppercase">Spend</span>
      </header>
      <main className="px-4">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
