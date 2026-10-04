# rafaelpedraza.dev

Personal site of **Rafael Pedraza** — Software Engineer · AI-Assisted Development · Software Architecture.

React 19 · TypeScript · Vite · Tailwind CSS v4 · Motion · Lucide. 100 % static: no backend, no database.

## Commands

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # type-check + production build → dist/
npm run preview   # serve dist/ locally
npm run images    # regenerate optimized photos, OG image and favicons
```

## Deploy to Hostinger

1. `npm run build`
2. Upload the **contents** of `dist/` (not the folder itself) to `public_html/` using the File Manager or FTP.
3. `dist/.htaccess` is included: it forces HTTPS, enables compression and long-term caching for hashed assets.

## Contact form → Telegram + visit counter (PHP)

Hostinger runs PHP, so `public/api/` holds two tiny endpoints that are deployed with the site:

| Endpoint | Purpose |
| --- | --- |
| `api/contact.php` | Validates the form (name, phone, subject, message) and forwards it to your Telegram chat |
| `api/visits.php` | Visit counter — counts each visitor once every 12 h, ignores bots |

- **Secrets live only in `public/api/config.php`** (bot token + chat id). It is in `.gitignore`;
  `config.example.php` is the template. The token is never sent to the browser.
- Anti-spam: hidden honeypot field, minimum fill time, per-IP + global rate limit, origin check.
  Your email is no longer published anywhere on the site.
- Runtime data (`api/data/*.json`) is private (`.htaccess` deny). On Hostinger the `api/data`
  folder must be writable (default permissions work).

**Local development:** run both servers — Vite proxies `/api` to PHP:

```bash
npm run api   # PHP built-in server on :8000 (needs php in PATH, e.g. C:\xampp\php)
npm run dev
```

Local data is written to `.api-data/` (outside `public/`, never deployed).

**Rotate the bot token** if it was ever shared: @BotFather → `/revoke`, then update `config.php`.

## Background music

Place your track at `public/audio/background.mp3`. Music is **on by default** at 80 % volume (fades in, loops,
pauses when the tab is hidden). Browsers block audible autoplay until the visitor interacts, so it starts
immediately when allowed, otherwise on the first click / tap / key. The bottom-right button pauses it (remembered)
and shows a volume slider on hover. Default volume: `DEFAULT_VOLUME` in `src/components/ui/MusicToggle.tsx`.

## Languages (ES / EN)

Spanish is the default; the ES/EN switch in the navbar remembers the choice (`localStorage`).
Every visible text is written as `{ es: '...', en: '...' }`:

- Interface copy (buttons, section titles): `src/i18n/ui.ts`
- Content: the files in `src/data/`

## Editing content (no component changes needed)

| File | What it controls |
| --- | --- |
| `src/data/profile.ts` | Name, roles, phrases, photo, links (email, LinkedIn, GitHub, WhatsApp, CV), About text, indicators |
| `src/data/experience.ts` | Professional experience timeline + education |
| `src/data/projects.ts` | Selected projects (problem / solution / optional `results`) |
| `src/data/technologies.ts` | Technology stack, grouped by category |
| `src/data/journey.ts` | My Evolution stages, "How I work" process nodes, system status |
| `src/data/architecture.ts` | Architecture diagrams (nodes + edges) and principles |
| `src/data/certifications.ts` | Certifications |
| `src/data/navigation.ts` | Navbar items and the left progress rail |

**Placeholders:** any value written like `[ADD GITHUB URL]` is treated as pending — buttons render as a disabled
"pending" pill and links are never generated. Currently pending:

- `profile.links.github` → `[ADD GITHUB URL]`

## Photo

- Source: `public/images/rafael-pedraza-v2.png` (transparent cut-out; falls back to `rafael-pedraza.png`).
- `npm run images` produces `rafael-pedraza-480.webp`, `-760.webp`, `-760.jpg`, `-face.webp`, `og-image.jpg`
  and the favicons. The face is never altered.
- In the hero the cut-out only fades at the bottom (`.portrait-cutout`); no light is applied over the photo.

## CV

`public/cv/Rafael-Pedraza-CV.pdf` is served by every "Download CV" button. Replace the file to update it
(note: it is public once deployed — it currently includes your phone number and email).

## Structure

```
src/
  components/
    animations/   FadeIn, RevealText, ScrollReveal, Parallax, AnimatedLine, AnimatedCounter,
                  MagneticButton, TiltCard, SectionTransition, TechNode, ArchitectureDiagram
    layout/       BootSequence, Background, ScrollRail
    navigation/   Navbar (desktop + mobile menu)
    sections/     Hero, Manifesto, About, Evolution, Experience, Stack, Method,
                  Projects, Architecture, Certifications, CurrentFocus, Contact, Footer
    ui/           Button, SectionHeader, Logo, BrandIcons, Cursor, LanguageToggle, WhatsAppButton
  data/           all editable content (bilingual)
  i18n/           language provider + interface copy
  hooks/          useMediaQuery, useActiveSection
  lib/            utils
  styles/         design tokens + base styles
```

## Accessibility & performance

- `prefers-reduced-motion`: boot sequence skipped, sticky scroll scenes replaced by static layouts,
  CSS animations neutralised, Motion transforms disabled (`MotionConfig reducedMotion="user"`).
- Scroll effects use Motion values (no React re-render per frame); only `transform` / `opacity` are animated.
- Custom cursor, magnetic buttons and tilt only on fine-pointer devices.
- Self-hosted variable fonts (Sora, Inter, JetBrains Mono) — subsets load on demand via `unicode-range`.
