import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { TrackerSwitcher } from './TrackerSwitcher'

export function Layout() {
  return (
    <div
      className="mx-auto min-h-dvh max-w-lg"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'calc(5.75rem + env(safe-area-inset-bottom))',
      }}
    >
      <header className="flex items-center justify-between px-4 pt-4 pb-2">
        <TrackerSwitcher />
        <span className="text-xs font-semibold tracking-wide text-teal-800 uppercase">Spend</span>
      </header>
      <main className="px-4">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
