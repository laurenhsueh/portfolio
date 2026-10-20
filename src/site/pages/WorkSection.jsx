import { PROJECTS } from '../content/projects'

/** Featured work, right below the desktop. A card links once its case study has a page. */
export default function WorkSection() {
  return (
    <section id="work" className="work" aria-labelledby="work-title" tabIndex={-1}>
      <header className="section-head">
        <h2 id="work-title" className="section-title">Work</h2>
      </header>
      <ol className="work-grid">
        {PROJECTS.map((p, i) => {
          const Title = p.href ? 'a' : 'span'
          return (
            <li key={p.id} className="work-card">
              <div className="work-card-bar" aria-hidden="true">
                <span className="work-card-index">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <div className="work-card-body">
                <h3 className="work-card-title">
                  <Title {...(p.href ? { href: p.href } : {})}>{p.title}</Title>
                </h3>
                <p className="work-card-summary">{p.summary}</p>
                {p.role && <p className="work-card-role">{p.role}</p>}
                <ul className="work-card-tags" aria-label="Disciplines">
                  {p.tags.map((t) => <li key={t}>{t}</li>)}
                </ul>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
