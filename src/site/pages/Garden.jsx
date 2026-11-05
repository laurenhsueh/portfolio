import { GARDEN_ITEMS as ITEMS } from '../content/garden'

export default function Garden() {
  return (
    <section className="page" aria-labelledby="garden-title">
      <h1 id="garden-title" className="page-title">Garden</h1>
      <p className="page-lede">Experiments, explorations, unfinished ideas and playful work outside my main portfolio.</p>
      <ul className="file-list">
        {ITEMS.map((it) => (
          <li key={it.name} className="file-row">
            {it.href ? (
              <a className="file-row-name" href={it.href}>{it.name}</a>
            ) : (
              <span className="file-row-name">{it.name}</span>
            )}
            <span className="file-row-note">{it.note}</span>
            <span className="file-row-tag">{it.href ? it.tag : 'soon'}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
