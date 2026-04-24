---
name: Draw cache and deadline computation bugs
description: Three interconnected bugs in tennisData.js — draw cache never hit, windowOpensOverrides ignored, scraper format mishandled. All fixed 24 Apr 2026.
type: feedback
---

## Draw cache must use stable timestamp, not Date.now()

The draw cache in getDraw() compared scraperFetchedAt using Date.now(), which changes every call. Cache never hit; overlayFixtures() ran on every request.

Fix: Use getScraperFetchedAt() from scraperCache.js — a stable timestamp set when data arrives from the scraper.

Why: Overlay runs Levenshtein matching across all players. Running it 100+ times between scraper updates is wasteful and makes results processing slower/more fragile.

How to apply: If adding any new caching logic, never use Date.now() as the comparison key unless the value being cached also uses Date.now() at creation time. Use the source data's own timestamp.

## windowOpensOverrides must be read in getDeadlines

Defining override values in activeTournament.js does nothing unless getDeadlines() actually reads them. There are TWO code paths in getDeadlines (static fallback + live fixture) — both must check overrides.

Why: Session 26d set all schedule overrides, but pick windows still used the computed formula.

How to apply: When adding any new config override to activeTournament.js, grep getDeadlines and every other consumer to ensure it's actually read.

## getDeadlines must detect fixture format

getDeadlines() gets fixtures from scraperCache OR fetchApiDraw. Scraper data is in internal format (matchId, winnerId, startTime). API-Tennis data has different fields. The code must detect which format it has before parsing.

How to apply: Check 'matchId' in fixtures[0] to detect internal format vs API-Tennis format.
