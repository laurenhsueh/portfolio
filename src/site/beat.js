// Finds a song's tempo and where its beats land, from the audio itself, so the butterflies
// dance on the real beat. Runs once per song in the browser (a few hundred ms):
//   1. decode → mono → log energy in ~11 ms hops
//   2. onset strength = how much the energy jumps (half-wave rectified difference)
//   3. tempo = where onsets repeat best (autocorrelation, 60–180 BPM), scoring each tempo
//      together with its double and half so the pick is the one the whole rhythm agrees on
//      (swing and jazz have strong off-beats that fool a plain autocorrelation)
//   4. phase = the offset where a grid at that tempo hits the most onsets
const HOP = 512

export async function analyzeBeat(arrayBuffer) {
  const Ctx = window.AudioContext || window.webkitAudioContext
  const ctx = new Ctx()
  try {
    const audio = await ctx.decodeAudioData(arrayBuffer)
    const sr = audio.sampleRate
    const len = audio.length
    const chans = Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i))

    // log energy per hop
    const n = Math.floor(len / HOP)
    const energy = new Float32Array(n)
    for (let f = 0; f < n; f++) {
      let sum = 0
      for (let i = f * HOP, end = i + HOP; i < end; i++) {
        let s = 0
        for (const ch of chans) s += ch[i]
        sum += s * s
      }
      energy[f] = Math.log(1e-6 + sum / HOP)
    }
    // onset strength, minus a local mean so steady loud parts don't count
    const onset = new Float32Array(n)
    for (let f = 1; f < n; f++) onset[f] = Math.max(0, energy[f] - energy[f - 1])
    const W = 16
    const flux = new Float32Array(n)
    let acc = 0
    for (let f = 0; f < n; f++) {
      acc += onset[f] - (f >= W ? onset[f - W] : 0)
      flux[f] = Math.max(0, onset[f] - acc / Math.min(f + 1, W))
    }

    // tempo: autocorrelation of the zero-mean onset curve at fractional lags
    const fps = sr / HOP
    let mean = 0
    for (let f = 0; f < n; f++) mean += flux[f]
    mean /= n
    const z = flux.map((v) => v - mean)
    const ac = (bpm) => {
      const lag = (60 * fps) / bpm
      let sum = 0
      for (let f = Math.ceil(lag); f < n - 1; f++) {
        const j = f - lag
        const j0 = Math.floor(j)
        const t = j - j0
        sum += z[f] * (z[j0] * (1 - t) + z[j0 + 1] * t)
      }
      return sum
    }
    const score = (bpm) => ac(bpm) + 0.5 * ac(bpm * 2) + 0.5 * ac(bpm / 2)
    let bpm = 60
    let best = -Infinity
    for (let b = 60; b <= 180; b += 0.5) {
      const sc = score(b)
      if (sc > best) { best = sc; bpm = b }
    }
    // refine to 0.05 BPM around the winner
    for (let b = bpm - 0.5; b <= bpm + 0.5; b += 0.05) {
      const sc = score(b)
      if (sc > best) { best = sc; bpm = b }
    }
    const lag = (60 * fps) / bpm

    // phase: the grid offset that lands on the most onsets
    const steps = Math.ceil(lag)
    let bestOff = 0
    let bestHit = -Infinity
    for (let off = 0; off < steps; off++) {
      let s = 0
      for (let f = off; f < n; f += lag) s += flux[Math.round(f)] ?? 0
      if (s > bestHit) { bestHit = s; bestOff = off }
    }
    return { bpm, offset: bestOff / fps }
  } finally {
    ctx.close()
  }
}
