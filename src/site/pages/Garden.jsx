import { GARDEN_ITEMS as ITEMS } from '../content/garden'
import MaskedTitle from '../motion/MaskedTitle'

export default function Garden() {
  return (
    <section className="page" aria-labelledby="garden-title">
      <h1 id="garden-title" className="page-title">
        <MaskedTitle text="Garden" />
      </h1>
      <p className="page-lede" data-reveal>
        Experiments, explorations, unfinished ideas and playful work outside my main portfolio.
      </p>
      <ul className="file-list">
        {ITEMS.map((it) => (
          <li key={it.name} className="file-row" data-reveal>
            {it.href ? (
              <a className="file-row-name" href={it.href}>
                {it.name}
              </a>
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
