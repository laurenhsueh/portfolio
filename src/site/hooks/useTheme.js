import { useCallback, useEffect, useState } from 'react'

const KEY = 'lh-theme'

function initialTheme() {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* storage blocked (private mode): fall back to the OS setting */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Light / dark theme: OS preference on first visit, the user's choice once they toggle. */
export function useTheme() {
  const [theme, setTheme] = useState(initialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark'
      try { localStorage.setItem(KEY, next) } catch { /* storage blocked: the choice lasts this visit only */ }
      return next
    })
  }, [])

  return [theme, toggle]
}
