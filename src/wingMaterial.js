// Powdered, iridescent butterfly material.
//
// MeshStandardMaterial (so it still reacts to the scene lights) patched with onBeforeCompile:
//   - fully rough, non-metal base: no glossy highlight, the wing reads as matte powder
//   - per-texel grain on the albedo for the scale "dust"
//   - thin-film rainbow: hue driven by view angle, light angle and a noisy film thickness,
//     masked to where the light actually hits (broad lobe + grazing edges), so it looks like
//     glass catching light rather than an all-over rainbow
//   - back-light transmission: light behind the wing shines through it
//   - soft pink/white emissive glow, strongest at the rim
import * as THREE from 'three'

const NOISE = /* glsl */ `
uniform float uTime;
uniform vec3  uLightDir;   // view space, towards the key light
uniform float uIri;
uniform float uGlow;
uniform vec3  uGlowColor;
uniform float uPastel;
uniform float uGrain;

float bwHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float bwNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(bwHash(i), bwHash(i + vec2(1, 0)), u.x),
             mix(bwHash(i + vec2(0, 1)), bwHash(i + vec2(1, 1)), u.x), u.y);
}
float bwFbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * bwNoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return v;
}
vec3 bwSpectrum(float x) { return clamp(0.5 + 0.5 * cos(6.28318 * (x + vec3(0.0, 0.33, 0.67))), 0.0, 1.0); }
`

const SHADE = /* glsl */ `
{
  #ifdef USE_MAP
    vec2 bwUv = vMapUv;
  #else
    vec2 bwUv = vec2(0.5);
  #endif
  vec3 V = normalize(vViewPosition);
  vec3 N = normalize(normal);
  vec3 L = normalize(uLightDir);
  float NdV = clamp(abs(dot(N, V)), 0.0, 1.0);
  float NdH = abs(dot(N, normalize(L + V + vec3(0.0, 0.0, 1e-4))));
  float fres = pow(max(1.0 - NdV, 0.0), 2.5);
  float n = bwFbm(bwUv * 5.0 + vec2(uTime * 0.04, -uTime * 0.03));
  // soft, fine powder: blurred value noise instead of per-texel salt
  float grain = bwNoise(bwUv * 520.0) * 0.6 + bwNoise(bwUv * 1300.0) * 0.4;
  float albedoL = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  float back = pow(clamp(dot(-V, L), 0.0, 1.0), 2.0);       // light coming through the wing

  // powder: scales scatter light unevenly, never as a single glossy highlight
  outgoingLight *= mix(1.0 - uGrain, 1.0 + uGrain, grain);

  // inner glow: the wing is lit from within with its own (pastel) colour, like a backlit petal
  vec3 petal = mix(diffuseColor.rgb, vec3(1.0), 0.25);
  outgoingLight += petal * uGlow * (0.55 + back * 0.8 + fres * 0.6);

  // thin-film rainbow: hue from view angle, light angle, distance from the body and a noisy
  // film thickness, only where the light lands (broad lobe + grazing edges)
  float radial = length((bwUv - vec2(0.5, 0.48)) * vec2(1.0, 1.3));
  float film = NdV * 1.3 + dot(N, L) * 0.45 + radial * 1.6 + n * 1.1 + uTime * 0.03;
  vec3 rainbow = mix(bwSpectrum(film), vec3(1.0), uPastel);
  float hit = pow(clamp(NdH, 0.0, 1.0), 4.0) * 0.8 + fres * 0.7 + back * 0.7;
  float iri = hit * uIri * mix(0.3, 1.0, albedoL) * mix(0.8, 1.0, grain);
  // tint (keeps the powdery brightness) plus a little additive light, like a prism caustic
  float k = clamp(iri, 0.0, 1.0);
  outgoingLight = mix(outgoingLight, outgoingLight * (0.35 + rainbow * 1.15), k * 0.75) + rainbow * k * 0.12;

  // soft white rim, pink at the core of the glow
  vec3 glow = mix(uGlowColor, vec3(1.0), 0.4 + 0.4 * n);
  outgoingLight += glow * uGlow * fres * 0.8 * mix(0.4, 1.0, albedoL);
}
#include <opaque_fragment>
`

export function createButterflyMaterial(map, { iri = 1, glow = 0.35 } = {}) {
  const mat = new THREE.MeshStandardMaterial({
    map,
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide,
    alphaTest: 0.45,
  })
  const uniforms = {
    uTime: { value: 0 },
    uLightDir: { value: new THREE.Vector3(0, 1, 1).normalize() },
    uIri: { value: iri },
    uGlow: { value: glow },
    uGlowColor: { value: new THREE.Color('#ffb3d6') },
    uPastel: { value: 0.35 },
    uGrain: { value: 0.1 },
  }
  mat.userData.uniforms = uniforms
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE}`)
      .replace('#include <opaque_fragment>', SHADE)
  }
  mat.customProgramCacheKey = () => 'butterfly-powder-iri'
  return mat
}

/** Radial pink/white gradient used for the soft halo sprite behind the butterfly. */
export function createHaloTexture() {
  const s = 256
  const c = document.createElement('canvas')
  c.width = c.height = s
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  // exponential-ish falloff so the halo never shows a disc edge
  for (let i = 0; i <= 16; i++) {
    const x = i / 16
    const a = Math.exp(-x * x * 5.5) * (1 - x)
    const r = Math.round(255 - x * 30), gg = Math.round(235 - x * 60), b = Math.round(245 - x * 10)
    grad.addColorStop(x, `rgba(${r},${gg},${b},${a.toFixed(3)})`)
  }
  g.fillStyle = grad
  g.fillRect(0, 0, s, s)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}
