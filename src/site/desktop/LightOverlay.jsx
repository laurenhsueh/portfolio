import { useEffect, useRef } from 'react'

// Lauren's light image (website/lightoverlay.png), flipped so it falls top-right → bottom-left
// along the butterflies' diagonal. Two versions in /public/art:
//   light-overlay-light.*  the flipped original (white light on near-paper) → `lighten` on light theme
//   light-overlay-dark.*   Lauren's dark-mode image (website/lightoverlaydarkmode.png) → `screen` on dark
// Covers the desktop top-to-bottom; horizontally the README centre sits on the beam (ANCHOR, fractions
// of the image), and the image scales with the README's width. Recomputed only on resize.
const ANCHOR = { x: 0.66, y: 0.5 }
const ASPECT = 992 / 1585
const SCALE = { wide: 2.1, narrow: 2.4 } // image width ÷ README width

export default function LightOverlay({ heroRef, anchorRef }) {
  const ref = useRef(null)

  // useEffect (not layout): the parent hero's ref is only attached after children's layout effects
  useEffect(() => {
    const hero = heroRef.current
    const anchor = anchorRef.current
    const el = ref.current
    if (!hero || !anchor || !el) return
    const place = () => {
      const h = hero.getBoundingClientRect()
      const r = anchor.getBoundingClientRect()
      const narrow = h.width < 900
      const cx = r.left - h.left + r.width / 2
      // Cover the desktop top-to-bottom (the light touches the bottom of the viewport) with
      // the source cloud just inside the top edge, and keep the image's right edge past the
      // viewport so its bright corner is never cut. Aspect ratio kept, never stretched.
      const TOP = 0.04 // fraction of the image above the hero's top edge
      const coverW = h.height / (1 - TOP) / ASPECT
      const readmeW = r.width * (narrow ? SCALE.narrow : SCALE.wide)
      const w = Math.max(readmeW, coverW)
      const ht = w * ASPECT
      // horizontally: README centre on the beam, unless that would expose the image's right
      // edge (its bright source corner) — then slide it right so that edge sits just off-screen
      let left = cx - w * ANCHOR.x
      const minRight = h.width + w * 0.02
      if (left + w < minRight) left = minRight - w
      const top = -ht * TOP
      el.style.width = `${w}px`
      el.style.height = `${ht}px`
      el.style.left = `${left}px`
      el.style.top = `${top}px`
    }
    place()
    const ro = new ResizeObserver(place)
    ro.observe(hero)
    ro.observe(anchor)
    window.addEventListener('resize', place)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', place)
    }
  }, [heroRef, anchorRef])

  return (
    <div ref={ref} className="light-overlay" aria-hidden="true">
      <span className="light-overlay-glow" />
    </div>
  )
}
