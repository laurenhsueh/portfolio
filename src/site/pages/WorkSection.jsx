import { useEffect, useRef, useState } from 'react'
import { PROJECTS } from '../content/projects'
import { ButterflyIcon } from '../NeonIcons'
import { guide } from '../butterflies/guide'

/**
 * Featured work: a vertical stack of cards that alternate sides (text | image, then image | text).
 * A rail of dots sticks to the right edge while Work is on screen; the card in view gets the
 * butterfly icon, and clicking a dot jumps to that card. Each card is `data-perch`: the scroll
 * butterfly (butterflies/GuideButterfly.jsx) lands on its top edge, at the corner on the image side.
 */
export default function WorkSection() {
  const [active, setActive] = useState(0)
  const cardRefs = useRef([])

  // the card in view = the one whose centre is nearest the screen's middle
  useEffect(() => {
    let raf = 0
    const measure = () => {
      raf = 0
      const line = window.innerHeight * 0.5
      let best = 0
      let bestD = Infinity
      cardRefs.current.forEach((el, i) => {
        if (!el) return
        const r = el.getBoundingClientRect()
        const d = Math.abs(r.top + r.height / 2 - line)
        if (d < bestD) { bestD = d; best = i }
      })
      guide.active = best
      setActive(best)
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(measure) }
    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  const goTo = (i) => {
    const el = cardRefs.current[i]
    if (!el) return
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' })
  }

  return (
    <section id="work" className="work" aria-labelledby="work-title" tabIndex={-1}>
      <header className="section-head">
        <h2 id="work-title" className="section-title">Work</h2>
      </header>
      <div className="work-body">
        <ol className="work-stack">
          {PROJECTS.map((p, i) => (
            <li key={p.id} className="work-card" data-perch={i} ref={(el) => { cardRefs.current[i] = el }}>
              <div className="work-card-text">
                <h3 className="work-card-title">
                  {p.href ? <a href={p.href}>{p.title}</a> : p.title}
                </h3>
                <p className="work-card-meta">{p.dates}<span className="work-card-sep" aria-hidden="true">|</span><span className="sr-only">, </span>{p.role}</p>
                <p className="work-card-line">{p.line}</p>
              </div>
              <div className="work-card-media">
                {p.image ? <img src={p.image} alt="" loading="lazy" /> : <div className="media-ph" aria-hidden="true" />}
              </div>
            </li>
          ))}
        </ol>
        <div className="work-rail">
          <nav className="work-dots" aria-label="Projects">
            {PROJECTS.map((p, i) => (
              <button
                key={p.id}
                type="button"
                className={`work-dot${i === active ? ' is-active' : ''}`}
                aria-label={`Go to ${p.title}`}
                aria-current={i === active ? 'true' : undefined}
                onClick={() => goTo(i)}
              >
                {i === active ? <ButterflyIcon size={26} /> : <span className="work-dot-pip" />}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </section>
  )
}
