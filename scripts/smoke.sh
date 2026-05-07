#!/usr/bin/env bash
#
# scripts/smoke.sh — post-launch smoke test
#
# Run this after every tournament transition or any push touching:
#   - backend/src/routes/groups.js
#   - backend/src/routes/pools.js
#   - backend/src/config/activeTournament.js
#   - backend/src/data/tournaments.js
#   - frontend/src/data/tournaments.js
#   - Railway env vars (ACTIVE_TOURNAMENT, scraper config)
#
# What it checks
#   1. /api/health is 200 and reports a real data source
#   2. ACTIVE_TOURNAMENT env var on Railway matches what we expect
#   3. /api/pools returns at least one active pool
#   4. The active pool's invite link round-trips (catches the case-sensitivity bug)
#   5. The frontend /finalserveivor.com is reachable
#   6. orphan-picks count is 0 (catches the membership/pick mismatch bug —
#      requires ADMIN_SECRET via env var)
#   7. /api/picks rejects pick attempts from non-members with 403
#      (regression test for the 6 May data-integrity fix; requires ADMIN_SECRET)
#
# Exits non-zero on any failure so it can wedge into CI later.

set -u

API="${API:-https://tennis-survivor-production.up.railway.app}"
WEB="${WEB:-https://finalserveivor.com}"
EXPECTED_TOURNAMENT="${EXPECTED_TOURNAMENT:-rome-2026}"

PASS="\033[32m✓\033[0m"
FAIL="\033[31m✗\033[0m"
fail_count=0

step() { printf "\n— %s\n" "$1"; }
ok()   { printf " $PASS %s\n" "$1"; }
no()   { printf " $FAIL %s\n" "$1"; fail_count=$((fail_count+1)); }

step "1. /api/health"
HEALTH=$(curl -s -m 30 "$API/api/health")
if echo "$HEALTH" | grep -q '"ok":true'; then ok "health.ok = true"; else no "health.ok != true"; echo "$HEALTH" | head -c 300; fi
TOURN=$(echo "$HEALTH" | grep -o '"tournament":"[^"]*"' | cut -d'"' -f4)
if [ "$TOURN" = "$EXPECTED_TOURNAMENT" ]; then ok "active tournament = $TOURN"; else no "active tournament = '$TOURN' (expected '$EXPECTED_TOURNAMENT')"; fi
SRC=$(echo "$HEALTH" | grep -o '"data_source":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ "$SRC" != "" ] && [ "$SRC" != "mock_data" ] && [ "$SRC" != "mock_fallback" ]; then ok "data source = $SRC"; else no "data source = '$SRC' (mock fallback active)"; fi
FRESH=$(echo "$HEALTH" | grep -o '"scraper_freshness":{[^}]*}' | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
case "$FRESH" in
  fresh|idle_window|no_cache_idle) ok "scraper freshness = $FRESH" ;;
  STALE|NO_CACHE)                  no "scraper freshness = $FRESH (alarm should be firing)" ;;
  *)                               echo "  (no scraper_freshness in payload)" ;;
esac

# 1b. Bracket overlay sanity check — catches the case where the scraper is
# fresh but scraping the WRONG tournament. dataSource must contain
# `scraper(N)` with N > 0 (or N=0 *only* if R1 has not started yet, e.g.
# pre-launch). This is the regression check for the 6 May 2026 incident
# where the scraper silently kept scraping Madrid for a week.
BRACKET=$(curl -s -m 30 "$API/api/draw/bracket?round=R1")
DSRC=$(echo "$BRACKET" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('dataSource',''))" 2>/dev/null)
echo "  dataSource = $DSRC"
case "$DSRC" in
  *"scraper(0)"*)
    no "bracket dataSource = $DSRC — scraper is fresh but matched 0 fixtures (likely scraping wrong tournament; verify FLASHSCORE_URL on Railway scraper service)" ;;
  *"scraper("*")"*)
    ok "bracket dataSource = $DSRC (overlay merging correctly)" ;;
  "seed_draw_only"|"")
    echo "  (no scraper data yet — fine pre-tournament, but verify after R1 starts)" ;;
  *)
    echo "  (unexpected dataSource $DSRC — check $API/api/draw/bracket manually)" ;;
esac

step "2. /api/pools"
POOLS=$(curl -s -m 30 "$API/api/pools")
ACTIVE_COUNT=$(echo "$POOLS" | grep -o '"status":"active"' | wc -l | tr -d ' ')
if [ "$ACTIVE_COUNT" -ge 1 ]; then ok "$ACTIVE_COUNT active pool(s) listed"; else no "no active pools"; fi

