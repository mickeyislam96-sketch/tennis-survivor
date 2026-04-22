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

## Navigation patterns
- **Gold pill nav link** (`.ds-nav-pool-pill`): used for "My Pool" link in header nav. Gold background (#FFC933), dark ink (#2B1F00), 999px border-radius, 700 weight, 13px font. Hover darkens to #E6A500. Active state: scale(0.97). Only visible to logged-in users with pool membership.
- **Nav links**: Outfit 14px/600, muted ink (#4A4A46), hover to full ink. Active state: primary green (#0F4A23).
- **Footer links**: same Outfit 14px/600 pattern. Includes: How to play, Terms & conditions, Support.

## Tennis court pattern (hero background)
- SVG `ui-court-backdrop` — 10 solid white lines (2.5px) + 1 dashed net line (1.5px, dash 8px gap 5px)
- Opacity: 0.18, with CSS mask-image gradient (left 35% opacity fading to right 100%)
- Parent: `ui-hero ui-hero--primary` — background-color: #0F4A23
- Email version: `email-court-bg.png` in `frontend/public/` — PNG rendering of the same pattern

## Design tokens file
`frontend/src/styles/tokens.css` — 217 lines, defines all CSS custom properties.

## Email font loading
Google Fonts link tag loading Fraunces (ital 0,700 and 1,400), JetBrains Mono (600, 700), and Outfit (400, 600, 700).

---

## Page-specific UI patterns (session 22 redesign)

### Leaderboard page (Leaderboard.jsx)
**Layout:** Card-based `.lb-card` divs replacing HTML table (one card per player).
**Card structure:**
- Rank number (left, large)
- Avatar initials circle (40px)
- Display name (bold, Outfit)
- Meta line (seed + rounds survived, muted ink)
- Status badge (right side)
- Current round pick (shows player name after lock, "🔒 Hidden" during open window)

**Status badges (brand dark green #0F4A23 background):**
- "Alive" — solid #0F4A23 background, white text, bright green #4ade80 dot
- "Eliminated" — 0.6 opacity card, name struck through in red, red "Eliminated" badge
- "Winner" — gold background card, gold status badge

**Survivometer (new):**
- Progress bar between hint text and card list
- Shows elimination percentage (0-100%)
- Green-to-red gradient fill
- Large percentage number (32pt)
- "X still standing" text below

### Pick History / My Picks page (PickHistory.jsx)
**Layout:** Card-based `.ph-card` divs (one card per pick).
**Card structure:**
- Round badge (top-left, pill shape with round label)
- PlayerAvatar (40px)
- Player name (bold)
- Round label ("R32", "R16", etc.)
- Result pill (right side — "Advanced", "Eliminated", "Pending")

**Status card (new):**
- Alive/eliminated dot indicator
- Headline text ("1 win, 0 losses" or "Eliminated in R64")
- Rounds survived count
- Stat counters on right: won/lost/pending counts

**Result pills:**
- "Advanced" — dark green #0F4A23 background, white text, checkmark SVG
- "Eliminated" — light red background
- "Pending" — grey background with border

**Card background tinting:**
- Won cards — subtle green tint
- Lost cards — 0.65 opacity with struck-through name

### Make a Pick page (PickScreen.jsx)
**Layout:** Card-based `.ps-pcard` divs (one card per player).
**Card structure:**
- Seed badge (top-left, pill shape — gold for top seeds)
- PlayerAvatar (40px)
- Info block:
  - Player name (bold, Outfit)
  - Opponent (italic secondary text, shows "vs [opponent]" or "vs Qualifier")
  - Match start time (small muted text)
- Tags row (custom pills)
- Pick button (gold CTA, right-aligned)

**Tag system (replaces Badge components):**
- "Your pick" — dark green #0F4A23 background, white text, glowing green #4ade80 dot
- "Already used" — grey background
- "Pending" — orange background (indicates waiting on prev round result)

**Card styling:**
- Top seed cards — gold-tinted background with gold seed badge
- Standard cards — white background with silver seed badge

**Mobile responsiveness:**
- Leaderboard: 10px gap, 12px padding, 36px avatars
- Pick history: 12px padding, 10px badge/result text, 92vw modal width
- Pick screen: 10px gap, 12px padding, 32px seed badges, 8px tag text
- All pages: 640px breakpoint, 44px minimum touch targets
