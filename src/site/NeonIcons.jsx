// Icon set F from the Figma icon board: thin neon-pink line icons, each with a small line
// butterfly landing on it. 64-unit artboards; colour (currentColor) and glow come from CSS
// (.neon-icon).
const STROKE = { stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }
const WING = 'M32 30C26 16 12 12 10 22c-1 8 9 11 20 11-9 3-14 10-10 14 5 5 10-4 12-10 2 6 7 15 12 10 4-4-1-11-10-14 11 0 21-3 20-11-2-10-16-6-22 8z'

/** A line butterfly centred at (cx, cy), `s` × the 64-unit original (stroke kept at 2.2). */
function Butterfly({ cx, cy, s }) {
  const w = 2.2 / s
  return (
    <g className="neon-butterfly" transform={`translate(${cx - 32 * s} ${cy - 31 * s}) scale(${s})`}>
      <path d={WING} stroke="currentColor" strokeWidth={w} strokeLinejoin="round" fill="none" />
      <path d="M32 29v13M32 27c-1-5-4-8-7-9M32 27c1-5 4-8 7-9" stroke="currentColor" strokeWidth={w} strokeLinecap="round" fill="none" />
    </g>
  )
}

function Svg({ size = 60, className = '', children }) {
  return (
    <svg className={`neon-icon ${className}`} width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
      {children}
    </svg>
  )
}

/** Just the line butterfly, filling the artboard (the Work section's active progress dot). */
export function ButterflyIcon(props) {
  return (
    <Svg {...props}>
      <Butterfly cx={32} cy={32} s={1} />
    </Svg>
  )
}

/** README: a document with a folded corner (not on the Figma board; drawn to match the set). */
export function ReadmeIcon(props) {
  return (
    <Svg {...props}>
      <path d="M16 8h21l13 13v31a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z" {...STROKE} />
      <path d="M37 8v13h13" {...STROKE} strokeOpacity="0.5" />
      <path d="M20 31h22M20 38h22M20 45h14" {...STROKE} strokeOpacity="0.7" />
      <Butterfly cx={22} cy={8} s={0.32} />
    </Svg>
  )
}

export function DanceIcon(props) {
  return (
    <Svg {...props}>
      <g className="neon-record">
        <circle cx="30" cy="36" r="21" {...STROKE} />
        <circle cx="30" cy="36" r="13" {...STROKE} strokeOpacity="0.4" />
        <circle cx="30" cy="36" r="4.5" fill="#DB5B90" />
        {/* a glint that only shows while the record spins, so the spin is visible */}
        <path className="neon-glint" d="M37 22.5a14 14 0 0 1 6 5" {...STROKE} strokeOpacity="0.7" />
      </g>
      <path d="M44 21c1.5-2 3-3.5 4.5-5" {...STROKE} strokeDasharray="1 4" />
      <Butterfly cx={52} cy={11} s={0.34} />
    </Svg>
  )
}

/**
 * Theme toggle (taskbar): a crescent moon and a sun. No little butterfly: at nav-bar size it
 * would be a smudge. Both are drawn optically centred on (32, 32).
 */
export function MoonIcon(props) {
  return (
    <Svg {...props}>
      <path d="M38 10a23 23 0 1 0 16 36A19 19 0 0 1 38 10z" {...STROKE} transform="translate(-2 2)" />
    </Svg>
  )
}

export function SunIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="32" cy="32" r="11" {...STROKE} />
      <path d="M32 8v6M32 50v6M8 32h6M50 32h6M15 15l4.2 4.2M44.8 44.8L49 49M15 49l4.2-4.2M44.8 19.2L49 15" {...STROKE} strokeOpacity="0.75" />
    </Svg>
  )
}

export function LinkedInIcon(props) {
  return (
    <Svg {...props}>
      <rect x="8" y="10" width="46" height="46" rx="11" {...STROKE} />
      <path d="M20 30v15M29 45V30M29 36c0-4 3-6 6-6s6 2 6 6v9" {...STROKE} />
      <circle cx="20" cy="22" r="2.4" fill="currentColor" />
      <Butterfly cx={53} cy={10} s={0.32} />
    </Svg>
  )
}

export function EmailIcon(props) {
  return (
    <Svg {...props}>
      <rect x="8" y="18" width="48" height="33" rx="6" {...STROKE} />
      <path d="M10 21l22 16 22-16" {...STROKE} />
      <Butterfly cx={32} cy={11} s={0.34} />
    </Svg>
  )
}

