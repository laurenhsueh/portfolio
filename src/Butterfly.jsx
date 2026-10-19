import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { precompute, updateDistance, evaluateWings, SCENE } from './wingMath'
import { createButterflyMaterial, createHaloTexture } from './wingMaterial'
import { createApparitionMaterial } from './apparitionMaterial'
import { SmokeSystem, findEmitters } from './Smoke'

const GLB = '/butterflybaked.glb'

const _light = new THREE.Vector3()
const _center = new THREE.Vector3()
const _toCam = new THREE.Vector3()

const smooth = (a, b, x) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

/** 0 = whole, 1 = fully dissolved. Holds whole most of the cycle, then fades out and reforms. */
function dissolveCurve(t, period) {
  const p = (t % period) / period
  return smooth(0.55, 0.72, p) * (1 - smooth(0.78, 0.97, p))
}

export default function Butterfly({ params, playback, look, keyLight, hudRef }) {
  const gltf = useGLTF(GLB)
  const { camera, gl } = useThree()
  const frameRef = useRef(SCENE.frameStart)
  const flightRef = useRef()
  const timeRef = useRef(0)

  // Clone so we never mutate the cached glTF; give the wings their own geometry + materials.
  const { root, wings, body, haze, mats } = useMemo(() => {
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
      powder: {
        wing: createButterflyMaterial(map, { iri: 1, glow: 0.35 }),
        body: createButterflyMaterial(map, { iri: 0.3, glow: 0.12 }),
      },
      apparition: {
        wing: createApparitionMaterial(map, { layer: 0 }),
        body: createApparitionMaterial(map, { layer: 0, body: 1 }),
        haze: createApparitionMaterial(map, { layer: 1 }),
      },
    }
    let haze = null
    if (wings) {
      wings.geometry = wings.geometry.clone()
      wings.frustumCulled = false
      // soft haze shell: same deforming geometry, blurred + noise-warped silhouette
      haze = new THREE.Mesh(wings.geometry, mats.apparition.haze)
      haze.frustumCulled = false
      haze.renderOrder = -1
      wings.add(haze)
    }
    return { root, wings, body, haze, mats }
  }, [gltf])

  const field = useMemo(() => {
    if (!wings) return null
    const rest = Float32Array.from(wings.geometry.attributes.position.array)
    return precompute(rest, params)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wings])

  const smoke = useMemo(() => {
    const img = mats.powder.wing.map?.image
    if (!wings || !img) return null
    return new SmokeSystem(findEmitters(wings.geometry, img))
  }, [wings, mats])
  useEffect(() => () => smoke?.dispose(), [smoke])

  const halo = useMemo(() => {
    const mat = new THREE.SpriteMaterial({ map: createHaloTexture(), transparent: true, depthWrite: false })
    const s = new THREE.Sprite(mat)
    s.renderOrder = -2
    return s
  }, [])

  // Distance field depends on yStretch / centerY.
  useEffect(() => {
    if (field) updateDistance(field, params)
  }, [field, params.yStretch, params.centerY]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (body) body.visible = playback.showBody
  }, [body, playback.showBody])

  // Style + theme. Same model in every combination; only materials, blending and colours change.
  useEffect(() => {
    const light = look.theme === 'light'
    const app = look.style === 'apparition'
    if (wings) wings.material = app ? mats.apparition.wing : mats.powder.wing
    if (body) body.material = app ? mats.apparition.body : mats.powder.body
    if (haze) haze.visible = app

    const w = mats.powder.wing.userData.uniforms
    w.uIri.value = look.iridescence
    w.uGlow.value = look.glow * (light ? 0.55 : 1)
    w.uPastel.value = light ? 0.25 : 0.35
    const b = mats.powder.body.userData.uniforms
    b.uIri.value = look.iridescence * 0.3
    b.uGlow.value = look.glow * 0.35 * (light ? 0.55 : 1)

    for (const [m, op] of [[mats.apparition.wing, 1], [mats.apparition.body, 1], [mats.apparition.haze, look.haze]]) {
      const u = m.uniforms
      u.uIri.value = look.iridescence
      u.uGlow.value = look.glow * 1.15 // glow 0.3 ≈ the earlier 0.5 default's brightness
      u.uOpacity.value = op
      u.uLight.value = light ? 1 : 0
      m.blending = light ? THREE.NormalBlending : THREE.AdditiveBlending
      m.needsUpdate = true
    }

    halo.visible = look.halo > 0
    halo.material.blending = light ? THREE.NormalBlending : THREE.AdditiveBlending
    halo.material.color.set(app ? (light ? '#f6b6d6' : '#ffc4df') : light ? '#f7b8d8' : '#ffffff')
    halo.userData.opacity = look.halo * (light ? (app ? 0.55 : 0.75) : app ? 0.3 : 0.22)
    halo.material.needsUpdate = true

    smoke?.setLook(look.style, look.theme)
  }, [look, wings, body, haze, mats, halo, smoke])

  useEffect(() => {
    root.traverse((o) => {
      if (o.isMesh) o.material.wireframe = playback.wireframe
    })
  }, [root, playback.wireframe, look.style])

  useFrame((_, dt) => {
    if (!wings || !field) return
    const step = Math.min(dt, 0.1)
    if (playback.playing) {
      frameRef.current += step * SCENE.fps * playback.speed
      timeRef.current += step
    } else {
      frameRef.current = playback.scrub
    }
    const frame = frameRef.current
    const t = timeRef.current

    // gentle wandering flight so the smoke has somewhere to trail
    const f = flightRef.current
    if (f) {
      const a = look.drift
      f.position.set(Math.sin(t * 0.37) * 0.9 * a, Math.sin(t * 0.53) * 0.45 * a, Math.sin(t * 0.29 + 1) * 0.6 * a)
      f.rotation.z = -Math.cos(t * 0.37) * 0.12 * a
      f.rotation.x = Math.cos(t * 0.53) * 0.08 * a
    }

    const pos = wings.geometry.attributes.position
    evaluateWings(field, frame, params, pos.array)
    pos.needsUpdate = true
    wings.geometry.computeVertexNormals()
    wings.updateWorldMatrix(true, false)

    // glow pulse + occasional dissolve / reform
    const pulse = 1 + 0.12 * Math.sin(t * 1.1) + 0.05 * Math.sin(t * 2.7 + 1)
    const app = look.style === 'apparition'
    const dissolve = app ? dissolveCurve(t, look.dissolvePeriod) * look.dissolve : 0

    // key light direction in view space for the iridescence mask
    _light.set(...keyLight).normalize().transformDirection(camera.matrixWorldInverse)
    for (const m of [mats.powder.wing, mats.powder.body]) {
      m.userData.uniforms.uLightDir.value.copy(_light)
      m.userData.uniforms.uTime.value = t
    }
    for (const m of [mats.apparition.wing, mats.apparition.body, mats.apparition.haze]) {
      m.uniforms.uLightDir.value.copy(_light)
      m.uniforms.uTime.value = t
      m.uniforms.uPulse.value = pulse
      m.uniforms.uDissolve.value = dissolve
    }

    // halo sits behind the butterfly as seen from the camera, breathing with the glow
    if (f && halo.visible) {
      f.getWorldPosition(_center)
      _toCam.subVectors(camera.position, _center).normalize()
      halo.position.copy(_center).addScaledVector(_toCam, -2.5)
      halo.scale.setScalar(9 * (0.97 + 0.03 * pulse))
      halo.material.opacity = (halo.userData.opacity ?? 0.3) * pulse * (1 - dissolve * 0.6)
    }

    if (smoke) {
      smoke.update(playback.playing ? step * playback.speed : 0, wings, {
        amount: look.smoke,
        life: look.smokeLife,
        burst: dissolve,
        pixelRatio: gl.getPixelRatio(),
      })
    }
    if (hudRef.current) hudRef.current.textContent = `frame ${frame.toFixed(1)}  ·  ${SCENE.fps} fps`
  })

  return (
    <>
      <primitive object={halo} />
      <group ref={flightRef}>
        <primitive object={root} />
      </group>
      {smoke && <primitive object={smoke.group} />}
    </>
  )
}

useGLTF.preload(GLB)
