#!/usr/bin/env bash
# Local DB-restore drill — manual counterpart to the quarterly workflow.
#
# Usage:
#   1. Download a backup_*.sql.gz file from the most recent successful
#      Daily Database Backup run on GitHub Actions.
#   2. Run: ./scripts/test-db-restore.sh path/to/backup.sql.gz
#
# Spins up postgres:17-alpine in Docker, restores the dump, runs the
# same assertions as the quarterly workflow, then tears everything
# down. Same exit codes as the workflow.
#
# Requires: docker, psql client (postgresql-client-17 if you want to
# match prod exactly; older clients usually work fine for restore).
set -euo pipefail

BACKUP_FILE="${1:-}"
if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <path/to/backup.sql.gz>" >&2
  exit 1
fi
if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

CONTAINER="fsv-restore-test-$$"
DB_NAME="fsv_restore_test"
PORT=55433  # Avoid clashing with anything else on local 5432

cleanup() {
  echo
  echo "Tearing down container $CONTAINER..."
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Starting ephemeral Postgres 17 on localhost:$PORT..."
docker run -d --rm --name "$CONTAINER" \
  -e POSTGRES_DB="$DB_NAME" \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=test \
  -p "${PORT}:5432" \
  postgres:17-alpine >/dev/null

# Wait for ready
for _ in $(seq 1 30); do
  if docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

export PGPASSWORD=test
PSQL="psql -h localhost -p $PORT -U postgres -d $DB_NAME"

echo "Restoring $BACKUP_FILE..."
gunzip -c "$BACKUP_FILE" | $PSQL --set ON_ERROR_STOP=1 -q

echo
echo "=== Schema check ==="
PSQL_T="$PSQL -t -A"
for t in users groups group_members picks payment_orders admin_audit_log; do
  EXISTS=$($PSQL_T -c "SELECT to_regclass('public.${t}') IS NOT NULL")
  if [ "$EXISTS" != "t" ]; then
    echo "  ✗ $t MISSING" >&2
    exit 1
  fi
  echo "  ✓ $t"
done

echo
echo "=== Row counts ==="
USERS=$($PSQL_T -c "SELECT COUNT(*) FROM users")
GROUPS=$($PSQL_T -c "SELECT COUNT(*) FROM groups")
MEMBERS=$($PSQL_T -c "SELECT COUNT(*) FROM group_members")
PICKS=$($PSQL_T -c "SELECT COUNT(*) FROM picks")
echo "  users:         $USERS"
echo "  groups:        $GROUPS"
echo "  group_members: $MEMBERS"
echo "  picks:         $PICKS"

if [ "$USERS" -lt 1 ] || [ "$GROUPS" -lt 1 ]; then
  echo "  ✗ Suspiciously empty — restore probably failed silently." >&2
  exit 1
fi

echo
echo "=== Referential integrity spot check ==="
ORPHAN_PICKS=$($PSQL_T -c "SELECT COUNT(*) FROM picks p WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = p.user_id)")
if [ "$ORPHAN_PICKS" -gt 0 ]; then
  echo "  ✗ $ORPHAN_PICKS orphan picks — referential integrity broken." >&2
  exit 1
fi
echo "  ✓ no orphan picks"

echo
echo "✅ Restore verification passed. Backup is usable."
