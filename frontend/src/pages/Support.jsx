import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, API } from '../App';
import './Support.css';

const CATEGORIES = [
  { value: 'picks', label: 'Picks & selections' },
  { value: 'account', label: 'Account & login' },
  { value: 'results', label: 'Results & scoring' },
  { value: 'payments', label: 'Payments' },
  { value: 'bug', label: 'Bug report' },
  { value: 'other', label: 'Something else' },
];

export function Support() {
  const { user } = useAuth();
  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [errorMsg, setErrorMsg] = useState('');

  const canSubmit = subject.trim() && message.trim() && status !== 'sending';

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;

    setStatus('sending');
    setErrorMsg('');

    try {
      const res = await fetch(`${API}/support`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: CATEGORIES.find(c => c.value === category)?.label || 'General',
          subject: subject.trim(),
          message: message.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong.');
      }

      setStatus('sent');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message);
    }
  }

  if (status === 'sent') {
    return (
      <div className="support-page">
        <div className="support-card">
          <div className="support-success">
            <div className="support-success__icon">✓</div>
            <h1 className="support-success__title">Message sent</h1>
            <p className="support-success__text">
              We've received your support request and will get back to you as soon as possible.
            </p>
            <Link to="/" className="support-success__link">Back to home</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="support-page">
      <div className="support-card">
        <div className="support-header">
          <h1 className="support-header__title">Contact support</h1>
          <p className="support-header__subtitle">
            Having an issue or got a question? Send us a message and we'll get back to you.
          </p>
        </div>

        <form className="support-form" onSubmit={handleSubmit}>
          <div className="support-field">
            <label className="support-label" htmlFor="support-category">Category</label>
            <select
              id="support-category"
              className="support-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Select a category (optional)</option>
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div className="support-field">
            <label className="support-label" htmlFor="support-subject">
              Subject <span className="support-required">*</span>
            </label>
            <input
              id="support-subject"
              className="support-input"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary of your issue"
              maxLength={200}
              required
            />
          </div>

          <div className="support-field">
            <label className="support-label" htmlFor="support-message">
              Message <span className="support-required">*</span>
            </label>
            <textarea
              id="support-message"
              className="support-textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe what happened, what you expected, and any other details that might help us."
              maxLength={5000}
              rows={6}
              required
            />
            <span className="support-charcount">{message.length}/5,000</span>
          </div>

          {user && (
            <div className="support-context">
              <p className="support-context__label">Sending as</p>
              <p className="support-context__value">{user.displayName} ({user.email})</p>
            </div>
          )}

          {status === 'error' && (
            <div className="support-error" role="alert">
              {errorMsg || 'Something went wrong. Please try again or email us directly at finalservivor@gmail.com.'}
            </div>
          )}

          <button
            type="submit"
            className="support-submit"
            disabled={!canSubmit}
          >
            {status === 'sending' ? 'Sending...' : 'Send message'}
          </button>

          <p className="support-alt">
            You can also email us directly at{' '}
            <a href="mailto:finalservivor@gmail.com">finalservivor@gmail.com</a>
          </p>
        </form>
      </div>
    </div>
  );
}
