import { useEffect, useRef } from 'react'
import PixelIcon from '../PixelIcon'

const COUNT = 2

/**
 * Fallback for butterfly mode when WebGL is unavailable (the real mode is GhostButterflies):
 * a few pixel butterflies flutter out of the jar and drift gently around
 * the desktop. Positions are written straight to the DOM in a rAF loop (no React state per
 * frame). With reduced motion they simply appear, resting, without flying or flapping.
 */
export default function PixelButterflies({ active, areaRef, originRef, reduced }) {
  const els = useRef([])
  const seeds = useRef(
    Array.from({ length: COUNT }, (_, i) => ({
      a: Math.random() * 6.28, b: Math.random() * 6.28, c: Math.random() * 6.28,
      sx: 0.6 + Math.random() * 0.5, sy: 0.5 + Math.random() * 0.5,
      ax: 0.12 + Math.random() * 0.8, ay: 0.12 + Math.random() * 0.72,
      size: 18 + ((i * 7) % 4) * 4,
      delay: i * 0.18,
    })),
  )

  useEffect(() => {
    if (!active) return
    const area = areaRef.current
    if (!area) return
    let raf = 0
    const start = performance.now()
    const tick = (now) => {
      const W = area.clientWidth
      const H = area.clientHeight
      const ar = area.getBoundingClientRect()
      const o = originRef.current?.getBoundingClientRect()
      const ox = o ? o.left + o.width / 2 - ar.left : 40
      const oy = o ? o.top + o.height / 2 - ar.top : H / 2
      const t = (now - start) / 1000
      seeds.current.forEach((s, i) => {
        const el = els.current[i]
        if (!el) return
        // home position somewhere on the desktop, wandering on slow layered sines
        const tx = (s.ax + Math.sin(t * 0.13 * s.sx + s.a) * 0.08) * W + Math.sin(t * 0.47 + s.b) * 26
        const ty = (s.ay + Math.sin(t * 0.11 * s.sy + s.c) * 0.08) * H + Math.sin(t * 0.61 + s.a) * 18
        // fly out of the jar over ~1.6s
        const k = reduced ? 1 : Math.min(1, Math.max(0, (t - s.delay) / 1.6))
        const e = 1 - Math.pow(1 - k, 3)
        const x = ox + (tx - ox) * e
        const y = oy + (ty - oy) * e - Math.sin(e * Math.PI) * 60
        const tilt = reduced ? 0 : Math.cos(t * 0.47 + s.b) * 14
        el.style.transform = `translate(${x - s.size / 2}px, ${y - s.size / 2}px) rotate(${tilt}deg)`
        el.style.opacity = String(Math.min(1, k * 3))
      })
      if (!reduced) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, areaRef, originRef, reduced])

  if (!active) return null
  return (
    <div className={`pixel-butterflies ${reduced ? 'is-still' : ''}`} aria-hidden="true">
      {seeds.current.map((s, i) => (
        <span key={i} ref={(el) => (els.current[i] = el)} className="pixel-butterfly" style={{ width: s.size, height: s.size, opacity: 0 }}>
          <span className="pixel-butterfly-wings" style={{ animationDelay: `${-i * 0.13}s`, animationDuration: `${0.55 + (i % 3) * 0.12}s` }}>
            <PixelIcon name="butterfly" size={s.size} />
          </span>
        </span>
      ))}
    </div>
  )
}
