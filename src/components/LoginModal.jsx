import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginModal({ isOpen, onClose, onSwitchToRegister }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);
    
    if (result.success) {
      onClose();
      setEmail('');
      setPassword('');
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
            <h2 className="font-display text-2xl" style={{ fontWeight: 560, color: 'var(--text)' }}>Sign in</h2>
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
              <label htmlFor="login-email" className="block text-sm font-medium mb-2" style={{ color: 'var(--muted)' }}>
                Email
              </label>
              <input
                id="login-email"
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
              <label htmlFor="login-password" className="block text-sm font-medium mb-2" style={{ color: 'var(--muted)' }}>
                Password
              </label>
              <input
                id="login-password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg focus:outline-none transition-colors"
                style={{ background: 'var(--panel-2)', border: '1px solid var(--line-2)', color: 'var(--text)' }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--sapphire)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--line-2)')}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />
            </div>

            <div className="text-right">
              <button
                type="button"
                onClick={() => { onClose(); navigate('/forgot-password'); }}
                className="text-xs transition-colors"
                style={{ color: 'var(--muted)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full font-semibold py-2 px-4 rounded-md transition hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: 'var(--sapphire)', color: '#0b1620' }}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Don't have an account?{' '}
              <button
                onClick={onSwitchToRegister}
                className="font-semibold transition-colors"
                style={{ color: 'var(--sapphire)' }}
              >
                Create account
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
