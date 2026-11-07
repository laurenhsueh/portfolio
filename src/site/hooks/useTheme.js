import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'

const KEY = 'lh-theme'

function initialTheme() {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* storage blocked (private mode): fall back to the OS setting */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * Light / dark theme: OS preference on first visit, the user's choice once they toggle.
 * Toggling crossfades the whole page from one theme to the other (View Transitions, where the
 * browser has them): one smooth dissolve instead of colours, glows and the butterflies all
 * switching on their own timings. Elsewhere, or with reduced motion, it switches directly.
 */
export function useTheme() {
  const [theme, setTheme] = useState(initialTheme)
  // the theme being switched to, updated the moment the toggle is pressed: the dissolve applies the
  // change a frame later, so a quick second press must not read the old one and repeat the switch
  const themeRef = useRef(theme)

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const toggle = useCallback(() => {
    const next = themeRef.current === 'dark' ? 'light' : 'dark'
    themeRef.current = next
    try {
      localStorage.setItem(KEY, next)
    } catch {
      /* storage blocked: the choice lasts this visit only */
    }
    const root = document.documentElement
    const apply = () =>
      flushSync(() => {
        root.dataset.theme = next
        setTheme(next)
      })
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (!document.startViewTransition || reduced) {
      apply()
      return
    }
    // the dissolve does the transition, so per-element colour transitions are paused meanwhile
    root.classList.add('is-theme-switching')
    const vt = document.startViewTransition(apply)
    vt.finished.finally(() => root.classList.remove('is-theme-switching'))
  }, [])

  return [theme, toggle]
}
