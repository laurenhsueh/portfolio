/**
 * Apple-style title bar: three round buttons on the far left (close in the accent pink, the
 * other two outlined) and the title centred. Only close works; the other two are decoration
 * (hidden from assistive tech).
 */
export default function WindowChrome({ title, titleId, onClose, closeLabel, closeRef }) {
  return (
    <header className="win-bar is-mac">
      <span className="win-buttons">
        <button
          ref={closeRef}
          type="button"
          className="win-btn win-btn-close"
          onClick={onClose}
          aria-label={closeLabel}
        >
          <span aria-hidden="true">×</span>
        </button>
        <span className="win-btn win-btn-min" aria-hidden="true" />
        <span className="win-btn win-btn-max" aria-hidden="true" />
      </span>
      <h2 id={titleId} className="win-title">
        {title}
      </h2>
    </header>
  )
}
