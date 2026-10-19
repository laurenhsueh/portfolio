import { useEffect, useRef, useState } from 'react'
import PixelIcon from '../PixelIcon'
import { THOUGHTS } from '../thoughts'
import WindowChrome from './WindowChrome'

/** The butterfly jar and the random thought, as items of the desktop icon column. */
export default function Utilities({ butterflies, onToggleButterflies, jarRef }) {
  const [thought, setThought] = useState(null) // index into THOUGHTS, or null when closed
  const order = useRef([])
  const popRef = useRef(null)
  const btnRef = useRef(null)

  const nextThought = () => {
    if (!order.current.length) {
      // shuffle, avoiding a back-to-back repeat across reshuffles
      const idx = THOUGHTS.map((_, i) => i).sort(() => Math.random() - 0.5)
      if (idx[0] === thought && idx.length > 1) idx.push(idx.shift())
      order.current = idx
    }
    setThought(order.current.shift())
  }

  useEffect(() => {
    if (thought === null) return
    const onKey = (e) => { if (e.key === 'Escape') { setThought(null); btnRef.current?.focus() } }
    const onDown = (e) => {
      if (!popRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) setThought(null)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [thought])

  return (
    <>
      <li className="icon-slot">
        <button
          ref={jarRef}
          type="button"
          className={`desktop-file ${butterflies ? 'is-open' : ''}`}
          onClick={onToggleButterflies}
          aria-pressed={butterflies}
          aria-label={butterflies ? 'Butterfly jar: catch the butterflies' : 'Butterfly jar: release the butterflies'}
        >
          <PixelIcon name="jar" size={56} />
          <span className="desktop-file-label">{butterflies ? 'Catch' : 'Release'}</span>
        </button>
      </li>

      <li className="icon-slot">
        <button
          ref={btnRef}
          type="button"
          className={`desktop-file ${thought !== null ? 'is-open' : ''}`}
          onClick={nextThought}
          aria-haspopup="dialog"
          aria-expanded={thought !== null}
          aria-label="Random thought"
        >
          <PixelIcon name="thought" size={56} />
          <span className="desktop-file-label">Thought</span>
        </button>

        {thought !== null && (
          <div ref={popRef} className="thought-pop win" role="dialog" aria-labelledby="thought-title">
            <WindowChrome
              title="thought.txt"
              titleId="thought-title"
              closeLabel="Close thought"
              onClose={() => { setThought(null); btnRef.current?.focus() }}
            />
            <div className="win-body">
              <div className="win-pane">
                <p className="thought-text" aria-live="polite">{THOUGHTS[thought]}</p>
                <div className="win-actions">
                  <button type="button" className="win-button" onClick={nextThought}>another</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </li>
    </>
  )
}
