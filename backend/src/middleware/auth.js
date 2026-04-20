/**
 * JWT authentication middleware.
 *
 * Tokens are issued on login/register and sent by the frontend as:
 *   Authorization: Bearer <token>
 *
 * Verified tokens attach `req.userId` (string UUID) to the request.
 *
 * Two middleware variants:
 *   requireAuth  — 401 if no valid token (for protected endpoints)
 *   optionalAuth — attaches userId if token present, continues either way
 */

import jwt from 'jsonwebtoken';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Fall back to ADMIN_SECRET so the system works without adding a new env var immediately.
    // In production, set a dedicated JWT_SECRET for proper separation of concerns.
    const fallback = process.env.ADMIN_SECRET;
    if (!fallback) {
      console.error('[auth] Neither JWT_SECRET nor ADMIN_SECRET is set — token verification will fail');
    }
    return fallback;
  }
  return secret;
}

const TOKEN_EXPIRY = '7d';  // 7-day tokens; frontend refreshes on mount

/**
 * Issue a JWT for a user. Called after login or register.
 */
export function issueToken(userId) {
  const secret = getJwtSecret();
  if (!secret) throw new Error('Cannot issue token — no JWT secret configured');
  return jwt.sign({ sub: userId }, secret, { expiresIn: TOKEN_EXPIRY });
}

/**
 * Verify a JWT and return the payload, or null if invalid/expired.
 */
function verifyToken(token) {
  try {
    const secret = getJwtSecret();
    if (!secret) return null;
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}

/**
 * Extract Bearer token from Authorization header.
 */
function extractToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice(7);
  }
  return null;
}

/**
 * Required auth — rejects with 401 if no valid token.
 */
export function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (token) {
    const payload = verifyToken(token);
    if (payload && payload.sub) {
      req.userId = payload.sub;
      return next();
    }
    // Token was present but invalid/expired
    return res.status(401).json({ error: 'Token expired or invalid. Please log in again.', code: 'TOKEN_EXPIRED' });
  }

  return res.status(401).json({ error: 'Authentication required.', code: 'NO_TOKEN' });
}

/**
 * Optional auth — attaches userId if token present, continues either way.
 * Used for endpoints that behave differently for logged-in vs anonymous users.
 */
export function optionalAuth(req, _res, next) {
  const token = extractToken(req);
  if (token) {
    const payload = verifyToken(token);
    if (payload && payload.sub) {
      req.userId = payload.sub;
    }
  }

  next();
}

/**
 * CSRF protection — double-submit cookie pattern.
 *
 * On login/register, the backend sets a `csrf` cookie (httpOnly: false, sameSite: strict).
 * The frontend reads this cookie and sends it as `X-CSRF-Token` header on state-changing requests.
 * The middleware verifies the header matches the cookie.
 *
 * Only applies to POST/PATCH/PUT/DELETE (state-changing methods).
 * Skipped for webhook endpoints (they use HMAC signatures instead).
 */
export function csrfProtection(req, res, next) {
  // Only check state-changing methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip CSRF for webhook endpoints (they use signature verification)
  if (req.path.startsWith('/api/payments/webhook')) {
    return next();
  }

  // Skip CSRF for admin endpoints (they use Bearer token auth)
  if (req.path.startsWith('/api/admin') || req.path.startsWith('/api/ops')) {
    return next();
  }

  const cookieToken = req.cookies?.csrf;
  const headerToken = req.headers['x-csrf-token'];

  // During migration: if no CSRF cookie exists yet, allow the request.
  // This prevents breaking existing sessions. Once all clients send
  // the cookie, tighten this to reject requests without CSRF.
  if (!cookieToken) {
    return next();
  }

  if (!headerToken || headerToken !== cookieToken) {
    return res.status(403).json({ error: 'CSRF token mismatch.', code: 'CSRF_FAILED' });
  }

  next();
}

/**
 * Generate a random CSRF token.
 */
export function generateCsrfToken() {
  return [...Array(32)].map(() => Math.random().toString(36)[2]).join('');
}
