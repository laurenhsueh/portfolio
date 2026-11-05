// Small math helpers shared by the butterfly code.
export const lerp = (a, b, t) => a + (b - a) * t
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
/** 0 → 1 smoothly as t goes from a to b (smoothstep). */
export const smooth = (a, b, t) => { const u = clamp((t - a) / (b - a), 0, 1); return u * u * (3 - 2 * u) }
/** Ease in-out cubic on 0..1. */
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
/** Interpolate angles the shortest way round. */
export function angLerp(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI
  if (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}
