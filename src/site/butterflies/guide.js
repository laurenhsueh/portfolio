// Shared state between the Work section, the Garden orbit and the scroll butterfly
// (GuideButterfly.jsx), so the three stay in step without React re-renders every frame.
//   active   which Work card is in view (WorkSection writes it; the dots and the butterfly read it)
//   arrived  the butterfly has landed in the Garden bubble (GardenSwirl fades its pieces in)
//   enRoute  it's flying to the bubble right now (GardenSwirl holds its fallback reveal a little)
//   heroEl / hero / heroHidden   the hero's big butterfly: its canvas, its page position and
//            wingspan (DuetStage writes them), and whether the scroll butterfly has taken it over
const subs = new Set()

export const guide = {
  active: 0,
  arrived: false,
  enRoute: false,
  heroEl: null,
  hero: null,
  heroHidden: false,
  arrive() {
    if (guide.arrived) return
    guide.arrived = true
    subs.forEach((f) => f())
  },
  onArrive(f) {
    subs.add(f)
    return () => subs.delete(f)
  },
}
