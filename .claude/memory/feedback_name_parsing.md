---
name: shortName must handle Surname, Firstname format
description: Seed draw stores names as 'Surname, Firstname' (canonical ATP format). Any frontend formatter has to detect the comma and parse accordingly, or it inverts the display name for every player on the bracket.
type: feedback
---

The seed-draw JSON stores names as `"Surname, Firstname"` — that's the
canonical ATP / FlashScore format. Any utility that produces a display
name from raw player data has to detect the comma.

**6 May 2026 incident:** `shortName()` in
`frontend/src/utils/playerImage.js` assumed `"Firstname Lastname"` and
split on whitespace. For `"Sinner, Jannik"` it returned `"Jannik, S."`,
inverting every player on the bracket cards, list cards, and matchup
modal — visible to every Rome viewer until Mickey reported it.

**How to apply:**

When writing or modifying any function that takes a player name string
and produces a derivative form (display, slug, search key, headshot
filename), assume the input is in `"Surname, Firstname"` format unless
documented otherwise. Detect the comma:

```js
if (name.includes(',')) {
  const [surname, firstNames] = name.split(',', 2).map(s => s.trim());
  // ... build output from surname + firstNames
}
```

For test coverage, exercise:
- Single first name: `"Sinner, Jannik"` → expected output
- Multi-name first names: `"Cerundolo, Juan Manuel"`
- Multi-word surnames: `"Carreno Busta, Pablo"`, `"Davidovich Fokina, Alejandro"`, `"Mpetshi Perricard, Giovanni"`
- Hyphenated first names: `"Struff, Jan-Lennard"`, `"Auger-Aliassime, Felix"`
- Legacy `"Firstname Lastname"` format (still used by some API responses)
- Placeholders: `"TBD"`, `"Qualifier 13"`, `"BYE"` — must pass through unmangled
- Null / empty / whitespace-only — graceful default

Reference test file: `frontend/tests/playerImage.test.mjs`.

The same lesson applies to `nameSlug()` (already handles the comma
form) and any future formatter — keep both formats in mind.
