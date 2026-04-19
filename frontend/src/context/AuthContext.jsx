import { createContext, useContext, useState, useEffect, useCallback } from 'react';

export const API = import.meta.env.VITE_API_URL || '/api';

const USER_KEY  = 'fsv_user';
const TOKEN_KEY = 'fsv_token';

function readStored(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function readStoredString(key) {
  try {
    return localStorage.getItem(key) || null;
  } catch { return null; }
}

/**
 * Read the CSRF cookie value (set by the backend on login/register).
 * The cookie is httpOnly: false so JavaScript can read it.
 */
function getCsrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUserState]   = useState(() => readStored(USER_KEY));
  const [token, setTokenState] = useState(() => readStoredString(TOKEN_KEY));

  // ── Persist helpers ──────────────────────────────────────────
  const saveAuth = (userData, jwtToken) => {
    // Strip token/csrf from the user object before persisting
    const { token: _t, csrf: _c, ...cleanUser } = userData;
    localStorage.setItem(USER_KEY, JSON.stringify(cleanUser));
    if (jwtToken) {
      localStorage.setItem(TOKEN_KEY, jwtToken);
      setTokenState(jwtToken);
    }
    setUserState(cleanUser);
  };

  const clearAuth = () => {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    setUserState(null);
    setTokenState(null);
  };

  // ── Authenticated fetch helper ───────────────────────────────
  // Wraps fetch() to automatically attach Authorization + CSRF headers.
  // All frontend pages should use this instead of raw fetch() for API calls.
  const authFetch = useCallback((url, options = {}) => {
    const headers = { ...(options.headers || {}) };

    // Attach JWT token if available
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Attach CSRF token for state-changing requests
    const method = (options.method || 'GET').toUpperCase();
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      const csrf = getCsrfToken();
      if (csrf && !headers['X-CSRF-Token']) {
        headers['X-CSRF-Token'] = csrf;
      }
    }

    return fetch(url, { ...options, headers });
  }, [token]);

  // ── Verify stored session on mount ───────────────────────────
  useEffect(() => {
    if (!token) return;
    authFetch(`${API}/auth/me`)
      .then(r => {
        if (r.status === 401) {
          // Token expired or invalid — clear auth
          clearAuth();
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then(u => {
        if (u) {
          setUserState(u);
          localStorage.setItem(USER_KEY, JSON.stringify(u));
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Register ─────────────────────────────────────────────────
  const register = async (email, displayName, password) => {
    const res = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, displayName, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    saveAuth(data, data.token);
    return data;
  };

  // ── Login ────────────────────────────────────────────────────
  const login = async (email, password) => {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    saveAuth(data, data.token);
    return data;
  };

  // ── Logout ───────────────────────────────────────────────────
  const logout = () => {
    clearAuth();
    // Clear CSRF cookie
    document.cookie = 'csrf=; max-age=0; path=/; secure; samesite=strict';
  };

  // ── Update local user after profile edit ─────────────────────
  const updateUser = (u) => {
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    setUserState(u);
  };

  return (
    <AuthContext.Provider value={{
      user,
      userId: user?.id || null,
      isRegistered: !!user?.id,
      token,
      register,
      login,
      logout,
      updateUser,
      authFetch,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
