// Smoke shed by the wings: soft noise-textured puffs that grow, curl and fade as they drift
// away, plus a sprinkle of fine glowing dust. World space, so it trails behind the butterfly.
// Emission follows wing speed and bursts while the butterfly dissolves.
import * as THREE from 'three'

const NOISE2 = /* glsl */ `
float h2(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float n2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1, 0)), u.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), u.x), u.y);
}
float fbm2(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 3; i++) { v += a * n2(p); p = p * 2.05 + 7.3; a *= 0.5; } return v; }
`

const VERT = /* glsl */ `
attribute float aAge;
attribute float aSeed;
uniform float uSize;
uniform float uGrow;
uniform float uPixelRatio;
varying float vAge;
varying float vSeed;
void main() {
  vAge = aAge; vSeed = aSeed;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float alive = step(aAge, 1.0);
  gl_PointSize = alive * uSize * uPixelRatio * (0.6 + aSeed * 0.8) * (1.0 + aAge * uGrow) * (10.0 / -mv.z);
}`

const SMOKE_FRAG = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform vec3 uColA;
uniform vec3 uColB;
uniform float uIri;
varying float vAge;
varying float vSeed;
${NOISE2}
vec3 spectrum(float x) { return 0.5 + 0.5 * cos(6.28318 * (x + vec3(0.0, 0.33, 0.67))); }
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float ang = vSeed * 6.28318 + vAge * (vSeed - 0.5) * 2.0;
  p = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * p;
  float r = length(p);
  float n = fbm2(p * 3.2 + vec2(vSeed * 17.0, vSeed * 9.0 - vAge * 1.2));
  // stretched, high-contrast noise: wisps and tendrils rather than round puffs
  float n2b = fbm2(vec2(p.x * 1.6, p.y * 5.0) + vec2(vSeed * 31.0, -vAge * 0.8));
  float puff = (1.0 - smoothstep(0.1, 0.5, r)) * smoothstep(0.45, 0.85, n * 0.6 + n2b * 0.7 - r * 0.3);
  float a = puff * smoothstep(0.0, 0.15, vAge) * pow(max(1.0 - vAge, 0.0), 1.4) * uOpacity;
  vec3 col = mix(uColA, uColB, clamp(vAge * 0.8 + n * 0.4, 0.0, 1.0));
  col = mix(col, mix(spectrum(vSeed * 2.0 + vAge + uTime * 0.05), vec3(0.85, 0.88, 1.0), 0.5), uIri * (1.0 - vAge));
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}`

const DUST_FRAG = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform vec3 uColA;
uniform vec3 uColB;
varying float vAge;
varying float vSeed;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = (1.0 - smoothstep(0.0, 0.5, d));
  a *= a * smoothstep(0.0, 0.1, vAge) * pow(max(1.0 - vAge, 0.0), 1.3) * uOpacity;
  float twinkle = 0.7 + 0.3 * sin(uTime * 5.0 + vSeed * 40.0);
  gl_FragColor = vec4(mix(uColA, uColB, vSeed), a * twinkle);
  #include <colorspace_fragment>
}`

// palettes per style + theme
const LOOKS = {
  apparition: {
    dark: { blending: THREE.AdditiveBlending, smoke: ['#ffd3e8', '#c7a3e6', 0.09, 0.25], dust: ['#ffffff', '#ffc8e3', 0.75] },
    light: { blending: THREE.NormalBlending, smoke: ['#f2a7cc', '#cbb3ee', 0.14, 0.2], dust: ['#ec92c0', '#b9a2e8', 0.8] },
  },
  powder: {
    dark: { blending: THREE.AdditiveBlending, smoke: ['#ffd6ea', '#c9a6f0', 0.14, 0.3], dust: ['#ffffff', '#ffc2e0', 0.85] },
    light: { blending: THREE.NormalBlending, smoke: ['#f0b3d2', '#c8b3ee', 0.16, 0.2], dust: ['#e57fb2', '#a98ae0', 1.0] },
  },
}

function flow(x, y, z, t, s, out) {
  out.x = Math.sin(y * 1.3 + t * 0.6 + s) + Math.sin(z * 1.9 - t * 0.5)
  out.y = Math.sin(z * 1.1 + t * 0.55) + Math.sin(x * 1.7 + t * 0.4 + s)
  out.z = Math.sin(x * 1.5 - t * 0.35) + Math.sin(y * 0.9 + t * 0.8)
  return out
}

