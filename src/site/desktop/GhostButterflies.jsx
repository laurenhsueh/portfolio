import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { precompute, evaluateWings, NODE_DEFAULTS, SCENE } from '../../wingMath'
import { createApparitionMaterial } from '../../apparitionMaterial'
import { createHaloTexture } from '../../wingMaterial'
import { SmokeSystem, findEmitters } from '../../Smoke'
import { getPerch } from '../perch'
import { BUTTERFLY_LOOK } from './lookParams'

// Butterfly mode: two of Lauren's pink ghost "apparition" butterflies (same GLB, Geometry
// Nodes flap and approved material as the lab) on a transparent canvas over the desktop.
//   • "perch" butterflies use the reusable land → fly-off behaviour (see ../perch.js)
//   • "hover" butterflies float almost in place, gliding a little along their heading
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

const TIMING = { flyIn: 2.6, flyOut: 2.0, followDelay: 0.9, follow: 3.2 }
// wings: full flap in flight; perched, they fold up together (seen side-on) with only a
// whisper of flutter, via the Geometry Nodes Map Range output (radians)
const WING = { fly: [NODE_DEFAULTS.mapToMin, NODE_DEFAULTS.mapToMax], rest: [1.04, 1.4] }
const FLAP = { fly: 1.1, rest: 0.45 }

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

