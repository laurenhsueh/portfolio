// "Apparition" butterfly: a glowing, smoky ghost of the textured model.
//
// Custom additive ShaderMaterial (no depth write) used on the wings, the body and a second
// "haze" copy of the wings that shares the same deforming geometry:
//   - colour: soft pink (texture pink + pink/lavender palette) with the iridescent thin-film
//     kept where the light hits; light theme renders as iridescent pink glass
//   - brightness concentrated near the body and along the veins, fading out to the tips
//   - the silhouette is the texture alpha, warped by animated noise and eroded from the edges
//     inward so outer wing areas dissolve unevenly into haze
//   - uDissolve (0 = whole, ~1 = mostly gone) sweeps a noisy front from the tips to the body,
//     with a faint glowing rim on the front
//   - the haze layer samples a heavily blurred alpha so a soft glow hugs the wing outline
import * as THREE from 'three'

const VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vV = -mv.xyz;
  vN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}`

const FRAG = /* glsl */ `
uniform sampler2D map;
uniform float uTime;
uniform float uPulse;
uniform float uDissolve;
uniform float uIri;
uniform float uGlow;
uniform float uOpacity;
uniform float uLayer;   // 0 = core wing, 1 = haze shell
uniform float uBody;    // 1 on the body mesh
uniform float uLight;   // 1 in light theme
uniform vec3 uLightDir;
uniform vec3 uColCore;
uniform vec3 uColMid;
uniform vec3 uColEdge;
uniform vec3 uColRose;
uniform vec3 uColPearl;
uniform vec3 uColLav;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;

float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n3(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * n3(p); p = p * 2.02 + vec3(11.7, 3.1, 5.3); a *= 0.5; }
  return v;
}
vec3 spectrum(float x) { return 0.5 + 0.5 * cos(6.28318 * (x + vec3(0.0, 0.33, 0.67))); }

