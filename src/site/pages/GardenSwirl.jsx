import { useEffect, useRef, useState } from 'react'
import { GARDEN_ITEMS } from '../content/garden'
import { guide } from '../butterflies/guide'
import { invalidateLayout } from '../butterflies/layout'

// The home page's Garden: the garden projects orbit the middle of the stage on a tilted ring, like
// the orbit on the desktop, and the scroll butterfly settles in that middle ([data-nest], an
// invisible marker). Dragging spins the ring (with a pink DRAG cursor on mouse); it also drifts
// slowly on its own. The rings and cards wait until the butterfly arrives (guide.arrive), then
// fade in. If it's late or missing (no WebGL, reduced motion), a timer shows them anyway, so
// content never stays hidden. The centred "See Garden" heading links to the full Garden page.
const TILT = (-14 * Math.PI) / 180
const IDLE_SPIN = 0.07 // rad/s
const FALLBACK_MS = 900 // after the section is in view, unless the butterfly is on its way…
const MAX_WAIT_MS = 4000 // …and never longer than this
const DRAG_CLICK_PX = 6 // a press that moved further is a drag, not a click

export default function GardenSwirl({ reduced }) {
  const sectionRef = useRef(null)
  const stageRef = useRef(null)
  const cardRefs = useRef([])
  const cursorRef = useRef(null)
  const [revealed, setRevealed] = useState(guide.arrived)
  const [geo, setGeo] = useState(null)
  const spin = useRef({ a: 0, v: 0, drag: null, suppressClick: false })

  // reveal when the butterfly lands, or shortly after the section comes into view without it
  useEffect(() => {
    if (revealed) return
    const off = guide.onArrive(() => setRevealed(true))
    let timer = 0
    let since = 0
    const check = () => {
      if (guide.enRoute && performance.now() - since < MAX_WAIT_MS) timer = setTimeout(check, 250)
      else setRevealed(true)
    }
    const io = new IntersectionObserver(
      ([e]) => {
        clearTimeout(timer)
        if (!e.isIntersecting) return
        since = performance.now()
        timer = setTimeout(check, reduced ? 0 : FALLBACK_MS)
      },
      { threshold: 0.4 },
    )
    io.observe(sectionRef.current)
    return () => {
      off()
      io.disconnect()
      clearTimeout(timer)
    }
  }, [revealed, reduced])

  // geometry from the stage's size
  useEffect(() => {
    const el = stageRef.current
    const measure = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      const rx = Math.min(w * 0.42, 480)
      setGeo({ w, h, cx: w / 2, cy: h * 0.5, rx, ry: rx * 0.34, nest: Math.min(w * 0.4, h * 0.62, 400) })
      invalidateLayout() // the butterfly's nest moved
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // the orbit: place every card each frame (only while on screen)
  useEffect(() => {
    if (!geo) return
    const S = spin.current
    let raf = 0
    let last = performance.now()
    let onScreen = false
    const n = GARDEN_ITEMS.length
    const frame = (now) => {
      const dt = Math.min((now - last) / 1000, 1 / 20)
      last = now
      if (!S.drag) {
        S.v += ((reduced ? 0 : IDLE_SPIN) - S.v) * (1 - Math.exp(-dt * 1.5))
        S.a += S.v * dt
      }
      cardRefs.current.forEach((el, i) => {
        if (!el) return
        const a = S.a + (i / n) * Math.PI * 2 + 0.5
        const ex = geo.rx * Math.cos(a)
        const ey = geo.ry * Math.sin(a)
        const x = geo.cx + ex * Math.cos(TILT) - ey * Math.sin(TILT)
        const y = geo.cy + ex * Math.sin(TILT) + ey * Math.cos(TILT)
        const d = (Math.sin(a) + 1) / 2 // 0 back … 1 front
        el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${0.62 + 0.42 * d})`
        el.style.opacity = String(0.38 + 0.62 * d)
        el.style.zIndex = String(d > 0.5 ? 20 + Math.round(d * 10) : 0) // the back half sits behind the butterfly
      })
      if (onScreen) raf = requestAnimationFrame(frame)
    }
    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting
      cancelAnimationFrame(raf)
      if (onScreen) {
        last = performance.now()
        raf = requestAnimationFrame(frame)
      }
    })
    io.observe(stageRef.current)
    frame(performance.now()) // place them once right away
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [geo, reduced])

  // drag to spin: horizontal drags turn the ring (the front follows the pointer); vertical
  // swipes still scroll the page (touch-action: pan-y)
  const onPointerDown = (e) => {
    if (e.button !== 0) return
    const S = spin.current
    S.drag = { x: e.clientX, start: e.clientX, t: performance.now(), moved: 0 }
    S.v = 0
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e) => {
    const c = cursorRef.current
    if (c && e.pointerType === 'mouse') {
      const r = stageRef.current.getBoundingClientRect()
      c.style.transform = `translate(${e.clientX - r.left}px, ${e.clientY - r.top}px) translate(-50%, -50%)`
    }
    const S = spin.current
    if (!S.drag || !geo) return
    const now = performance.now()
    const dx = e.clientX - S.drag.x
    const dt = Math.max((now - S.drag.t) / 1000, 1 / 240)
    const da = -dx / geo.rx
    S.a += da
    S.v = S.v * 0.6 + (da / dt) * 0.4
    S.drag.x = e.clientX
    S.drag.t = now
    S.drag.moved = Math.max(S.drag.moved, Math.abs(e.clientX - S.drag.start))
  }
  const onPointerUp = () => {
    const S = spin.current
    if (!S.drag) return
    S.suppressClick = S.drag.moved > DRAG_CLICK_PX
    S.v = Math.max(-3, Math.min(3, S.v))
    S.drag = null
  }
  // a drag that ends on a card shouldn't open it
  const onClickCapture = (e) => {
    if (spin.current.suppressClick) {
      e.preventDefault()
      e.stopPropagation()
      spin.current.suppressClick = false
    }
  }

  return (
    <section
      ref={sectionRef}
      className={`swirl${revealed ? ' is-revealed' : ''}`}
      aria-labelledby="garden-title"
      data-garden
      onFocus={() => setRevealed(true)}
    >
      <header className="swirl-head">
        <h2 id="garden-title" className="section-title">
          <a href="#/garden" className="swirl-head-link">
            <span className="swirl-head-text">See Garden</span>
            <svg className="swirl-head-arrow" width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
              <path
                d="M7 21L21 7M10 7h11v11"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        </h2>
      </header>

      <div
        ref={stageRef}
        className="swirl-stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={onClickCapture}
      >
        {geo && (
          <svg className="swirl-rings" width={geo.w} height={geo.h} aria-hidden="true">
            <ellipse cx={geo.cx} cy={geo.cy} rx={geo.rx} ry={geo.ry} transform={`rotate(-14 ${geo.cx} ${geo.cy})`} />
            <ellipse
              cx={geo.cx}
              cy={geo.cy}
              rx={geo.rx * 0.72}
              ry={geo.ry * 1.6}
              transform={`rotate(12 ${geo.cx} ${geo.cy})`}
              className="is-faint"
            />
          </svg>
        )}
        {geo && (
          <div
            className="swirl-nest"
            data-nest
            aria-hidden="true"
            style={{ width: geo.nest, height: geo.nest, left: geo.cx - geo.nest / 2, top: geo.cy - geo.nest / 2 }}
          />
        )}
        <ul className="swirl-cards">
          {GARDEN_ITEMS.map((it, i) => (
            <li
              key={it.name}
              className="swirl-slot"
              ref={(el) => {
                cardRefs.current[i] = el
              }}
            >
              <a className="swirl-card" href={it.href ?? '#/garden'} draggable={false} style={{ '--i': i }}>
                <span className="swirl-card-bar" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="swirl-card-media" aria-hidden="true">
                  {it.image ? <img src={it.image} alt="" draggable={false} /> : null}
                </span>
                <span className="swirl-card-name">{it.name}</span>
                <span className="swirl-card-tag">{it.tag}</span>
              </a>
            </li>
          ))}
        </ul>
        <div ref={cursorRef} className="swirl-cursor" aria-hidden="true">
          Drag
        </div>
      </div>
    </section>
  )
}
