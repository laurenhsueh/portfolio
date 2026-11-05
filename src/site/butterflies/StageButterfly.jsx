import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { precompute, evaluateWings, NODE_DEFAULTS, SCENE } from '../../three/wingMath'
import { createApparitionMaterial } from '../../three/apparitionMaterial'
import { createHaloTexture } from '../../three/wingMaterial'
import { SmokeSystem, findEmitters } from '../../three/Smoke'
import { dance, beatNow } from '../music/dance'
import { BUTTERFLY_LOOK as LOOK } from './lookParams'
import { createAfterimage } from './afterimage'

// The ghost "apparition" butterfly (same GLB, material, halo and smoke as the Garden lab), for
// the home page's DuetStage.jsx. `Flyer` is one butterfly that a choreographer moves every
// frame: a slow hover, flapping on the beat (and lifting on each downbeat) while the Dance song
// plays. `Afterimage` is the faint trail + bloom pipeline (./afterimage.js).
const GLB = '/butterflybaked.glb'
const WING_FLY = [NODE_DEFAULTS.mapToMin, NODE_DEFAULTS.mapToMax] // the Map Range of a full flap
// held: the wings fold up over the back (≈ π/2 is straight up, touching) and only flutter a
// little, and the body turns side-on so the folded wings face the viewer
const WING_HELD = [1.34, 1.56]
const HOLD_ROT = [0.12, 1.3, 0.2] // x pitch, y turn (side-on), z tilt; head = +Y
const HOLD_FLUTTER = 1.8 // × the flap rate: a held butterfly beats its folded wings fast
// flying (released, heading home): it flaps harder, pitches forward, and its path bobs on each
// wingbeat and weaves a little, the way butterflies fly, rather than gliding on rails
const FLIGHT_FLAP = 1.3 // extra flap rate at full speed
const FLIGHT_BOB = 0.05 // bob per wingbeat, × the span
const FLIGHT_WEAVE = 0.03 // slow side-to-side weave, × the span
const FLIGHT_PITCH = 0.3
const FLAP_CYCLE = 2 * Math.PI * NODE_DEFAULTS.frameDivisor // frames per wingbeat
const lerp = (a, b, t) => a + (b - a) * t
const FOV = 30
const CAM_Z = 10
export const CAMERA = { fov: FOV, position: [0, 0, CAM_Z], near: 0.1, far: 50 } // for the canvas hosting Flyers
const VIEW_H = 2 * CAM_Z * Math.tan(THREE.MathUtils.degToRad(FOV / 2))
const KEY_LIGHT = new THREE.Vector3(3, 5, 6).normalize()
const HALO_TEX = typeof document !== 'undefined' ? createHaloTexture() : null
const _v = new THREE.Vector3()

/** Downbeat lift (fraction of span), same shape as the home page's dance. */
function downbeatLift(db) {
  const inBar = ((db % 4) + 4) % 4
  const which = Math.floor(inBar)
  if (which !== 0 && which !== 2) return 0
  const u = inBar - which
  const pulse = u < 0.35 ? 1 - (1 - u / 0.35) ** 3 : 1 - ((u - 0.35) / 0.65) ** 2
  return (which === 0 ? 0.03 : 0.015) * pulse
}

/**
 * One butterfly, placed every frame by `drive(t, dt)` → { at ([x, y] canvas fractions), span
 * (wingspan × min(w, 1.3 h)), rot (resting rotation; head = +Y), fade, z, held (being dragged, or
 * landed), flying (0..1, how fast it's travelling), swing (lean from the drag, rad), and optional
 * holdRot (the held pose, default HOLD_ROT), holdRate ([in, out] easing rates, default [9, 4]), roll (screen-plane tilt while held, rad), haloGain /
 * haloSize (override the props for this frame) }. `bob` / `bobRate`:
 * how much and how fast it hovers. `theme` 'light' switches to the iridescent pink-glass look (no bloom there).
 */
