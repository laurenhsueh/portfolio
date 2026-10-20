import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { precompute, evaluateWings, NODE_DEFAULTS, SCENE } from '../../wingMath'
import { createApparitionMaterial } from '../../apparitionMaterial'
import { createHaloTexture } from '../../wingMaterial'
import { SmokeSystem, findEmitters } from '../../Smoke'
import { getPerch } from '../perch'
import { dance, beatNow } from '../dance'
import { BUTTERFLY_LOOK } from './lookParams'

// Butterfly mode: two of Lauren's pink ghost "apparition" butterflies (same GLB, Geometry
// Nodes flap and approved material as the lab), each on its own transparent canvas so it can
// sit in front of or behind the README window.
//   • the "perch" role uses the reusable land → fly-off behaviour (see ../perch.js)
//   • the "hover" role floats almost in place, gliding a little along its heading
// The two butterflies are identical, so they can trade roles: while music plays (../dance.js)
// they dance, and every few bars they swap places, growing / shrinking as they pass in front of
// / behind the README.
const GLB = '/butterflybaked.glb'
const FOV = 30
const CAM_Z = 10
const KEY_LIGHT = new THREE.Vector3(3, 5, 6).normalize()
const _v = new THREE.Vector3()
const _c = new THREE.Vector3()
const HALF_PI = Math.PI / 2

// Look, in the butterfly lab's own units (Lauren's picks): glow 0.3, halo 1, smoke 0.1.
const LOOK = BUTTERFLY_LOOK
const HALO_TEX = typeof document !== 'undefined' ? createHaloTexture() : null

// Model space: head = +Y, back = +Z. rot.z turns the head in screen space
// (0 = up, +π/2 = left, −π/4 = up-right).
const BUTTERFLIES = [
  {
    kind: 'hover',
    // large, below-left of the README, facing diagonally up-right.
    // `follow`: while that perch is away (README closed) it drifts to `alt` (the README's
    // spot) and comes closer (`altScale`), filling the empty space; it returns when it's back.
    span: (w, narrow) => (narrow ? w * 0.56 : THREE.MathUtils.clamp(w * 0.27, 340, 440)),
    at: (r, c, span, narrow) =>
      narrow ? [c.width * 0.58, r.bottom + span * 0.3] : [r.left - span * 0.02, r.bottom + span * 0.18],
    follow: 'readme',
    // README closed: horizontally centred in the gap between the name and the icon column
    // (equal space from each wingtip), at the README's height
    alt: (r, c, span, narrow, L) =>
      narrow ? [c.width * 0.5, r.top + r.height * 0.55] : [L ? (L.nameRight + L.iconsLeft) / 2 : c.width * 0.5, r.top + r.height * 0.6],
    altScale: 1.2,
    // on load it flies in from off-screen bottom-left (along its up-right heading), a beat
    // after the small butterfly starts its approach to the README
    introDelay: 0.4,
    // keep the lowest wingtip at least this far above the hero's bottom border
    bottomClear: 48,
    dir: [0.7, -0.7], rot: [0.32, 0.25, -Math.PI / 4], flap: 0.55,
  },
  {
    kind: 'perch',
    perch: 'readme',
    span: (w, narrow) => (narrow ? w * 0.3 : THREE.MathUtils.clamp(w * 0.12, 150, 200)),
    flap: 0.65,
  },
]

const TIMING = { flyIn: 3.2, flyOut: 2.0, followDelay: 0.9, follow: 3.2 }
// wings: full flap in flight; perched, they fold up together (seen side-on) with only a
// whisper of flutter, via the Geometry Nodes Map Range output (radians)
const WING = { fly: [NODE_DEFAULTS.mapToMin, NODE_DEFAULTS.mapToMax], rest: [1.04, 1.4] }
const FLAP = { fly: 1.1, rest: 0.45 }

// dancing: frames per wing-flap cycle (one sine period of the Geometry Nodes flap)
const FLAP_CYCLE = 2 * Math.PI * NODE_DEFAULTS.frameDivisor
// The dance is a repeating 4-bar phrase (16 beats), so moves take turns and never collide:
//   bar 1 (beats 0–3)   groove: the big one sways, the small one hops
//   bar 2 (beats 4–7)   groove + the big one's twirl (beats 5–7, every other phrase)
//   bar 3 (beats 8–11)  groove
//   bar 4 (beats 12–15) the swap (README open); it lands on the next phrase's beat 0
const PHRASE = 16
const TWIRL = { at: 5, beats: 2, settle: 0.5 }
const SWAP = { at: 12, beats: 4 }
const HOP = { beats: 0.6, height: 0.13, dip: 0.02, dipBeats: 0.15 } // lands on bar beats 1 and 3
const phraseRand = (n) => { const v = Math.sin(n * 12.9898 + 4.1) * 43758.5453; return v - Math.floor(v) }

