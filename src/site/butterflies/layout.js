// Cached page-coordinate boxes, so the butterflies don't call getBoundingClientRect every frame.
// A box in page coordinates doesn't change when the page scrolls, only when the layout does, so
// each element is measured once and re-measured after a resize or any change to the page's size
// (fonts loading, images, a section growing). Subtract window.scrollX / scrollY for screen space.
let version = 0
const cache = new WeakMap()

if (typeof window !== 'undefined') {
  const bump = () => { version++ }
  window.addEventListener('resize', bump)
  if ('ResizeObserver' in window) new ResizeObserver(bump).observe(document.documentElement)
}

/** { left, top, width, height } of `el` on the page (not the screen). */
export function pageRect(el) {
  let c = cache.get(el)
  if (!c || c.v !== version) {
    const r = el.getBoundingClientRect()
    c = { v: version, left: r.left + window.scrollX, top: r.top + window.scrollY, width: r.width, height: r.height }
    cache.set(el, c)
  }
  return c
}

/** Force everything to be re-measured on next use (e.g. after a layout change no observer sees). */
export function invalidateLayout() { version++ }
