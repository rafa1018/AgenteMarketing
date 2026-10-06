import { MotionConfig, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { Preloader } from '@/components/layout/Preloader'
import { Background } from '@/components/layout/Background'
import { Navbar } from '@/components/layout/Navbar'
import { BackToTop } from '@/components/ui/BackToTop'
import { Hero } from '@/components/sections/Hero'
import { Platform } from '@/components/sections/Platform'
import { About } from '@/components/sections/About'
import { HowItWorks } from '@/components/sections/HowItWorks'
import { Markets } from '@/components/sections/Markets'
import { Trust } from '@/components/sections/Trust'
import { Pricing } from '@/components/sections/Pricing'
import { Faq } from '@/components/sections/Faq'
import { Footer } from '@/components/sections/Footer'

export default function App() {
  const reduce = useReducedMotion()
  const [loaded, setLoaded] = useState(false)
  const ready = loaded || Boolean(reduce)

  return (
    <MotionConfig reducedMotion="user">
      {!ready && <Preloader onDone={() => setLoaded(true)} />}
      <Background />
      <Navbar />
      <div className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-2.5 sm:right-6 sm:bottom-6">
        <BackToTop />
      </div>
      {/* overflow-x: clip (not hidden) keeps position: sticky working */}
      <main className="overflow-x-clip">
        <Hero ready={ready} />
        <Platform />
        <About />
        <HowItWorks />
        <Markets />
        <Trust />
        <Pricing />
        <Faq />
      </main>
      <Footer />
    </MotionConfig>
  )
}
