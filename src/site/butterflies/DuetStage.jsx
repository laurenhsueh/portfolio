import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { dance, beatNow } from '../music/dance'
import { Flyer, Afterimage } from './StageButterfly'
import ButterflyCanvas from './ButterflyCanvas'
import { lerp, angLerp } from './math'
import { guide, HANDBACK_RATE } from './guide'
import { pageRect } from './layout'
import { DARK_BLOOM, LIGHT_HALO } from './lookParams'

// The #/v4 stage: the big ghost butterfly hovering in its orbit, and a smaller one that comes
// and goes. Both share one canvas, so on dark they get the same bloom pipeline as #/v3
// (./afterimage.js, with only a faint trail), screen-blended onto the page.
//
//   README open, no music   small one is away (off the top right)
//   README closed           it hovers where the README window was
//   Dance                   it flies to the big one and they circle each other on the beat,
//                           along a small copy of the orbit ring (same tilt), passing in front
//                           and behind; the pair shifts left if the circle would reach the icons
//   Stop                    it goes back to wherever the README state says
//
// Every state change only moves the small one's target, and a spring follows it, so toggling
// mid-flight just retargets. Either butterfly can be dragged: it follows the pointer, and on
// release its spring flies it home. `sceneRef.current` is measured by OrbitDesktop (hero pixels):
//   { w, h, readmeOpen, big: { x, y, span }, readmeSpot: { x, y } | null, rightLimit,
//     drag: { who: 'big' | 'small', x, y } | null }
// and the Director writes back where both are each frame (`live`), for OrbitDesktop's hit test.
//   live: { big: { x, y, span }, small: { x, y, span, fade } }

export const RING_TILT = (-14 * Math.PI) / 180 // the orbit lines' tilt (screen, y down)
const SMALL = 0.34 // small wingspan, × the big one's
const DANCE_BIG = 0.8 // the big one shrinks a touch while they dance, to make room
const PATH_RX = 0.55 // dance circle radii, × the big one's (dance) wingspan
const PATH_RY = 0.2
const LAP_BEATS = 8 // one lap around the big one every 2 bars
const BIG_SWING = 0.32 // the big one circles the pair's centre too, this × the small one's radius, opposite it
// springs (rad/s): how tightly a dragged butterfly follows the pointer, and how briskly the big
// one flies home once let go (the small one goes back at its usual, unhurried pace)
const DRAG_FOLLOW = 14
const BIG_HOME = 2.6
// a held butterfly swings like it's dangling from the pointer: lean (rad) per px/s of drag, capped
const DRAG_SWING = 0.0009
const DRAG_SWING_MAX = 0.7
/** 0 hovering → 1 flying flat out, from speed (px/s). */
const flyingAt = (speed) => Math.min(1, Math.max(0, (speed - 60) / 420))
const HIDDEN = { at: [0.5, 0.5], span: 0.3, fade: 0 } // before the first measurement
const BIG_ROT = [0.3, 0.15, -0.18]
const SMALL_ROT = [0.32, 0.25, -Math.PI / 5]
const BLOOM = DARK_BLOOM
const INTRO_S = 2.4 // the big one's load-in: wings open from shut while it fades in (seconds)

function createDuet() {
  return {
    ready: false,
    dl: 0, // 0 → 1 as the dance eases in
    theta: Math.PI * 0.75,
    big: { x: 0, y: 0, span: 1 },
    heroFade: 1, // eases back in when the scroll butterfly hands it back (a short crossfade)
    bigOff: { x: 0, y: 0, vx: 0, vy: 0 }, // the big one's offset from home (dragged / flying back)
    bigRz: BIG_ROT[2], // the big one's heading (it turns to face its way home)
    swing: { big: 0, small: 0 }, // lean while dragged
    small: { x: 0, y: 0, vx: 0, vy: 0, fade: 0, rz: SMALL_ROT[2], z: 0, depth: 0 },
  }
}

