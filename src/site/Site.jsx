import { lazy, Suspense } from 'react'
import './site.css'
import Taskbar from './Taskbar'
import Footer from './Footer'
import { useTheme } from './useTheme'
import { useHashRoute } from './useHashRoute'
import Home from './pages/Home'
import Garden from './pages/Garden'
import About from './pages/About'

const ButterflyLab = lazy(() => import('../ButterflyLab'))

export default function Site() {
  const route = useHashRoute()
  const [theme, toggleTheme] = useTheme()

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
