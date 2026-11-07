/**
 * Text that rises out of a mask at its baseline, one letter at a time.
 *
 *   mode 'load'  plays once when the page loads (CSS animation, starts on first paint)
 *   mode 'view'  plays when it scrolls into view and resets when it leaves, so it plays again
 *                (driven by the shared observer in ./useScrollReveal.js through `data-reveal`)
 *
 * `from` offsets the letter index, so two pieces (e.g. "Lauren" + "Hsueh") stagger as one.
 * Screen readers get the plain text; the letter spans are hidden from them.
 * Timings live in styles/motion.css (--mt-*).
 */
export default function MaskedTitle({ text, mode = 'view', from = 0 }) {
  // words stay unbroken (each letter is an inline-block, which would otherwise allow a line
  // break between any two letters); lines can still wrap at the spaces
  let i = from
  const words = text.split(' ').map((w) => [...w].map((ch) => ({ ch, i: i++ })))
  return (
    <span className="mt" data-mask={mode} {...(mode === 'view' ? { 'data-reveal': '' } : {})}>
      <span className="sr-only">{text}</span>
      <span className="mt-letters" aria-hidden="true">
        {words.map((word, w) => (
          <span key={w}>
            {w > 0 && ' '}
            <span className="mt-word">
              {word.map(({ ch, i }) => (
                <span key={i} className="mt-char">
                  <span className="mt-inner" style={{ '--i': i }}>
                    {ch}
                  </span>
                </span>
              ))}
            </span>
          </span>
        ))}
      </span>
    </span>
  )
}
