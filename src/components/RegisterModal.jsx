import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function RegisterModal({ isOpen, onClose, onSwitchToLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);

    const result = await register(email, password);
    
    if (result.success) {
      onClose();
      setEmail('');
      setPassword('');
      setConfirmPassword('');
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 grid place-items-center p-4"
         onClick={handleBackdropClick}>
       <div className="w-full max-w-md">
        <div className="rounded-xl p-6 w-full max-w-md mx-4 border" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-2xl" style={{ fontWeight: 560, color: 'var(--text)' }}>Create Account</h2>
            <button
              onClick={onClose}
              className="transition-colors"
              style={{ color: 'var(--muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
            {error && (
              <div className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--panel-2)', border: '1px solid color-mix(in srgb, var(--ruby) 40%, var(--line-2))', color: 'var(--ruby)' }}>
                {error}
              </div>
            )}

            <div>
              <label htmlFor="register-email" className="block text-sm font-medium mb-2" style={{ color: 'var(--muted)' }}>
                Email
              </label>
              <input
                id="register-email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg focus:outline-none transition-colors"
                style={{ background: 'var(--panel-2)', border: '1px solid var(--line-2)', color: 'var(--text)' }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--sapphire)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--line-2)')}
                placeholder="Enter your email"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label htmlFor="register-password" className="block text-sm font-medium mb-2" style={{ color: 'var(--muted)' }}>
                Password
              </label>
              <input
                id="register-password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg focus:outline-none transition-colors"
                style={{ background: 'var(--panel-2)', border: '1px solid var(--line-2)', color: 'var(--text)' }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--sapphire)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--line-2)')}
                placeholder="Create a password"
                autoComplete="new-password"
                required
              />
              <p className="text-xs mt-1" style={{ color: 'var(--faint)' }}>At least 8 characters</p>
            </div>

            <div>
              <label htmlFor="register-confirm-password" className="block text-sm font-medium mb-2" style={{ color: 'var(--muted)' }}>
                Confirm Password
              </label>
              <input
                id="register-confirm-password"
                name="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg focus:outline-none transition-colors"
                style={{ background: 'var(--panel-2)', border: '1px solid var(--line-2)', color: 'var(--text)' }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--sapphire)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--line-2)')}
                placeholder="Confirm your password"
                autoComplete="new-password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full font-semibold py-2 px-4 rounded-md transition hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: 'var(--sapphire)', color: '#0b1620' }}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Already have an account?{' '}
              <button
                onClick={onSwitchToLogin}
                className="font-semibold transition-colors"
                style={{ color: 'var(--sapphire)' }}
              >
                Sign in
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