/** Runs before the butterflies each frame and decides where both of them are. */
function Director({ duet, sceneRef, reduced }) {
  useFrame((_, rawDt) => {
    const sc = sceneRef.current
    if (!sc?.big) return
    const dt = Math.min(rawDt, 1 / 20)
    const S = duet.small
    duet.dl = reduced ? (dance.playing ? 1 : 0) : lerp(duet.dl, dance.playing ? 1 : 0, 1 - Math.exp(-dt * 1.6))
    const dl = duet.dl

    // the big one: shrinks a little and, if needed, glides left so the dance clears the icons
    const bigSpan = sc.big.span * lerp(1, DANCE_BIG, dl)
    const smallSpan = sc.big.span * SMALL
    const rx = bigSpan * PATH_RX
    const ry = bigSpan * PATH_RY
    const reach = Math.abs(rx * Math.cos(RING_TILT)) + smallSpan * 0.55
    const danceX = Math.min(sc.big.x, sc.rightLimit - reach)
    const cx = lerp(sc.big.x, danceX, dl) // the pair's centre
    const cy = sc.big.y
    duet.big.span = bigSpan
    // the scroll butterfly takes it over instantly (same spot, same wingbeat); handing it back,
    // the two crossfade, so there's never a frame without a butterfly
    duet.heroFade =
      guide.heroHidden || reduced
        ? guide.heroHidden
          ? 0
          : 1
        : lerp(duet.heroFade, 1, 1 - Math.exp(-dt * HANDBACK_RATE))

    // the small one's target
    const away = { x: sc.w + smallSpan * 0.8, y: -smallSpan * 0.5 }
    let tx, ty
    let goingAway = false
    const drag = sc.drag
    if (drag?.who === 'small') {
      tx = drag.x
      ty = drag.y
    } else if (dance.playing) {
      // locked to the song: a lap every LAP_BEATS, so pauses and loops stay on the beat
      duet.theta = reduced ? duet.theta : (beatNow() / LAP_BEATS) * Math.PI * 2 + Math.PI * 0.75
      const ex = Math.cos(duet.theta) * rx
      const ey = Math.sin(duet.theta) * ry
      const ox = ex * Math.cos(RING_TILT) - ey * Math.sin(RING_TILT)
      const oy = ex * Math.sin(RING_TILT) + ey * Math.cos(RING_TILT)
      tx = cx + ox
      ty = cy + oy - bigSpan * 0.04
    } else if (!sc.readmeOpen && sc.readmeSpot) {
      tx = sc.readmeSpot.x
      ty = sc.readmeSpot.y
    } else {
      tx = away.x
      ty = away.y
      goingAway = true
    }

    // the big one swings around the same centre on the opposite side, so they circle each other
    const swing = BIG_SWING * dl
    const bx = Math.cos(duet.theta) * rx * swing
    const by = Math.sin(duet.theta) * ry * swing
    const homeX = cx - (bx * Math.cos(RING_TILT) - by * Math.sin(RING_TILT))
    const homeY = cy - (bx * Math.sin(RING_TILT) + by * Math.cos(RING_TILT))

    // dragging the big one: its offset from home chases the pointer; let go, it springs back to 0
    const O = duet.bigOff
    const held = drag?.who === 'big'
    const ox = held ? drag.x - homeX : 0
    const oy = held ? drag.y - homeY : 0
    if (reduced) {
      O.x = ox
      O.y = oy
      O.vx = 0
      O.vy = 0
    } else {
      const w = held ? DRAG_FOLLOW : BIG_HOME
      const lift = held ? 0 : Math.min(Math.hypot(O.x, O.y), 800) * 0.15 // arc home, like the small one
      O.vx += (w * w * (ox - O.x) - 2 * w * O.vx) * dt
      O.vy += (w * w * (oy - lift - O.y) - 2 * w * O.vy) * dt
      O.x += O.vx * dt
      O.y += O.vy * dt
    }
    duet.big.x = homeX + O.x
    duet.big.y = homeY + O.y
    // flying home it faces where it's going, then settles back into its resting pose
    const bigSpeed = Math.hypot(O.vx, O.vy)
    const bk = held ? 0 : flyingAt(bigSpeed)
    duet.bigRz = angLerp(duet.bigRz, angLerp(BIG_ROT[2], Math.atan2(-O.vx, -O.vy), bk), 1 - Math.exp(-dt * 4))
    duet.big.flying = held ? 0 : bk
    const swingTo = (v) => Math.max(-DRAG_SWING_MAX, Math.min(DRAG_SWING_MAX, -v * DRAG_SWING))
    duet.swing.big = lerp(duet.swing.big, held ? swingTo(O.vx) : 0, 1 - Math.exp(-dt * 6))

    if (!duet.ready) {
      // start already away (or in place), never flying in on first paint
      S.x = tx
      S.y = ty
      S.fade = goingAway ? 0 : 1
      duet.ready = true
    }

    if (reduced) {
      S.x = tx
      S.y = ty
      S.vx = 0
      S.vy = 0
    } else {
      // a critically damped spring: smooth, no overshoot, and it can be retargeted any time.
      // Unhurried when flying in or out; stiffer while dancing, to keep up with the partner.
      const held = drag?.who === 'small'
      const w = held ? DRAG_FOLLOW : lerp(1.6, 5, dl)
      // aim a little above the target while it's still far, so long trips arc instead of
      // sliding straight; the bulge shrinks to nothing as it arrives
      const dist = Math.hypot(tx - S.x, ty - S.y)
      const aimY = ty - (held ? 0 : Math.min(dist, 800) * 0.18 * (1 - dl))
      const ax = w * w * (tx - S.x) - 2 * w * S.vx
      const ay = w * w * (aimY - S.y) - 2 * w * S.vy
      S.vx += ax * dt
      S.vy += ay * dt
      S.x += S.vx * dt
      S.y += S.vy * dt
    }

    // fade out only once it's nearly off screen, and back in as it sets off
    const nearAway = Math.hypot(S.x - away.x, S.y - away.y) < smallSpan * 1.2
    const fadeT = goingAway && nearAway ? 0 : 1
    S.fade = reduced ? fadeT : lerp(S.fade, fadeT, 1 - Math.exp(-dt * (fadeT ? 3 : 4)))

    // facing: along its flight when moving fast, its resting pose when hovering
    const speed = Math.hypot(S.vx, S.vy)
    const travel = Math.atan2(-S.vx, -S.vy)
    const k = drag?.who === 'small' ? 0 : flyingAt(speed)
    S.rz = angLerp(S.rz, angLerp(SMALL_ROT[2], travel, k), 1 - Math.exp(-dt * 4))
    S.flying = k
    duet.swing.small = lerp(duet.swing.small, drag?.who === 'small' ? swingTo(S.vx) : 0, 1 - Math.exp(-dt * 6))

    // depth while dancing: the front half of the circle (lower) is nearer, so it's a bit bigger
    // and brighter; behind, it's smaller and dimmer, so passing reads as around, not through
    S.depth = Math.sin(duet.theta) * dl

    // where the big one is on the page, for the scroll butterfly to take over from (GuideButterfly)
    const hr = guide.heroEl && pageRect(guide.heroEl) // cached page box (see ./layout.js)
    if (hr) guide.hero = { x: hr.left + duet.big.x, y: hr.top + duet.big.y, span: bigSpan }

    sc.live = {
      big: { x: duet.big.x, y: duet.big.y, span: bigSpan },
      small: { x: S.x, y: S.y, span: smallSpan, fade: S.fade },
    }
  }, -1)
  return null
}

