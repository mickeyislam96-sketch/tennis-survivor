# Final Serve-ivor — Design System

## Typography (three-font system)
- **Outfit** (sans-serif): body text, navigation, buttons — `--ds-font-sans`
- **Fraunces** (serif): display headings, step card titles, section titles — `--ds-font-display`. Weight 700 for headings, weight 400 italic for accent text (e.g. "Serve-ivor" in logo, italic words in hero).
- **JetBrains Mono** (monospace): eyebrow labels, badges, taglines — `--ds-font-mono`. Weight 600-700, uppercase, letter-spacing 1.3-2.5px.

## Logo treatment
- Nav: tennis ball SVG icon + "Final" in Outfit bold + "Serve-ivor" in Fraunces italic green (#0F4A23)
- Footer (site): same split-font, "Serve-ivor" in Fraunces italic gold (#FFC933) on dark green bg
- Footer (email): "Final" in Outfit bold + "Serve-ivor" in Fraunces italic green (#0F4A23) on light bg
- Tagline: "A tennis survivor pool" in JetBrains Mono uppercase (removed "A game of skill" on 19 Apr)

## Colour palette (from tokens.css)
- Canvas: #FAFAF7 (warm cream background)
- Surface: #FFFFFF
- Primary: #0F4A23 (deep emerald)
- Gold: #FFC933, Gold Ink: #2B1F00
- Accent: #C1572E (terracotta)
- Ink: #141414, Ink Muted: #4A4A46, Ink Soft: #8A8780, Ink Ghost: #BEBAB0

## CTA buttons
- Primary CTA: gold pill — `background: #FFC933; color: #2B1F00; border-radius: 999px`
- Secondary: emerald pill — `background: #0F4A23; color: #FFFFFF; border-radius: 999px`
- Outlined: transparent with border

## Tennis court pattern (hero background)
- SVG `ui-court-backdrop` — 10 solid white lines (2.5px) + 1 dashed net line (1.5px, dash 8px gap 5px)
- Opacity: 0.18, with CSS mask-image gradient (left 35% opacity fading to right 100%)
- Parent: `ui-hero ui-hero--primary` — background-color: #0F4A23
- Email version: `email-court-bg.png` in `frontend/public/` — PNG rendering of the same pattern

## Design tokens file
`frontend/src/styles/tokens.css` — 217 lines, defines all CSS custom properties.

## Email font loading
Google Fonts link tag loading Fraunces (ital 0,700 and 1,400), JetBrains Mono (600, 700), and Outfit (400, 600, 700).
