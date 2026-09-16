import { NavLink } from 'react-router-dom'
import { useTrackers } from '../context/TrackerContext'

const item = ({ isActive }: { isActive: boolean }) =>
  `nav-item flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl py-1 text-[10px] font-semibold transition ${
    isActive ? 'is-active' : 'text-stone-500'
  }`

export function BottomNav() {
  const { active } = useTrackers()

  return (
    <nav className="fixed right-0 bottom-0 left-0 z-20 pointer-events-none">
      <div className="relative mx-auto max-w-lg px-3" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        <NavLink
          to="/add"
          className="pointer-events-auto absolute -top-7 right-5 z-10 flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition active:scale-95"
          style={{ backgroundColor: active?.color ?? '#0f766e', boxShadow: `0 9px 22px ${active?.color ?? '#0f766e'}55` }}
          aria-label="Add transaction"
        >
          <span className="text-[1.75rem] leading-none" aria-hidden="true">
            +
          </span>
        </NavLink>
        <div className="bottom-nav pointer-events-auto grid grid-cols-5 gap-1 rounded-[1.4rem] border border-white/70 p-1.5 shadow-[0_12px_35px_rgba(28,25,23,0.14)] backdrop-blur-xl">
          <NavLink to="/" end className={item}>
            <HomeIcon />
            Home
          </NavLink>
          <NavLink to="/activity" className={item}>
            <ListIcon />
            Activity
          </NavLink>
          <NavLink to="/insights" className={item}>
            <ChartIcon />
            Insights
          </NavLink>
          <NavLink to="/import" className={item}>
            <CardIcon />
            Import
          </NavLink>
          <NavLink to="/more" className={item}>
            <MoreIcon />
            More
          </NavLink>
        </div>
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

function CardIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3 9h18M7 15h4" />
    </svg>
  )
}
