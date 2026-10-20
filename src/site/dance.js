// ─────────────────────────────────────────────────────────────────────────────
//  Dance state, shared between the Dance button (UI + Spotify) and the butterflies (three.js).
//  Like perch.js it's a plain mutable object, so the render loop can read it every frame
//  without React re-renders.
//
//    dance.playing   true while a song is playing
//    dance.bpm       the current song's tempo (see bpm.js)
//    dance.t0        performance.now() / 1000 when the current song started (beat 0)
//
//  beat = (now - t0) × bpm / 60. Spotify gives no beat data, so this is a tempo clock.
// ─────────────────────────────────────────────────────────────────────────────
export const dance = { playing: false, bpm: 110, t0: 0 }

/**
 * Start (or keep) dancing at `bpm`, with the song `positionMs` in. Re-syncs the beat clock
 * only when it has drifted, so frequent player updates don't make the beat jitter.
 */
export function startDance(bpm, positionMs = 0) {
  const t0 = performance.now() / 1000 - positionMs / 1000
  if (!dance.playing || dance.bpm !== bpm || Math.abs(t0 - dance.t0) > 0.15) dance.t0 = t0
  dance.bpm = bpm
  dance.playing = true
}

export function stopDance() {
  dance.playing = false
}

/** Beats since the current song started (fractional). */
export function beatNow() {
  return ((performance.now() / 1000 - dance.t0) * dance.bpm) / 60
}
