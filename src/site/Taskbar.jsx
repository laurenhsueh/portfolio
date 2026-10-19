import PixelIcon from './PixelIcon'

const LINKS = [
  { href: '#/work', label: 'Work', match: '/work' },
  { href: '#/garden', label: 'Garden', match: '/garden' },
  { href: '#/about', label: 'About', match: '/about' },
]

/** Mac-style menu bar: butterfly + name on the left, links + theme toggle on the right. */
export default function Taskbar({ route, theme, onToggleTheme }) {
  const dark = theme === 'dark'
  const goHome = (e) => {
    // already home: the hash won't change, so scroll up ourselves
    if (route === '/' || route === '') {
      e.preventDefault()
      window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    }
  }
  return (
    <header className="taskbar">
      <a className="taskbar-brand" href="#/" onClick={goHome} aria-label="Lauren Hsueh, home">
        <PixelIcon name="butterfly" size={24} />
        <span>Lauren Hsueh</span>
      </a>
      <nav className="taskbar-nav" aria-label="Main">
        <ul>
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                aria-current={route.startsWith(l.match) ? 'page' : undefined}
                onClick={(e) => {
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
      </nav>
    </header>
  )
}
