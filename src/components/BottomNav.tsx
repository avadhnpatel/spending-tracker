import { NavLink } from 'react-router-dom'
import { useTrackers } from '../context/TrackerContext'

const item = ({ isActive }: { isActive: boolean }) =>
  `nav-item flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[11px] font-medium ${
    isActive ? 'is-active' : 'text-stone-500'
  }`

export function BottomNav() {
  const { active } = useTrackers()

  return (
    <nav
      className="bottom-nav fixed right-0 bottom-0 left-0 z-20 border-t border-stone-200/80 backdrop-blur-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex max-w-lg items-end px-2 pt-1">
        <NavLink to="/" end className={item}>
          <HomeIcon />
          Home
        </NavLink>
        <NavLink to="/activity" className={item}>
          <ListIcon />
          Activity
        </NavLink>
        <NavLink
          to="/add"
          className="relative -top-3 flex flex-col items-center text-[11px] font-medium text-teal-900"
          aria-label="Add transaction"
        >
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full text-3xl leading-none text-white shadow-lg transition active:scale-95"
            style={{ backgroundColor: active?.color ?? '#0f766e', boxShadow: `0 10px 24px ${active?.color ?? '#0f766e'}40` }}
          >
            +
          </span>
        </NavLink>
        <NavLink to="/insights" className={item}>
          <ChartIcon />
          Insights
        </NavLink>
        <NavLink to="/more" className={item}>
          <MoreIcon />
          More
        </NavLink>
      </div>
    </nav>
  )
}

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6.5 10.5V20h11V10.5" />
    </svg>
  )
}

function ListIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 7h12M8 12h12M8 17h12" />
      <circle cx="4.5" cy="7" r="1" fill="currentColor" />
      <circle cx="4.5" cy="12" r="1" fill="currentColor" />
      <circle cx="4.5" cy="17" r="1" fill="currentColor" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 20V9M10 20V4M16 20v-7M22 20H2" />
    </svg>
  )
}

function MoreIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="6" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18" cy="12" r="1.6" />
    </svg>
  )
}
