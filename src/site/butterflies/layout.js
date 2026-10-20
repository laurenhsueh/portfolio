// ─────────────────────────────────────────────────────────────────────────────
//  Where things are on the desktop, for the butterflies: the README window, the name, the icon
//  column and the perch, as rects relative to the butterfly canvases. The canvases cover the
//  hero exactly, so these never change on scroll; they're re-measured only when something may
//  have moved (a resize, an element changing size, fonts loading, or a transition in the README
//  area such as it opening/closing) instead of reading layout every frame.
// ─────────────────────────────────────────────────────────────────────────────
import { getPerch } from './perch'

export const layout = {
  canvas: { width: 1, height: 1 },
  readme: null, // the README window (it scales while opening/closing, so it's tracked live then)
  nameRight: null, // right edge of the big name
  iconsLeft: null, // left edge of the desktop icon column
  perch: null, // the element the small butterfly lands on
}

let hero = null
let measureUntil = 0 // keep measuring every frame until then (transitions in progress)
let dirty = true

/** Measure again on the next frame, and keep measuring for `ms` (e.g. during a transition). */
function invalidate(ms = 0) {
  dirty = true
  measureUntil = Math.max(measureUntil, performance.now() + ms)
}

/** Start watching the hero for layout changes. Returns a cleanup function. */
export function watchLayout(heroEl) {
  hero = heroEl
  invalidate()
  if (!heroEl) return () => {}
  const ro = new ResizeObserver(() => invalidate())
  ro.observe(heroEl)
  for (const el of heroEl.querySelectorAll('.hero-window, .desktop-name, .hero-icons > li')) ro.observe(el)
  // README open/close (and the theme's colour fades) run as transitions; follow them live
  const onTransition = (e) => { if (e.target.closest?.('.hero-window')) invalidate(600) }
  const onResize = () => invalidate()
  heroEl.addEventListener('transitionrun', onTransition)
  heroEl.addEventListener('transitionend', onTransition)
  window.addEventListener('resize', onResize)
  document.fonts?.ready.then(onResize)
  return () => {
    ro.disconnect()
    heroEl.removeEventListener('transitionrun', onTransition)
    heroEl.removeEventListener('transitionend', onTransition)
    window.removeEventListener('resize', onResize)
    if (hero === heroEl) hero = null
  }
}

/** Re-measure if anything may have moved since last time (call once per frame). */
export function refreshLayout(canvasEl, perchId) {
  if (!dirty && performance.now() > measureUntil) return
  dirty = false
  const c = canvasEl.getBoundingClientRect()
  const rel = (el) => {
    const b = el.getBoundingClientRect()
    return { left: b.left - c.left, right: b.right - c.left, top: b.top - c.top, bottom: b.bottom - c.top, width: b.width, height: b.height }
  }
  layout.canvas = { width: c.width || 1, height: c.height || 1 }
  const win = hero?.querySelector('.readme-window')
  layout.readme = win ? rel(win) : null
  const name = hero?.querySelector('.desktop-name')
  layout.nameRight = name ? rel(name).right : null
  // visible icons only: hidden (display: none) ones report left = 0
  const icons = hero ? [...hero.querySelectorAll('.hero-icons > li')].filter((e) => e.getClientRects().length) : []
  layout.iconsLeft = icons.length ? Math.min(...icons.map((e) => rel(e).left)) : null
  const perchEl = getPerch(perchId)?.el
  layout.perch = perchEl ? rel(perchEl) : null
}
