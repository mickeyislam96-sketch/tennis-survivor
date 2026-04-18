import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../App';
import { API } from '../App';
import { Section } from '../ui/Section.jsx';
import { Card } from '../ui/Card.jsx';
import { Button } from '../ui/Button.jsx';
import './ResetPassword.css';

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

      setDone(true);
      setTimeout(() => navigate('/'), 2500);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rp-page">
      <Section tone="canvas" size="lg">
        <Card tone="surface" padding="lg" className="rp-card">

          <div className="rp-header">
            <Link to="/" className="rp-logo">Final Serve-ivor</Link>
          </div>

          {/* Checking token */}
          {tokenState === 'checking' && (
            <div className="rp-body">
              <div className="rp-spinner" aria-hidden="true" />
              <p className="rp-hint">Verifying your reset link…</p>
            </div>
          )}

          {/* Invalid token */}
          {tokenState === 'invalid' && (
            <div className="rp-body">
              <div className="rp-icon" aria-hidden="true">⚠️</div>
              <h2 className="rp-title">Link invalid or expired</h2>
              <p className="rp-hint">{tokenError}</p>
              <Button as={Link} to="/" variant="primary" size="lg" fullWidth>
                Back to home
              </Button>
            </div>
          )}

          {/* Success state */}
          {done && (
            <div className="rp-body">
              <div className="rp-check" aria-hidden="true">✓</div>
              <h2 className="rp-title">Password updated</h2>
              <p className="rp-hint">
                Your password has been changed. Redirecting you to the home page…
              </p>
            </div>
          )}

          {/* Reset form */}
          {tokenState === 'valid' && !done && (
            <div className="rp-body">
              <h2 className="rp-title">Choose a <em>new password</em>.</h2>
              <p className="rp-hint">Enter and confirm your new password below.</p>

              <form className="rp-form" onSubmit={handleSubmit}>
                <input
                  className="rp-input"
                  type="password"
                  placeholder="New password (min. 8 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                />
                <input
                  className="rp-input"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
                {error && <p className="rp-error">{error}</p>}
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={loading}
                  fullWidth
                >
                  {loading ? 'Updating password…' : 'Set new password →'}
                </Button>
              </form>
            </div>
          )}
        </Card>
      </Section>
    </div>
  );
}
