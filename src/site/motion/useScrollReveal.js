import { useEffect } from 'react'

// One IntersectionObserver for the whole site. Anything with `data-reveal` gets `.is-visible`
// while it's on screen and loses it when it leaves, so items fade in AND out in both scroll
// directions (styles/motion.css does the actual animation). Items that enter together are
// staggered with --reveal-delay. New elements (route changes, lazy content) are picked up by a
// MutationObserver, so components only need to add the attribute.
//
//   data-reveal         fade + small rise
//   data-reveal="fade"  opacity only (for things whose position other code measures, e.g. Work cards)
//   MaskedTitle (view)  the letter-by-letter baseline reveal

const STAGGER_MS = 110 // keep in sync with --reveal-stagger in motion.css

export function useScrollReveal() {
  useEffect(() => {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-visible'))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        const entering = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left)
        entering.forEach((e, i) => {
          e.target.style.setProperty('--reveal-delay', `${i * STAGGER_MS}ms`)
          e.target.classList.add('is-visible')
        })
        entries.forEach((e) => {
          if (!e.isIntersecting) e.target.classList.remove('is-visible')
        })
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    )

    const seen = new WeakSet()
    const scan = (root) => {
      if (!(root instanceof Element)) return
      const els = root.matches('[data-reveal]') ? [root] : []
      els.push(...root.querySelectorAll('[data-reveal]'))
      for (const el of els) {
        if (seen.has(el)) continue
        seen.add(el)
        io.observe(el)
      }
    }
    scan(document.body)
    const mo = new MutationObserver((muts) => {
      for (const m of muts) m.addedNodes.forEach(scan)
    })
    mo.observe(document.body, { childList: true, subtree: true })
    return () => {
      io.disconnect()
      mo.disconnect()
    }
  }, [])
}
