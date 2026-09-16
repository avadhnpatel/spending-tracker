import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useTrackers } from '../context/TrackerContext'

const item = ({ isActive }: { isActive: boolean }) =>
  `nav-item flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl py-1 text-[10px] font-semibold transition ${
    isActive ? 'is-active' : 'text-stone-500'
  }`

export function BottomNav() {
  const { active } = useTrackers()
  const navigate = useNavigate()
  const [quickMenuOpen, setQuickMenuOpen] = useState(false)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressTriggered = useRef(false)
  const menuArea = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!quickMenuOpen) return
    const closeMenu = (event: PointerEvent) => {
      if (!menuArea.current?.contains(event.target as Node)) setQuickMenuOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setQuickMenuOpen(false)
    }
    document.addEventListener('pointerdown', closeMenu)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeMenu)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [quickMenuOpen])

  function startHold() {
    longPressTriggered.current = false
    holdTimer.current = setTimeout(() => {
      longPressTriggered.current = true
      setQuickMenuOpen(true)
      navigator.vibrate?.(20)
    }, 450)
  }

  function cancelHold() {
    if (holdTimer.current) clearTimeout(holdTimer.current)
    holdTimer.current = null
  }

  function activateAdd() {
    cancelHold()
    if (longPressTriggered.current) {
      longPressTriggered.current = false
      return
    }
    navigate('/add')
  }

  return (
    <nav className="fixed right-0 bottom-0 left-0 z-20 pointer-events-none">
      <div className="relative mx-auto max-w-lg px-3" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        <div className="bottom-nav pointer-events-auto grid grid-cols-6 gap-0.5 rounded-[1.4rem] border border-white/70 p-1.5 shadow-[0_12px_35px_rgba(28,25,23,0.14)] backdrop-blur-xl">
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
          <div ref={menuArea} className="relative flex min-w-0">
            {quickMenuOpen ? (
              <div className="quick-add-menu absolute right-0 bottom-[calc(100%+0.75rem)] z-30 w-56 rounded-2xl border border-white/70 p-1.5 shadow-xl backdrop-blur-xl" role="menu">
                <button type="button" role="menuitem" onClick={() => { setQuickMenuOpen(false); navigate('/add') }} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold hover:bg-stone-100">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full text-xl text-white" style={{ backgroundColor: active?.color ?? '#0f766e' }}>+</span>
                  New transaction
                </button>
                <button type="button" role="menuitem" onClick={() => { setQuickMenuOpen(false); navigate('/more/trackers') }} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold hover:bg-stone-100">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-700"><FolderPlusIcon /></span>
                  New collection or tracker
                </button>
              </div>
            ) : null}
            <button
              type="button"
              className="flex min-h-[3.25rem] flex-1 touch-none items-center justify-center rounded-2xl transition active:scale-95"
              onPointerDown={startHold}
              onPointerUp={activateAdd}
              onPointerCancel={cancelHold}
              onPointerLeave={cancelHold}
              onContextMenu={(event) => { event.preventDefault(); cancelHold(); setQuickMenuOpen(true) }}
              aria-label="Add transaction. Press and hold for more options."
              aria-haspopup="menu"
              aria-expanded={quickMenuOpen}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full text-[1.65rem] leading-none text-white shadow-md" style={{ backgroundColor: active?.color ?? '#0f766e' }} aria-hidden="true">+</span>
            </button>
          </div>
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

function FolderPlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 7.5h7l2 2h9v9.5H3z" />
      <path d="M12 12v5M9.5 14.5h5" />
    </svg>
  )
}