function GhostButterfly({ index, theme, reduced, heroRef }) {
  const cfg = BUTTERFLIES[index]
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
    () => ({
      t: index * 7.3,
      frame: SCENE.frameStart + index * 41,
      params: { ...NODE_DEFAULTS },
      // perch state machine: away → in → landed → out → away
      mode: 'away', k: 0, from: [0, 0], ctrl: [0, 0],
      pos: null, prevPos: null, heading: HALF_PI, rest: 0, fade: index === 0 ? 1 : 0,
      // hover-follow state: m = 0 at home, 1 at the alternate spot
      m: 0, wantAway: false, since: 0,
    }),
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
    const narrow = size.width < 900
    const { w, h } = viewExtents(size)
    const spanPx = cfg.span(size.width, narrow)
    const scale = ((spanPx / size.height) * h) / 5 // the model is ~5 units wide
    g.scale.setScalar(scale)
    const rel = (el) => {
      const b = el.getBoundingClientRect()
      return { left: b.left - c.left, right: b.right - c.left, top: b.top - c.top, bottom: b.bottom - c.top, width: b.width, height: b.height }
    }

    let px, py
    let fade = 1

    if (cfg.kind === 'hover') {
      const win = heroRef?.current?.querySelector('.readme-window')
      const r = win ? rel(win) : { left: c.width * 0.4, right: c.width * 0.75, top: c.height * 0.25, bottom: c.height * 0.5, width: c.width * 0.35 }
      // home ↔ alternate spot, tied to whether the followed perch is present
      const away = cfg.follow ? !getPerch(cfg.follow)?.present : false
      if (away !== st.wantAway) { st.wantAway = away; st.since = 0 }
      st.since += dt
      // leave only after the perched butterfly has taken off; come back right away
      const target = st.wantAway && st.since > TIMING.followDelay ? 1 : st.wantAway ? st.m : 0
      if (reduced) {
        // no travel: fade out, switch spots, fade back in
        if (Math.abs(target - st.m) > 0.001) {
          st.fade = Math.max(0, st.fade - dt * 3)
          if (st.fade === 0) st.m = target
        } else st.fade = Math.min(1, st.fade + dt * 3)
      } else {
        st.m += (target - st.m) * (1 - Math.exp(-dt * (4 / TIMING.follow)))
        st.fade = 1
      }
      const m = ease(THREE.MathUtils.clamp(st.m, 0, 1))
      // live layout landmarks: right edge of the name, left edge of the icon column
      const hero = heroRef?.current
      const nameEl = hero?.querySelector('.desktop-name')
      const iconEls = hero ? [...hero.querySelectorAll('.hero-icons > li')] : []
      const L = nameEl && iconEls.length
        ? { nameRight: rel(nameEl).right, iconsLeft: Math.min(...iconEls.map((e) => rel(e).left)) }
        : null
      const home = cfg.at(r, c, spanPx, narrow)
      const alt = cfg.alt ? cfg.alt(r, c, spanPx, narrow, L) : home
      px = lerp(home[0], alt[0], m)
      py = lerp(home[1], alt[1], m)
      g.scale.setScalar(scale * lerp(1, cfg.altScale ?? 1, m))
      fade = st.fade
      // glide swings evenly around the spot (so the spot stays the visual centre)
      const glide = -0.5 * Math.cos(t * 0.22 * motion + index) * spanPx * 0.14
      px += cfg.dir[0] * glide + Math.sin(t * 0.37 * motion + index) * spanPx * 0.02
      py += cfg.dir[1] * glide + Math.sin(t * 0.53 * motion + index * 2) * spanPx * 0.02
      // correct for the model's visual centre sitting off its pivot in this pose
      // (measured from last frame), fully at the alternate spot where centring matters
      px -= (st.visDx ?? 0) * m
      py -= (st.visDy ?? 0) * m
      px = THREE.MathUtils.clamp(px, spanPx * 0.4, c.width - spanPx * 0.4)
      // lowest wingtip ≈ centre + 0.42 × the (scaled) span in this pose
      const reach = spanPx * lerp(1, cfg.altScale ?? 1, m) * 0.42
      py = THREE.MathUtils.clamp(py, spanPx * 0.3, c.height - (cfg.bottomClear ?? 0) - reach)
      g.rotation.set(
        cfg.rot[0] + Math.sin(t * 0.31 * motion) * 0.03,
        cfg.rot[1] + Math.sin(t * 0.23 * motion + 1.7) * 0.07,
        cfg.rot[2] + Math.sin(t * 0.27 * motion + 0.9) * 0.05,
      )
    } else {
      // ── perch: land on the element while it's present, fly off when it goes ──
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
        st.mode = present ? 'landed' : 'away'
        st.fade += ((present ? 1 : 0) - st.fade) * (1 - Math.exp(-dt * 5))
        st.pos = spot
      } else {
        if (present && (st.mode === 'away' || st.mode === 'out')) {
          st.from = st.mode === 'out' && st.pos ? st.pos : offIn
          st.ctrl = [lerp(st.from[0], spot[0], 0.25), Math.min(st.from[1], spot[1]) - spanPx * 0.6]
          st.mode = 'in'
          st.k = 0
        } else if (!present && (st.mode === 'landed' || st.mode === 'in')) {
          st.from = st.pos ?? spot
          st.ctrl = [lerp(st.from[0], offOut[0], 0.35), st.from[1] - spanPx * 0.9]
          st.mode = 'out'
          st.k = 0
        }
        if (st.mode === 'in') {
          st.k = Math.min(1, st.k + dt / TIMING.flyIn)
          st.pos = bez(st.from, st.ctrl, spot, ease(st.k))
          if (st.k >= 1) st.mode = 'landed'
        } else if (st.mode === 'out') {
          st.k = Math.min(1, st.k + dt / TIMING.flyOut)
          st.pos = bez(st.from, st.ctrl, offOut, easeIn(st.k))
          if (st.k >= 1) st.mode = 'away'
        } else if (st.mode === 'landed') {
          st.pos = spot // stay put on the (possibly moving) element
        }
        st.fade = st.mode === 'away' ? 0 : 1
      }

      const prev = st.prevPos ?? st.pos ?? spot
      ;[px, py] = st.pos ?? offIn
      const flying = st.mode === 'in' || st.mode === 'out'
      // heading follows the flight path; once down it settles facing the perch direction
      const vx = px - prev[0]
      const vy = -(py - prev[1])
      const want = flying && Math.hypot(vx, vy) > 0.3 ? Math.atan2(vy, vx) - HALF_PI : faceLeft ? HALF_PI : -HALF_PI
      st.heading = angLerp(st.heading, want, 1 - Math.exp(-dt * (flying ? 6 : 3)))
      st.prevPos = [px, py]
      st.rest += ((flying ? 0 : 1) - st.rest) * (1 - Math.exp(-dt * 2.5))
      // flying: back to the viewer, head along the path. Perched: rolled side-on (back up),
      // body along the bar, so the folded wings stand above it. A whisper of sway.
      g.rotation.set(
        lerp(0.25, -HALF_PI + 0.18, st.rest),
        lerp(0.15, 0.3, st.rest) * (faceLeft ? 1 : -1) + Math.sin(t * 0.4) * 0.03 * st.rest,
        st.heading,
      )
      fade = st.fade
      g.visible = fade > 0.01
    }

    g.position.set((px / c.width - 0.5) * w, (0.5 - py / c.height) * h, 0)
    g.updateWorldMatrix(true, true)
    if (cfg.kind === 'hover') {
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
      st.visDx = lerp(st.visDx ?? 0, THREE.MathUtils.clamp((minX + maxX) / 2 - px, -spanPx, spanPx), k)
      st.visDy = lerp(st.visDy ?? 0, THREE.MathUtils.clamp((minY + maxY) / 2 - py, -spanPx, spanPx), k)
    }

    // halo sits just behind the butterfly; lab size ratio (9 units for a 5-unit wingspan)
    halo.position.set(g.position.x, g.position.y, -0.6)
    halo.scale.setScalar(g.scale.x * 9)

    // flap: full in flight, barely fluttering while resting on a perch
    const rest = cfg.kind === 'perch' ? st.rest : 0
    st.params.mapToMin = lerp(WING.fly[0], WING.rest[0], rest)
    st.params.mapToMax = lerp(WING.fly[1], WING.rest[1], rest)
    const rate = cfg.kind === 'perch' ? lerp(FLAP.fly, FLAP.rest, rest) : cfg.flap
    st.frame += dt * SCENE.fps * rate * motion
    const pos = wings.geometry.attributes.position
    evaluateWings(field, st.frame, st.params, pos.array)
    pos.needsUpdate = true
    wings.geometry.computeVertexNormals()

    if (smoke) {
      const amount = cfg.kind === 'perch' && st.mode === 'away' ? 0 : LOOK.smoke
      smoke.update(reduced ? 0 : dt, wings, { amount, life: 3.2, burst: 0, pixelRatio: gl.getPixelRatio() })
    }

    _v.copy(KEY_LIGHT).transformDirection(camera.matrixWorldInverse)
    const pulse = 1 + 0.12 * Math.sin(t * 1.1) + 0.05 * Math.sin(t * 2.7 + 1)
    for (const [m, op] of [[mats.wing, 1], [mats.body, 1], [mats.haze, 0.8]]) {
      const u = m.uniforms
      u.uLightDir.value.copy(_v)
      u.uTime.value = t
      u.uPulse.value = pulse
      u.uOpacity.value = op * fade
    }
    halo.material.opacity = halo.material.userData.base * pulse * fade
    halo.visible = fade > 0.01
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
  const [visible, setVisible] = useState(true)

  // stop rendering while the desktop is scrolled out of view
  useEffect(() => {
    const el = wrapRef.current
    if (!el || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={wrapRef} className="ghost-butterflies" aria-hidden="true">
      <Canvas
        frameloop={visible ? 'always' : 'never'}
        dpr={[1, 1.75]}
        camera={{ fov: FOV, position: [0, 0, CAM_Z], near: 0.1, far: 50 }}
        gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
        style={{ pointerEvents: 'none' }}
      >
        {BUTTERFLIES.map((_, i) => (
          <GhostButterfly key={i} index={i} theme={theme} reduced={reduced} heroRef={heroRef} />
        ))}
      </Canvas>
    </div>
  )
}

useGLTF.preload(GLB)
