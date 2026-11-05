import { CONTACT } from '../content/contact'
import { LinkedInIcon, EmailIcon } from '../NeonIcons'

const ITEMS = [
  { key: 'linkedin', Icon: LinkedInIcon, label: 'LinkedIn', href: CONTACT.linkedin, external: true, a11y: 'LinkedIn profile' },
  { key: 'email', Icon: EmailIcon, label: 'Email', href: CONTACT.email && `mailto:${CONTACT.email}`, a11y: `Email ${CONTACT.email}` },
].filter((it) => it.href)

/** Contact icons as desktop-file list items: neon icon + label underneath (no phone, by choice). */
export function ContactItems({ className = '' }) {
  return ITEMS.map(({ key, Icon, label, href, external, a11y }) => (
    <li key={key} className={`icon-slot ${className}`}>
      <a
        className="desktop-file"
        href={href}
        aria-label={external ? `${a11y} (opens in a new tab)` : a11y}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        <Icon size={56} />
        <span className="desktop-file-label">{label}</span>
      </a>
    </li>
  ))
}
