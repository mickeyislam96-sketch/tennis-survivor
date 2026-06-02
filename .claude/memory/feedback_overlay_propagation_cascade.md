---
name: Unresolved early-round matches cascade up the bracket (null-player propagation)
description: 2 Jun 2026 — RG R16/QF showed wrong players (Tabilo/Svajda alive, Felix/Cobolli missing). Root: 3 R1 slots held pre-tournament withdrawals whose LL replacements never auto-resolved (no cancelled fixture), so those R1 matches got no winner and the gap cascaded up (R64→R32→R16→QF) as null-player slots. Plus a 2-char surname ("Wu") failed fuzzy matching. Fixed via 1 seed-draw correction + result overrides.
type: feedback
---

# One unresolved early-round match silently breaks its whole branch

**Why this happens.** `seedDrawOverlay` matches each round's scraper fixtures to
the seed-draw slots, then propagates winners into the next round. It SKIPS any
slot missing a player name (`if (!player1Name || !player2Name) continue`). So if
an R1 match never gets a winner, its winner never propagates, the next-round
slot stays half-null, that match is skipped too, and the gap climbs the bracket.
The bracket shows `None vs X` (or a named match with no winner) at progressively
higher rounds. The pick pool then keeps the un-eliminated players alive.

**Two root causes seen (2 Jun 2026, RG):**

1. **Pre-tournament withdrawal, no cancelled fixture.** Three R1 seed-draw slots
   held entrants who withdrew before the event and were replaced by lucky
   losers. The overlay's auto-replacement only fires when FlashScore shows a
   *cancelled* match (see [[feedback_seeded_withdrawal_with_bye]]) — it doesn't
   for pre-event withdrawals — so the scraper's real names never matched the
   slots and those R1 matches got no winner.
   - Fix A (replacement WON, and isn't in the slot): correct the **seed draw
     JSON** to the real player. RG pos 120 Fils (seed 17, withdrew) → De Jong
     (LL, won, reached R16 vs Zverev). seed: null so the loader gives a
     position-based id (`-p120`). An override can't help here — the winner
     isn't one of the slot's two names.
   - Fix B (the in-slot player WON): a `manualResultOverrides` R1 entry naming
     the slot's two players + the winner works, because the override matches by
     the slot's own names. RG: van Assche d. (Kypson slot; LL Gaubas really
     played — used `loserDisplayName: 'Gaubas, Vilius (LL)'`); Wu d. (Giron
     slot; scraper was even MISSING this R1 fixture — Wu confirmed via R64).

2. **Short surname fails fuzzy matching.** Even after Wu propagated into the R64
   slot, `Cobolli vs Wu` got no winner: the 2-char surname "Wu" doesn't pass
   `surnameSubsetMatch`, so `findFixtureMatch` couldn't pair the fixture.
   Forced it with a `manualResultOverrides` R64 entry (matches by exact full
   name, not surname). Related: [[feedback_double_barrel_surnames]].

**How to diagnose (fast).** Pull `/api/draw/bracket?round=F` and list, per round,
matches with a NULL player or a named-but-no-winner. The LOWEST round with such a
match is the root; everything above it is cascade. Fix the roots, redeploy, and
the higher rounds heal via normal matching. (`dataSource` annotation
`scraper(N)+overrides(M)` rises as breaks resolve — went 109→119, overrides 2→5.)

**Verification contract.** After fixing: 0 null/no-winner matches in played
rounds; eliminated players show the correct `roundEliminated`; the pick pool for
the open round excludes them; QF/SF/F nulls are fine (not played yet).

**Open follow-ups (riskier overlay changes — do in a dedicated session, not
mid-tournament):**
- Make the overlay heal pre-tournament withdrawal replacements that have NO
  cancelled fixture: when an R1 fixture pairs a known seed-draw player against a
  player not in the draw at all, adopt the unknown as the replacement (carefully
  guard against double-barrel/name-format false negatives).
- Harden surname matching for very short surnames (e.g. "Wu") so 2-char names
  don't silently fail to pair.
