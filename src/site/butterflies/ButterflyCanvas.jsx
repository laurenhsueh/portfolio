import { Canvas } from '@react-three/fiber'
import { CAMERA } from './StageButterfly'

/**
 * The canvas both home butterfly stages use. `bloom` (dark theme): an opaque black canvas with its
 * own bloom pass, screen-blended onto the page by CSS. Otherwise (light): a see-through canvas.
 * The two need different GL contexts, hence the key.
 */
export default function ButterflyCanvas({ bloom, frameloop, children }) {
  return (
    <Canvas
      key={bloom ? 'bloom' : 'plain'}
      frameloop={frameloop}
      dpr={bloom ? [1, 1.25] : [1, 1.75]}
      camera={CAMERA}
      gl={{ alpha: !bloom, antialias: !bloom, powerPreference: bloom ? 'default' : 'low-power' }}
      onCreated={bloom ? ({ gl }) => gl.setClearColor('#000000', 1) : undefined}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      {children}
    </Canvas>
  )
}
