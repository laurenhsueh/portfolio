import { useEffect, useState } from 'react'

const read = () => window.location.hash.replace(/^#/, '') || '/'

/** Tiny hash router: '#/work' → '/work'. No server config needed for static hosting. */
export function useHashRoute() {
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const onChange = () => {
      const next = read()
      setRoute(next)
      if (next !== '/work') window.scrollTo(0, 0) // '/work' scrolls to its section itself
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
