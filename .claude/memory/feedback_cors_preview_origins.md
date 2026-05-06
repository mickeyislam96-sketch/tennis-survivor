---
name: CORS allowlist must include Vercel preview origins
description: The branch+PR+preview workflow can't function if the backend's CORS allowlist only knows about production hosts. Vercel preview URLs need to be allowed via a project-locked regex pattern.
type: feedback
---

The working agreement (`docs/working-agreement.md`) routes user-facing
changes through a feature branch + Vercel preview URL + manual
verification + PR. The preview's frontend talks to the production
backend (until a Railway staging service exists). If the backend's
CORS allowlist is restricted to production origins only, login and
every other API call from the preview fails preflight with
"Failed to fetch", and the workflow breaks.

**Fix in place** (commit `b4b4481`, 6 May 2026): `ALLOWED_ORIGINS` in
`backend/src/index.js` is now a function that checks both:

- Static list: `finalserveivor.com`, `www.finalserveivor.com`,
  `tennis-survivor.vercel.app`, plus localhost in non-prod.
- Regex pattern: `/^https:\/\/tennis-survivor-[a-z0-9-]+-mickeyislam96-sketchs-projects\.vercel\.app$/`
  — locked to this specific Vercel team so we don't drive-by allowlist
  forks or unrelated Vercel deployments.

**How to apply:** if the Vercel team or project Vercel subdomain ever
changes (e.g. team rename, project rename), update the regex. Don't
loosen it to allow generic `*.vercel.app` — that would let any Vercel
user CORS-talk to our backend.

When a Railway staging service exists, the equivalent fix on staging's
CORS list isn't needed because preview frontends will talk to staging
(separate origin too, but mutating freely there is the whole point).
