import { lazy, Suspense } from 'react'
import SafeBoundary from '../SafeBoundary'
import OrbitDesktop from '../desktop/OrbitDesktop'
import WorkSection from './WorkSection'
import GardenSwirl from './GardenSwirl'
import { useScrollToWork } from '../hooks/useScrollToWork'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { useAfterPaint } from '../hooks/useAfterPaint'

const GuideButterfly = lazy(() => import('../butterflies/GuideButterfly'))

/**
 * The home page: the orbit desktop (glass README, neon icons, the blooming ghost butterflies),
 * then Work and the Garden orbit, with a butterfly that lands on the case study in view and
 * then flies down into the Garden. '#/work' lands here and glides down to Work.
 */
export default function Home({ route, theme }) {
  useScrollToWork(route, '/work')
  const reduced = useReducedMotion()
  const afterPaint = useAfterPaint()

  return (
    <>
      <OrbitDesktop theme={theme} />
      <WorkSection />
      <GardenSwirl reduced={reduced} />
      {afterPaint && (
        <SafeBoundary>
          <Suspense fallback={null}>
            <GuideButterfly reduced={reduced} theme={theme} />
          </Suspense>
        </SafeBoundary>
      )}
    </>
  )
}
