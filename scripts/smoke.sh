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

step "4. Frontend reachable"
HTTP_WEB=$(curl -s -L -o /dev/null -w "%{http_code}" -m 15 "$WEB")
if [ "$HTTP_WEB" = "200" ]; then ok "$WEB responds 200"; else no "$WEB responds $HTTP_WEB"; fi

echo ""
if [ "$fail_count" -eq 0 ]; then
  echo "✅ All smoke checks passed."
  exit 0
else
  echo "❌ $fail_count smoke check(s) failed. Investigate before sharing the invite link."
  exit 1
fi