class Pool {
  constructor(n, frag, uniforms, renderOrder) {
    this.n = n
    this.head = 0
    this.p = new Float32Array(n * 3)
    this.v = new Float32Array(n * 3)
    this.t = new Float32Array(n).fill(1e9)
    this.life = new Float32Array(n).fill(1)
    const g = new THREE.BufferGeometry()
    this.posAttr = new THREE.BufferAttribute(this.p, 3)
    this.ageAttr = new THREE.BufferAttribute(new Float32Array(n).fill(2), 1)
    const seeds = new Float32Array(n)
    for (let i = 0; i < n; i++) seeds[i] = Math.random()
    g.setAttribute('position', this.posAttr)
    g.setAttribute('aAge', this.ageAttr)
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: frag,
      uniforms: {
        uTime: { value: 0 }, uSize: { value: 1 }, uGrow: { value: 1 }, uPixelRatio: { value: 1 },
        uOpacity: { value: 1 }, uIri: { value: 0 },
        uColA: { value: new THREE.Color() }, uColB: { value: new THREE.Color() },
        ...uniforms,
      },
      transparent: true,
      depthWrite: false,
    })
    this.points = new THREE.Points(g, this.mat)
    this.points.frustumCulled = false
    this.points.renderOrder = renderOrder
  }

  spawn(x, y, z, vx, vy, vz, life) {
    const k = this.head
    this.head = (k + 1) % this.n
    const j = k * 3
    this.p[j] = x; this.p[j + 1] = y; this.p[j + 2] = z
    this.v[j] = vx; this.v[j + 1] = vy; this.v[j + 2] = vz
    this.t[k] = 0
    this.life[k] = life
  }

  step(dt, t, turb, lift, drag, tmp) {
    const ages = this.ageAttr.array
    const d = Math.exp(-drag * dt)
    for (let k = 0; k < this.n; k++) {
      if (this.t[k] > this.life[k]) { ages[k] = 2; continue }
      this.t[k] += dt
      const j = k * 3
      flow(this.p[j], this.p[j + 1], this.p[j + 2], t, k * 0.013, tmp)
      this.v[j] = (this.v[j] + tmp.x * turb * dt) * d
      this.v[j + 1] = (this.v[j + 1] + (tmp.y * turb + lift) * dt) * d
      this.v[j + 2] = (this.v[j + 2] + tmp.z * turb * dt) * d
      this.p[j] += this.v[j] * dt
      this.p[j + 1] += this.v[j + 1] * dt
      this.p[j + 2] += this.v[j + 2] * dt
      ages[k] = this.t[k] / this.life[k]
    }
    this.posAttr.needsUpdate = true
    this.ageAttr.needsUpdate = true
  }

  dispose() { this.points.geometry.dispose(); this.mat.dispose() }
}

export class SmokeSystem {
  constructor({ edges, surface, smokeCount = 520, dustCount = 500 }) {
    this.edges = edges
    this.surface = surface
    this.group = new THREE.Group()
    this.group.name = 'smoke'
    this.t = 0
    this.tmp = new THREE.Vector3()
    this.smokeAccum = 0
    this.dustAccum = 0
    // previous world positions of every emitter for velocities
    this.emitters = edges.concat(surface)
    this.prev = new Float32Array(this.emitters.length * 3)
    this.havePrev = false
    this.cur = new Float32Array(this.emitters.length * 3)

    this.smoke = new Pool(smokeCount, SMOKE_FRAG, {}, 1)
    this.smoke.mat.uniforms.uSize.value = 34
    this.smoke.mat.uniforms.uGrow.value = 2.2
    this.dust = new Pool(dustCount, DUST_FRAG, {}, 2)
    this.dust.mat.uniforms.uSize.value = 2.0
    this.dust.mat.uniforms.uGrow.value = 0.5
    this.group.add(this.smoke.points, this.dust.points)
    this.setLook('apparition', 'dark')
  }

  setLook(style, theme) {
    const l = (LOOKS[style] || LOOKS.apparition)[theme] || LOOKS.apparition.dark
    const su = this.smoke.mat.uniforms
    su.uColA.value.set(l.smoke[0])
    su.uColB.value.set(l.smoke[1])
    this.baseSmoke = l.smoke[2]
    su.uIri.value = l.smoke[3]
    const du = this.dust.mat.uniforms
    du.uColA.value.set(l.dust[0])
    du.uColB.value.set(l.dust[1])
    this.baseDust = l.dust[2]
    for (const m of [this.smoke.mat, this.dust.mat]) { m.blending = l.blending; m.needsUpdate = true }
  }

