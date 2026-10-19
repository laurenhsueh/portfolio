import { Component, lazy, Suspense, useMemo, useRef, useState } from 'react'
import PixelIcon from '../PixelIcon'
import ReadmeWindow from './ReadmeWindow'
import Utilities from './Utilities'
import ContactDock from './ContactDock'
import PixelButterflies from './PixelButterflies'
import { useReducedMotion } from '../useReducedMotion'
import { usePerch } from '../perch'
import LightOverlay from './LightOverlay'

// The ghost apparition butterflies (three.js) load only when butterfly mode is first opened.
const GhostButterflies = lazy(() => import('./GhostButterflies'))


function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

/** If WebGL is missing or the 3D butterflies fail, fall back to the pixel ones. */
class GhostBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

/**
 * The landing "desktop" (Lauren's layout): name top-left, README window top-right, a
 * column of desktop icons on the right edge (Work, README, butterfly jar, random thought),
 * and the contact dock bottom-left. On phones it stacks: name, icon row, window, dock.
 */
export default function DesktopHero({ theme }) {
  const [readmeOpen, setReadmeOpen] = useState(true)
  const [butterflies, setButterflies] = useState(true) // out by default
  const reduced = useReducedMotion()
  const webgl = useMemo(hasWebGL, [])
  const heroRef = useRef(null)
  const jarRef = useRef(null)
  const iconRef = useRef(null)
  const windowRef = useRef(null)
  // the top butterfly lands on the README's title bar, and flies off when it closes
  usePerch('readme', windowRef, readmeOpen, { spot: { x: 0.84, y: 0 }, facing: 'left' })

  const closeReadme = () => {
    setReadmeOpen(false)
    iconRef.current?.focus({ preventScroll: true })
  }

  const openWork = (e) => {
    e.preventDefault()
    const el = document.getElementById('work')
    if (!el) return
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
    el.focus({ preventScroll: true })
  }

  return (
    <section ref={heroRef} className="desktop-hero" aria-label="Lauren Hsueh: desktop">
      <div className="hero-name">
        <h1 className="desktop-name">
          <span>LAUREN</span> <span>HSUEH</span>
        </h1>
      </div>

      <div ref={windowRef} className="hero-window">
        <ReadmeWindow open={readmeOpen} onClose={closeReadme} />
      </div>

      <ul className="hero-icons" role="list" aria-label="Desktop">
        <li className="icon-slot">
          <a className="desktop-file" href="#/work" onClick={openWork} aria-label="Work: jump to projects">
            <PixelIcon name="folder" size={56} />
            <span className="desktop-file-label">Work</span>
          </a>
        </li>
        <li className="icon-slot">
          <button
            ref={iconRef}
            type="button"
            className={`desktop-file ${readmeOpen ? 'is-open' : ''}`}
            onClick={() => setReadmeOpen(true)}
            aria-label={readmeOpen ? 'README: about me (open)' : 'Open README: about me'}
          >
            <PixelIcon name="document" size={56} />
            <span className="desktop-file-label">README</span>
          </button>
        </li>
        <Utilities butterflies={butterflies} onToggleButterflies={() => setButterflies((b) => !b)} jarRef={jarRef} />
      </ul>

      <ContactDock />

      <LightOverlay heroRef={heroRef} anchorRef={windowRef} />

      {butterflies && (() => {
        const pixel = <PixelButterflies active areaRef={heroRef} originRef={jarRef} reduced={reduced} />
        return webgl ? (
          <GhostBoundary fallback={pixel}>
            <Suspense fallback={null}>
              <GhostButterflies theme={theme} heroRef={heroRef} reduced={reduced} />
            </Suspense>
          </GhostBoundary>
        ) : pixel
      })()}
    </section>
  )
}
