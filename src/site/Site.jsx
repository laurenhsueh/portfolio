import { lazy, Suspense, useEffect } from 'react'
import './site.css'
import Taskbar from './Taskbar'
import Footer from './Footer'
import { useTheme } from './hooks/useTheme'
import { useHashRoute } from './hooks/useHashRoute'
import Home from './pages/Home'
import Garden from './pages/Garden'
import About from './pages/About'

const ButterflyLab = lazy(() => import('../lab/ButterflyLab'))

/** Figma's multiplayer-style arrow: pink fill, white outline, soft shadow. Tip at (4, 3). */
function arrowCursor(fill) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'>`
    + `<defs><filter id='s' x='-20%' y='-20%' width='140%' height='140%'><feDropShadow dx='0' dy='1' stdDeviation='0.8' flood-opacity='0.35'/></filter></defs>`
    + `<path d='M4 3 L19.5 10.6 L12.4 12.4 L9.6 19.6 Z' fill='${fill}' stroke='#fff' stroke-width='1.5' stroke-linejoin='round' filter='url(#s)'/>`
    + `</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export default function Site() {
  const route = useHashRoute()
  const [theme, toggleTheme] = useTheme()

  // Figma-style arrow cursor in the theme's accent pink (CSS vars can't reach cursor images)
  useEffect(() => {
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
    document.documentElement.style.setProperty('--cursor-arrow', `url("${arrowCursor(accent)}") 4 3`)
  }, [theme])

  if (route === '/garden/butterfly-lab') {
    return (
      <Suspense fallback={null}>
        <ButterflyLab />
      </Suspense>
    )
  }

  let page
  if (route.startsWith('/garden')) page = <Garden />
  else if (route.startsWith('/about')) page = <About />
  else page = <Home route={route} theme={theme} />

  return (
    <div className="site">
      {/* not a hash link: the router owns the hash */}
      <button type="button" className="skip-link" onClick={() => document.getElementById('main')?.focus()}>
        Skip to content
      </button>
      <Taskbar route={route} theme={theme} onToggleTheme={toggleTheme} />
      <main id="main" tabIndex={-1}>{page}</main>
      <Footer />
    </div>
  )
}
