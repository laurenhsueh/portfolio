import { useEffect } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
//  Butterfly perches: the reusable "land → fly off" interaction.
//  Any element can register itself as a perch. While it is `present`, the butterfly
//  assigned to that perch flies in and lands on it (wings resting, barely flapping);
//  when it goes away (closed, hidden) the butterfly takes off and flies away, and it
//  comes back to land when the element returns.
//
//    usePerch('readme', ref, isOpen)        // in the component that owns the element
//    <GhostButterfly perch="readme" ... />  // the butterfly that uses it
//
//  A hovering butterfly can also `follow` a perch: it keeps a home spot while the element
//  is present and drifts to an alternate spot (e.g. into the space the element leaves
//  behind) while it's away. See BUTTERFLIES in desktop/GhostButterflies.jsx.
//
//  `spot` says where on the element to land: { x, y } as fractions of its box, where
//  y = 0 is its top edge. `facing` is 'left' | 'right'.
// ─────────────────────────────────────────────────────────────────────────────
const perches = new Map()

export function setPerch(id, perch) { perches.set(id, perch) }
export function clearPerch(id) { perches.delete(id) }
export function getPerch(id) { return perches.get(id) }

/** Land the perch's butterfly / send it off imperatively (same as toggling `present`). */
export function land(id) { const p = perches.get(id); if (p) p.present = true }
export function flyOff(id) { const p = perches.get(id); if (p) p.present = false }

export function usePerch(id, ref, present, { spot = { x: 0.86, y: 0 }, facing = 'left' } = {}) {
  useEffect(() => {
    setPerch(id, { el: ref.current, present, spot, facing })
  }, [id, ref, present, spot.x, spot.y, facing]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => clearPerch(id), [id])
}