function Stage({ sceneRef, reduced, theme }) {
  const { size } = useThree()
  const duet = useMemo(createDuet, [])
  const bloom = theme !== 'light'

  // Flyer wants fractions of the canvas and a span as a fraction of min(w, 1.3 h)
  const unit = () => Math.min(size.width, size.height * 1.3)
  const driveBig = () => {
    const B = duet.big
    if (!duet.ready) return HIDDEN
    // the big one leans toward its partner a little as they circle
    const lean = Math.cos(duet.theta) * 0.12 * duet.dl
    const held = sceneRef.current?.drag?.who === 'big'
    return {
      at: [B.x / size.width, B.y / size.height],
      span: B.span / unit(),
      // hidden while the scroll butterfly has it (it flew down to Work as the same butterfly)
      rot: [BIG_ROT[0], BIG_ROT[1] + lean, duet.bigRz],
      fade: duet.heroFade,
      held,
      flying: B.flying ?? 0,
      swing: duet.swing.big,
    }
  }
  const driveSmall = () => {
    const S = duet.small
    if (!duet.ready) return HIDDEN
    const sc = sceneRef.current
    const span = sc.big.span * SMALL * (1 + 0.14 * S.depth)
    return {
      at: [S.x / size.width, S.y / size.height],
      span: span / unit(),
      rot: [SMALL_ROT[0], SMALL_ROT[1], S.rz],
      fade: S.fade * (0.8 + 0.2 * S.depth),
      z: S.depth * 0.8,
      held: sc.drag?.who === 'small',
      flying: S.flying ?? 0,
      swing: duet.swing.small,
    }
  }

  return (
    <>
      <Director duet={duet} sceneRef={sceneRef} reduced={reduced} />
      <Flyer
        drive={driveBig}
        intro={INTRO_S}
        sharePhase
        bob={1.3}
        bobRate={1.25}
        reduced={reduced}
        theme={theme}
        flapRate={BLOOM.flapRate}
        smokeAmount={bloom ? BLOOM.smoke : undefined}
        haloGain={bloom ? 0.45 : LIGHT_HALO.gain}
        haloSize={bloom ? null : LIGHT_HALO.size}
      />
      <Flyer
        drive={driveSmall}
        bob={1.6}
        bobRate={1.5}
        reduced={reduced}
        theme={theme}
        flapRate={0.7}
        smokeAmount={bloom ? BLOOM.smoke * 0.6 : undefined}
        haloGain={bloom ? 0.45 : LIGHT_HALO.gain}
        haloSize={bloom ? null : LIGHT_HALO.size}
      />
      <Afterimage cfg={BLOOM} reduced={reduced} enabled={bloom} />
    </>
  )
}

/** The canvas covers the hero. On dark it's opaque black and screen-blended (see .is-afterimage). */
export default function DuetStage({ sceneRef, reduced, theme }) {
  const wrapRef = useRef(null)
  const [visible, setVisible] = useState(true)
  const bloom = theme !== 'light'

  useEffect(() => {
    guide.heroEl = wrapRef.current
    return () => {
      guide.heroEl = null
      guide.hero = null
      guide.heroHidden = false
    }
  }, [])

  useEffect(() => {
    const el = wrapRef.current
    if (!el || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={wrapRef}
      className={`stage-butterfly duet-stage ${bloom ? 'is-afterimage' : 'is-light'}`}
      aria-hidden="true"
    >
      <ButterflyCanvas frameloop={visible ? 'always' : 'never'}>
        <Stage sceneRef={sceneRef} reduced={reduced} theme={theme} />
      </ButterflyCanvas>
    </div>
  )
}
