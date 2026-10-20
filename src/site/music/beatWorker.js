// Runs the beat analysis (beatMath.js) off the main thread, so the page and the butterflies
// keep animating while it works.
import { findBeat } from './beatMath'

self.onmessage = ({ data }) => {
  try {
    self.postMessage({ ok: true, beat: findBeat(data.channels, data.sampleRate) })
  } catch (err) {
    self.postMessage({ ok: false, error: String(err) })
  }
}