const ROLE_CFG = { hover: BUTTERFLIES[0], perch: BUTTERFLIES[1] }
const otherRole = (r) => (r === 'hover' ? 'perch' : 'hover')
// which role each butterfly plays; reversed when a swap completes
const ROLES = ['hover', 'perch']
// Shared world: each role's motion and the swap, stepped once per animation frame (by
// whichever canvas renders first) so both butterflies see the same state.
const W = {}
function resetWorld() {
  ROLES[0] = 'hover'
  ROLES[1] = 'perch'
  Object.assign(W, {
    last: -1, t: 0, dl: 0, beat: 0,
    // dance clock in beats: runs at the song's tempo, phase-locked to the audio while it plays,
    // and keeps going smoothly after a stop or a song loop so moves in progress can finish
    db: 0,
    // hover-follow state: m = 0 at home, 1 at the alternate spot; intro = load fly-in clock
    hover: { m: 0, wantAway: false, since: 0, fade: 1, intro: 0, visDx: 0, visDy: 0, twirl: null, twirlDone: -1, pose: null },
    // perch state machine: away → in → landed → out → away
    perch: { mode: 'away', k: 0, from: [0, 0], ctrl: [0, 0], pos: null, prevPos: null, heading: HALF_PI, rest: 0, side: 1, fade: 0, hop: null, pose: null },
    swap: { active: false, k: 0, start: 0, end: -Infinity, done: -1 },
  })
}
resetWorld() // ready before the first frame, even right after a hot reload

