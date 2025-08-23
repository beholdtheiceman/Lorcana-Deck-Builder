import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginModal({ isOpen, onClose, onSwitchToRegister }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  // Handle click outside to close
  const handleBackdropClick = (e) => {
    console.log('[LoginModal] Backdrop clicked, target:', e.target, 'currentTarget:', e.currentTarget);
    if (e.target === e.currentTarget) {
      console.log('[LoginModal] Closing modal');
      onClose();
    }
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
          onClick={handleBackdropClick}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              console.log('[LoginModal] Mouse down on backdrop, closing');
              onClose();
            }
          }}>
       <div className="w-full max-w-md">
        <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md mx-4 border border-gray-800" onClick={(e) => {
          console.log('[LoginModal] Modal content clicked, stopping propagation');
          e.stopPropagation();
        }}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">Login</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-900 border border-red-700 text-red-200 px-3 py-2 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-400 focus:border-emerald-400 focus:outline-none transition-colors"
                placeholder="Enter your email"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-400 focus:border-emerald-400 focus:outline-none transition-colors"
                placeholder="Enter your password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-400 text-sm">
              Don't have an account?{' '}
              <button
                onClick={onSwitchToRegister}
                className="text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                Register here
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
