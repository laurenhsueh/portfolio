import { useEffect } from 'react'
import DesktopHero from '../desktop/DesktopHero'
import WorkSection from '../WorkSection'

export default function Home({ route, theme }) {
  // '#/work' lands on the home page and glides down to the Work section
  useEffect(() => {
    if (route !== '/work') return
    const el = document.getElementById('work')
    if (!el) return
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' })
      el.focus({ preventScroll: true })
    })
  }, [route])

  return (
    <>
      <DesktopHero theme={theme} />
      <WorkSection />
    </>
  )
}
