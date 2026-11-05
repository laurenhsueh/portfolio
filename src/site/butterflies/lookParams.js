// Home-page ghost butterflies, in the Garden butterfly lab's own units (Lauren's picks).
export const BUTTERFLY_LOOK = {
  glow: 0.3,
  halo: 1,
  smoke: 0.1,
}

// Dark-mode render of the home butterflies (DuetStage and the scroll butterfly share it, so the
// hand-off between them is seamless): a faint trail + a wide bloom (./afterimage.js).
export const DARK_BLOOM = {
  life: 0.45,
  blur: 0.35,
  smoke: 0.3,
  flapRate: 0.55,
  bloom: { strength: 0.5, radius: 0.55, threshold: 0.6 },
}
// light mode has no bloom pass: a bigger, denser pink halo stands in for it (plus CSS glow)
export const LIGHT_HALO = { gain: 0.8, size: 7 }
