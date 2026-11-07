// ─────────────────────────────────────────────────────────────────────────────
//  A long-exposure afterimage for StageButterfly (#/v3): every frame is laid over a faded,
//  softly blurred, lavender-shifted copy of the trail so far, which is also moved and shrunk
//  toward an anchor. The butterfly is stamped in once per wingbeat (`emit`), so each flap leaves
//  a ghost that recedes along the diagonal, hazing out as it goes (or, with a steady `emit`, a
//  continuous smear of wherever it flew).
//
//  The trail lives in a half-resolution feedback buffer (a quarter of the pixels; the blur
//  hides it), and the sharp current frame is screened on top at full resolution. A half-res
//  bloom then spreads the light, replacing the CSS drop-shadow glow.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js'

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`

// next trail = max(current frame × emit, previous trail faded + blurred + moved + tinted)
const FEEDBACK = /* glsl */ `
uniform sampler2D tCur;
uniform sampler2D tPrev;
uniform float uFade;   // this frame's fade (frame-rate independent)
uniform vec3 uAge;     // per-channel fade on top: pink drifts toward lavender as it ages
uniform vec2 uDrift;   // uv per frame: the haze moves (e.g. rises like smoke)
uniform vec2 uAnchor;  // uv the trail contracts toward…
uniform float uShrink; // …by this much per frame (> 1 shrinks): ghosts recede into the distance
uniform float uEmit;   // how much of this frame is stamped into the trail (pulses once per flap)
uniform vec2 uTexel;
uniform float uSpread; // blur radius in trail texels
varying vec2 vUv;
void main() {
  vec2 uv = uAnchor + (vUv - uAnchor) * uShrink - uDrift;
  vec2 o = uTexel * uSpread;
  vec3 p = texture2D(tPrev, uv).rgb * 0.36
    + (texture2D(tPrev, uv + vec2(o.x, 0.0)).rgb + texture2D(tPrev, uv - vec2(o.x, 0.0)).rgb
     + texture2D(tPrev, uv + vec2(0.0, o.y)).rgb + texture2D(tPrev, uv - vec2(0.0, o.y)).rgb) * 0.16;
  p *= uFade * uAge;
  vec3 c = texture2D(tCur, vUv).rgb;
  gl_FragColor = vec4(max(c * uEmit, p), 1.0);
}
`

// the sharp frame screened over the (upsampled) trail. The buffers are HDR (half float), so a
// plain screen (c + t - c t) goes negative once a channel passes 1, e.g. where overlapping
// additive wings blow the red out: red drops below zero and that spot turns cyan. This form is
// the same screen up to 1 and only ever adds light past it.
const COMPOSITE = /* glsl */ `
uniform sampler2D tCur;
uniform sampler2D tTrail;
uniform float uGain;
varying vec2 vUv;
void main() {
  vec3 c = max(texture2D(tCur, vUv).rgb, 0.0);
  vec3 t = max(texture2D(tTrail, vUv).rgb * uGain, 0.0);
  gl_FragColor = vec4(c + t * (1.0 - min(c, 1.0)), 1.0);
}
`

class TrailPass extends Pass {
  constructor({ scale = 0.5 } = {}) {
    super()
    this.scale = scale
    const rt = () => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false })
    this.prev = rt()
    this.next = rt()
    this.feedback = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FEEDBACK,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tCur: { value: null },
        tPrev: { value: null },
        uFade: { value: 0.96 },
        uAge: { value: new THREE.Vector3(1, 1, 1) },
        uDrift: { value: new THREE.Vector2(0, 0) },
        uTexel: { value: new THREE.Vector2(1, 1) },
        uAnchor: { value: new THREE.Vector2(0, 0) },
        uShrink: { value: 1 },
        uEmit: { value: 0.8 },
        uSpread: { value: 1.2 },
      },
    })
    this.composite = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: COMPOSITE,
      depthTest: false,
      depthWrite: false,
      uniforms: { tCur: { value: null }, tTrail: { value: null }, uGain: { value: 1 } },
    })
    this.quad = new FullScreenQuad(null)
    this.cleared = false
  }

  setSize(width, height) {
    const w = Math.max(1, Math.round(width * this.scale))
    const h = Math.max(1, Math.round(height * this.scale))
    this.prev.setSize(w, h)
    this.next.setSize(w, h)
    this.feedback.uniforms.uTexel.value.set(1 / w, 1 / h)
    this.cleared = false
  }

  /**
   * Per frame. `cfg`: { on, life (seconds to fade to ~5%), drift ([x, y] uv / s, y up),
   * anchor ([x, y] uv the trail recedes toward), shrink (per second), blur (texels per 60 fps
   * frame) }. `emit`: how much of this frame to stamp into the trail (0..1).
   */
  step(dt, cfg, emit) {
    const u = this.feedback.uniforms
    const f = dt * 60 // in 60 fps frames: fade, tint, motion and blur keep the same look at any frame rate
    u.uFade.value = cfg.on ? Math.pow(0.05, dt / cfg.life) : 0
    u.uAge.value.set(Math.pow(0.997, f), Math.pow(0.993, f), 1)
    const drift = cfg.drift ?? [0, 0]
    u.uDrift.value.set(drift[0] * dt, drift[1] * dt)
    const anchor = cfg.anchor ?? [0.5, 0.5]
    u.uAnchor.value.set(anchor[0], anchor[1])
    u.uShrink.value = Math.exp((cfg.shrink ?? 0) * dt)
    u.uSpread.value = (cfg.blur ?? 0.5) * f
    u.uEmit.value = emit
  }

  render(renderer, writeBuffer, readBuffer) {
    if (!this.cleared) {
      // start from black, not from whatever the new buffers hold
      for (const t of [this.prev, this.next]) {
        renderer.setRenderTarget(t)
        renderer.clear()
      }
      this.cleared = true
    }
    const fb = this.feedback.uniforms
    fb.tCur.value = readBuffer.texture
    fb.tPrev.value = this.prev.texture
    this.quad.material = this.feedback
    renderer.setRenderTarget(this.next)
    this.quad.render(renderer)

    const cu = this.composite.uniforms
    cu.tCur.value = readBuffer.texture
    cu.tTrail.value = this.next.texture
    this.quad.material = this.composite
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer)
    this.quad.render(renderer)

    const t = this.prev
    this.prev = this.next
    this.next = t
  }

  dispose() {
    this.prev.dispose()
    this.next.dispose()
    this.feedback.dispose()
    this.composite.dispose()
    this.quad.dispose()
  }
}

/**
 * Builds the pipeline: scene → trail → bloom → output (tone mapping + sRGB, as without it).
 * Bloom runs at `bloomScale` of the canvas resolution.
 */
export function createAfterimage(gl, scene, camera, { trailScale = 0.5, bloomScale = 0.5, bloom = {} } = {}) {
  const composer = new EffectComposer(gl)
  composer.addPass(new RenderPass(scene, camera))
  const trail = new TrailPass({ scale: trailScale })
  composer.addPass(trail)
  // only the bright core blooms (the additive wings run well above 1 in this HDR buffer), so the
  // trail keeps its shape instead of washing into one glow
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(256, 256),
    bloom.strength ?? 0.45,
    bloom.radius ?? 0.45,
    bloom.threshold ?? 0.6,
  )
  composer.addPass(bloomPass)
  composer.addPass(new OutputPass())

  return {
    trail,
    bloomPass, // exposed so a caller can retune strength / radius per frame
    setSize(width, height, pixelRatio) {
      composer.setPixelRatio(pixelRatio)
      composer.setSize(width, height)
      bloomPass.setSize(width * pixelRatio * bloomScale, height * pixelRatio * bloomScale)
    },
    render(dt) {
      composer.render(dt)
    },
    /** Wipe the trail (e.g. after a while unused, so an old ghost doesn't flash up). */
    reset() {
      for (const rt of [trail.prev, trail.next]) {
        gl.setRenderTarget(rt)
        gl.clear()
      }
      gl.setRenderTarget(null)
    },
    dispose() {
      trail.dispose()
      bloomPass.dispose()
      composer.dispose()
    },
  }
}
