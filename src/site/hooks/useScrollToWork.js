import { useEffect } from 'react'

/** When the route is `workRoute` (e.g. '/work', '/v1/work'), glide down to the Work section. */
export function useScrollToWork(route, workRoute) {
  useEffect(() => {
    if (route !== workRoute) return
    const el = document.getElementById('work')
    if (!el) return
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' })
      el.focus({ preventScroll: true })
    })
  }, [route, workRoute])
}
