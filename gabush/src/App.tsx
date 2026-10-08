import { MotionConfig } from 'motion/react'
import { useCallback, useState } from 'react'
import { Intro } from '@/components/layout/Intro'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { WhatsappFab } from '@/components/layout/WhatsappFab'
import { MusicToggle } from '@/components/ui/MusicToggle'
import { useSite } from '@/lib/site'
import { ScrollProgress } from '@/components/animations'
import { Hero } from '@/components/sections/Hero'
import { About } from '@/components/sections/About'
import { Areas } from '@/components/sections/Areas'
import { Programs } from '@/components/sections/Programs'
import { Steps } from '@/components/sections/Steps'
import { Gallery } from '@/components/sections/Gallery'
import { Feed } from '@/components/sections/Feed'
import { CtaBand, Faq, Testimonials } from '@/components/sections/Extras'
import { Contact } from '@/components/sections/Contact'
import { Calendar } from '@/components/sections/Calendar'
import { FamilyApp } from '@/components/sections/FamilyApp'
import { AdminLayer } from '@/components/admin/AdminUI'
import { useReducedMotionPref } from '@/hooks/useMediaQuery'
import { useT } from '@/i18n'
import { ui } from '@/i18n/ui'

const INTRO_KEY = 'gb-intro-seen'
function introSeen() {
  try {
    return sessionStorage.getItem(INTRO_KEY) === '1'
  } catch {
    return false
  }
}

export default function App() {
  const t = useT()
  const reduce = useReducedMotionPref()
  const [introDone, setIntroDone] = useState(introSeen)
  // the intro can be turned off in the admin panel (Sitio web); null while that setting loads
  const site = useSite()
  const preloader = site?.preloader ?? null
  const ready = introDone || reduce || preloader === false
  const finishIntro = useCallback(() => {
    setIntroDone(true)
    try {
      sessionStorage.setItem(INTRO_KEY, '1')
    } catch {
      /* ignore */
    }
  }, [])

  return (
    <MotionConfig reducedMotion="user">
      <a href="#programas" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:rounded-full focus:bg-ink focus:px-5 focus:py-3 focus:text-white">
        {t(ui.nav.skip)}
      </a>
      {!ready && preloader === true && <Intro seconds={site?.preloaderSeconds ?? 2.5} onDone={finishIntro} />}
      {/* a moment while the setting arrives: plain sky cover (same as the intro) so nothing flashes */}
      {!ready && preloader === null && <div aria-hidden className="fixed inset-0 z-[100] bg-[#bfe8ff]" />}
      <Navbar visible={ready} />
      {ready && <ScrollProgress />}

      {/* overflow-x: clip (not hidden) keeps position: sticky working */}
      <main className="overflow-x-clip">
        <Hero ready={ready} />
        <About />
        <Areas />
        <Programs />
        <Feed />
        <Steps />
        <Gallery />
        <Calendar />
        <FamilyApp />
        <Testimonials />
        <CtaBand />
        <Faq />
        <Contact />
      </main>
      <Footer />
      <WhatsappFab visible={ready} />
      <MusicToggle visible={ready} />
      <AdminLayer />
    </MotionConfig>
  )
}
