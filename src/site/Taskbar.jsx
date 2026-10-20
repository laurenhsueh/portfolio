import { useEffect, useState } from 'react'
import PixelIcon from './PixelIcon'

const LINKS = [
  { href: '#/work', label: 'Work', match: '/work' },
  { href: '#/garden', label: 'Garden', match: '/garden' },
  { href: '#/about', label: 'About', match: '/about' },
]

const PHONE = '(max-width: 899px)'

/**
 * Mac-style menu bar: name on the left, links + theme toggle on the right.
 * On phones the links collapse into a full-screen menu behind an animated hamburger.
 */
export default function Taskbar({ route, theme, onToggleTheme }) {
  const dark = theme === 'dark'
  const [menuOpen, setMenuOpen] = useState(false)

  // while the phone menu is open: lock page scroll, close on Escape or on growing to desktop
  useEffect(() => {
    if (!menuOpen) return
    const mq = matchMedia(PHONE)
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false) }
    const onMq = () => { if (!mq.matches) setMenuOpen(false) }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    mq.addEventListener('change', onMq)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
      mq.removeEventListener('change', onMq)
    }
  }, [menuOpen])

  // any navigation closes the menu
  useEffect(() => { setMenuOpen(false) }, [route])

  const goHome = (e) => {
    setMenuOpen(false)
    // already home: the hash won't change, so scroll up ourselves
    if (route === '/' || route === '') {
      e.preventDefault()
      window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    }
  }
  return (
    <header className={`taskbar ${menuOpen ? 'is-menu-open' : ''}`}>
      <a className="taskbar-brand" href="#/" onClick={goHome} aria-label="Lauren Hsueh, home">
        <span>Lauren Hsueh</span>
      </a>
      <nav className="taskbar-nav" aria-label="Main">
        <ul id="main-menu">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                aria-current={route.startsWith(l.match) ? 'page' : undefined}
                onClick={(e) => {
                  setMenuOpen(false)
                  // re-clicking Work while on '#/work' (hash unchanged): scroll there again
                  if (l.match === '/work' && route === '/work') {
                    e.preventDefault()
                    document.getElementById('work')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                }}
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <button
            type="button"
            className="theme-toggle"
            onClick={onToggleTheme}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <PixelIcon name={dark ? 'moon' : 'sun'} size={24} />
          </button>
        <button
          type="button"
          className="menu-toggle"
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          aria-controls="main-menu"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          <span className="menu-toggle-box" aria-hidden="true">
            <span className="menu-toggle-bar" />
            <span className="menu-toggle-bar" />
            <span className="menu-toggle-bar" />
          </span>
        </button>
      </nav>
    </header>
  )
}
