import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Flyer, Afterimage } from './StageButterfly'
import ButterflyCanvas from './ButterflyCanvas'
import { lerp, clamp, smooth, easeInOut } from './math'
import { DARK_BLOOM, LIGHT_HALO } from './lookParams'
import { guide } from './guide'
import { pageRect } from './layout'

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
const SIDE_YAW = 1.15 // rad: how far it turns side-on while travelling
const BANK = 0.25 // rad: how much it leans into its heading
const GUIDE_BLOOM = { ...DARK_BLOOM, life: 0.14, smoke: 0.12 } // a much shorter trail than the hero's
// landed on a card's top edge: folded side-on, the whole body tilted toward the card (head in,
// wings up and out). Right corner = the default held pose leaning left; left corner = mirrored.
const LAND_ROLL = 1.0 // rad
const LAND_POSE = { 1: [0.12, 1.3, 0.2], [-1]: [0.12, -1.3, -0.2] }
const LAND_LIFT = 0.07 // × span: how far its centre sits above the edge
// smaller butterfly → a gentler, wider glow (a tight, strong bloom on a small one looked harsh)
const DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug')
const sizeK = (span) => clamp((span - 100) / 300, 0, 1) // 0 small … 1 big

function createState() {
  return { ready: false, owner: 'hero', key: '', x: 0, y: 0, span: 100, fade: 0, ry: ROT_LEFT[1], rz: ROT_LEFT[2], flying: 0,
    held: 0, landing: 0, restRot: null, corner: 1, trip: null, els: null }
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

/** The page elements it flies between (looked up again if the page re-renders them). */
function findElements(st) {
  if (st.els && st.els.work?.isConnected) return st.els
  st.els = {
    work: document.getElementById('work'),
    cards: [...document.querySelectorAll('[data-perch]')],
    nest: document.querySelector('[data-nest]'),
    garden: document.querySelector('[data-garden]'),
  }
  return st.els
}

/**
 * Where it should be right now, in page coordinates: `mode` 'home' (the hero), 'card' (the card
 * in view) or 'nest' (the Garden), with the spot (tx, ty), wingspan, resting pose and a `key`
 * that changes whenever the destination does.
 */
function pickTarget(st, els, vw, vh) {
  const { work, cards, nest, garden } = els
  const sx = window.scrollX
  const sy = window.scrollY
  // section boxes from the layout cache (page coordinates), turned into screen space
  const wp = pageRect(work)
  const workTop = wp.top - sy
  const workBottom = workTop + wp.height
  const gardenTop = garden ? pageRect(garden).top - sy : Infinity

  let mode
  if (gardenTop < vh * 0.6) mode = 'nest'
  else if (workTop < vh * 0.55 && workBottom > vh * 0.45) mode = 'card'
  else if (workTop >= vh * 0.55) mode = 'home'
  else mode = 'nest'

  const i = guide.active
  const card = cards[i] ?? cards[0]
  if (mode === 'card' && card) {
    // small, landed on the card's top edge at the corner on its image side (cards alternate:
    // image right on even cards). Measured live (one read a frame) so it rides the hover zoom.
    const r = card.getBoundingClientRect()
    const imageRight = i % 2 === 0
    const span = clamp(vw * 0.11, 104, 160)
    st.corner = imageRight ? 1 : -1
    return {
      mode, key: `card${i}`, span,
      tx: (imageRight ? r.right - span * 0.6 : r.left + span * 0.6) + sx,
      ty: r.top - span * LAND_LIFT + sy,
      rot: imageRight ? ROT_RIGHT : ROT_LEFT,
    }
  }
  if (mode === 'nest' && nest) {
    // the Garden: bigger, in the middle of the orbit
    const r = pageRect(nest)
    return { mode, key: 'nest', span: clamp(r.width * 1.2, 280, 560), tx: r.left + r.width / 2, ty: r.top + r.height / 2, rot: ROT_LEFT }
  }
  const h = guide.hero ?? offscreenSpot(vw)
  return { mode: 'home', key: 'home', span: h.span, tx: h.x, ty: h.y, rot: ROT_LEFT }
}

/** No hero butterfly to hand over (it failed to load): come and go off the top right instead. */
function offscreenSpot(vw) {
  return { x: window.scrollX + vw + 200, y: window.scrollY - 200, span: 200 }
}

/** Is a page point out of sight (with margin m)? */
function offView(x, y, m, vw, vh) {
  const sx = x - window.scrollX
  const sy = y - window.scrollY
  return sy < -m || sy > vh + m || sx < -m || sx > vw + m
}

/** A new destination: start a glide from wherever it is now. */
function startTrip(st, t, reduced) {
  const dist = Math.hypot(t.tx - st.x, t.ty - st.y)
  st.trip = { fx: st.x, fy: st.y, fspan: st.span, fry: st.ry, frz: st.rz, p: 0,
    dur: reduced ? 0 : clamp(1.4 + dist / 2200, 1.4, 2.2), side: Math.sign(t.tx - st.x) || 1 }
  st.key = t.key
}

/** One frame of a glide: a gentle arc, a slow turn side-on (and, landing, a gradual fold). */
function stepTrip(st, t, dt, vw, vh) {
  const T = st.trip
  const boost = offView(st.x, st.y, st.span * 0.3, vw, vh) ? 4 : 1 // out of sight (a far, fast scroll): hurry
  T.p = T.dur ? Math.min(1, T.p + (dt * boost) / T.dur) : 1
  const e = easeInOut(T.p)
  const env = Math.sin(Math.PI * e) // 0 at both ends, 1 midway
  // it turns side-on as it sets off and back to face us as it settles; heading for a card it
  // stays side-on and folds into its landing over the last stretch (turning back first, then
  // folding, looked abrupt)
  const landing = t.mode === 'card'
  const turned = smooth(0, 0.3, T.p) * (landing ? 1 : 1 - smooth(0.7, 1, T.p))
  st.landing = landing ? smooth(0.55, 1, T.p) : 0
  const dx = t.tx - T.fx
  const dy = t.ty - T.fy
  const L = Math.hypot(dx, dy) || 1
  const amp = Math.min(L * 0.12, 90) * env // the arc bows outward, the way it's heading
  st.x = lerp(T.fx, t.tx, e) + amp * (-dy / L) * T.side
  st.y = lerp(T.fy, t.ty, e) + amp * (dx / L) * T.side
  st.span = lerp(T.fspan, t.span, e) * (1 - 0.1 * env) // a slight dip in size mid-flight
  st.ry = lerp(lerp(T.fry, t.rot[1], e), t.rot[1] - T.side * SIDE_YAW, turned) // front faces the way it flies
  st.rz = lerp(T.frz, t.rot[2], e) - T.side * BANK * turned // leans a little into its heading
  st.flying = env * 0.6
  if (T.p >= 1) {
    st.trip = null
    st.restRot = landing ? [st.ry, st.rz] : null // landed: keep the side-on turn while the wings finish folding
  }
}

/** Resting: stay on the spot (cards don't move on the page; the hero's spot bobs). */
function rest(st, t) {
  st.x = t.tx; st.y = t.ty; st.span = t.span
  st.ry = st.restRot ? st.restRot[0] : t.rot[1]
  st.rz = st.restRot ? st.restRot[1] : t.rot[2]
  st.flying = 0
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
    const els = findElements(st)
    if (!els.work) return
    const vw = size.width
    const vh = size.height
    const t = pickTarget(st, els, vw, vh)
    const hero = guide.hero

    if (!st.ready) { // start where the hero's butterfly is, still the hero's
      const h = hero ?? offscreenSpot(vw)
      st.x = h.x; st.y = h.y; st.span = h.span
      giveBack(st)
      st.ready = true
    }

    // the hero has it: follow it invisibly until Work comes into view, then take it over
    if (st.owner === 'hero') {
      if (t.mode === 'home') { st.x = t.tx; st.y = t.ty; st.span = t.span; return }
      st.owner = 'guide'
      st.fade = 1
      st.ry = ROT_LEFT[1]; st.rz = ROT_LEFT[2]
      guide.heroHidden = !!hero
    }

    if (t.key !== st.key) startTrip(st, t, reduced)
    if (st.trip) stepTrip(st, t, dt, vw, vh)
    else rest(st, t)

    const done = !st.trip
    // landed: wings folded with a flutter (Flyer's held pose), eased in over the end of the trip
    st.held = t.mode !== 'card' ? 0 : done ? 1 : st.landing
    if (t.mode === 'home' && done) {
      if (hero) { giveBack(st); return } // home: hand it back
      st.fade = reduced ? 0 : lerp(st.fade, 0, 1 - Math.exp(-dt * 5)) // no hero: fade out up there
    } else {
      st.fade = 1
    }
    if (t.mode === 'nest' && done) guide.arrive()
    guide.enRoute = t.mode === 'nest' && !done
  }, -1)
  return null
}

