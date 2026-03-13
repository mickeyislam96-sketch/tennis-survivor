import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../App';
import { API } from '../App';

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const token = searchParams.get('token');

  const [tokenState, setTokenState] = useState('checking'); // 'checking' | 'valid' | 'invalid'
  const [tokenError, setTokenError] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  // Verify token on mount
  useEffect(() => {
    if (!token) {
      setTokenState('invalid');
      setTokenError('No reset token found. Please request a new password reset link.');
      return;
    }

    fetch(`${API}/auth/verify-reset-token?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        if (data.valid) {
          setTokenState('valid');
        } else {
          setTokenState('invalid');
          setTokenError(data.error || 'Invalid or expired reset link.');
        }
      })
      .catch(() => {
        setTokenState('invalid');
        setTokenError('Could not verify reset link. Please try again.');
      });
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Password reset failed.');

      // Auto-login with the returned user
      // (backend returns the user directly after reset)
      setDone(true);
      setTimeout(() => navigate('/'), 2500);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page auth-page">
      <div className="auth-card">
        <div className="auth-card-header">
          <Link to="/" className="auth-card-logo">Final Serve-ivor</Link>
        </div>

        {/* Checking token */}
        {tokenState === 'checking' && (
          <p className="auth-card-hint">Verifying your reset link…</p>
        )}

        {/* Invalid token */}
        {tokenState === 'invalid' && (
          <div className="auth-card-body">
            <div className="auth-status-icon">⚠️</div>
            <h2 className="auth-card-title">Link invalid or expired</h2>
            <p className="auth-card-hint">{tokenError}</p>
            <Link to="/" className="btn primary btn-lg" style={{ display: 'block', textAlign: 'center' }}>
              Back to home
            </Link>
          </div>
        )}

        {/* Success state */}
        {done && (
          <div className="auth-card-body">
            <div className="auth-status-icon">✅</div>
            <h2 className="auth-card-title">Password updated</h2>
            <p className="auth-card-hint">Your password has been changed. Redirecting you to the home page…</p>
          </div>
        )}

        {/* Reset form */}
        {tokenState === 'valid' && !done && (
          <div className="auth-card-body">
            <h2 className="auth-card-title">Choose a new password</h2>
            <p className="auth-card-hint">Enter and confirm your new password below.</p>

            <form className="auth-form" onSubmit={handleSubmit}>
              <input
                className="input"
                type="password"
                placeholder="New password (min. 8 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
              />
              <input
                className="input"
                type="password"
                placeholder="Confirm new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
              {error && <p className="error">{error}</p>}
              <button type="submit" className="btn primary btn-lg" disabled={loading}>
                {loading ? 'Updating password…' : 'Set new password →'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
