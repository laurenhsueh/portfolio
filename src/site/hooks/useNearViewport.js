import { useEffect, useState } from 'react'

/**
 * true once the element with `id` comes within `margin` of the screen (e.g. '50%' = half a screen
 * below it), and stays true. Used to start heavy extras only when they're about to be needed.
 */
export function useNearViewport(id, margin = '50%') {
  const [near, setNear] = useState(false)
  useEffect(() => {
    if (near) return
    const el = document.getElementById(id)
    if (!el || !('IntersectionObserver' in window)) {
      setNear(true)
      return
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setNear(true)
      },
      { rootMargin: `${margin} 0px ${margin} 0px` },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [id, margin, near])
  return near
}
