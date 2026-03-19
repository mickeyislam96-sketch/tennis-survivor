import { createContext, useContext, useState, useEffect } from 'react';

export const API = import.meta.env.VITE_API_URL || '/api';

const STORAGE_KEY = 'fsv_user';

function readStoredUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(() => readStoredUser());

  // Verify stored user against backend on mount â syncs auth state across components
  useEffect(() => {
    const stored = readStoredUser();
    if (!stored?.id) return;
    fetch(`${API}/auth/me?userId=${stored.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(u => {
        if (u) {
          setUserState(u);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
        }
        // If not found keep stored user (offline / Railway sleeping)
      })
      .catch(() => {});
  }, []);

  const saveUser = (u) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    setUserState(u);
  };

  // Create account â stored in Railway DB
  const register = async (email, displayName, password) => {
    const res = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, displayName, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    saveUser(data);
    return data;
  };

  // Sign in with email + password
  const login = async (email, password) => {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    saveUser(data);
    return data;
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUserState(null);
  };

  // Update local user state after a profile change
  const updateUser = (u) => {
    saveUser(u);
  };

  return (
    <AuthContext.Provider value={{
      user,
      userId: user?.id || null,
      isRegistered: !!user?.id,
      register,
      login,
      logout,
      updateUser,
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