void main() {
  float t = uTime;
  vec2 uv = vUv;

  // animated smoky warp of the texture lookup
  vec3 q = vec3(uv * 4.0, t * 0.12);
  vec2 warp = vec2(fbm(q), fbm(q + vec3(5.2, 1.3, 0.0))) - 0.5;
  vec2 suv = uv + warp * mix(0.012, 0.045, uLayer);

  vec4 tex = texture2D(map, suv);
  float aSoft = texture2D(map, suv, mix(3.0, 5.5, uLayer)).a;
  float aWide = 0.5 * (texture2D(map, suv + warp * 0.04, 5.5).a + texture2D(map, suv - warp * 0.03, 6.0).a);
  float lum = dot(tex.rgb, vec3(0.299, 0.587, 0.114));
  float lumBlur = dot(texture2D(map, suv, 4.0).rgb, vec3(0.299, 0.587, 0.114));
  float veins = clamp((lumBlur - lum) * 5.0, 0.0, 1.0);
  float spots = (1.0 - smoothstep(0.12, 0.38, lum));

  // 0 at the body, 1 at the wing tips
  float fromBody = clamp(length((uv - vec2(0.5, 0.5)) * vec2(2.0, 1.6)), 0.0, 1.0);
  float inner = mix(1.0 - smoothstep(0.05, 0.85, fromBody), 1.0, uBody);

  // drifting smoke inside the wing
  float smoke = fbm(vec3(uv * 6.0 + warp * 2.0, t * 0.18));
  float smoke2 = fbm(vec3(uv * 13.0 - vec2(0.0, t * 0.05), t * 0.3 + 4.0));

  // silhouette: edges erode inward and break up unevenly
  float shape;
  float edge = smoothstep(0.12, 0.7, aWide + (smoke - 0.5) * 0.3);
  if (uLayer < 0.5) {
    // wide, noisy edge falloff so the outline melts into haze instead of a cut line
    shape = smoothstep(0.2, 0.9, tex.a) * edge * (1.0 - fromBody * 0.45);
    shape *= smoothstep(0.38, 0.78, smoke * 1.15 + inner * 0.38 - fromBody * 0.12 + uBody);
    shape *= 0.55 + 0.45 * inner;
  } else {
    shape = pow(aSoft, 1.4) * (0.4 + 0.6 * smoke);
  }

  // dissolve front: tips go first, noisy, with a faint rim of light
  float field = (1.0 - fromBody) * 0.65 + smoke * 0.55 + uBody * 0.4;
  float front = uDissolve * 1.25 - 0.1;
  float alive = smoothstep(front, front + 0.18, field);
  float rim = (1.0 - smoothstep(0.0, 0.08, abs(field - front - 0.06))) * smoothstep(0.05, 0.4, uDissolve);

  // soft pink apparition: the texture's own pink shows through, pale pink-white at the core,
  // lavender-pink haze at the edges (kept below white so it survives bloom as pink)
  vec3 texPink = tex.rgb / max(max(tex.r, max(tex.g, tex.b)), 1e-3);
  vec3 col = mix(uColEdge, uColMid, smoothstep(0.2, 0.8, smoke));
  col = mix(col, uColCore, inner * 0.6);
  col = mix(col, texPink * uColMid / max(uColMid.r, 1e-3), 0.3 * (1.0 - spots));

  // iridescent thin film where the light lands
  vec3 V = normalize(vV);
  vec3 N = normalize(vN);
  vec3 L = normalize(uLightDir);
  float NdV = clamp(abs(dot(N, V)), 0.0, 1.0);
  float NdH = clamp(abs(dot(N, normalize(L + V + vec3(0.0, 0.0, 1e-4)))), 0.0, 1.0);
  float back = pow(clamp(dot(-V, L), 0.0, 1.0), 2.0);
  float hit = pow(NdH, 3.0) * 0.8 + pow(max(1.0 - NdV, 0.0), 2.0) * 0.6 + back * 0.6;
  float film = NdV * 1.3 + fromBody * 1.6 + smoke * 1.2 + t * 0.03;
  vec3 rainbow = mix(spectrum(film), vec3(1.0, 0.82, 0.92), 0.55);
  col = mix(col, col * 0.6 + rainbow * 0.8, clamp(hit * uIri, 0.0, 1.0) * 0.6);

  float intensity = (0.2 + inner * inner * 0.65 + veins * 0.9 + smoke2 * 0.3) * (1.0 - spots * 0.75);
  intensity *= mix(1.0, 0.3, uBody);
  intensity *= uPulse * uGlow * mix(1.0, 0.45, uLayer);
  intensity += rim * 0.45 * (1.0 - uLayer);

  // fine organic grain that sticks to the wing, flickering slowly
  float grain = n3(vec3(uv * 700.0, floor(t * 12.0)));
  intensity *= 0.85 + 0.3 * grain;

  float a = shape * alive * uOpacity * 0.8;
  a = max(a, rim * tex.a * edge * 0.35 * (1.0 - uLayer));

  vec3 outCol = col * intensity;
  if (uLight > 0.5) {
    // light background: iridescent pink glass catching soft light instead of added light.
    // rose body colour, pearl highlights (specular + fresnel + veins), pastel thin film.
    float spec = pow(NdH, 24.0) * 0.9 + pow(NdH, 6.0) * 0.25;
    float fres = pow(max(1.0 - NdV, 0.0), 2.0);
    vec3 glass = mix(uColRose, uColLav, smoothstep(0.3, 0.85, smoke) * 0.5 + fromBody * 0.2);
    glass = mix(glass, texPink * uColRose / max(uColRose.r, 1e-3), 0.25 * (1.0 - spots));
    // deeper rose where the glass turns edge-on gives it depth against the light background
    glass = mix(glass, uColRose * 0.78, clamp(fres * 0.6 + (1.0 - smoke) * 0.15, 0.0, 0.6));
    glass = mix(glass, uColPearl, clamp(inner * 0.3 + veins * 0.45 + spec, 0.0, 0.85));
    glass = mix(glass, glass * 0.45 + mix(spectrum(film), vec3(1.0, 0.82, 0.92), 0.4) * 0.65,
                clamp(hit * uIri, 0.0, 1.0) * 0.6);
    glass *= 1.0 - spots * 0.3 * (1.0 - uBody);
    glass = mix(glass, uColRose * 0.85, uBody * 0.55);
    outCol = glass * (0.9 + 0.1 * uPulse);
    a *= (0.5 + inner * 0.2 + spec * 0.3 + fres * 0.2) * mix(1.0, 0.6, uLayer);
  }
  gl_FragColor = vec4(outCol, clamp(a, 0.0, 1.0));
  #include <colorspace_fragment>
}`

const APPARITION_PALETTE = {
  core: '#ffe6f1', // pale pink-white
  mid: '#f3a6cb', // soft pink
  edge: '#c9a4e4', // lavender-pink haze
  rose: '#f19cc4', // light mode: glass body colour
  pearl: '#fff7fb', // light mode: pearlescent highlights
  lav: '#cdb6f0', // light mode: lavender reflections
}

export function createApparitionMaterial(map, { layer = 0, body = 0 } = {}) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      map: { value: map },
      uTime: { value: 0 },
      uPulse: { value: 1 },
      uDissolve: { value: 0 },
      uIri: { value: 1 },
      uGlow: { value: 1 },
      uOpacity: { value: 1 },
      uLayer: { value: layer },
      uBody: { value: body },
      uLight: { value: 0 },
      uLightDir: { value: new THREE.Vector3(0, 1, 1).normalize() },
      uColCore: { value: new THREE.Color(APPARITION_PALETTE.core) },
      uColMid: { value: new THREE.Color(APPARITION_PALETTE.mid) },
      uColEdge: { value: new THREE.Color(APPARITION_PALETTE.edge) },
      uColRose: { value: new THREE.Color(APPARITION_PALETTE.rose) },
      uColPearl: { value: new THREE.Color(APPARITION_PALETTE.pearl) },
      uColLav: { value: new THREE.Color(APPARITION_PALETTE.lav) },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  })
  mat.userData.uniforms = mat.uniforms
  return mat
}
