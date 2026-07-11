import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { checkAuth } = useAuth();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => navigate('/team-hub'), 2000);
      return () => clearTimeout(timer);
    }
  }, [success, navigate]);

  if (!token) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-full max-w-md rounded-xl border p-8 text-center" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
          <p className="font-medium" style={{ color: 'var(--ruby)' }}>Invalid reset link.</p>
          <p className="text-sm mt-2" style={{ color: 'var(--faint)' }}>Request a new one from the forgot password page.</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong');
      } else {
        if (checkAuth) await checkAuth();
        setSuccess(true);
      }
    } catch {
      setError('Network error — please try again');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-md rounded-xl border p-8" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
        <h1 className="font-display text-2xl mb-2" style={{ fontWeight: 560, color: 'var(--text)' }}>Set new password</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>Choose a strong password for your account.</p>

        {success ? (
          <div className="px-4 py-3 rounded-lg text-sm" style={{ background: 'color-mix(in srgb, var(--sapphire) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--sapphire) 40%, var(--line-2))', color: 'var(--text)' }}>
            Password updated! You're now logged in. Redirecting…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--panel-2)', border: '1px solid color-mix(in srgb, var(--ruby) 40%, var(--line-2))', color: 'var(--ruby)' }}>
                {error}
              </div>
            )}
            <div>
              <label htmlFor="rp-password" className="block text-sm font-medium mb-2" style={{ color: 'var(--muted)' }}>
                New password
              </label>
              <input
                id="rp-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg focus:outline-none transition-colors"
                style={{ background: 'var(--panel-2)', border: '1px solid var(--line-2)', color: 'var(--text)' }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--sapphire)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--line-2)')}
                placeholder="At least 8 characters"
                minLength={8}
                required
              />
              <p className="text-xs mt-1" style={{ color: 'var(--faint)' }}>At least 8 characters</p>
            </div>
            <div>
              <label htmlFor="rp-confirm" className="block text-sm font-medium mb-2" style={{ color: 'var(--muted)' }}>
                Confirm password
              </label>
              <input
                id="rp-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full px-3 py-2 rounded-lg focus:outline-none transition-colors"
                style={{ background: 'var(--panel-2)', border: '1px solid var(--line-2)', color: 'var(--text)' }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--sapphire)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--line-2)')}
                placeholder="Repeat your password"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full font-semibold py-2 px-4 rounded-md transition hover:brightness-110 disabled:opacity-60"
              style={{ background: 'var(--sapphire)', color: '#0b1620' }}
            >
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
