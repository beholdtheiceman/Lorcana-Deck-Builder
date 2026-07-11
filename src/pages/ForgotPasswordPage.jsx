import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong');
      } else {
        setSent(true);
      }
    } catch {
      setError('Network error — please try again');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-md rounded-xl border p-8" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
        <h1 className="font-display text-2xl mb-2" style={{ fontWeight: 560, color: 'var(--text)' }}>Forgot password?</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>Enter your email and we'll send you a reset link.</p>

        {sent ? (
          <div className="space-y-4">
            <div className="px-4 py-3 rounded-lg text-sm" style={{ background: 'color-mix(in srgb, var(--sapphire) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--sapphire) 40%, var(--line-2))', color: 'var(--text)' }}>
              Check your email — we sent a reset link to <strong>{email}</strong>.
            </div>
            <Link to="/" className="block text-center text-sm transition" style={{ color: 'var(--muted)' }}>
              ← Back to home
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--panel-2)', border: '1px solid color-mix(in srgb, var(--ruby) 40%, var(--line-2))', color: 'var(--ruby)' }}>
                {error}
              </div>
            )}
            <div>
              <label htmlFor="fp-email" className="block text-sm font-medium mb-2" style={{ color: 'var(--muted)' }}>
                Email
              </label>
              <input
                id="fp-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg focus:outline-none transition-colors"
                style={{ background: 'var(--panel-2)', border: '1px solid var(--line-2)', color: 'var(--text)' }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--sapphire)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--line-2)')}
                placeholder="you@example.com"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full font-semibold py-2 px-4 rounded-md transition hover:brightness-110 disabled:opacity-60"
              style={{ background: 'var(--sapphire)', color: '#0b1620' }}
            >
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
            <Link to="/" className="block text-center text-sm transition" style={{ color: 'var(--muted)' }}>
              ← Back to home
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
