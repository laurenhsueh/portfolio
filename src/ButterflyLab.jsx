import { Suspense, useEffect, useRef } from 'react'
import './lab.css'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { EffectComposer, Bloom, Noise, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { Leva, useControls, button, folder } from 'leva'
import Butterfly from './Butterfly'
import { NODE_DEFAULTS, SCENE } from './wingMath'

const KEY_LIGHT = [4, 6, 5]

const THEMES = {
  dark: {
    bg: '#07070b',
    ambient: 0.35,
    key: 2.0,
    rim: 1.8,
    fill: 0.5,
    bloom: { intensity: 0.9, threshold: 0.45, smoothing: 0.35 },
    apparitionBloom: { intensity: 1.1, threshold: 0.3, smoothing: 0.5 },
  },
  light: {
    bg: '#f7f1f4',
    ambient: 1.0,
    key: 1.7,
    rim: 1.0,
    fill: 0.6,
    bloom: { intensity: 0.25, threshold: 0.97, smoothing: 0.05 },
    apparitionBloom: { intensity: 0.2, threshold: 0.97, smoothing: 0.05 },
  },
}

const prefersDark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches

export default function ButterflyLab() {
  const hudRef = useRef(null)

  const playback = useControls('Playback', {
    playing: true,
    speed: { value: 0.6, min: 0.05, max: 4, step: 0.05 },
    scrub: { value: 84, min: SCENE.frameStart, max: SCENE.frameEnd, step: 0.5, label: 'frame (paused)' },
    showBody: { value: true, label: 'show body' },
    wireframe: false,
    autoRotate: false,
  })

  const look = useControls('Look', {
    style: { value: 'apparition', options: ['apparition', 'powder'] },
    theme: { value: prefersDark ? 'dark' : 'light', options: ['dark', 'light'] },
    iridescence: { value: 1, min: 0, max: 2, step: 0.05 },
    glow: { value: 0.3, min: 0, max: 1.5, step: 0.05 },
    haze: { value: 0.8, min: 0, max: 2, step: 0.05, label: 'haze layer' },
    halo: { value: 1, min: 0, max: 2, step: 0.05 },
    smoke: { value: 0.3, min: 0, max: 2, step: 0.05 },
    smokeLife: { value: 3.2, min: 0.5, max: 6, step: 0.1, label: 'smoke life (s)' },
    dissolve: { value: 0, min: 0, max: 1, step: 0.05, label: 'dissolve depth' },
    dissolvePeriod: { value: 14, min: 4, max: 40, step: 1, label: 'dissolve every (s)' },
    grain: { value: 0, min: 0, max: 1, step: 0.05, label: 'film grain' },
    drift: { value: 1, min: 0, max: 2, step: 0.05, label: 'flight drift' },
  })

  const [params, setParams] = useControls('Geometry Nodes', () => ({
    frameDivisor: { value: NODE_DEFAULTS.frameDivisor, min: 0.5, max: 12, step: 0.1, label: 'frame ÷ (flap speed)' },
    distFalloff: { value: NODE_DEFAULTS.distFalloff, min: 0, max: 1.5, step: 0.01, label: 'distance × (wave lag)' },
    amplitude: { value: NODE_DEFAULTS.amplitude, min: 0, max: 2, step: 0.01, label: 'amplitude' },
    'Map Range': folder({
      mapFromMin: { value: NODE_DEFAULTS.mapFromMin, min: -3, max: 0.99, step: 0.05, label: 'from min' },
      mapFromMax: { value: NODE_DEFAULTS.mapFromMax, min: -0.99, max: 3, step: 0.05, label: 'from max' },
      mapToMin: { value: NODE_DEFAULTS.mapToMin, min: -2, max: 2, step: 0.05, label: 'to min (rad)' },
      mapToMax: { value: NODE_DEFAULTS.mapToMax, min: -2, max: 3, step: 0.05, label: 'to max (rad)' },
    }),
    'Distance field': folder({
      yStretch: { value: NODE_DEFAULTS.yStretch, min: 0.1, max: 4, step: 0.05, label: 'Y stretch' },
      centerY: { value: NODE_DEFAULTS.centerY, min: -4, max: 4, step: 0.05, label: 'origin Y' },
    }),
    'reset defaults': button(() => setParams({ ...NODE_DEFAULTS })),
  }), { collapsed: true })

  const th = THEMES[look.theme]
  const bloom = look.style === 'apparition' ? th.apparitionBloom : th.bloom
  const dark = look.theme === 'dark'

  useEffect(() => {
    document.documentElement.dataset.labTheme = look.theme
    return () => { delete document.documentElement.dataset.labTheme }
  }, [look.theme])

  return (
    <div className="lab">
      <Leva collapsed={false} />
      <a className="lab-back" href="#/garden">← Garden</a>
      <Canvas flat camera={{ position: [5, 2.5, 6.5], fov: 40 }} dpr={[1, 2]} gl={{ antialias: false }}>
        <color attach="background" args={[th.bg]} />
        <ambientLight intensity={th.ambient} color="#fff4f8" />
        <directionalLight position={KEY_LIGHT} intensity={th.key} color="#fffaf5" />
        {/* rim light from behind: shines through the wings and lights the iridescent edges */}
        <directionalLight position={[-3, 2, -6]} intensity={th.rim} color="#ffc8e4" />
        <directionalLight position={[-5, -2, 4]} intensity={th.fill} color="#d9ccff" />
        <Suspense fallback={null}>
          <Butterfly params={params} playback={playback} look={look} keyLight={KEY_LIGHT} hudRef={hudRef} />
        </Suspense>
        <OrbitControls makeDefault autoRotate={playback.autoRotate} autoRotateSpeed={1.5} />
        <EffectComposer multisampling={0}>
          <Bloom
            mipmapBlur
            intensity={bloom.intensity}
            luminanceThreshold={bloom.threshold}
            luminanceSmoothing={bloom.smoothing}
            radius={0.85}
            levels={8}
          />
          {/* grain mostly where there is light, so it reads as film grain rather than static */}
          <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={dark ? look.grain * 1.6 : 0} />
          <Noise blendFunction={BlendFunction.SOFT_LIGHT} opacity={look.grain * (dark ? 0.35 : 0.25)} />
          <Vignette eskil={false} offset={0.2} darkness={dark ? 0.75 : 0.15} />
        </EffectComposer>
      </Canvas>
      <div className="hud" ref={hudRef} />
    </div>
  )
}
