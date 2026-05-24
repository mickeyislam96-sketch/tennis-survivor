---
name: Overlay startTime sanity check (the right architectural location for "is this date plausible?")
description: seedDrawOverlay.js is the single source of truth for what gets shown. Defensive checks belong here, not in the scraper.
type: feedback
---

When data flows from scraper → cache → overlay → API response, the
**overlay** is the right place to enforce "is this value plausible"
contracts. Not the scraper. Not the API endpoint.

**Why:** the scraper's job is to extract what FlashScore shows. If
FlashScore lies (or is ambiguous), the scraper has limited context to
detect that. The overlay sees the full match — round, status, lock
times, neighbouring fixtures — and can reject implausible values.

## Concrete pattern (PR #11 + #14, 8 May 2026)

Bug: 23/32 R64 cards showed `7 May 08:00` startTimes for matches
playing 8 May. Root cause was an evening scrape on 7 May seeing
tomorrow's order of play as time-only entries; the scraper defaulted
the date to its current UTC, stamping next-day matches with that day.

**First fix (PR #11):** I made the scraper return `null` when the date
prefix was missing. Conservative but threw away signal in the common
case (today's matches displayed time-only ARE today's matches; the
scraper-time default is correct).

**Better fix (kept after #14):** the **overlay** drops any startTime
more than 6h in the past for a `scheduled` match. Decided/live matches
keep their startTime regardless. Two layers:

```js
const isDecided = DECIDED_STATUSES.has(gsFixture.status);
const isLive = gsFixture.status === 'live';
const startTs = new Date(gsFixture.startTime).getTime();
const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;

if (isDecided || isLive || startTs >= sixHoursAgo) {
  match.startTime = gsFixture.startTime;
} else {
  // log and drop — bracket shows "SCHEDULED" with no date
}
```

This handles:
- Today's match scraped today → kept ✓
- Tomorrow's match scraped today (wrongly stamped today) → dropped ✓
- Completed match yesterday → kept (status decided) ✓
- Live match → kept regardless of staleness ✓

## How to apply

When fixing data-quality bugs that span scraper → backend → frontend:

1. **Locate the contract first.** What's the rule the data must obey?
2. **Pick the right enforcement point.** Closest to the consumer (=
   overlay or API response) is usually right because it has the most
   context.
3. **Resist scraper-side over-correction.** If the scraper can't
   distinguish good from bad input, defer to a downstream check rather
   than dropping signal.
4. **Add a unit test at the enforcement point.** `tests/smoke/overlay-starttime-sanity.test.js`
   covers both PRs and would have caught the bug pre-launch.