  /**
   * @param cfg { amount, life, burst (0..1 extra emission e.g. while dissolving), pixelRatio }
   */
  update(dt, wings, cfg) {
    if (dt <= 0) return
    dt = Math.min(dt, 0.05)
    this.t += dt
    const t = this.t
    this.group.visible = cfg.amount > 0
    if (cfg.amount <= 0) return

    // world positions + speed of the emitters
    const local = wings.geometry.attributes.position.array
    const mw = wings.matrixWorld.elements
    const E = this.emitters.length
    const cur = this.cur
    const prev = this.prev
    let speedSum = 0
    for (let e = 0; e < E; e++) {
      const vi = this.emitters[e] * 3
      const x = local[vi], y = local[vi + 1], z = local[vi + 2]
      const j = e * 3
      cur[j] = mw[0] * x + mw[4] * y + mw[8] * z + mw[12]
      cur[j + 1] = mw[1] * x + mw[5] * y + mw[9] * z + mw[13]
      cur[j + 2] = mw[2] * x + mw[6] * y + mw[10] * z + mw[14]
      if (this.havePrev && (e & 7) === 0) {
        const dx = cur[j] - prev[j], dy = cur[j + 1] - prev[j + 1], dz = cur[j + 2] - prev[j + 2]
        speedSum += Math.sqrt(dx * dx + dy * dy + dz * dz) / dt
      }
    }
    const avgSpeed = this.havePrev ? speedSum / Math.ceil(E / 8) : 0
    const motion = THREE.MathUtils.clamp(0.4 + avgSpeed * 0.25, 0.4, 2)
    const burst = 1 + cfg.burst * 4

    const emit = (pool, count, life, inherit, jitter, edgeBias) => {
      for (let i = 0; i < count; i++) {
        const fromEdge = Math.random() < edgeBias
        const e = fromEdge || !this.surface.length
          ? (Math.random() * this.edges.length) | 0
          : this.edges.length + ((Math.random() * this.surface.length) | 0)
        const j = e * 3
        let vx = 0, vy = 0, vz = 0
        if (this.havePrev) {
          vx = (cur[j] - prev[j]) / dt * inherit
          vy = (cur[j + 1] - prev[j + 1]) / dt * inherit
          vz = (cur[j + 2] - prev[j + 2]) / dt * inherit
        }
        pool.spawn(
          cur[j], cur[j + 1], cur[j + 2],
          vx + (Math.random() - 0.5) * jitter, vy + (Math.random() - 0.5) * jitter, vz + (Math.random() - 0.5) * jitter,
          life * (0.6 + Math.random() * 0.8),
        )
      }
    }

    this.smokeAccum += 40 * cfg.amount * motion * burst * dt
    const ns = this.smokeAccum | 0
    this.smokeAccum -= ns
    emit(this.smoke, ns, cfg.life, 0.12, 0.25, 0.6)

    this.dustAccum += 70 * cfg.amount * motion * burst * dt
    const nd = this.dustAccum | 0
    this.dustAccum -= nd
    emit(this.dust, nd, cfg.life * 0.8, 0.15, 0.35, 0.5)

    prev.set(cur)
    this.havePrev = true

    this.smoke.step(dt, t, 0.35, 0.18, 0.9, this.tmp)
    this.dust.step(dt, t, 0.6, 0.25, 1.2, this.tmp)
    for (const [pool, base] of [[this.smoke, this.baseSmoke], [this.dust, this.baseDust]]) {
      const u = pool.mat.uniforms
      u.uTime.value = t
      u.uPixelRatio.value = cfg.pixelRatio
      u.uOpacity.value = base * Math.min(cfg.amount, 1.5)
    }
  }

  dispose() { this.smoke.dispose(); this.dust.dispose() }
}

/**
 * Emitter vertices from the texture alpha (the wing outline lives in the texture; the mesh is
 * a subdivided plane): `edges` on the outline, `surface` a sample of the wing interior.
 */
export function findEmitters(geometry, image) {
  const uv = geometry.attributes.uv.array
  const n = uv.length / 2
  const W = image.width
  const H = image.height
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(image, 0, 0)
  const data = ctx.getImageData(0, 0, W, H).data
  const alphaAt = (u, v) => {
    const x = Math.min(W - 1, Math.max(0, (u * W) | 0))
    const y = Math.min(H - 1, Math.max(0, (v * H) | 0)) // glTF UVs: v=0 is the top row
    return data[(y * W + x) * 4 + 3] / 255
  }
  const r = 0.012
  const offsets = []
  for (let k = 0; k < 8; k++) offsets.push([Math.cos((k / 8) * Math.PI * 2) * r, Math.sin((k / 8) * Math.PI * 2) * r])

  const edges = []
  const surface = []
  for (let i = 0; i < n; i++) {
    const u = uv[i * 2]
    const v = uv[i * 2 + 1]
    if (alphaAt(u, v) < 0.5) continue
    if (Math.abs(u - 0.5) < 0.05) continue // body strip
    let edge = false
    for (const [ox, oy] of offsets) if (alphaAt(u + ox, v + oy) < 0.5) { edge = true; break }
    if (edge) edges.push(i)
    else if ((i & 3) === 0) surface.push(i)
  }
  return { edges, surface }
}
