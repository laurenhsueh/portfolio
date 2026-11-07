import { lazy, Suspense, useEffect, useState } from 'react'
import SafeBoundary from '../SafeBoundary'
import OrbitDesktop from '../desktop/OrbitDesktop'
import WorkSection from './WorkSection'
import GardenSwirl from './GardenSwirl'
import { useScrollToWork } from '../hooks/useScrollToWork'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { useAfterPaint } from '../hooks/useAfterPaint'
import { useNearViewport } from '../hooks/useNearViewport'

const GuideButterfly = lazy(() => import('../butterflies/GuideButterfly'))

/**
 * The home page: the orbit desktop (glass README, neon icons, the blooming ghost butterflies),
 * then Work and the Garden orbit, with a butterfly that lands on the case study in view and
 * then flies down into the Garden. '#/work' lands here and glides down to Work.
 */
/** true a while after `ready` (in an idle moment), for warming up heavy extras ahead of use. */
function useSettled(ready, delay) {
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    if (!ready || settled) return
    let idle = 0
    const timer = setTimeout(() => {
      if ('requestIdleCallback' in window) idle = requestIdleCallback(() => setSettled(true), { timeout: 1500 })
      else setSettled(true)
    }, delay)
    return () => {
      clearTimeout(timer)
      if (idle) cancelIdleCallback(idle)
    }
  }, [ready, settled, delay])
  return settled
}

export default function Home({ route, theme }) {
  useScrollToWork(route, '/work')
  const reduced = useReducedMotion()
  const afterPaint = useAfterPaint()
  // the scroll butterfly (a second WebGL canvas) only starts once Work is about to scroll in
  const nearWork = useNearViewport('work', '50%')
  // …or earlier, in a quiet moment once the load-in animations are done, so its setup never
  // lands mid-scroll
  const settled = useSettled(afterPaint, 3500)

  return (
    <>
      <OrbitDesktop theme={theme} />
      <WorkSection />
      <GardenSwirl reduced={reduced} />
      {afterPaint && (nearWork || settled) && (
        <SafeBoundary>
          <Suspense fallback={null}>
            <GuideButterfly reduced={reduced} theme={theme} />
          </Suspense>
        </SafeBoundary>
      )}
    </>
  )
}
