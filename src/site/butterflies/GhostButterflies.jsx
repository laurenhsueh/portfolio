import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { precompute, evaluateWings, NODE_DEFAULTS, SCENE } from '../../three/wingMath'
import { createApparitionMaterial } from '../../three/apparitionMaterial'
import { createHaloTexture } from '../../three/wingMaterial'
import { SmokeSystem, findEmitters } from '../../three/Smoke'
import { dance } from '../music/dance'
import { BUTTERFLY_LOOK as LOOK } from './lookParams'
import { layout, watchLayout } from './layout'
import { W, ROLES, otherRole, resetWorld, stepWorld, blendPoses, lerp, WING, FLAP_CYCLE } from './motion'

// The home page's two pink ghost "apparition" butterflies (same GLB, Geometry Nodes flap and
// approved material as the Garden lab), each on its own transparent canvas so it can sit in
// front of or behind the README window. How they move lives in ./motion.js; this file renders.
const GLB = '/butterflybaked.glb'
const FOV = 30
const CAM_Z = 10
const KEY_LIGHT = new THREE.Vector3(3, 5, 6).normalize()
const _v = new THREE.Vector3()
const _c = new THREE.Vector3()
const HALO_TEX = typeof document !== 'undefined' ? createHaloTexture() : null
// world-space height of the visible plane at z = 0 (its width follows the canvas aspect)
const VIEW_H = 2 * CAM_Z * Math.tan(THREE.MathUtils.degToRad(FOV / 2))

function GhostButterfly({ index, theme, reduced, layerRef }) {
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
    // light mode: a faint pink halo, small and soft, so it never washes out the README text
    hm.color.set(light ? '#f7c9de' : '#ffc4df')
    hm.userData.base = LOOK.halo * 0.3
    hm.userData.size = light ? 6 : 9 // × the model scale (the lab's ratio is 9 for a 5-unit wingspan)
    hm.needsUpdate = true
  }, [theme, mats, smoke, halo])

  const st = useMemo(
    () => ({ t: index * 7.3, frame: SCENE.frameStart + index * 41, params: { ...NODE_DEFAULTS }, outline: null, tick: 0, stale: true }),
    [index],
  )

  useFrame(({ camera }, rawDt) => {
    const g = groupRef.current
    if (!g || !wings || !field) return
    const dt = Math.min(rawDt, 1 / 20)
    const motion = reduced ? 0 : 1
    st.t += dt
    const t = st.t

    stepWorld(performance.now(), dt, { canvas: gl.domElement, width: size.width, narrow: size.width < 900, reduced })
    const c = layout.canvas

    const role = ROLES[index]
    const sw = W.swap
    let p = W[role].pose
    if (!p) return
    if (sw.active && W[otherRole(role)].pose) p = blendPoses(p, W[otherRole(role)].pose, sw.k)

    // layer: whoever is (becoming) the hover butterfly flies in front of the README (z 5);
    // the percher, or the one heading back to the perch, goes behind it. While the duet circles,
    // whichever is passing in front of the other is drawn on top.
    const z = (W.duet.front ? role === W.duet.front : (sw.active ? otherRole(role) : role) === 'hover') ? '6' : '4'
    if (layerRef?.current && layerRef.current.style.zIndex !== z) layerRef.current.style.zIndex = z

    const h = VIEW_H
    const w = h * (size.width / size.height)
    const px = THREE.MathUtils.clamp(p.x, p.span * 0.1, c.width - p.span * 0.1)
    const py = p.y
    g.scale.setScalar(((p.span / size.height) * h) / 5) // the model is ~5 units wide
    g.rotation.set(p.rot[0], p.rot[1], p.rot[2])
    g.position.set((px / c.width - 0.5) * w, (0.5 - py / c.height) * h, 0)
    g.visible = p.fade > 0.01
    g.updateWorldMatrix(true, true)

    // (skipped while dancing: the swing and twirls would skew the measurement)
    if (role === 'hover' && !sw.active && W.dl < 0.05 && g.visible) {
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

    // halo sits just behind the butterfly
    halo.position.set(g.position.x, g.position.y, -0.6)
    halo.scale.setScalar(g.scale.x * (halo.material.userData.size ?? 9))

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
    if (g.visible) {
      // deform the wings (skipped while invisible, e.g. the percher while the README is closed).
      // Normals are the costliest part (~17k vertices), so they're refreshed every other frame,
      // the two butterflies taking turns; lighting trailing one frame behind is invisible.
      const pos = wings.geometry.attributes.position
      evaluateWings(field, st.frame, st.params, pos.array)
      pos.needsUpdate = true
      if (st.stale || (st.tick + index) % 2 === 0) {
        wings.geometry.computeVertexNormals()
        st.stale = false
      }
      st.tick++
    } else st.stale = true // refresh normals on the first frame it's visible again

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

  // track where the README, name and icons are (measured on change, not every frame)
  useEffect(() => watchLayout(heroRef.current), [heroRef])

  // stop rendering while the desktop is scrolled out of view (hidden tabs pause on their own)
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
            <GhostButterfly index={i} theme={theme} reduced={reduced} layerRef={ref} />
          </Canvas>
        </div>
      ))}
    </div>
  )
}

useGLTF.preload(GLB)
