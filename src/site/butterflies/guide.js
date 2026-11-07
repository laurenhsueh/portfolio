// Shared state between the Work section, the Garden orbit and the scroll butterfly
// (GuideButterfly.jsx), so the three stay in step without React re-renders every frame.
//   active   which Work card is in view (WorkSection writes it; the dots and the butterfly read it)
//   arrived  the butterfly is in the Garden bubble (GardenSwirl fades its pieces in, and out
//            again when it leaves)
//   live     the scroll butterfly is running (so the Garden waits for it, with no timed fallback)
//   phase    the big butterfly's clock and wingbeat ({ t, frame }), shared by its two copies (hero
//            canvas and scroll canvas) so a hand-over between them doesn't snap the wings or bob
//   enRoute  it's flying to the bubble right now (GardenSwirl holds its fallback reveal a little)
//   heroEl / hero / heroHidden   the hero's big butterfly: its canvas, its page position and
//            wingspan (DuetStage writes them), and whether the scroll butterfly has taken it over
const subs = new Set()

/** The hand-back crossfade between the scroll butterfly and the hero's (1/s): ≈ 0.4 s. */
export const HANDBACK_RATE = 7

export const guide = {
  active: 0,
  arrived: false,
  enRoute: false,
  live: false,
  phase: null,
  heroEl: null,
  hero: null,
  heroHidden: false,
  arrive() {
    if (guide.arrived) return
    guide.arrived = true
    subs.forEach((f) => f(true))
  },
  leave() {
    if (!guide.arrived) return
    guide.arrived = false
    subs.forEach((f) => f(false))
  },
  /** `f(true)` when the butterfly lands in the Garden, `f(false)` when it flies off. */
  onArrive(f) {
    subs.add(f)
    return () => subs.delete(f)
  },
}
