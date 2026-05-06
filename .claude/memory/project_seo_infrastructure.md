---
name: SEO infrastructure (state of play)
description: 6 May 2026 baseline SEO live (robots.txt, sitemap.xml, JSON-LD with brand-misspell aliases, canonical, theme-color). Google Search Console domain property verified for finalserveivor.com. Sitemap submitted. Open follow-ups documented below.
type: project
---

**What's live (as of 6 May 2026, commit c5fe659):**

- `frontend/public/robots.txt` — allow all reputable crawlers, block
  `/group/`, `/api/`, `/pay/` (auth-only), points at `/sitemap.xml`.
- `frontend/public/sitemap.xml` — 4 public URLs: `/`, `/how-to-play`,
  `/terms`, `/support`.
- `frontend/index.html` head additions:
  - `<link rel="canonical" href="https://finalserveivor.com/" />`
  - `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />`
  - `<meta name="theme-color" content="#0F4A23" />`
  - JSON-LD `WebSite` block with `alternateName: ["Final Serveivor",
    "Final Survivor Tennis", "FinalServeivor"]` so Google ranks the
    site for the obvious misspellings.
  - JSON-LD `Game` block (Sports / Survivor pool / Tennis).
  - Richer description and keywords meta covering Madrid, Rome,
    Roland Garros, "tennis survivor pool", "ATP survivor", etc.

**Google Search Console:**

- Property type: Domain (covers apex + www + any subdomain).
- Property: `finalserveivor.com`.
- Verification method: TXT record on Namecheap.
  - Record: `TXT @ google-site-verification=28bF0UID_eealiUCa756rQ6s9beWCFJ4xCPDIXHYX3E`
  - Verified: 6 May 2026.
- Sitemap submitted: `https://finalserveivor.com/sitemap.xml`.
- Status on submission: "Couldn't fetch" — known-cause: Vercel
  redirects apex → www, Google's first sitemap fetch can't follow.
  Re-fetches automatically over the next 24h; should flip to
  "Success" once the redirect chain is followed.

**Known follow-ups (not urgent, propose-via-PR when convenient):**

1. **Canonical URL mismatch.** `<link rel="canonical">` says
   `https://finalserveivor.com/` but Vercel always redirects apex
   to `https://www.finalserveivor.com/`. Update the canonical to
   match the served URL so Google indexes the correct host.
2. **Resubmit sitemap with www prefix** if status remains "Couldn't
   fetch" 24h after submission. The sitemap's `<loc>` entries already
   reference `https://finalserveivor.com/` — update them too if you
   change the canonical to www.
3. **Add /og-image.png to /public** if not already there (referenced
   from the OG meta tag).

**Expected timeline:**

- Day 1: verified, submitted.
- Day 2-7: Google starts crawling. Pages appear in URL Inspection.
- Day 7-14: brand queries surface the site.
- Day 14-30: misspelled URL queries (e.g. "finalsurvivor.com",
  "final survivor tennis") in Chrome's omnibox start finding the
  site via Google's fallback search.
