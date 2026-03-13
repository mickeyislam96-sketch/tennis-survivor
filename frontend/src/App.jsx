import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { PickScreen } from './pages/PickScreen';
import { DrawViewer } from './pages/DrawViewer';
import { PickHistory } from './pages/PickHistory';
import { Leaderboard } from './pages/Leaderboard';
import { GroupHome } from './pages/GroupHome';
import { JoinGroup } from './pages/JoinGroup';
import { TermsAndConditions } from './pages/TermsAndConditions';

const API = import.meta.env.VITE_API_URL || '/api';

const STORAGE_KEY = 'fsv_user';

function readStoredUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function useAuth() {
  const [user, setUserState] = useState(() => readStoredUser());

  // Verify stored user against backend on mount
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

  // Create account — stored in Railway DB
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

  return {
    user,
    userId: user?.id || null,
    isRegistered: !!user?.id,
    register,
    login,
    logout,
  };
}

function App() {
  const { user } = useAuth();

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<GroupHome />} />
        <Route path="/group/:groupId" element={<GroupHome />} />
        <Route path="/group/:groupId/pick" element={<PickScreen />} />
        <Route path="/group/:groupId/draw" element={<DrawViewer />} />
        <Route path="/group/:groupId/history" element={<PickHistory />} />
        <Route path="/group/:groupId/leaderboard" element={<Leaderboard />} />
        <Route path="/join/:code" element={<JoinGroup />} />
        <Route path="/terms" element={<TermsAndConditions />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;
export { API };
