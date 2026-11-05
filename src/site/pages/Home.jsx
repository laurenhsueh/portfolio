import { Component, lazy, Suspense } from 'react'
import OrbitDesktop from '../desktop/OrbitDesktop'
import WorkSection from './WorkSection'
import GardenSwirl from './GardenSwirl'
import { useScrollToWork } from '../hooks/useScrollToWork'
import { useReducedMotion } from '../hooks/useReducedMotion'

const GuideButterfly = lazy(() => import('../butterflies/GuideButterfly'))

/** If WebGL or the model fails, the page just goes on without the scroll butterfly. */
class Boundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? null : this.props.children }
}

/**
 * The home page: the orbit desktop (glass README, neon icons, the blooming ghost butterflies),
 * then Work and the Garden orbit, with a butterfly that lands on the case study in view and
 * then flies down into the Garden. '#/work' lands here and glides down to Work.
 */
export default function Home({ route, theme }) {
  useScrollToWork(route, '/work')
  const reduced = useReducedMotion()

  return (
    <>
      <OrbitDesktop theme={theme} />
      <WorkSection />
      <GardenSwirl reduced={reduced} />
      <Boundary>
        <Suspense fallback={null}>
          <GuideButterfly reduced={reduced} theme={theme} />
        </Suspense>
      </Boundary>
    </>
  )
}
