---
name: "Used-player" check must match full name, not a parsed surname
description: 2 Jun 2026 — the pick screen blocked Servena from picking Zverev because its "already used" check did split(' ').pop() on "Surname, Firstname", which returns the FIRST name. "Blockx, Alexander" and "Zverev, Alexander" both reduced to "Alexander", so using Blockx blocked Zverev. Fixed by matching the whole normalised name + ID, identical to the backend.
type: feedback
---

# Pick "already used" check: match full name + ID, never a parsed surname

**Bug (2 Jun 2026, web `fcea805`, mobile patch pending).** A player is greyed
out and its Pick button hidden when it's "already used" in another round. The
frontend built that set with `name.split(' ').pop()` to get a "last name" — but
names are stored `"Surname, Firstname"`, so `split(' ').pop()` returns the
**first** name. Servena's used set became `{alexander, tommy, frances, rafael}`
(all first names). **Zverev, Alexander** reduced to "alexander", collided with
**Blockx, Alexander** (used at R1), and Zverev was wrongly blocked. The backend
would have accepted the pick — it matches on the whole name — so the bug was
purely client-side, and any two players sharing a first name collided.

**Fix.** Match "already used" on the **whole normalised name + player ID**,
identical to the backend `POST /api/picks` validation, so the UI and server can
never disagree. No first-name or surname collisions, and no dependence on a
fragile surname parse. Web: `frontend/src/pages/PickScreen.jsx`. Mobile (same
bug): `src/screens/PickScreen.tsx` + the `surname()` helper in `DrawScreen.tsx`
— patch saved to the workspace (`mobile-pick-namebug-fix.patch`); not pushed
because this session's token is scoped to the web repo only.

**How to apply / the rule.**
- Whenever you need to decide "is this the same player as one already picked",
  compare the **full** normalised name (and the ID), not a token of it.
- `"Surname, Firstname"` is the canonical store format (see
  [[feedback_name_parsing]]); `split(' ').pop()` is wrong for it everywhere.
- Keep the frontend's availability logic a mirror of the backend's, so a player
  the server would accept is never hidden in the UI (and vice versa). When the
  two diverge, prefer making the client match the server.
