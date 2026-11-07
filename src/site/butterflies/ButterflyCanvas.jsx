import { Canvas } from '@react-three/fiber'
import { CAMERA } from './StageButterfly'

/**
 * The canvas both home butterfly stages use. Dark: cleared to opaque black, with its own bloom
 * pass, screen-blended onto the page by CSS. Light: see-through, with a WebGL glow. One GL context
 * serves both themes (Afterimage switches the clear colour and render path), so toggling the theme
 * never tears the canvas down and rebuilds it, which used to stall the switch.
 */
export default function ButterflyCanvas({ frameloop, children }) {
  return (
    <Canvas
      frameloop={frameloop}
      // the same resolution in both themes (light used to render ~44% more pixels)
      dpr={[1, 1.25]}
      camera={CAMERA}
      // light used to ask for the low-power GPU, which made it the laggier theme on dual-GPU laptops
      gl={{ alpha: true, antialias: true, powerPreference: 'default' }}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      {children}
    </Canvas>
  )
}
