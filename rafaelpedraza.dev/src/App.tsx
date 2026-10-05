import { MotionConfig } from 'motion/react'
import { useState } from 'react'
import { BootSequence } from '@/components/layout/BootSequence'
import { Background } from '@/components/layout/Background'
import { ScrollRail } from '@/components/layout/ScrollRail'
import { Navbar } from '@/components/navigation/Navbar'
import { Cursor } from '@/components/ui/Cursor'
import { MusicToggle } from '@/components/ui/MusicToggle'
import { BackToTop } from '@/components/ui/BackToTop'
import { AutoScroll } from '@/components/ui/AutoScroll'
import { SectionTransition } from '@/components/animations'
import { Hero } from '@/components/sections/Hero'
import { Manifesto } from '@/components/sections/Manifesto'
import { BuildScene } from '@/components/sections/build/BuildScene'
import { About } from '@/components/sections/About'
import { Evolution } from '@/components/sections/Evolution'
import { Experience } from '@/components/sections/Experience'
import { Stack } from '@/components/sections/Stack'
import { Method } from '@/components/sections/Method'
import { Architecture } from '@/components/sections/Architecture'
import { CurrentFocus } from '@/components/sections/CurrentFocus'
import { Contact } from '@/components/sections/Contact'
import { Footer } from '@/components/sections/Footer'
import { useReducedMotionPref } from '@/hooks/useMediaQuery'
import { useSite } from '@/hooks/useSite'
import { useT } from '@/i18n'
import { ui } from '@/i18n/ui'

export default function App() {
  const t = useT()
  const reduce = useReducedMotionPref()
  const [booted, setBooted] = useState(false)
  // intro screen can be turned off from the admin panel (Ajustes); null while the setting loads
  const preloader = useSite()?.preloader ?? null
  const ready = booted || reduce || preloader === false
  const next = (label: Parameters<typeof t>[0]) => t(label).toUpperCase()

  return (
    <MotionConfig reducedMotion="user">
      {!reduce && !booted && preloader === true && <BootSequence onDone={() => setBooted(true)} />}
      {/* a few ms while the setting arrives: plain cover (same color as the intro) so nothing flashes */}
      {!reduce && preloader === null && <div aria-hidden className="fixed inset-0 z-[200] bg-ink" />}
      <Background />
      <Cursor />
      <Navbar visible={ready} />
      <ScrollRail />
      {/* bottom-right dock: back-to-top stacks above the music button (and takes its place if music is off) */}
      <div className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-2.5 sm:right-6 sm:bottom-6">
        <BackToTop />
        <AutoScroll visible={ready} />
        <MusicToggle visible={ready} />
      </div>

      {/* overflow-x: clip (not hidden) keeps position: sticky working */}
      <main className="overflow-x-clip">
        <Hero ready={ready} />
        <Manifesto />
        <BuildScene />
        <About />
        <SectionTransition index="02" next={next(ui.evolution.kicker)} />
        <Evolution />
        <SectionTransition index="03" next={next(ui.nav.experience)} />
        <Experience />
        <SectionTransition index="04" next={next(ui.nav.stack)} />
        <Stack />
        <SectionTransition index="05" next={next(ui.method.kicker)} />
        <Method />
        <SectionTransition index="06" next={next(ui.nav.architecture)} />
        <Architecture />
        <CurrentFocus />
        <SectionTransition index="08" next={next(ui.nav.contact)} />
        <Contact />
      </main>
      <Footer />
    </MotionConfig>
  )
}
