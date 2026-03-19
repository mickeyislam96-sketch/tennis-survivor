import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { PickScreen } from './pages/PickScreen';
import { DrawViewer } from './pages/DrawViewer';
import { PickHistory } from './pages/PickHistory';
import { Leaderboard } from './pages/Leaderboard';
import { GroupHome } from './pages/GroupHome';
import { JoinGroup } from './pages/JoinGroup';
import { TermsAndConditions } from './pages/TermsAndConditions';
import { ResetPassword } from './pages/ResetPassword';
import { Profile } from './pages/Profile';
import { AuthProvider } from './context/AuthContext';

// Re-export so all existing page imports of `useAuth` and `API` from '../App' continue to work
export { useAuth, API } from './context/AuthContext';

function App() {
  return (
    <AuthProvider>
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
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </AuthProvider>
  );
}

export default App;
