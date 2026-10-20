import { useEffect } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
//  Butterfly perches: the reusable "land → fly off" interaction.
//  Any element can register itself as a perch. While it is `present`, the butterfly
//  assigned to that perch flies in and lands on it (wings resting, barely flapping);
//  when it goes away (closed, hidden) the butterfly takes off and flies away, and it
//  comes back to land when the element returns.
//
//    usePerch('readme', ref, isOpen)   // in the component that owns the element
//    ROLE_CFG.perch.perchId = 'readme' // the butterfly role that uses it (see motion.js)
//
//  A hovering butterfly can also `follow` a perch: it keeps a home spot while the element
//  is present and drifts to an alternate spot (e.g. into the space the element leaves
//  behind) while it's away. See ROLE_CFG.hover in motion.js.
//
//  `spot` says where on the element to land: { x, y } as fractions of its box, where
//  y = 0 is its top edge. `facing` is 'left' | 'right'.
// ─────────────────────────────────────────────────────────────────────────────
const perches = new Map()

export function getPerch(id) { return perches.get(id) }

export function usePerch(id, ref, present, { spot = { x: 0.86, y: 0 }, facing = 'left' } = {}) {
  useEffect(() => {
    perches.set(id, { el: ref.current, present, spot, facing })
  }, [id, ref, present, spot.x, spot.y, facing]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => perches.delete(id), [id])
}
