// Experiments and side projects. Live items link; the rest are listed from
// case-studies/case-study-plan.md ("Playground") and will get pages later.
const ITEMS = [
  { name: 'Butterfly lab', note: 'Shader experiments for my 3D butterfly.', tag: '3D', href: '#/garden/butterfly-lab' },
  { name: 'Soul Cal graphics', note: 'Posters and graphics for my hip-hop dance club.', tag: 'graphics' },
  { name: 'Water polo website', note: 'A website redesign, with before and after.', tag: 'web' },
  { name: 'Robot game', note: 'Concept art for a game.', tag: 'concept' },
]

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
