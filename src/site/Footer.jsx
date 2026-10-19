import { CONTACT } from './contact'

/** Plain, readable contact info: no hover-only content, nothing tiny. */
export default function Footer() {
  const rows = [
    CONTACT.email && { label: 'Email', text: CONTACT.email, href: `mailto:${CONTACT.email}` },
    CONTACT.linkedin && { label: 'LinkedIn', text: CONTACT.linkedin.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''), href: CONTACT.linkedin, external: true },
  ].filter(Boolean)

  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <p className="footer-name">Lauren Hsueh</p>
        <dl className="footer-contacts">
          {rows.map((r) => (
            <div key={r.label} className="footer-row">
              <dt>{r.label}</dt>
              <dd>
                <a href={r.href} {...(r.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{r.text}</a>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </footer>
  )
}
