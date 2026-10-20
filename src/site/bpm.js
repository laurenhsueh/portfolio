// Tempo per Spotify track ID, for the butterfly dance. Spotify no longer provides BPM, so
// these are added by hand. Songs not listed here dance at DEFAULT_BPM.
// Lauren: replace each `// verify` guess with the real BPM (e.g. from songbpm.com).
export const DEFAULT_BPM = 110

export const BPM = {
  '6O26k1i1HcmtDYX3sjBMAZ': 92, // Heaven, Masego (verify)
  '5kY2DRIom6dcVZbQb1SAX8': 100, // Collide, Justine Skye ft. Tyga (verify)
  '1mOwVgwbD4HWrATknEbCMP': 96, // Lullaby, JayDon & Paradise (verify)
}

export const bpmFor = (id) => BPM[id] ?? DEFAULT_BPM
