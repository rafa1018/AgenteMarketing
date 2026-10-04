import { MotionConfig } from 'motion/react'
import { useState } from 'react'
import { BootSequence } from '@/components/layout/BootSequence'
import { Background } from '@/components/layout/Background'
import { ScrollRail } from '@/components/layout/ScrollRail'
import { Navbar } from '@/components/navigation/Navbar'
import { Cursor } from '@/components/ui/Cursor'
import { MusicToggle } from '@/components/ui/MusicToggle'
import { SectionTransition } from '@/components/animations'
import { Hero } from '@/components/sections/Hero'
import { Manifesto } from '@/components/sections/Manifesto'
import { About } from '@/components/sections/About'
import { Evolution } from '@/components/sections/Evolution'
import { Experience } from '@/components/sections/Experience'
import { Stack } from '@/components/sections/Stack'
import { Method } from '@/components/sections/Method'
import { Projects } from '@/components/sections/Projects'
import { Architecture } from '@/components/sections/Architecture'
import { Certifications } from '@/components/sections/Certifications'
import { CurrentFocus } from '@/components/sections/CurrentFocus'
import { Contact } from '@/components/sections/Contact'
import { Footer } from '@/components/sections/Footer'
import { useReducedMotionPref } from '@/hooks/useMediaQuery'
import { useT } from '@/i18n'
import { ui } from '@/i18n/ui'

export default function App() {
  const t = useT()
  const reduce = useReducedMotionPref()
  const [booted, setBooted] = useState(false)
  const ready = booted || reduce
  const next = (label: Parameters<typeof t>[0]) => t(label).toUpperCase()

  return (
    <MotionConfig reducedMotion="user">
      {!reduce && !booted && <BootSequence onDone={() => setBooted(true)} />}
      <Background />
      <Cursor />
      <Navbar visible={ready} />
      <ScrollRail />
      <MusicToggle visible={ready} />

      {/* overflow-x: clip (not hidden) keeps position: sticky working */}
      <main className="overflow-x-clip">
        <Hero ready={ready} />
        <Manifesto />
        <About />
        <SectionTransition index="02" next={next(ui.evolution.kicker)} />
        <Evolution />
        <SectionTransition index="03" next={next(ui.nav.experience)} />
        <Experience />
        <SectionTransition index="04" next={next(ui.nav.stack)} />
        <Stack />
        <SectionTransition index="05" next={next(ui.method.kicker)} />
        <Method />
        <SectionTransition index="06" next={next(ui.nav.projects)} />
        <Projects />
        <SectionTransition index="07" next={next(ui.nav.architecture)} />
        <Architecture />
        <Certifications />
        <CurrentFocus />
        <SectionTransition index="10" next={next(ui.nav.contact)} />
        <Contact />
      </main>
      <Footer />
    </MotionConfig>
  )
}
