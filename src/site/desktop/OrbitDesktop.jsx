import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import ReadmeWindow from './ReadmeWindow'
import DanceButton from './DanceButton'
import { ContactItems } from './ContactDock'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { ReadmeIcon, DanceIcon } from '../NeonIcons'

const DuetStage = lazy(() => import('../butterflies/DuetStage'))
import { useAfterPaint } from '../hooks/useAfterPaint'
import SafeBoundary from '../SafeBoundary'

// The big butterfly on desktop: centred in the open space between the name's right edge and
// the icon column, level with the middle of the name + README block. Its wingspan is
// BIG_SPAN × min(w, 1.3 h), shrunk if the open wings (≈ BIG_WIDE × the span on screen) wouldn't
// clear both with BIG_PAD to spare; its glow still spreads under the glass README. On phones it
// centres in the space under the README.
const BIG_SPAN = 0.6
const BIG_WIDE = 1.15
const BIG_PAD = 16
// the orbit lines, × the big wingspan: a tilted ring around the butterfly and a planet circle
// with the same centre, so the four crossings sit symmetrically on its wings
const RING_RX = 0.98
const RING_RY = 0.22
const PLANET_R = 0.5
const TILT_DEG = -14 // matches RING_TILT in DuetStage
const HOLE_PAD = 20 // lines fade out this far around the UI
// grabbing a butterfly: within this × its wingspan of its centre (the small one only once it's in view)
const GRAB_BIG = 0.42
const GRAB_SMALL = 0.5
// the parts of the hero that keep their own clicks (no butterfly grab through them)
const UI = 'a, button, .orbit-window, .orbit-name, .orbit-icons'

function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

/** No butterflies (rather than a broken page) if three.js fails. */
/**
 * The orbit lines. `part` 'back' is the planet circle and the far (upper) half of the ring,
 * drawn under the butterflies; 'front' is the near half, drawn over them, so the ring reads as
 * passing behind the butterfly at the top and in front of it at the bottom. Both are masked
 * where they'd run under the name or the icons; they run on behind the glass README.
 */
