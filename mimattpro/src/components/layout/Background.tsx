/** Static ambient background: trading grid, gold and silver light pools, film grain. No animation cost. */
export function Background() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ink">
      <div className="grid-bg absolute inset-0 [mask-image:radial-gradient(ellipse_80%_70%_at_50%_25%,black_30%,transparent_80%)]" />
      <div className="absolute -top-[30vh] left-1/2 h-[80vh] w-[120vw] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgb(22_52_120/0.45),transparent)]" />
      <div className="absolute top-[30vh] -right-[20vw] h-[70vh] w-[60vw] rounded-[50%] bg-[radial-gradient(closest-side,rgb(var(--brand-rgb)/0.09),transparent)]" />
      <div className="absolute bottom-[-20vh] -left-[20vw] h-[70vh] w-[60vw] rounded-[50%] bg-[radial-gradient(closest-side,rgb(198_207_220/0.06),transparent)]" />
      <div
        className="absolute inset-0 opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  )
}