/**
 * Drives the canvas (frameloop 'demand') at the rate the moment needs: full speed while it flies
 * or hovers in the Garden, 30 fps while it rests folded on a card (only a flutter), and a slow
 * 12 fps check while the hero still has it (nothing to draw, just watching for the hand-off).
 */
function FrameDriver({ st }) {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    let raf = 0
    let last = 0
    const loop = (now) => {
      raf = requestAnimationFrame(loop)
      const fps = st.owner !== 'guide' ? 12 : st.trip || st.key === 'nest' ? 120 : 30
      if (now - last >= 1000 / fps - 4) { last = now; invalidate() }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [invalidate, st])
  return null
}

function Stage({ activeRef, reduced, theme }) {
  const { size } = useThree()
  const st = useMemo(createState, [])
  if (import.meta.env.DEV && DEBUG) window.__guideButterfly = st // tuning: open the page with ?debug
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
      <FrameDriver st={st} />
      {/* the hero's big butterfly's settings (DuetStage), with a shorter trail */}
      <Flyer drive={drive} bob={1.3} bobRate={1.25} reduced={reduced} theme={theme} flapRate={DARK_BLOOM.flapRate} smokeAmount={bloom ? GUIDE_BLOOM.smoke : undefined} haloGain={bloom ? 0.45 : LIGHT_HALO.gain} haloSize={bloom ? null : LIGHT_HALO.size} />
      {bloom && <Afterimage cfg={GUIDE_BLOOM} reduced={reduced} adjust={adjust} idle={() => st.owner !== 'guide' || st.fade < 0.01} />}
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
      <ButterflyCanvas bloom={bloom} frameloop={active ? 'demand' : 'never'}>{/* FrameDriver sets the pace */}
        <Stage activeRef={activeRef} reduced={reduced} theme={theme} />
      </ButterflyCanvas>
    </div>
  )
}
