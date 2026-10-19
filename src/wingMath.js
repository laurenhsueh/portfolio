// Port of the "Geometry Nodes" tree on the `wings` object in butterflybaked.blend.
//
// Node graph (all in the wings mesh's *local Blender space*, Z-up):
//   t       = SceneTime.Frame / frameDivisor                       (Math: DIVIDE, 3.6)
//   d       = distance( P * (1, yStretch, 1), (0, centerY, 0) )    (Vector Math MULTIPLY + DISTANCE)
//   phase   = t - d * distFalloff                                  (Math SUBTRACT, Math MULTIPLY 0.3)
//   s       = sin(phase)                                           (Math SINE)
//   m       = MapRange(s, -1.4..1  ->  0..1.5, no clamp)           (Map Range)
//   angle   = m * amplitude * (P.x > 0 ? -1 : 1)                   (Compare + Switch + Math MULTIPLY)
//   P'      = rotateAroundY(P, angle)                              (Vector Rotate, Y_AXIS, center 0)
//
// The GLB is Y-up, Blender is Z-up. glTF export maps blender (x, y, z) -> glb (x, z, -y),
// so we convert each vertex into Blender space, run the node math, and convert back.

export const NODE_DEFAULTS = {
  frameDivisor: 3.6, // Math (DIVIDE) second input
  distFalloff: 0.3, // Math.005 multiplier on the distance
  yStretch: 1.5, // Vector Math.001 multiply -> (1, 1.5, 1)
  centerY: -1.5, // Vector Math DISTANCE point -> (0, -1.5, 0)
  mapFromMin: -1.4, // Map Range
  mapFromMax: 1,
  mapToMin: 0,
  mapToMax: 1.5,
  amplitude: 1, // Math.002 multiply (value 1 in the file)
}

export const SCENE = { fps: 24, frameStart: 1, frameEnd: 250 }

/** Per-vertex data that never changes: Blender-space position, distance field, flap side. */
export function precompute(restPositions, p = NODE_DEFAULTS) {
  const n = restPositions.length / 3
  const bx = new Float32Array(n)
  const by = new Float32Array(n)
  const bz = new Float32Array(n)
  const dist = new Float32Array(n)
  const side = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const gx = restPositions[i * 3]
    const gy = restPositions[i * 3 + 1]
    const gz = restPositions[i * 3 + 2]
    bx[i] = gx
    by[i] = -gz
    bz[i] = gy
    side[i] = gx > 0 ? -1 : 1
  }
  const field = { bx, by, bz, dist, side, n }
  updateDistance(field, p)
  return field
}

/** Recompute the distance field (only needed if yStretch / centerY change). */
export function updateDistance(field, p) {
  const { bx, by, bz, dist, n } = field
  for (let i = 0; i < n; i++) {
    const dy = by[i] * p.yStretch - p.centerY
    dist[i] = Math.sqrt(bx[i] * bx[i] + dy * dy + bz[i] * bz[i])
  }
}

/** Evaluate the node tree at `frame`, writing deformed positions (GLB space) into `out`. */
export function evaluateWings(field, frame, p, out) {
  const { bx, by, bz, dist, side, n } = field
  const t = frame / p.frameDivisor
  const inRange = p.mapFromMax - p.mapFromMin || 1e-6
  const outRange = p.mapToMax - p.mapToMin
  for (let i = 0; i < n; i++) {
    const s = Math.sin(t - dist[i] * p.distFalloff)
    const m = (p.mapToMin + ((s - p.mapFromMin) / inRange) * outRange) * p.amplitude
    const a = m * side[i]
    const c = Math.cos(a)
    const sn = Math.sin(a)
    const x = bx[i]
    const z = bz[i]
    const nx = x * c + z * sn
    const nz = -x * sn + z * c
    // back to glTF space: (x, y, z)_glb = (x, z, -y)_blender
    out[i * 3] = nx
    out[i * 3 + 1] = nz
    out[i * 3 + 2] = -by[i]
  }
}
