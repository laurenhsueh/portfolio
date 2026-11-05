import { useEffect, useState } from 'react'

// the old landing experiments (#/v1–#/v4, and their '/work') now live at home
const LEGACY = /^\/v[1-4](\/work)?\/?$/

const read = () => {
  const route = window.location.hash.replace(/^#/, '') || '/'
  const old = route.match(LEGACY)
  if (!old) return route
  const to = old[1] ? '/work' : '/'
  window.history.replaceState(null, '', `#${to}`)
  return to
}

/** Tiny hash router: '#/work' → '/work'. No server config needed for static hosting. */
export function useHashRoute() {
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const onChange = () => {
      const next = read()
      setRoute(next)
      if (!next.endsWith('/work')) window.scrollTo(0, 0) // '/work' scrolls to its section itself
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
