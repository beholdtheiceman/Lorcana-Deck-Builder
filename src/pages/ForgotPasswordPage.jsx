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
      <div className="w-full max-w-md bg-gray-900 rounded-xl border border-gray-800 p-8">
        <h1 className="text-2xl font-bold text-white mb-2">Forgot password?</h1>
        <p className="text-gray-400 text-sm mb-6">Enter your email and we'll send you a reset link.</p>

        {sent ? (
          <div className="space-y-4">
            <div className="bg-violet-900/40 border border-violet-700 text-violet-200 px-4 py-3 rounded-lg text-sm">
              Check your email — we sent a reset link to <strong>{email}</strong>.
            </div>
            <Link to="/" className="block text-center text-sm text-gray-400 hover:text-gray-200 transition">
              ← Back to home
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-900/50 border border-red-700 text-red-200 px-3 py-2 rounded-lg text-sm">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="fp-email" className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <input
                id="fp-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-400 focus:border-violet-500 focus:outline-none transition-colors"
                placeholder="you@example.com"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-b from-violet-500 to-indigo-500 hover:brightness-110 disabled:opacity-60 text-white font-medium py-2 px-4 rounded-lg transition"
            >
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
            <Link to="/" className="block text-center text-sm text-gray-400 hover:text-gray-200 transition">
              ← Back to home
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
