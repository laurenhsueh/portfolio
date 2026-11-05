import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Flyer, Afterimage, CAMERA } from './StageButterfly'
import { DARK_BLOOM, LIGHT_HALO } from './lookParams'
import { guide } from './guide'

// The scroll butterfly: the hero's big butterfly, carried down the page on a fixed canvas that
// sits behind the cards (it lands on their top edges, and the front of the Garden orbit passes
// in front of it). It's rendered like the
// hero's (same bloom on dark, same halo on light, a shorter trail), so it's the same butterfly
// the whole way:
//   in the hero     the hero canvas (DuetStage) draws it; this one follows it, invisible
//   Work arrives    hand-off: this one appears exactly where the big one is (same size), the hero
//                   hides its copy (guide.heroHidden), and it glides down, shrinking, to land on
//                   the top edge of the card in view, at the corner on its image side, wings
//                   folded with a flutter (Flyer's held pose)
//   next card       a glide along a gentle arc: it turns side-on as it sets off, leaning into
//                   its heading, and turns back to face us as it settles. Trips are timed in page
//                   coordinates (1.4–2.2 s), so a normal scroll doesn't make it race; a new
//                   target mid-flight just starts a fresh glide from where it is. Scrolling far
//                   and fast: any part of a trip spent off screen runs 4× faster, so it catches
//                   up without ever jumping
//   back up         it glides home to the hero's spot and hands the butterfly back
//   Work ends       it glides into the middle of the Garden orbit ([data-nest]), growing, and on
//                   arriving tells the Garden to fade in (guide.arrive)
// If the hero butterfly isn't there (it failed to load), it comes and goes off the top right.
// The canvas only renders while Work or the Garden is on screen.
const ROT_LEFT = [0.3, 0.15, -0.18] // the hero's resting pose
const ROT_RIGHT = [0.3, -0.15, 0.18] // mirrored, for a card with its text on the right
const lerp = (a, b, t) => a + (b - a) * t
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const smooth = (a, b, t) => { const u = clamp((t - a) / (b - a), 0, 1); return u * u * (3 - 2 * u) }
const SIDE_YAW = 1.15 // rad: how far it turns side-on while travelling
const BANK = 0.25 // rad: how much it leans into its heading
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2) // ease in-out cubic
const GUIDE_BLOOM = { ...DARK_BLOOM, life: 0.14, smoke: 0.12 } // a much shorter trail than the hero's
// landed on a card's top edge: folded side-on, the whole body tilted toward the card (head in,
// wings up and out). Right corner = the default held pose leaning left; left corner = mirrored.
const LAND_ROLL = 1.0 // rad
const LAND_POSE = { 1: [0.12, 1.3, 0.2], [-1]: [0.12, -1.3, -0.2] }
const LAND_LIFT = 0.07 // × span: how far its centre sits above the edge
// smaller butterfly → a gentler, wider glow (a tight, strong bloom on a small one looked harsh)
const sizeK = (span) => clamp((span - 100) / 300, 0, 1) // 0 small … 1 big

function createState() {
  return { ready: false, owner: 'hero', key: '', x: 0, y: 0, span: 100, fade: 0, ry: ROT_LEFT[1], rz: ROT_LEFT[2], flying: 0,
    held: 0, landing: 0, restRot: null, corner: 1, trip: null, els: null, tick: 0 }
}

/** Hand the butterfly back to the hero canvas. */
function giveBack(st) {
  st.owner = 'hero'
  st.key = ''
  st.trip = null
  st.held = 0
  st.fade = 0
  guide.heroHidden = false
  guide.enRoute = false
}