export function Flyer({ drive, reduced, bob = 1, bobRate = 0.8, flapRate = 0.55, smokeAmount, haloGain = 1, theme = 'dark', haloSize = null }) {
  const gltf = useGLTF(GLB)
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
    for (const [m, op] of [[mats.wing, 1], [mats.body, 1], [mats.haze, 0.8]]) {
      m.uniforms.uIri.value = 1
      m.uniforms.uGlow.value = LOOK.glow * 1.15
      m.userData.op = op
    }
    const smoke = wings && map?.image ? new SmokeSystem(findEmitters(wings.geometry, map.image)) : null
    return { root, wings, mats, smoke }
  }, [gltf])

  const halo = useMemo(() => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: HALO_TEX, transparent: true, depthWrite: false, color: '#ffc4df' }))
    sp.renderOrder = -2
    const hm = sp.material
    // pure additive light that leaves the canvas alpha alone
    hm.blending = THREE.CustomBlending
    hm.blendEquation = THREE.AddEquation
    hm.blendSrc = THREE.SrcAlphaFactor
    hm.blendDst = THREE.OneFactor
    hm.blendSrcAlpha = THREE.ZeroFactor
    hm.blendDstAlpha = THREE.OneFactor
    return sp
  }, [])

  // theme: additive ghost on dark, pink glass with normal blending on light
  useEffect(() => {
    const light = theme === 'light'
    for (const m of [mats.wing, mats.body, mats.haze]) {
      m.uniforms.uLight.value = light ? 1 : 0
      m.blending = light ? THREE.NormalBlending : THREE.AdditiveBlending
      m.needsUpdate = true
    }
    smoke?.setLook('apparition', light ? 'light' : 'dark')
    const hm = halo.material
    if (light) hm.blending = THREE.NormalBlending
    else {
      hm.blending = THREE.CustomBlending
      hm.blendEquation = THREE.AddEquation
      hm.blendSrc = THREE.SrcAlphaFactor
      hm.blendDst = THREE.OneFactor
      hm.blendSrcAlpha = THREE.ZeroFactor
      hm.blendDstAlpha = THREE.OneFactor
    }
    hm.color.set(light ? '#f4a3ca' : '#ffc4df') // light: a deeper pink, so the glow reads on the pale page
    hm.userData.size = haloSize ?? (light ? 6 : 9)
    hm.needsUpdate = true
  }, [theme, mats, smoke, halo, haloSize])

  useEffect(() => () => {
    Object.values(mats).forEach((m) => m.dispose())
    wings?.geometry.dispose()
    smoke?.dispose()
    halo.material.dispose()
  }, [mats, wings, smoke, halo])

  const field = useMemo(() => wings && precompute(Float32Array.from(wings.geometry.attributes.position.array), NODE_DEFAULTS), [wings])
  const st = useMemo(() => ({ t: 0, frame: SCENE.frameStart, params: { ...NODE_DEFAULTS }, dl: 0, tick: 0, hold: 0, fly: 0 }), [])
  const mainRef = useRef() // position + a roll in the screen plane (drv.roll)
  const poseRef = useRef() // the body's pose + scale

  useFrame(({ camera }, rawDt) => {
    const g = mainRef.current
    if (!g || !wings || !field) return
    const dt = Math.min(rawDt, 1 / 20)
    const motion = reduced ? 0 : 1
    st.t += dt
    const t = st.t
    st.dl = lerp(st.dl, dance.playing ? 1 : 0, 1 - Math.exp(-dt * 3))
    const db = dance.playing ? beatNow() : 0

    const drv = drive(t, dt)
    const rest = drv.rot
    const fade = drv.fade ?? 1
    const home = drv.at
    // ease into / out of the held pose (folding is quick, opening up to fly a touch slower)
    // `held` may be a number (0..1) to fold part-way; `holdRate` [in, out] sets how fast it eases
    const heldT = typeof drv.held === 'number' ? drv.held : drv.held ? 1 : 0
    const [rateIn, rateOut] = drv.holdRate ?? [9, 4]
    st.hold = reduced ? heldT : lerp(st.hold, heldT, 1 - Math.exp(-dt * (heldT > st.hold ? rateIn : rateOut)))
    st.fly = reduced ? 0 : lerp(st.fly, drv.flying ?? 0, 1 - Math.exp(-dt * 5))
    const hold = st.hold
    const fly = st.fly * (1 - hold)

    const h = VIEW_H
    const w = h * (size.width / size.height)
    const spanPx = drv.span * Math.min(size.width, size.height * 1.3)
    const toWorld = (fx, fy) => [(fx - 0.5) * w, (0.5 - fy) * h]
    const scale = ((spanPx / size.height) * h) / 5 // the model is ~5 units wide

    const pose = (lag) => {
      const tt = t - lag
      const sway = Math.sin(db * Math.PI * 0.5) * 0.12 * st.dl
      const bobX = Math.sin(tt * bobRate * 0.62) * 0.015 * bob * motion
      const bobY = (Math.sin(tt * bobRate) * 0.02 * bob - downbeatLift(db) * st.dl * 2.2) * motion
      return {
        dx: bobX * spanPx / size.width,
        dy: bobY * spanPx / size.height,
        rx: rest[0] + Math.sin(tt * 0.31) * 0.03 * motion,
        ry: rest[1] + Math.sin(tt * 0.23 + 1.7) * 0.07 * motion,
        rz: rest[2] + Math.sin(tt * 0.27 + 0.9) * 0.05 * motion + sway * motion,
      }
    }

    const p = pose(0)
    // in flight: a lift on every downstroke (the flap's own phase) and a slow weave
    const beat = st.frame / NODE_DEFAULTS.frameDivisor
    const fdx = Math.sin(t * 2.3) * FLIGHT_WEAVE * fly * motion
    const fdy = -Math.cos(beat) * FLIGHT_BOB * fly * motion
    const [x, y] = toWorld(home[0] + p.dx * (1 - hold) + (fdx * spanPx) / size.width, home[1] + p.dy * (1 - hold) + (fdy * spanPx) / size.height)
    // held pose: `drv.holdRot` overrides the default (e.g. mirrored), and `drv.roll` tilts the
    // whole held butterfly in the screen plane (landing: the body leans toward the surface)
    const hr = drv.holdRot ?? HOLD_ROT
    g.position.set(x, y, drv.z ?? 0)
    g.rotation.set(0, 0, (drv.roll ?? 0) * hold)
    poseRef.current.rotation.set(
      lerp(p.rx + FLIGHT_PITCH * fly, hr[0], hold),
      lerp(p.ry, hr[1], hold),
      lerp(p.rz, hr[2] + (drv.swing ?? 0), hold),
    )
    poseRef.current.scale.setScalar(scale)
    g.visible = fade > 0.01
    g.updateWorldMatrix(true, true)

    halo.position.set(x, y, (drv.z ?? 0) - 0.6)
    halo.scale.setScalar(scale * (drv.haloSize ?? halo.material.userData.size ?? 9))

    // flap; dancing locks one slow flap to every 2 beats (as on the home page)
    st.params.mapToMin = lerp(WING_FLY[0], WING_HELD[0], hold)
    st.params.mapToMax = lerp(WING_FLY[1], WING_HELD[1], hold)
    st.frame += dt * SCENE.fps * flapRate * motion * (1 + HOLD_FLUTTER * hold + FLIGHT_FLAP * fly)
    if (st.dl > 0.001 && !reduced) {
      const tempoFps = (FLAP_CYCLE * 0.5 * dance.bpm) / 60
      st.frame += dt * (tempoFps - SCENE.fps * flapRate) * st.dl
      if (dance.playing) {
        const target = db * 0.5 * FLAP_CYCLE + SCENE.frameStart
        let diff = (target - st.frame) % FLAP_CYCLE
        if (diff > FLAP_CYCLE / 2) diff -= FLAP_CYCLE
        if (diff < -FLAP_CYCLE / 2) diff += FLAP_CYCLE
        st.frame += diff * (1 - Math.exp(-dt * 2)) * st.dl
      }
    }
    if (g.visible) {
      const pos = wings.geometry.attributes.position
      evaluateWings(field, st.frame, st.params, pos.array)
      pos.needsUpdate = true
      if (st.tick++ % 2 === 0) wings.geometry.computeVertexNormals()
    }
    smoke?.update(reduced ? 0 : dt, wings, { amount: (smokeAmount ?? LOOK.smoke) * fade, life: 3.2, burst: 0, pixelRatio: gl.getPixelRatio() })

    _v.copy(KEY_LIGHT).transformDirection(camera.matrixWorldInverse)
    const kick = st.dl * 0.175 * Math.max(0, Math.cos((Math.PI * 2 * db) / 4)) ** 8
    const pulse = (1 + 0.12 * Math.sin(t * 1.1) + 0.05 * Math.sin(t * 2.7 + 1)) * (1 + kick)
    for (const m of [mats.wing, mats.body, mats.haze]) {
      const u = m.uniforms
      u.uLightDir.value.copy(_v)
      u.uTime.value = t
      u.uPulse.value = pulse
      u.uOpacity.value = m.userData.op * fade
    }
    halo.material.opacity = LOOK.halo * 0.3 * pulse * (drv.haloGain ?? haloGain) * fade
    halo.visible = fade > 0.01
  })

  return (
    <>
      <primitive object={halo} />
      <group ref={mainRef}><group ref={poseRef}><primitive object={root} /></group></group>
      {smoke && <primitive object={smoke.group} />}
    </>
  )
}

/**
 * Takes over rendering (priority 1) with the trail + bloom pipeline: every frame is stamped
 * into a short-lived trail (`cfg.life`, `cfg.blur`), then bloomed (`cfg.bloom`). `adjust(bloomPass)`,
 * if given, runs every frame before rendering, to retune the bloom live.
 */
export function Afterimage({ cfg, reduced, adjust }) {
  const { gl, scene, camera, size, viewport } = useThree()
  const fx = useMemo(() => createAfterimage(gl, scene, camera, { bloom: cfg.bloom }), [gl, scene, camera, cfg.bloom])
  useEffect(() => { fx.setSize(size.width, size.height, viewport.dpr) }, [fx, size, viewport.dpr])
  useEffect(() => () => fx.dispose(), [fx])
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    fx.trail.step(dt, { on: !reduced, life: cfg.life ?? 1.6, blur: cfg.blur }, reduced ? 0 : 0.8)
    adjust?.(fx.bloomPass) // e.g. a softer, wider bloom for a smaller butterfly
    fx.render(dt)
  }, 1)
  return null
}

useGLTF.preload(GLB)
