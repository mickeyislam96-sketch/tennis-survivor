---
name: UI redesign — session 22 (22 April 2026)
description: Card-based layout overhaul for Leaderboard, Pick History, and Make a Pick pages
type: project
sessionId: 22-Apr-2026-session-22
---

## Summary
Session 22 focused on visual audit and design consolidation of three critical pages, followed by a continuation session that implemented the name format change ("Surname, F.") across the bracket and matchup modal, fixed modal overflow, and pushed all changes.

## Changes by Page

### 1. Leaderboard Page (`frontend/src/pages/Leaderboard.jsx` + `.css`)

**Layout change:** Replaced HTML `<table>` with `.lb-card` div-based card layout.

**Card structure:**
- Rank number (left side, large, semi-bold)
- Avatar initials circle (40px, colour by `avatarColour()`)
- Display name (Outfit bold)
- Meta line: seed number + "Rounds survived" (muted ink)
- Status badge (right side of header)
- Current round pick (right column)

**Status badge styling (brand dark green #0F4A23):**
- "Alive" badge: solid #0F4A23 background, white text, bright green #4ade80 dot indicator
- "Eliminated" badge: red text on transparent bg; entire card gets 0.6 opacity; player name struck through in red
- "Winner" badge: gold background, gold text

**New component: Survivometer**
- Positioned between hint text and card list
- Progress bar showing elimination percentage (0-100%)
- Uses **(n-1) denominator** so lone survivor = 100% (max possible eliminations, not total entrants)
- Gradient fill: green (#4ade80) to red (#DC2626)
- Large percentage number (32pt bold)
- Subtext: "X still standing"
- Hidden when totalEntrants < 2 (meaningless with one player)

**Removed:**
- `<Badge>` component import — no longer used on this page
- HTML table structure

**Mobile improvements:**
- Card gap: 10px (was 12px)
- Card padding: 12px
- Avatar size: 36px
- Badge text: 10px (up from 9px for readability)

---

### 2. Pick History / My Picks Page (`frontend/src/pages/PickHistory.jsx` + `.css`)

**Layout change:** Replaced Card+Badge rows with `.ph-card` div-based cards.

**Card structure:**
- Round badge (top-left pill: "R32", "R16", etc.)
- PlayerAvatar (40px)
- Player name (Outfit bold)
- Round label ("Round of 32", "Quarterfinals", etc.) — uses `ROUND_FULL` from roundLabels
- Result pill (right side)

**New component: Status card**
- Shows alive/eliminated dot indicator
- Headline: "2 wins, 0 losses" or "Eliminated in R64"
- Rounds survived count
- Stat counters on right: won count, lost count, pending count

**Result pill styling:**
- "Advanced" — dark green #0F4A23 background, white text, checkmark SVG icon
- "Eliminated" — light red background
- "Pending" — grey background with border

**Card background tinting:**
- Won cards: subtle green background tint
- Lost cards: 0.65 opacity, player name struck through

**Removed:**
- `<Badge>` component import — replaced with custom `.ph-card-result` CSS classes

**Added imports:**
- `ROUND_FULL` from `frontend/src/data/roundLabels.js`
- `avatarColour`, `initials` from `frontend/src/utils/playerImage.js`

**Mobile improvements:**
- Card padding: 12px
- Round badge text: 10px
- Result pill text: 10px
- Modal width: 92vw (constrained for 320px viewports)

---

### 3. Make a Pick Page (`frontend/src/pages/PickScreen.jsx` + `.css`)

**Layout change:** Replaced `<ul>/<li>` player list with `.ps-pcard` card layout.

**Card structure:**
- Seed badge (top-left pill: "1", "32", etc.)
- PlayerAvatar (40px)
- Info block:
  - Player name (Outfit bold)
  - Opponent line (italic, shows "vs [opponent]" or "vs Qualifier")
  - Match start time (small muted text, 11px)
- Tags row (custom `.ps-pcard-tag` pills)
- Pick button (gold CTA, right-aligned)

**Tag system (replaces Badge components):**
- "Your pick" — dark green #0F4A23 background, white text, glowing green #4ade80 dot
- "Already used" — grey background
- "Pending" — orange background (indicates waiting on previous round result)

**Card styling:**
- Top seed cards (1-8): gold-tinted background with gold seed badge
- Standard cards: white background with silver seed badge

**Removed:**
- `<Badge>` component import — no longer used on this page
- Old `<ul>/<li>` structure

**Mobile improvements:**
- Card gap: 10px (was 12px)
- Card padding: 12px
- Seed badge size: 32px
- Tag text: 8px
- Round tabs: reduced padding + 11px font
- Search row: tightened gap to prevent 320px overflow
- All touch targets: 44px minimum maintained

---

## Key Design Decisions

### Colour system
- **Brand dark green #0F4A23** is THE status colour for "alive" / "active" states across all pages
- Consistent "Alive" badge: dark green bg + white text + bright green dot
- Red for "Eliminated" (struck through text, red badge)
- Gold for "Winner" state
- Orange for "Pending" tags
- Green tint for "Won" pick cards

### Component patterns
- **Card-based layouts** with consistent 6px gap are the standard for all list views
- **Avatar circles** use 40px standard size (32px on mobile), coloured by `avatarColour()`
- **Status badges** are always pills with rounded corners (999px border-radius)
- **Result indicators** use pill styling + optional SVG icons (checkmark for "Advanced")

### Typography
- Player names: Outfit bold (14px)
- Meta lines: muted ink (#8A8780), 12px
- Labels: JetBrains Mono uppercase for eyebrow text
- Match times: secondary text, 11px

### Mobile responsiveness
- All three pages use 640px breakpoint consistently
- Touch targets: 44px minimum (Apple HIG standard)
- Cards: reduced padding (12px) and gap (10px) on mobile
- Text sizes: reduced 1-2px on mobile for tighter layout
- Modals: constrained to 92vw width to prevent overflow on 320px

### Component removal
- **Badge component phased out** in favour of custom `.ps-pcard-tag`, `.ph-card-result`, `.lb-card-status` CSS classes
- Reason: tighter control over styling, easier to add inline SVG icons, consistent colour system integration

---

## Name format change: "Surname, F."

**Decision:** All player names across bracket and modal display as "Surname, F." (e.g. "Alcaraz, C.") rather than "Firstname Lastname". Players are more recognisable by surname, and this format ensures the surname is always visible even when truncated.

**Utility:** `shortName()` in `frontend/src/utils/playerImage.js`
```javascript
export function shortName(name) {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  const first = parts[0];
  const surname = parts.slice(1).join(' ');
  return `${surname}, ${first[0]}.`;
}
```

**Applied in:**
- `DrawViewer.jsx` — bracket card names (player1, player2, bye rows) and list card names
- `MatchupModal.jsx` — player header names (loading + loaded states), form column headers, form opponent names ("vs Alcaraz, C."), stat comparison labels. Replaced and removed old `surname()` helper.

**Not applied to** (intentional):
- Leaderboard cards — show full display name (these are pool member names, not player names)
- PickScreen cards — show full player name for pick selection clarity
- PickHistory cards — show full player name

**MatchupModal overflow fix:**
- Added `overflow-x: hidden` to `.mu-modal` in `MatchupModal.css`
- Added `overflow: hidden` to `.mu2-form-row` to contain long form text

---

## Files modified (all pushed)
- `frontend/src/pages/Leaderboard.jsx` + `Leaderboard.css` — card layout, Survivometer, status badges
- `frontend/src/pages/PickHistory.jsx` + `PickHistory.css` — card layout, status cards, result pills
- `frontend/src/pages/PickScreen.jsx` + `PickScreen.css` — card layout, tag system, seed badges
- `frontend/src/pages/DrawViewer.jsx` — shortName() applied to bracket + list card names
- `frontend/src/components/MatchupModal.jsx` — shortName() replaces surname(), import added
- `frontend/src/components/MatchupModal.css` — overflow-x fix
- `frontend/src/utils/playerImage.js` — added shortName() utility
- `frontend/src/data/roundLabels.js` — imported in PickHistory

---

## Status
All changes implemented, committed, and pushed. Card-based redesign + name format change are live on finalserveivor.com.