function Director({ st, activeRef, reduced }) {
  const { size } = useThree()
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    if (!activeRef.current) { // off screen: the hero keeps (or gets back) its butterfly
      if (st.ready) giveBack(st)
      st.ready = false
      return
    }
    if (!st.els || st.tick++ % 60 === 0) {
      st.els = {
        work: document.getElementById('work'),
        cards: [...document.querySelectorAll('[data-perch]')],
        nest: document.querySelector('[data-nest]'),
        garden: document.querySelector('[data-garden]'),
      }
    }
    const { work, cards, nest, garden } = st.els
    if (!work) return
    const vw = size.width
    const vh = size.height
    const sx = window.scrollX
    const sy = window.scrollY
    const wr = work.getBoundingClientRect()
    const gr = garden?.getBoundingClientRect()
    // everything below is in page coordinates, so it stays put while the page scrolls
    const hero = guide.hero
    const offscreen = { x: sx + vw + 200, y: sy - 200, span: 200 }

    let mode
    if (gr && gr.top < vh * 0.6) mode = 'nest'
    else if (wr.top < vh * 0.55 && wr.bottom > vh * 0.45) mode = 'card'
    else if (wr.top >= vh * 0.55) mode = 'home'
    else mode = 'nest'

    let tx, ty, span, key
    let rot = ROT_LEFT
    const i = guide.active
    const card = cards[i] ?? cards[0]
    if (mode === 'card' && card) {
      // small, landed on the card's top edge at the corner on its image side (cards alternate:
      // image right on even cards). Folded, its lowest point is ~0.3 × span below its centre.
      const r = card.getBoundingClientRect()
      const imageRight = i % 2 === 0
      span = clamp(vw * 0.11, 104, 160)
      tx = (imageRight ? r.right - span * 0.6 : r.left + span * 0.6) + sx
      ty = r.top - span * LAND_LIFT + sy
      rot = imageRight ? ROT_RIGHT : ROT_LEFT
      st.corner = imageRight ? 1 : -1
      key = `card${i}`
    } else if (mode === 'nest' && nest) {
      // the Garden: bigger, in the middle of the orbit
      const r = nest.getBoundingClientRect()
      span = clamp(r.width * 1.2, 280, 560)
      tx = r.left + r.width / 2 + sx
      ty = r.top + r.height / 2 + sy
      key = 'nest'
    } else {
      mode = 'home'
      const h = hero ?? offscreen
      tx = h.x; ty = h.y; span = h.span
      key = 'home'
    }

    if (!st.ready) { // start where the hero's butterfly is, still the hero's
      const h = hero ?? offscreen
      st.x = h.x; st.y = h.y; st.span = h.span
      giveBack(st)
      st.ready = true
    }

    // the hero has it: follow it invisibly until Work comes into view, then take it over
    if (st.owner === 'hero') {
      if (mode === 'home') {
        st.x = tx; st.y = ty; st.span = span
        return
      }
      st.owner = 'guide'
      st.fade = 1
      st.ry = ROT_LEFT[1]; st.rz = ROT_LEFT[2]
      guide.heroHidden = !!hero
    }

    // a new destination: start a glide from wherever it is now
    // is it out of sight? (page → screen)
    const offView = (x, y, m) => y - sy < -m || y - sy > vh + m || x - sx < -m || x - sx > vw + m
    if (key !== st.key) {
      const dist = Math.hypot(tx - st.x, ty - st.y)
      st.trip = { fx: st.x, fy: st.y, fspan: st.span, fry: st.ry, frz: st.rz, p: 0,
        dur: reduced ? 0 : clamp(1.4 + dist / 2200, 1.4, 2.2), side: Math.sign(tx - st.x) || 1 }
      st.key = key
    }

    const T = st.trip
    if (T) {
      const boost = offView(st.x, st.y, st.span * 0.3) ? 4 : 1 // out of sight (a far, fast scroll): hurry
      T.p = T.dur ? Math.min(1, T.p + (dt * boost) / T.dur) : 1
      const e = ease(T.p)
      const env = Math.sin(Math.PI * e) // 0 at both ends, 1 midway
      // turning: it slowly turns side-on as it sets off and back to face us as it settles
      // heading for a card it stays side-on and folds into its landing over the last stretch
      // (turning back to face us first, then folding, looked abrupt)
      const landing = mode === 'card'
      const turned = smooth(0, 0.3, T.p) * (landing ? 1 : 1 - smooth(0.7, 1, T.p))
      st.landing = landing ? smooth(0.55, 1, T.p) : 0
      const dx = tx - T.fx
      const dy = ty - T.fy
      const L = Math.hypot(dx, dy) || 1
      // a gentle arc off the straight line (bowing outward, the way it's heading)
      const amp = Math.min(L * 0.12, 90) * env
      const nx = (-dy / L) * T.side
      const ny = (dx / L) * T.side
      st.x = lerp(T.fx, tx, e) + amp * nx
      st.y = lerp(T.fy, ty, e) + amp * ny
      st.span = lerp(T.fspan, span, e) * (1 - 0.1 * env) // a slight dip in size mid-flight
      st.ry = lerp(lerp(T.fry, rot[1], e), rot[1] - T.side * SIDE_YAW, turned) // turn so its front faces the way it flies
      st.rz = lerp(T.frz, rot[2], e) - T.side * BANK * turned // leans a little into its heading
      st.flying = env * 0.6
      if (T.p >= 1) {
        st.trip = null
        st.restRot = landing ? [st.ry, st.rz] : null // landed: keep the side-on turn while the wings finish folding
      }
    } else {
      // resting: stay on the spot (the card doesn't move on the page; the hero's spot bobs)
      st.x = tx; st.y = ty; st.span = span
      st.ry = st.restRot ? st.restRot[0] : rot[1]
      st.rz = st.restRot ? st.restRot[1] : rot[2]
      st.flying = 0
    }

    const done = !st.trip
    // landed: wings folded with a flutter (Flyer's held pose), eased in over the end of the trip
    st.held = mode !== 'card' ? 0 : done ? 1 : st.landing
    if (mode === 'home' && done) {
      if (hero) { giveBack(st); return }
      st.fade = reduced ? 0 : lerp(st.fade, 0, 1 - Math.exp(-dt * 5)) // no hero: fade out up there
    } else {
      st.fade = 1
    }
    if (mode === 'nest' && done) guide.arrive()
    guide.enRoute = mode === 'nest' && !done
  }, -1)
  return null
}

