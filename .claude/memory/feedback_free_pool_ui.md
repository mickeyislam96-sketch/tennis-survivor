---
name: Free-pool UI must derive from entryFeeCents===0 (betaFree is dead)
description: Free pools must show 'Free', not '£0'. The `betaFree` flag JoinGroup.jsx relied on is set NOWHERE — detect free via entryFeeCents===0; hide prize-pool stat when 0; don't promise a prize pot on free pools.
type: feedback
---
Most FSV tournaments are FREE (entryFeeCents:0, prizePoolCents:0). Several frontend surfaces rendered free pools as if paid, which looked broken/unprofessional.

**Rule:** detect free with `entryFeeCents === 0` (and hide pot UI when `prizePoolCents === 0`). NEVER rely on a `betaFree` flag — it is referenced in JoinGroup.jsx but assigned nowhere in backend or frontend, so it is always undefined/falsy and silently fails.

**Why (found 22 May 2026, session 41, RG pre-launch audit):** JoinGroup.jsx (the page invitees land on) showed 'Entry fee £0', a 'Join for £0 →' button, and a 'non-refundable' disclaimer. GroupHome.jsx Hero metas (registered/active/complete states) showed 'Prize pool £0'/'Entry fee £0'. Fixed: entry='Free', prize-pool stat hidden when 0, 'Join free →', disclaimer hidden, lede/rules say 'wins the pool' not 'takes the prize pot'. The not-member branch of GroupHome already did this correctly via a local `isFree` — the other branches didn't.

**How to apply:** any new pool-facing UI (join, group home, pool cards, emails, profile history) must branch on entryFeeCents/prizePoolCents — show 'Free' for £0 entry and hide/reword pot/prize language when there's no cash prize. When the first PAID tournament launches, the source of truth is entryFeeCents > 0; do not revive betaFree.