const clamp01 = (t) => Math.min(1, Math.max(0, t))
const easeOut = (t) => 1 - (1 - t) ** 3
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
/** Downbeat lift (fraction of span): on bar beat 1, softer on 3; rises fast, settles slowly. */
function downbeatLift(db) {
  const inBar = ((db % 4) + 4) % 4
  const which = Math.floor(inBar)
  if (which !== 0 && which !== 2) return 0
  const u = inBar - which
  const pulse = u < 0.35 ? easeOut(u / 0.35) : 1 - easeIn((u - 0.35) / 0.65)
  return (which === 0 ? 0.03 : 0.015) * pulse
}
const ease = (t) => t * t * (3 - 2 * t)
const easeIn = (t) => t * t
const lerp = (a, b, t) => a + (b - a) * t
function bez(a, c, b, t) {
  const u = 1 - t
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]
}
function angLerp(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI
  if (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}

/** World-space size of the visible plane at z = 0 for the current canvas. */
function viewExtents(size) {
  const h = 2 * CAM_Z * Math.tan(THREE.MathUtils.degToRad(FOV / 2))
  return { w: h * (size.width / size.height), h }
}

/**
 * A natural arrival flight from `from` to `to` (k: 0 → 1): it comes in at speed and slows to
 * settle, wandering side to side and bobbing with its wingbeats the way real butterflies do,
 * both fading out as it arrives. Returns [x, y] plus the heading of the underlying path.
 */
function flutterPath(from, ctrl, to, k, spanPx, t, seed = 0) {
  const e = easeOut(k)
  const [x, y] = bez(from, ctrl, to, e)
  const [ax, ay] = bez(from, ctrl, to, Math.min(1, e + 0.02))
  const dx = ax - x
  const dy = ay - y
  const len = Math.hypot(dx, dy) || 1
  const settle = 1 - e
  const wander = (Math.sin(k * Math.PI * 4 + seed) + 0.5 * Math.sin(k * Math.PI * 9 + seed * 2)) * spanPx * 0.12 * settle
  const bob = Math.sin(t * 9 + seed) * spanPx * 0.04 * settle
  return {
    x: x - (dy / len) * wander,
    y: y + (dx / len) * wander + bob,
    heading: len > 1e-3 ? Math.atan2(-dy, dx) - HALF_PI : null, // 0 = head up (model space)
    settle,
  }
}

/** Advance the shared world once per animation frame (both canvases call this). */
function stepWorld(now, dt, x) {
  if (now - W.last < 4) return // the other canvas already stepped this frame
  W.last = now
  W.t += dt
  // dance level: eases in and out over about 2s
  W.dl += ((dance.playing ? 1 : 0) - W.dl) * (1 - Math.exp(-dt * 2))
  W.beat = beatNow()
  W.db += (dance.bpm / 60) * dt
  if (dance.playing) {
    let d = (W.beat - W.db) % 1 // only the beat phase matters (the detector can't tell bar 1)
    if (d > 0.5) d -= 1
    if (d < -0.5) d += 1
    W.db += d * (1 - Math.exp(-dt * 3))
  }
  stepHover(dt, x)
  stepPerch(dt, x)
  stepSwap(dt, x)
}

/** The hover role: big, below-left of the README; drifts into its spot when it closes. */
function stepHover(dt, x) {
  const H = W.hover
  const cfg = ROLE_CFG.hover
  const { c, rel, narrow, reduced } = x
  const motion = reduced ? 0 : 1
  const t = W.t
  const spanPx = cfg.span(x.width, narrow)
  const win = x.hero?.querySelector('.readme-window')
  const r = win ? rel(win) : { left: c.width * 0.4, right: c.width * 0.75, top: c.height * 0.25, bottom: c.height * 0.5, width: c.width * 0.35, height: c.height * 0.25 }
  // home ↔ alternate spot, tied to whether the followed perch is present
  const away = cfg.follow ? !getPerch(cfg.follow)?.present : false
  if (away !== H.wantAway) { H.wantAway = away; H.since = 0 }
  H.since += dt
  // leave only after the perched butterfly has taken off; come back right away
  const target = H.wantAway && H.since > TIMING.followDelay ? 1 : H.wantAway ? H.m : 0
  if (reduced) {
    // no travel: fade out, switch spots, fade back in
    if (Math.abs(target - H.m) > 0.001) {
      H.fade = Math.max(0, H.fade - dt * 3)
      if (H.fade === 0) H.m = target
    } else H.fade = Math.min(1, H.fade + dt * 3)
  } else {
    H.m += (target - H.m) * (1 - Math.exp(-dt * (4 / TIMING.follow)))
    H.fade = 1
  }
  const m = ease(clamp01(H.m))
  // live layout landmarks: right edge of the name, left edge of the icon column
  const nameEl = x.hero?.querySelector('.desktop-name')
  // visible icons only: hidden (display: none) ones report left = 0
  const iconEls = x.hero ? [...x.hero.querySelectorAll('.hero-icons > li')].filter((e) => e.getClientRects().length) : []
  const L = nameEl && iconEls.length
    ? { nameRight: rel(nameEl).right, iconsLeft: Math.min(...iconEls.map((e) => rel(e).left)) }
    : null
  const home = cfg.at(r, c, spanPx, narrow)
  const alt = cfg.alt ? cfg.alt(r, c, spanPx, narrow, L) : home
  let px = lerp(home[0], alt[0], m)
  let py = lerp(home[1], alt[1], m)
  // glide swings evenly around the spot (so the spot stays the visual centre)
  const glide = -0.5 * Math.cos(t * 0.22 * motion) * spanPx * 0.14
  px += cfg.dir[0] * glide + Math.sin(t * 0.37 * motion) * spanPx * 0.02
  py += cfg.dir[1] * glide + Math.sin(t * 0.53 * motion) * spanPx * 0.02
  // correct for the model's visual centre sitting off its pivot in this pose
  // (measured last frame), fully at the alternate spot where centring matters
  px -= H.visDx * m
  py -= H.visDy * m
  px = THREE.MathUtils.clamp(px, spanPx * 0.4, c.width - spanPx * 0.4)
  // lowest wingtip ≈ centre + 0.42 × the (scaled) span in this pose
  const reach = spanPx * lerp(1, cfg.altScale ?? 1, m) * 0.42
  py = THREE.MathUtils.clamp(py, spanPx * 0.3, c.height - (cfg.bottomClear ?? 0) - reach)
  let fade = H.fade
  let rx = cfg.rot[0] + Math.sin(t * 0.31 * motion) * 0.03
  let ry = cfg.rot[1] + Math.sin(t * 0.23 * motion + 1.7) * 0.07
  let rz = cfg.rot[2] + Math.sin(t * 0.27 * motion + 0.9) * 0.05
  let flap = cfg.flap
  // fly-in on load: from off-screen bottom-left, fluttering in and settling onto the spot,
  // banking along its path and flapping harder until it arrives
  if (H.intro < cfg.introDelay + TIMING.flyIn) {
    H.intro += dt
    const k = clamp01((H.intro - cfg.introDelay) / TIMING.flyIn)
    if (reduced) fade *= k // no travel: fade in on the spot
    else {
      const from = [-spanPx * 0.8, c.height + spanPx * 0.6]
      const ctrl = [lerp(from[0], px, 0.15), lerp(from[1], py, 0.75) - spanPx * 0.3]
      const f = flutterPath(from, ctrl, [px, py], k, spanPx, t, 0.7)
      px = f.x
      py = f.y
      if (f.heading != null) rz = angLerp(f.heading, rz, ease(1 - f.settle))
      rx += 0.15 * f.settle // tipped a little more toward the viewer while travelling
      flap *= 1 + 1.2 * f.settle
      if (k === 0) fade = 0
    }
  }
  // dancing: smooth and flowing, a pendulum swing once per bar, leaning into it, with a lift on
  // the downbeats and, every other phrase, a slow twirl carried out of the end of a swing
  const db = W.db
  const phrase = Math.floor(db / PHRASE)
  const pb = db - phrase * PHRASE // beat within the phrase
  if (W.dl > 0.001 && !reduced) {
    const dl = W.dl
    const amp = 1 + 0.2 * (phraseRand(phrase) - 0.5) // ±10% per phrase, so it never feels mechanical
    const sw = Math.sin((Math.PI * 2 * db) / 4) // pendulum: lingers at ±1 (bar beats 2 and 4)
    px += dl * amp * spanPx * 0.1 * sw
    rz -= dl * 0.18 * sw
    py -= dl * spanPx * downbeatLift(db)
    flap *= 1 + 0.25 * dl
  }
  // twirl: latched when it starts so it always finishes (even if the music stops meanwhile)
  // (a late start on slow frames catches up on the same timeline instead of being skipped)
  if (!H.twirl && H.twirlDone !== phrase && phrase % 2 === 1 && pb >= TWIRL.at && pb < TWIRL.at + 1
    && W.dl > 0.5 && !reduced && !W.swap.active) {
    H.twirl = { start: phrase * PHRASE + TWIRL.at, dir: Math.floor(phrase / 2) % 2 === 0 ? 1 : -1 }
    H.twirlDone = phrase
  }
  if (H.twirl) {
    const u = (db - H.twirl.start) / TWIRL.beats
    if (u < 1) ry += H.twirl.dir * Math.PI * 2 * easeInOut(clamp01(u))
    else {
      // follow-through: a small overshoot that settles within half a beat
      const v = (db - H.twirl.start - TWIRL.beats) / TWIRL.settle
      if (v < 1) ry += H.twirl.dir * 0.05 * Math.sin(Math.PI * clamp01(v))
      else H.twirl = null
    }
  }
  H.pose = {
    x: px, y: py, span: spanPx * lerp(1, cfg.altScale ?? 1, m), rot: [rx, ry, rz],
    rest: 0, open: 0, fade, flap, lock: 1, smoke: true,
  }
}

/** The perch role: lands on the README's title bar, flies off when it closes. */
function stepPerch(dt, x) {
  const P = W.perch
  const cfg = ROLE_CFG.perch
  const { c, rel, reduced } = x
  const spanPx = cfg.span(x.width, x.narrow)
  const perch = getPerch(cfg.perch)
  const present = !!(perch?.present && perch.el)
  const r = perch?.el ? rel(perch.el) : null
  const spot = r
    ? [r.left + r.width * perch.spot.x, r.top + r.height * perch.spot.y - spanPx * 0.03]
    : [c.width * 0.7, c.height * 0.25]
  const faceLeft = (perch?.facing ?? 'left') === 'left'
  const offIn = [c.width + spanPx, -spanPx * 0.6] // arrives from the upper right
  const offOut = [spot[0] - c.width * 0.55, -spanPx] // leaves up and to the left

  if (reduced) {
    // no flight: appear on the perch / fade away
    P.mode = present ? 'landed' : 'away'
    P.fade += ((present ? 1 : 0) - P.fade) * (1 - Math.exp(-dt * 5))
    P.pos = spot
  } else {
    if (present && (P.mode === 'away' || P.mode === 'out')) {
      P.from = P.mode === 'out' && P.pos ? P.pos : offIn
      P.ctrl = [lerp(P.from[0], spot[0], 0.25), Math.min(P.from[1], spot[1]) - spanPx * 0.6]
      P.mode = 'in'
      P.k = 0
    } else if (!present && (P.mode === 'landed' || P.mode === 'in')) {
      P.from = P.pos ?? spot
      P.ctrl = [lerp(P.from[0], offOut[0], 0.35), P.from[1] - spanPx * 0.9]
      P.mode = 'out'
      P.k = 0
    }
    if (P.mode === 'in') {
      P.k = Math.min(1, P.k + dt / TIMING.flyIn)
      const f = flutterPath(P.from, P.ctrl, spot, P.k, spanPx, W.t, 2.1)
      P.pos = [f.x, f.y]
      if (P.k >= 1) P.mode = 'landed'
    } else if (P.mode === 'out') {
      P.k = Math.min(1, P.k + dt / TIMING.flyOut)
      P.pos = bez(P.from, P.ctrl, offOut, easeIn(P.k))
      if (P.k >= 1) P.mode = 'away'
    } else if (P.mode === 'landed') {
      P.pos = spot // stay put on the (possibly moving) element
    }
    P.fade = P.mode === 'away' ? 0 : 1
  }

  const [px, py] = P.pos ?? offIn
  const prev = P.prevPos ?? [px, py]
  const flying = P.mode === 'in' || P.mode === 'out'
  // heading follows the flight path; once down it settles facing the perch direction
  const vx = px - prev[0]
  const vy = -(py - prev[1])
  // arriving: it flies in sideways, already in its perched profile (body along the bar, facing
  // the perch direction), so landing is just folding the wings, with no roll or turn at the end.
  // Leaving: it rolls back toward the viewer and heads along its path.
  const leaving = P.mode === 'out'
  const rest = faceLeft ? HALF_PI : -HALF_PI
  const want = leaving && Math.hypot(vx, vy) > 0.3 ? Math.atan2(vy, vx) - HALF_PI : rest
  P.heading = angLerp(P.heading, want, 1 - Math.exp(-dt * (leaving ? 6 : 3)))
  P.prevPos = [px, py]
  P.rest += ((flying ? 0 : 1) - P.rest) * (1 - Math.exp(-dt * 2.5)) // wings: flap in flight, fold on the perch
  P.side += ((leaving ? 0 : 1) - P.side) * (1 - Math.exp(-dt * 4)) // body: profile unless leaving
  let rz = P.heading
  let open = 0
  let flap = lerp(FLAP.fly, FLAP.rest, P.rest)
  let hopY = 0
  // dancing while perched: light and bouncy. It leans opposite the big one's swing (partners),
  // flutters, and hops: a tiny dip, a push-off with the wings flicking open, and a landing
  // right on bar beats 1 and 3, wings folding as it touches down
  if (W.dl > 0.001 && !reduced && P.mode === 'landed') {
    rz += W.dl * 0.06 * Math.sin((Math.PI * 2 * W.db) / 4)
    open = W.dl * 0.15 * (1 - Math.cos(Math.PI * 4 * W.db)) * 0.5 // light flutter between hops
    flap = lerp(flap, 1.4, W.dl)
  }
  {
    // the next landing beat (bar beats 1 and 3 = every 2 beats from beat 0)
    const land = Math.ceil(W.db / 2) * 2
    const takeoff = land - HOP.beats
    const canHop = W.dl > 0.3 && !reduced && P.mode === 'landed' && !W.swap.active
      && takeoff >= W.swap.end + 1 // the newcomer settles for a beat before joining in
    if (!P.hop && canHop && W.db >= takeoff - HOP.dipBeats) P.hop = { land, w: 1 }
    if (P.hop) {
      const pre = (W.db - (P.hop.land - HOP.beats - HOP.dipBeats)) / HOP.dipBeats
      const u = (W.db - (P.hop.land - HOP.beats)) / HOP.beats
      if (u < 0) hopY = -spanPx * HOP.dip * Math.sin(Math.PI * clamp01(pre)) // anticipation dip
      else if (u < 1) {
        const arc = 4 * u * (1 - u) // parabola: eases out going up, eases in coming down
        hopY = spanPx * HOP.height * arc
        open = Math.max(open, arc)
      } else P.hop = null
    }
  }
  // profile (side = 1): rolled side-on (back up), body along the bar, so the folded wings stand
  // above it. Leaving (side → 0): back to the viewer. A whisper of sway while resting.
  P.pose = {
    x: px, y: py - hopY, span: spanPx,
    rot: [
      lerp(0.25, -HALF_PI + 0.18, P.side),
      lerp(0.15, 0.3, P.side) * (faceLeft ? 1 : -1) + Math.sin(W.t * 0.4) * 0.03 * P.rest,
      rz,
    ],
    rest: P.rest, open, fade: P.fade, flap, lock: 1 - P.rest,
    smoke: P.mode !== 'away',
  }
}

/** Line-dance swap: every 4 bars the two trade roles (places and sizes) over 1 bar. */
function stepSwap(dt, x) {
  const s = W.swap
  if (s.active) {
    // driven by the dance clock (which keeps running after a stop), so it always finishes and
    // lands exactly on the next phrase's beat 0
    s.k = clamp01((W.db - s.start) / SWAP.beats)
    if (s.k >= 1) {
      ROLES.reverse()
      s.active = false
      s.k = 0
      s.end = s.start + SWAP.beats
    }
    return
  }
  const phrase = Math.floor(W.db / PHRASE)
  const into = W.db - phrase * PHRASE - SWAP.at
  const ready = W.dl > 0.5 && !x.reduced && W.perch.mode === 'landed' && !W.perch.hop && !W.hover.twirl
    && W.hover.m < 0.01 && W.hover.intro >= ROLE_CFG.hover.introDelay + TIMING.flyIn
  // start on beat 12; a late start (slow frames) catches up instead of skipping
  if (ready && into >= 0 && into < SWAP.beats / 2 && phrase !== s.done) {
    s.active = true
    s.start = phrase * PHRASE + SWAP.at
    s.k = clamp01(into / SWAP.beats)
    s.done = phrase
  }
}

/** Blend a butterfly from role pose A into role pose B (k: 0 → 1) along a bowed arc. */
function blendPoses(A, B, k) {
  const e = ease(k)
  const vx = B.x - A.x
  const vy = B.y - A.y
  const len = Math.hypot(vx, vy) || 1
  // the two travel opposite ways, so the same bow puts one path over and one under
  const bow = Math.sin(Math.PI * e) * len * 0.22
  // wings: open early when taking off, fold late when landing
  const rk = B.rest > A.rest ? ease(clamp01((k - 0.65) / 0.35)) : ease(clamp01(k / 0.3))
  return {
    x: A.x + vx * e - (vy / len) * bow,
    y: A.y + vy * e + (vx / len) * bow,
    span: lerp(A.span, B.span, e),
    rot: [lerp(A.rot[0], B.rot[0], rk), lerp(A.rot[1], B.rot[1], rk), angLerp(A.rot[2], B.rot[2], e)],
    rest: lerp(A.rest, B.rest, rk),
    open: lerp(A.open, B.open, e),
    fade: lerp(A.fade, B.fade, e),
    flap: lerp(A.flap, B.flap, rk),
    lock: lerp(A.lock, B.lock, rk),
    smoke: A.smoke || B.smoke,
  }
}

function GhostButterfly({ index, theme, reduced, heroRef, layerRef }) {
  const gltf = useGLTF(GLB)
  const groupRef = useRef()
  const { size, gl } = useThree()

  const { root, wings, mats, smoke } = useMemo(() => {
    const root = gltf.scene.clone(true)
    let wings = null
    let body = null
    root.traverse((o) => {
      if (!o.isMesh) return
      if (o.name === 'wings') wings = o
      else if (o.name === 'butterfly') body = o
    })
    const map = (wings || body)?.material.map ?? null
    const mats = {
      wing: createApparitionMaterial(map, { layer: 0 }),
      body: createApparitionMaterial(map, { layer: 0, body: 1 }),
      haze: createApparitionMaterial(map, { layer: 1 }),
    }
    if (wings) {
      wings.geometry = wings.geometry.clone()
      wings.frustumCulled = false
      wings.material = mats.wing
      const haze = new THREE.Mesh(wings.geometry, mats.haze)
      haze.frustumCulled = false
      haze.renderOrder = -1
      wings.add(haze)
    }
    if (body) body.material = mats.body
    // the lab's smoke + glowing dust, at the approved smoke amount (0.3): ethereal + a bit techy
    const smoke = wings && map?.image ? new SmokeSystem(findEmitters(wings.geometry, map.image)) : null
    return { root, wings, mats, smoke }
  }, [gltf])

  useEffect(() => () => {
    Object.values(mats).forEach((m) => m.dispose())
    wings?.geometry.dispose()
    smoke?.dispose()
  }, [mats, wings, smoke])

  const halo = useMemo(() => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: HALO_TEX, transparent: true, depthWrite: false }))
    sp.renderOrder = -2
    sp.material.userData.base = 0.3
    return sp
  }, [])
  useEffect(() => () => halo.material.dispose(), [halo])

  const field = useMemo(
    () => wings && precompute(Float32Array.from(wings.geometry.attributes.position.array), NODE_DEFAULTS),
    [wings],
  )

  // approved apparition defaults: iridescence 1, glow 0.3 (×1.15 mapping), haze 0.8,
  // with extra glow here because this overlay has no bloom pass.
  useEffect(() => {
    const light = theme === 'light'
    for (const [m, op] of [[mats.wing, 1], [mats.body, 1], [mats.haze, 0.8]]) {
      const u = m.uniforms
      u.uIri.value = 1
      u.uGlow.value = LOOK.glow * 1.15 // lab slider mapping
      u.uOpacity.value = op
      u.uLight.value = light ? 1 : 0
      m.blending = light ? THREE.NormalBlending : THREE.AdditiveBlending
      m.needsUpdate = true
    }
    smoke?.setLook('apparition', theme)
    // the lab's halo sprite (apparition style): pink glow behind the butterfly
    const hm = halo.material
    if (light) {
      hm.blending = THREE.NormalBlending
    } else {
      // pure additive light that leaves the canvas alpha alone, so it glows over the page
      // instead of compositing as a grey disc on the transparent canvas
      hm.blending = THREE.CustomBlending
      hm.blendEquation = THREE.AddEquation
      hm.blendSrc = THREE.SrcAlphaFactor
      hm.blendDst = THREE.OneFactor
      hm.blendSrcAlpha = THREE.ZeroFactor
      hm.blendDstAlpha = THREE.OneFactor
    }
    hm.color.set(light ? '#fff6fb' : '#ffc4df') // light mode: a near-white halo so they stand out
    hm.userData.base = LOOK.halo * (light ? 0.85 : 0.3) // light mode: brighter white halo to lift off the page
    hm.needsUpdate = true
  }, [theme, mats, smoke, halo])

  const st = useMemo(
    () => ({ t: index * 7.3, frame: SCENE.frameStart + index * 41, params: { ...NODE_DEFAULTS }, outline: null }),
    [index],
  )

  useFrame(({ camera }, rawDt) => {
    const g = groupRef.current
    if (!g || !wings || !field) return
    const dt = Math.min(rawDt, 1 / 20)
    const motion = reduced ? 0 : 1
    st.t += dt
    const t = st.t

    const c = gl.domElement.getBoundingClientRect()
    const rel = (el) => {
      const b = el.getBoundingClientRect()
      return { left: b.left - c.left, right: b.right - c.left, top: b.top - c.top, bottom: b.bottom - c.top, width: b.width, height: b.height }
    }
    stepWorld(performance.now(), dt, { c, rel, width: size.width, narrow: size.width < 900, hero: heroRef?.current, reduced })

    const role = ROLES[index]
    const sw = W.swap
    let p = W[role].pose
    if (!p) return
    if (sw.active && W[otherRole(role)].pose) p = blendPoses(p, W[otherRole(role)].pose, sw.k)

    // layer: whoever is (becoming) the hover butterfly flies in front of the README (z 5);
    // the percher, or the one heading back to the perch, goes behind it
    const z = (sw.active ? otherRole(role) : role) === 'hover' ? '6' : '4'
    if (layerRef?.current && layerRef.current.style.zIndex !== z) layerRef.current.style.zIndex = z

    const { w, h } = viewExtents(size)
    const px = THREE.MathUtils.clamp(p.x, p.span * 0.1, c.width - p.span * 0.1)
    const py = p.y
    g.scale.setScalar(((p.span / size.height) * h) / 5) // the model is ~5 units wide
    g.rotation.set(p.rot[0], p.rot[1], p.rot[2])
    g.position.set((px / c.width - 0.5) * w, (0.5 - py / c.height) * h, 0)
    g.visible = p.fade > 0.01
    g.updateWorldMatrix(true, true)

    // (skipped while dancing: the swing and twirls would skew the measurement)
    if (role === 'hover' && !sw.active && W.dl < 0.05) {
      // where the VISIBLE wings sit on screen: project a sample of the alpha-picked outline
      // points (the plane's corners are transparent, so its bounding box would lie)
      if (!st.outline) {
        const e = smoke?.edges ?? []
        st.outline = e.filter((_, k) => k % Math.max(1, Math.floor(e.length / 96)) === 0)
      }
      const arr = wings.geometry.attributes.position.array
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
      for (const vi of st.outline) {
        _c.set(arr[vi * 3], arr[vi * 3 + 1], arr[vi * 3 + 2]).applyMatrix4(wings.matrixWorld).project(camera)
        const sx = (_c.x * 0.5 + 0.5) * c.width
        const sy = (0.5 - _c.y * 0.5) * c.height
        minX = Math.min(minX, sx); maxX = Math.max(maxX, sx)
        minY = Math.min(minY, sy); maxY = Math.max(maxY, sy)
      }
      if (!st.outline.length) { minX = maxX = px; minY = maxY = py }
      // offset of the visible centre from the pivot, smoothed so it never jitters
      const k = 1 - Math.exp(-dt * 3)
      const H = W.hover
      H.visDx = lerp(H.visDx, THREE.MathUtils.clamp((minX + maxX) / 2 - px, -p.span, p.span), k)
      H.visDy = lerp(H.visDy, THREE.MathUtils.clamp((minY + maxY) / 2 - py, -p.span, p.span), k)
    }

    // halo sits just behind the butterfly; lab size ratio (9 units for a 5-unit wingspan)
    halo.position.set(g.position.x, g.position.y, -0.6)
    halo.scale.setScalar(g.scale.x * 9)

    // flap: full in flight, folded with a whisper of flutter on the perch; perched dancing
    // parts the folded wings a little (`open`)
    st.params.mapToMin = lerp(WING.fly[0], WING.rest[0], p.rest) - p.open * 0.6
    st.params.mapToMax = lerp(WING.fly[1], WING.rest[1], p.rest) - p.open * 0.35
    st.frame += dt * SCENE.fps * p.flap * motion
    const lock = W.dl * p.lock
    if (lock > 0.001 && !reduced) {
      // dancing in the air: one slow flap every 2 beats, phase-locked to the beat
      const tempoFps = (FLAP_CYCLE * 0.5 * dance.bpm) / 60
      st.frame += dt * (tempoFps - SCENE.fps * p.flap) * lock
      const target = W.db * 0.5 * FLAP_CYCLE + SCENE.frameStart
      let diff = (target - st.frame) % FLAP_CYCLE
      if (diff > FLAP_CYCLE / 2) diff -= FLAP_CYCLE
      if (diff < -FLAP_CYCLE / 2) diff += FLAP_CYCLE
      st.frame += diff * (1 - Math.exp(-dt * 2)) * lock
    }
    const pos = wings.geometry.attributes.position
    evaluateWings(field, st.frame, st.params, pos.array)
    pos.needsUpdate = true
    wings.geometry.computeVertexNormals()

    if (smoke) {
      smoke.update(reduced ? 0 : dt, wings, { amount: p.smoke ? LOOK.smoke : 0, life: 3.2, burst: 0, pixelRatio: gl.getPixelRatio() })
    }

    _v.copy(KEY_LIGHT).transformDirection(camera.matrixWorldInverse)
    // dancing: a soft glow lift on beat 1 of each bar (the only dance move with reduced motion)
    const kick = W.dl * 0.175 * Math.max(0, Math.cos((Math.PI * 2 * W.db) / 4)) ** 8
    const pulse = (1 + 0.12 * Math.sin(t * 1.1) + 0.05 * Math.sin(t * 2.7 + 1)) * (1 + kick)
    for (const [m, op] of [[mats.wing, 1], [mats.body, 1], [mats.haze, 0.8]]) {
      const u = m.uniforms
      u.uLightDir.value.copy(_v)
      u.uTime.value = t
      u.uPulse.value = pulse
      u.uOpacity.value = op * p.fade
    }
    halo.material.opacity = halo.material.userData.base * pulse * p.fade
    halo.visible = p.fade > 0.01
  })

  return (
    <>
      <primitive object={halo} />
      <group ref={groupRef}>
        <primitive object={root} />
      </group>
      {smoke && <primitive object={smoke.group} />}
    </>
  )
}

export default function GhostButterflies({ theme, reduced, heroRef }) {
  const wrapRef = useRef(null)
  const layer0 = useRef(null)
  const layer1 = useRef(null)
  const [visible, setVisible] = useState(true)
  useState(resetWorld) // fresh roles + motion each time the desktop mounts

  // stop rendering while the desktop is scrolled out of view
  useEffect(() => {
    const el = wrapRef.current
    if (!el || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // one canvas per butterfly, so each can be layered in front of / behind the README
  return (
    <div ref={wrapRef} className="ghost-butterflies" aria-hidden="true">
      {[layer0, layer1].map((ref, i) => (
        <div key={i} ref={ref} className="ghost-layer" style={{ zIndex: ROLES[i] === 'hover' ? 6 : 4 }}>
          <Canvas
            frameloop={visible ? 'always' : 'never'}
            dpr={[1, 1.75]}
            camera={{ fov: FOV, position: [0, 0, CAM_Z], near: 0.1, far: 50 }}
            gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
            style={{ pointerEvents: 'none' }}
          >
            <GhostButterfly index={i} theme={theme} reduced={reduced} heroRef={heroRef} layerRef={ref} />
          </Canvas>
        </div>
      ))}
    </div>
  )
}

useGLTF.preload(GLB)