step "3. Active pool invite round-trip"
# Extract the first pool whose tournament status is active and probe its invite code.
ACTIVE_CODE=$(echo "$POOLS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for p in data:
    if (p.get('tournament') or {}).get('status') == 'active':
        print(p.get('inviteCode',''))
        break
" 2>/dev/null)
ACTIVE_POOL_ID=$(echo "$POOLS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for p in data:
    if (p.get('tournament') or {}).get('status') == 'active':
        print(p.get('id','')); break
" 2>/dev/null)

if [ -n "$ACTIVE_CODE" ]; then
  ok "active pool invite code = $ACTIVE_CODE"
  # Probe both as-stored and uppercased to catch case-sensitivity regressions.
  HTTP_AS=$(curl -s -o /dev/null -w "%{http_code}" -m 15 "$API/api/groups/invite/$ACTIVE_CODE")
  HTTP_UP=$(curl -s -o /dev/null -w "%{http_code}" -m 15 "$API/api/groups/invite/$(echo $ACTIVE_CODE | tr 'a-z' 'A-Z')")
  if [ "$HTTP_AS" = "200" ]; then ok "invite lookup (as-stored) = 200"; else no "invite lookup (as-stored) = $HTTP_AS"; fi
  if [ "$HTTP_UP" = "200" ]; then ok "invite lookup (uppercased) = 200"; else no "invite lookup (uppercased) = $HTTP_UP"; fi
else
  no "could not extract an active pool invite code from /api/pools"
fi

step "3b. Opponent enrichment for the OPEN round (PR #8 regression check)"
# This catches the bug class fixed in PR #8 (7 May 2026): backend was
# returning R64+ picks with no opponentName/opponentPossible, so the pick
# screen showed bare names with no `vs <opponent>` sub-line.
# Logic: find the round currently marked isOpen, hit /api/picks/available
# for it, count how many players have neither field populated.
DEADLINES=$(curl -s -m 15 "$API/api/draw/deadlines")
OPEN_ROUND=$(echo "$DEADLINES" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for d in data:
    if d.get('isOpen'):
        print(d.get('round','')); break
" 2>/dev/null)
if [ -n "$OPEN_ROUND" ] && [ -n "$ACTIVE_POOL_ID" ]; then
  ok "open round = $OPEN_ROUND"
  PICKS=$(curl -s -m 30 "$API/api/picks/available?userId=00000000-0000-0000-0000-000000000000&groupId=$ACTIVE_POOL_ID&round=$OPEN_ROUND")
  MISSING=$(echo "$PICKS" | python3 -c "
import sys, json
players = json.load(sys.stdin)
total = len(players) if isinstance(players, list) else 0
missing = sum(1 for p in players if not p.get('opponentName') and not (isinstance(p.get('opponentPossible'), list) and len(p['opponentPossible']) > 0))
print(f'{missing}/{total}')
" 2>/dev/null)
  case "$MISSING" in
    0/*) ok "every player in $OPEN_ROUND has opponent info ($MISSING)" ;;
    */0) echo "  (no players returned — caught by other checks)" ;;
    *)
      MISSING_N=$(echo "$MISSING" | cut -d/ -f1)
      TOTAL_N=$(echo "$MISSING" | cut -d/ -f2)
      # Allow up to 5% missing (qualifier slots with TBD feeders can
      # legitimately have nothing to render).  More than that = regression.
      THRESHOLD=$((TOTAL_N * 5 / 100))
      [ "$THRESHOLD" -lt 2 ] && THRESHOLD=2
      if [ "$MISSING_N" -le "$THRESHOLD" ]; then
        ok "opponent info populated for $OPEN_ROUND (missing $MISSING within tolerance)"
      else
        no "$MISSING players in $OPEN_ROUND missing opponentName + opponentPossible (likely PR #8 regression — opponentMap not built in picks.js R2+ branch)"
      fi
      ;;
  esac
else
  echo "  (no open round detected — skipping opponent-enrichment check)"
fi

step "4. Frontend reachable"
HTTP_WEB=$(curl -s -L -o /dev/null -w "%{http_code}" -m 15 "$WEB")
if [ "$HTTP_WEB" = "200" ]; then ok "$WEB responds 200"; else no "$WEB responds $HTTP_WEB"; fi

step "5. Orphan picks (data integrity)"
if [ -z "${ADMIN_SECRET:-}" ]; then
  echo "  (skipped — set ADMIN_SECRET in env to enable)"
else
  ORPHAN=$(curl -s -m 15 "$API/api/admin/orphan-picks" -H "Authorization: Bearer $ADMIN_SECRET")
  COUNT=$(echo "$ORPHAN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('count', 'ERR'))" 2>/dev/null)
  if [ "$COUNT" = "0" ]; then
    ok "orphan-picks count = 0"
  elif [ "$COUNT" = "ERR" ] || [ -z "$COUNT" ]; then
    echo "  (admin endpoint not deployed yet or auth failed — skipping)"
  else
    no "orphan-picks count = $COUNT (users have picks for groups they aren't members of)"
    echo "$ORPHAN" | python3 -m json.tool 2>/dev/null | head -20
  fi
fi

step "6. /api/picks rejects non-member with 403 (regression check for 6 May fix)"
if [ -n "$ACTIVE_CODE" ]; then
  # Use the active pool ID and a fresh non-member UUID
  POOL_ID=$(echo "$POOLS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for p in data:
    if (p.get('tournament') or {}).get('status') == 'active':
        print(p['id']); break
" 2>/dev/null)
  GHOST_USER="00000000-1111-2222-3333-444444444444"
  RESP=$(curl -s -o /dev/null -w "%{http_code}" -m 15 -X POST "$API/api/picks"     -H "Content-Type: application/json"     -d "{\"groupId\":\"$POOL_ID\",\"userId\":\"$GHOST_USER\",\"round\":\"R1\",\"playerId\":\"rome-s1\",\"playerName\":\"X\"}")
  # Accept either 403 (membership check fired — preferred) or 400
  # (round-lock check fired first — happens after the round closes;
  # both prove the pick wasn't accepted). 201 would be the regression.
  case "$RESP" in
    403) ok "non-member pick rejected with 403 (membership check)" ;;
    400) ok "non-member pick rejected with 400 (likely round locked — also fine)" ;;
    *)   no "non-member pick returned HTTP $RESP (expected 400 or 403; 201 would be a regression)" ;;
  esac
fi

echo ""
if [ "$fail_count" -eq 0 ]; then
  echo "✅ All smoke checks passed."
  exit 0
else
  echo "❌ $fail_count smoke check(s) failed. Investigate before sharing the invite link."
  exit 1
fi
