import { useEffect, useRef } from 'react'
import { README_TEXT } from '../content/contact'
import WindowChrome from './WindowChrome'

/** The README "application" window. Open on first load; × closes it, the desktop icon reopens it. */
export default function ReadmeWindow({ open, onClose }) {
  const closeRef = useRef(null)
  const firstRender = useRef(true)

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    if (open) closeRef.current?.focus({ preventScroll: true })
  }, [open])

  return (
    <section
      className={`readme-window win ${open ? 'is-open' : ''}`}
      aria-labelledby="readme-title"
      aria-hidden={!open}
      inert={open ? undefined : ''}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
    >
      <WindowChrome title="README" titleId="readme-title" onClose={onClose} closeLabel="Close README" closeRef={closeRef} />
      <div className="win-body">
        <div className="win-pane">
          <p className="readme-text">{README_TEXT}</p>
        </div>
      </div>
    </section>
  )
}
