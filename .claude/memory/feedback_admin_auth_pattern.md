---
name: Admin auth pattern — always go through adminAuth.js
description: New admin endpoints must use requireAdmin(req, res, scope) from backend/src/auth/adminAuth.js. Never hand-roll ADMIN_SECRET checks.
type: feedback
---

When adding any admin endpoint, use `requireAdmin(req, res, scope)` from
`backend/src/auth/adminAuth.js`. Never hand-roll a `process.env.ADMIN_SECRET`
check inline.

**Why:** Pre–5 May 2026, three different files (`admin.js`, `draw.js`,
`payments.js`) had near-duplicate but subtly different secret-check
functions. Some logged audit info, some didn't. Some accepted query-param
secrets, some didn't. The drift made the security surface impossible to
reason about. After consolidation:

- All admin auth flows through one module.
- Every call writes to `admin_audit_log` (success or failure).
- Per-scope tokens (`ADMIN_TOKEN_<SCOPE>` env vars) work without code changes.
- `ADMIN_SECRET` still grants every scope (back-compat for cron jobs).

**How to apply:** New route looks like:

```js
import { requireAdmin } from '../auth/adminAuth.js';

router.post('/some-admin-action', async (req, res) => {
  const ok = await requireAdmin(req, res, 'tournament');  // pick a scope
  if (!ok) return;
  // ... handler ...
});
```

Pick a scope name that matches the blast radius. Existing scope buckets:
read, tournament, user, emails, financial, scraper. Add a new one if the
action genuinely doesn't fit any.

For fully back-compat behaviour (no scope check), use the legacy alias
`checkSecret(req, res)` — same module, same audit log, scope tagged as
'legacy'.
