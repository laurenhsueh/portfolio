import PixelIcon from '../PixelIcon'
import { CONTACT } from '../content/contact'

const ITEMS = [
  { key: 'linkedin', icon: 'linkedin', label: 'LinkedIn', href: CONTACT.linkedin, external: true, a11y: 'LinkedIn profile' },
  { key: 'email', icon: 'email', label: 'Email', href: CONTACT.email && `mailto:${CONTACT.email}`, a11y: `Email ${CONTACT.email}` },
].filter((it) => it.href)

/** Contact icons as desktop-file list items (also reused in the phone icon row). */
export function ContactItems({ className = '' }) {
  return ITEMS.map((it) => (
          <li key={it.key} className={`icon-slot ${className}`}>
            <a
              className="desktop-file"
              href={it.href}
              aria-label={it.a11y}
              {...(it.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
              <PixelIcon name={it.icon} size={56} />
              <span className="desktop-file-label">{it.label}</span>
            </a>
          </li>
  ))
}

/** Contact icons, styled exactly like the desktop files: pixel icon + label underneath. */
export default function ContactDock() {
  return (
    <nav className="contact-dock" aria-label="Contact">
      <ul>
        <ContactItems />
      </ul>
    </nav>
  )
}