function Stage({ activeRef, reduced, theme }) {
  const { size } = useThree()
  const st = useMemo(createState, [])
  if (import.meta.env.DEV) window.__guideButterfly = st // for tuning in the browser
  const bloom = theme !== 'light'
  const drive = () => {
    if (!st.ready || st.owner === 'hero') return { at: [0.5, -0.5], span: 0.1, rot: ROT_LEFT, fade: 0 }
    const k = sizeK(st.span)
    return {
      at: [(st.x - window.scrollX) / size.width, (st.y - window.scrollY) / size.height],
      span: st.span / Math.min(size.width, size.height * 1.3),
      rot: [ROT_LEFT[0], st.ry, st.rz],
      fade: st.fade,
      held: st.held,
      holdRate: [2.5, 2.5], // folds and opens slowly
      holdRot: LAND_POSE[st.corner],
      roll: st.corner * LAND_ROLL,
      flying: st.flying,
      haloGain: bloom ? lerp(0.18, 0.45, k) : lerp(0.45, LIGHT_HALO.gain, k),
      haloSize: bloom ? lerp(16, 9, k) : lerp(11, LIGHT_HALO.size, k),
    }
  }
  const adjust = (pass) => { // the bloom pass follows the size too
    const k = sizeK(st.span)
    pass.strength = lerp(0.22, DARK_BLOOM.bloom.strength, k)
    pass.radius = lerp(0.95, DARK_BLOOM.bloom.radius, k)
  }
  return (
    <>
      <Director st={st} activeRef={activeRef} reduced={reduced} />
      {/* the hero's big butterfly's settings (DuetStage), with a shorter trail */}
      <Flyer drive={drive} bob={1.3} bobRate={1.25} reduced={reduced} theme={theme} flapRate={DARK_BLOOM.flapRate} smokeAmount={bloom ? GUIDE_BLOOM.smoke : undefined} haloGain={bloom ? 0.45 : LIGHT_HALO.gain} haloSize={bloom ? null : LIGHT_HALO.size} />
      {bloom && <Afterimage cfg={GUIDE_BLOOM} reduced={reduced} adjust={adjust} />}
    </>
  )
}

export default function GuideButterfly({ reduced, theme }) {
  const [active, setActive] = useState(false)
  const activeRef = useRef(false)
  const bloom = theme !== 'light'

  // only render while Work or the Garden is on screen
  useEffect(() => {
    const els = [document.getElementById('work'), document.querySelector('[data-garden]')].filter(Boolean)
    if (!els.length || !('IntersectionObserver' in window)) return
    const seen = new Map()
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => seen.set(e.target, e.isIntersecting))
      const on = [...seen.values()].some(Boolean)
      activeRef.current = on
      setActive(on)
    }, { threshold: 0 })
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  // dark: an opaque black canvas with its own bloom, screen-blended onto the page (like the hero)
  return (
    <div className={`guide-stage ${bloom ? 'is-dark' : 'is-light'}${active ? '' : ' is-off'}`} aria-hidden="true">
      <Canvas
        key={bloom ? 'bloom' : 'plain'} // the two looks need different GL contexts (opaque vs alpha)
        frameloop={active ? 'always' : 'never'}
        dpr={bloom ? [1, 1.25] : [1, 1.75]}
        camera={CAMERA}
        gl={{ alpha: !bloom, antialias: !bloom, powerPreference: bloom ? 'default' : 'low-power' }}
        onCreated={bloom ? ({ gl }) => gl.setClearColor('#000000', 1) : undefined}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        <Stage activeRef={activeRef} reduced={reduced} theme={theme} />
      </Canvas>
    </div>
  )
}