function OrbitLines({ geo, part }) {
  if (!geo) return null
  const { W, H, big, holes } = geo
  const { x: cx, y: cy, span } = big
  const rx = span * RING_RX
  const ry = span * RING_RY
  const id = `orbit-${part}`
  const half = part === 'back' ? 1 : 0 // SVG sweep 1 from the left point runs over the top
  return (
    <svg
      className={`orbit-lines is-${part}`}
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <filter id={`${id}-feather`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="12" />
        </filter>
        <mask id={`${id}-mask`} maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
          <rect width={W} height={H} fill="#fff" />
          <g filter={`url(#${id}-feather)`}>
            {Object.entries(holes).map(
              ([k, r]) =>
                r && (
                  <rect
                    key={k}
                    x={r.x - HOLE_PAD}
                    y={r.y - HOLE_PAD}
                    width={r.w + HOLE_PAD * 2}
                    height={r.h + HOLE_PAD * 2}
                    rx="24"
                    fill="#000"
                  />
                ),
            )}
          </g>
        </mask>
      </defs>
      <g mask={`url(#${id}-mask)`} fill="none" stroke="currentColor" strokeWidth="1">
        {part === 'back' && <circle className="orbit-planet" cx={cx} cy={cy} r={span * PLANET_R} />}
        <path
          className="orbit-ring"
          d={`M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 ${half} ${cx + rx} ${cy}`}
          transform={`rotate(${TILT_DEG} ${cx} ${cy})`}
        />
      </g>
    </svg>
  )
}

/**
 * The home page's hero (Figma "B — Desktop with orbit"): the glass desktop. Name and README on the
 * left, the neon icon column on the right (readme, dance, contacts), the big ghost butterfly between them inside v2's
 * orbit lines. Closing the README calls a smaller butterfly into its place; Dance makes the two
 * circle each other (see butterflies/DuetStage.jsx).
 */
export default function OrbitDesktop({ theme }) {
  const [readmeOpen, setReadmeOpen] = useState(true)
  const [geo, setGeo] = useState(null)
  const reduced = useReducedMotion()
  const webgl = useMemo(hasWebGL, [])
  const afterPaint = useAfterPaint()
  const heroRef = useRef(null)
  const nameRef = useRef(null)
  const windowRef = useRef(null)
  const iconsRef = useRef(null)
  const spaceRef = useRef(null)
  const iconRef = useRef(null)
  const sceneRef = useRef(null) // read every frame by the butterflies
  const openRef = useRef(readmeOpen)
  const winOff = useRef({ x: 0, y: 0 }) // where the README has been dragged to, from its grid spot
  const grab = useRef(null) // the drag in progress: a butterfly, or the README by its title bar

  // measure the layout (on resize / font load, not per frame) for the lines and the butterflies
  const measure = useCallback(() => {
    const hero = heroRef.current
    if (!hero) return
    const hb = hero.getBoundingClientRect()
    const rel = (el) => {
      if (!el) return null
      const b = el.getBoundingClientRect()
      if (!b.width && !b.height) return null
      return { x: b.left - hb.left, y: b.top - hb.top, w: b.width, h: b.height }
    }
    // the name's block spans its grid column; measure the letters themselves
    const relText = (el) => {
      if (!el) return null
      const r = document.createRange()
      r.selectNodeContents(el)
      const b = r.getBoundingClientRect()
      return b.width ? { x: b.left - hb.left, y: b.top - hb.top, w: b.width, h: b.height } : null
    }
    const W = hb.width
    const H = hb.height
    const narrow = W < 900
    const space = rel(spaceRef.current)
    const win = rel(windowRef.current)
    const icons = rel(iconsRef.current)
    const name = relText(nameRef.current)
    let big
    if (narrow && space) big = { x: W * 0.56, y: space.y + space.h / 2, span: Math.min(W * 0.86, space.h * 1.15) }
    else {
      const left = name ? name.x + name.w : W * 0.4
      const right = icons ? icons.x : W * 0.85
      const fit = (right - left - BIG_PAD * 2) / BIG_WIDE
      const y = name && win ? (name.y + win.y + win.h) / 2 : H / 2
      big = { x: (left + right) / 2, y, span: Math.max(0, Math.min(Math.min(W, H * 1.3) * BIG_SPAN, fit)) }
    }
    const holes = { name, icons }
    sceneRef.current = {
      ...sceneRef.current, // keeps `drag` and the butterflies' `live` positions
      w: W,
      h: H,
      big,
      readmeOpen: openRef.current,
      readmeSpot: win && { x: win.x + win.w / 2, y: win.y + win.h / 2 },
      rightLimit: !narrow && icons ? icons.x - 24 : W - 8,
    }
    setGeo({ W, H, big, holes })
  }, [])

  useLayoutEffect(() => {
    measure()
    const ro = new ResizeObserver(measure)
    for (const r of [heroRef, nameRef, windowRef, iconsRef, spaceRef]) if (r.current) ro.observe(r.current)
    document.fonts?.ready.then(measure)
    return () => ro.disconnect()
  }, [measure])

  useEffect(() => {
    openRef.current = readmeOpen
    if (sceneRef.current) sceneRef.current.readmeOpen = readmeOpen
  }, [readmeOpen])

  // the README moves by `translate`, kept inside the hero (below the nav bar)
  const placeWindow = (x, y) => {
    const hero = heroRef.current
    const el = windowRef.current
    if (!hero || !el) return
    const hb = hero.getBoundingClientRect()
    const wb = el.getBoundingClientRect()
    const baseX = wb.left - hb.left - winOff.current.x
    const baseY = wb.top - hb.top - winOff.current.y
    const top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--taskbar-h')) || 0
    const nx = Math.min(Math.max(x, -baseX), hb.width - wb.width - baseX)
    const ny = Math.min(Math.max(y, top - baseY), hb.height - wb.height - baseY)
    winOff.current = { x: nx, y: ny }
    el.style.translate = `${nx}px ${ny}px`
  }

  // keep a dragged README on screen when the layout changes
  useEffect(() => {
    if (!geo) return
    const { x, y } = winOff.current
    if (x || y) placeWindow(x, y)
  }, [geo])

  const heroPoint = (e) => {
    const b = heroRef.current.getBoundingClientRect()
    return { x: e.clientX - b.left, y: e.clientY - b.top }
  }
  /** Which butterfly (if any) is under a hero point. The small one is on top. */
  const butterflyAt = (p) => {
    const live = sceneRef.current?.live
    if (!live) return null
    const near = (b, r) => Math.hypot(p.x - b.x, p.y - b.y) < b.span * r
    if (live.small.fade > 0.5 && near(live.small, GRAB_SMALL)) return 'small'
    if (near(live.big, GRAB_BIG)) return 'big'
    return null
  }

  const onPointerDown = (e) => {
    if (e.button !== 0) return
    const t = e.target
    if (t.closest('.orbit-window .win-bar') && !t.closest('button')) {
      grab.current = { kind: 'readme', sx: e.clientX, sy: e.clientY, ox: winOff.current.x, oy: winOff.current.y }
      windowRef.current.classList.add('is-dragging')
    } else {
      if (t.closest(UI)) return
      const p = heroPoint(e)
      const who = butterflyAt(p)
      if (!who || !sceneRef.current) return
      grab.current = { kind: who }
      sceneRef.current.drag = { who, ...p }
      heroRef.current.style.cursor = 'grabbing'
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    e.preventDefault() // no text selection while dragging
  }

  const onPointerMove = (e) => {
    const g = grab.current
    if (g?.kind === 'readme') placeWindow(g.ox + e.clientX - g.sx, g.oy + e.clientY - g.sy)
    else if (g) Object.assign(sceneRef.current.drag, heroPoint(e))
    else if (e.pointerType === 'mouse') {
      // hint that a butterfly can be picked up
      const over = !e.target.closest(UI) && butterflyAt(heroPoint(e))
      heroRef.current.style.cursor = over ? 'grab' : ''
    }
  }

  // let go: the README stays put; a butterfly flies home (DuetStage's springs)
  const onPointerUp = () => {
    const g = grab.current
    if (!g) return
    grab.current = null
    if (g.kind === 'readme') {
      windowRef.current.classList.remove('is-dragging')
      measure() // the small butterfly's spot follows the window
    } else {
      if (sceneRef.current) sceneRef.current.drag = null
      heroRef.current.style.cursor = ''
    }
  }

  const closeReadme = () => {
    setReadmeOpen(false)
    iconRef.current?.focus({ preventScroll: true })
  }

  return (
    <section
      ref={heroRef}
      className="orbit-desktop is-glass"
      aria-label="Lauren Hsueh: desktop"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <OrbitLines geo={geo} part="back" />
      {webgl &&
        afterPaint && ( // the 3D waits until the page has painted
          <SafeBoundary>
            <Suspense fallback={null}>
              <DuetStage sceneRef={sceneRef} reduced={reduced} theme={theme} />
            </Suspense>
          </SafeBoundary>
        )}
      <OrbitLines geo={geo} part="front" />

      <h1 ref={nameRef} className="desktop-name orbit-name">
        <span>Lauren</span> <span>Hsueh</span>
      </h1>

      <div ref={windowRef} className="hero-window orbit-window">
        <ReadmeWindow open={readmeOpen} onClose={closeReadme} />
      </div>

      <ul ref={iconsRef} className="orbit-icons" role="list" aria-label="Desktop">
        <li className="icon-slot">
          <button
            ref={iconRef}
            type="button"
            className={`desktop-file ${readmeOpen ? 'is-open' : ''}`}
            onClick={() => (readmeOpen ? closeReadme() : setReadmeOpen(true))}
            aria-expanded={readmeOpen}
            aria-controls="readme-window"
            aria-label="README: about me"
          >
            <ReadmeIcon size={56} />
            <span className="desktop-file-label">readme</span>
          </button>
        </li>
        <DanceButton
          icon={(spinning) => <DanceIcon size={56} className={spinning ? 'is-spinning' : ''} />}
          label={(open) => (open ? 'stop dance' : 'dance')}
        />
        <ContactItems />
      </ul>

      {/* phones: the butterflies get this space under the README */}
      <div ref={spaceRef} className="orbit-space" aria-hidden="true" />
    </section>
  )
}
