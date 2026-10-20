/**
 * Retro pink OS title bar: title on the left, three square window buttons on the right.
 * Only close works; minimize and maximize are decoration (hidden from assistive tech).
 */
export default function WindowChrome({ title, titleId, onClose, closeLabel, closeRef }) {
  return (
    <header className="win-bar">
      <h2 id={titleId} className="win-title">{title}</h2>
      <span className="win-buttons">
        <span className="win-btn win-btn-min" aria-hidden="true" />
        <span className="win-btn win-btn-max" aria-hidden="true" />
        <button ref={closeRef} type="button" className="win-btn win-btn-close" onClick={onClose} aria-label={closeLabel}>
          <span aria-hidden="true">×</span>
        </button>
      </span>
    </header>
  )
}
