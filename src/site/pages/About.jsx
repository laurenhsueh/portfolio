import { README_TEXT } from '../contact'

export default function About() {
  return (
    <section className="page" aria-labelledby="about-title">
      <h1 id="about-title" className="page-title">About</h1>
      <p className="page-lede">{README_TEXT}</p>
      <p className="page-body">
        I work across product management and design: leading a team of PMs on a school publishing
        platform, building UI/UX for clients, and making graphics with a lot of personality for my
        hip-hop dance club.
      </p>
    </section>
  )
}
