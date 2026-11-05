import { useEffect, useState } from 'react'

/**
 * true once the page has loaded and the browser has a quiet moment (or after `timeout` ms at the
 * latest). Heavy extras (the 3D butterflies) wait for it, so the text and layout paint first.
 */
export function useAfterPaint(timeout = 1200) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let idle = 0
    let timer = 0
    const go = () => setReady(true)
    const schedule = () => {
      if ('requestIdleCallback' in window) idle = requestIdleCallback(go, { timeout })
      else timer = setTimeout(go, 200)
    }
    if (document.readyState === 'complete') schedule()
    else window.addEventListener('load', schedule, { once: true })
    return () => {
      window.removeEventListener('load', schedule)
      if (idle) cancelIdleCallback(idle)
      clearTimeout(timer)
    }
  }, [timeout])
  return ready
}
