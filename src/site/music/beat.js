// Analyses a song's beat (see beatMath.js): decodes the audio here (the browser decodes off
// the main thread), then runs the maths in a worker so nothing on the page stutters (or here, if
// workers aren't available).
import { findBeat } from './beatMath'

/** `arrayBuffer`: the encoded song (it gets detached by decoding). Resolves { bpm, offset }. */
export async function analyzeBeat(arrayBuffer) {
  const Ctx = window.AudioContext || window.webkitAudioContext
  const ctx = new Ctx()
  let audio
  try {
    audio = await ctx.decodeAudioData(arrayBuffer)
  } finally {
    ctx.close()
  }
  // copies we own, so they can be handed (transferred) to the worker without copying again
  const channels = Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i).slice())
  let worker
  try {
    worker = new Worker(new URL('./beatWorker.js', import.meta.url), { type: 'module' })
  } catch {
    return findBeat(channels, audio.sampleRate) // no workers: do it here
  }
  return inWorker(worker, channels, audio.sampleRate)
}

function inWorker(worker, channels, sampleRate) {
  return new Promise((resolve, reject) => {
    const done = (fn, v) => { worker.terminate(); fn(v) }
    worker.onmessage = ({ data }) => (data.ok ? done(resolve, data.beat) : done(reject, new Error(data.error)))
    worker.onerror = (e) => done(reject, e)
    worker.postMessage({ channels, sampleRate }, channels.map((c) => c.buffer))
  })
}
