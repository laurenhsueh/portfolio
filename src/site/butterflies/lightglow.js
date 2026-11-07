// ─────────────────────────────────────────────────────────────────────────────
//  The light theme's pink glow, drawn in WebGL. It replaces the stacked CSS drop-shadows the
//  canvases used to carry: a CSS blur is redone over the whole canvas every frame the butterfly
//  moves, which made light mode the laggier theme. Here the scene is drawn a second time into a
//  quarter-resolution buffer (1/16 of the pixels), its silhouette (alpha) is blurred there into
//  three widths (tight, medium, wide: the same recipe as the old CSS), and that glow is laid onto
//  the canvas before the butterfly itself is drawn on top at full resolution.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three'
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js'

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`

// 9-tap Gaussian along uDir, on the alpha channel only
const BLUR = /* glsl */ `
uniform sampler2D tMap;
uniform vec2 uDir;
varying vec2 vUv;
void main() {
  float a = texture2D(tMap, vUv).a * 0.227027;
  a += (texture2D(tMap, vUv + uDir).a + texture2D(tMap, vUv - uDir).a) * 0.1945946;
  a += (texture2D(tMap, vUv + uDir * 2.0).a + texture2D(tMap, vUv - uDir * 2.0).a) * 0.1216216;
  a += (texture2D(tMap, vUv + uDir * 3.0).a + texture2D(tMap, vUv - uDir * 3.0).a) * 0.054054;
  a += (texture2D(tMap, vUv + uDir * 4.0).a + texture2D(tMap, vUv - uDir * 4.0).a) * 0.016216;
  gl_FragColor = vec4(a);
}
`

// the three glows stacked like drop-shadows (tight on top), premultiplied for the canvas
const COMPOSITE = /* glsl */ `
uniform sampler2D tTight;
uniform sampler2D tMid;
uniform sampler2D tWide;
uniform vec4 uTight; // rgb (sRGB), strength
uniform vec4 uMid;
uniform vec4 uWide;
varying vec2 vUv;
void main() {
  float t = clamp(texture2D(tTight, vUv).a * uTight.a, 0.0, 1.0);
  float m = clamp(texture2D(tMid, vUv).a * uMid.a, 0.0, 1.0);
  float w = clamp(texture2D(tWide, vUv).a * uWide.a, 0.0, 1.0);
  // "over" from the bottom up: wide, then mid, then tight
  vec3 c = uWide.rgb * w;
  float a = w;
  c = uMid.rgb * m + c * (1.0 - m);
  a = m + a * (1.0 - m);
  c = uTight.rgb * t + c * (1.0 - t);
  a = t + a * (1.0 - t);
  gl_FragColor = vec4(c, a);
}
`

const rgb = (r, g, b, k) => new THREE.Vector4(r / 255, g / 255, b / 255, k)

/**
 * `spread` = Gaussian tap spacing in quarter-res texels for each width. The 9-tap kernel's sigma is
 * ≈ 1.8 taps, and each width blurs the one before it, so these give sigmas of ≈ 1, 6 and 20 CSS px
 * at 1.25× pixel density: the old CSS drop-shadow(2px / 12px / 40px), whose blur radius is 2σ.
 * `scale` = the glow buffers' fraction of the canvas.
 */
export function createLightGlow(gl, scene, camera, { scale = 0.25, spread = [0.35, 1, 3.3] } = {}) {
  const rt = (depth) => new THREE.WebGLRenderTarget(1, 1, { depthBuffer: depth, type: THREE.UnsignedByteType })
  const sceneRT = rt(true)
  const tmp = rt(false)
  const tight = rt(false)
  const mid = rt(false)
  const wide = rt(false)

  const blurMat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: BLUR,
    uniforms: { tMap: { value: null }, uDir: { value: new THREE.Vector2() } },
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
  })
  const compMat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: COMPOSITE,
    uniforms: {
      tTight: { value: tight.texture },
      tMid: { value: mid.texture },
      tWide: { value: wide.texture },
      uTight: { value: rgb(214, 70, 140, 0.55) },
      uMid: { value: rgb(232, 93, 158, 0.5) },
      uWide: { value: rgb(240, 120, 180, 0.34) },
    },
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
  })
  const blurQuad = new FullScreenQuad(blurMat)
  const compQuad = new FullScreenQuad(compMat)
  let texel = new THREE.Vector2(1, 1)

  // separable blur: src → tmp (horizontal) → dst (vertical)
  const blur = (src, dst, s) => {
    blurMat.uniforms.tMap.value = src.texture
    blurMat.uniforms.uDir.value.set(texel.x * s, 0)
    gl.setRenderTarget(tmp)
    blurQuad.render(gl)
    blurMat.uniforms.tMap.value = tmp.texture
    blurMat.uniforms.uDir.value.set(0, texel.y * s)
    gl.setRenderTarget(dst)
    blurQuad.render(gl)
  }

  return {
    setSize(width, height, pixelRatio) {
      const w = Math.max(1, Math.round(width * pixelRatio * scale))
      const h = Math.max(1, Math.round(height * pixelRatio * scale))
      for (const r of [sceneRT, tmp, tight, mid, wide]) r.setSize(w, h)
      texel = new THREE.Vector2(1 / w, 1 / h)
    },
    render() {
      const autoClear = gl.autoClear
      gl.autoClear = true
      // the silhouette, small
      gl.setRenderTarget(sceneRT)
      gl.render(scene, camera)
      // three widths, each blurred from the last, so the wide one costs no more than the tight one
      blur(sceneRT, tight, spread[0])
      blur(tight, mid, spread[1])
      blur(mid, wide, spread[2])
      // glow onto the (transparent) canvas, then the butterfly over it at full resolution
      gl.setRenderTarget(null)
      gl.clear()
      compQuad.render(gl)
      gl.autoClear = false
      gl.render(scene, camera)
      gl.autoClear = autoClear
    },
    dispose() {
      for (const r of [sceneRT, tmp, tight, mid, wide]) r.dispose()
      blurMat.dispose()
      compMat.dispose()
      blurQuad.dispose()
      compQuad.dispose()
    },
  }
}
