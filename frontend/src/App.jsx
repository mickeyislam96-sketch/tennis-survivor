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

export function useAuth() {
  const [user, setUser] = useState(null);
  const userId = localStorage.getItem('tennis_user_id') || 'u1';

  useEffect(() => {
    fetch(`${API}/auth/me?userId=${userId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setUser)
      .catch(() => setUser(null));
  }, [userId]);

  const login = (id) => {
    localStorage.setItem('tennis_user_id', id);
    setUser({ id, displayName: id });
    window.location.reload();
  };

  return { user, userId, login, setUser };
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
