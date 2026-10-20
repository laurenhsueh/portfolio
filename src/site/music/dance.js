// ─────────────────────────────────────────────────────────────────────────────
//  Dance state, shared between the Dance button (UI + audio) and the butterflies (three.js).
//  Like butterflies/perch.js it's a plain mutable object, so the render loop can read it every frame
//  without React re-renders.
//
//    dance.playing   true while the song is playing
//    dance.bpm       the song's tempo (detected from the audio, see beat.js)
//    dance.offset    seconds into the song where the first beat lands
//    dance.clock     () => the song's current time in seconds (the <audio> element)
//
//  beat = (clock() - offset) × bpm / 60, so the dance follows the audio itself: pauses, loops
//  and seeks stay on the beat.
// ─────────────────────────────────────────────────────────────────────────────
export const dance = { playing: false, bpm: 110, offset: 0, clock: () => 0 }

export function startDance(clock) {
  dance.clock = clock
  dance.playing = true
}

/** Set once the audio has been analysed (until then the default tempo is used). */
export function setBeat(bpm, offset) {
  dance.bpm = bpm
  dance.offset = offset
}

export function stopDance() {
  dance.playing = false
}

/** Beats since the song's first beat (fractional). */
export function beatNow() {
  return ((dance.clock() - dance.offset) * dance.bpm) / 60
}
