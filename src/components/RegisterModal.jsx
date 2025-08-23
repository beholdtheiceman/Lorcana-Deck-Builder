import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function RegisterModal({ isOpen, onClose, onSwitchToLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();

  // Handle click outside to close
  const handleBackdropClick = (e) => {
    console.log('[RegisterModal] Backdrop clicked, target:', e.target, 'currentTarget:', e.currentTarget);
    if (e.target === e.currentTarget) {
      console.log('[RegisterModal] Closing modal');
      onClose();
    }
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

  console.log('[RegisterModal] Rendering with email:', email);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 grid place-items-center p-4" 
         onClick={handleBackdropClick}
         onMouseDown={(e) => {
           if (e.target === e.currentTarget) {
             console.log('[RegisterModal] Mouse down on backdrop, closing');
             onClose();
           }
         }}>
       <div className="w-full max-w-md">
        <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md mx-4 border border-gray-800" onClick={(e) => {
          console.log('[RegisterModal] Modal content clicked, stopping propagation');
          e.stopPropagation();
        }}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">Create Account</h2>
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

            {/* Email Field - First and Most Important */}
            <div className="bg-yellow-900/30 p-4 rounded-lg border-2 border-yellow-500">
              <label className="block text-lg font-bold text-yellow-300 mb-3">
                🚨 EMAIL ADDRESS REQUIRED 🚨
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white text-black placeholder-gray-600 border-2 border-yellow-400 focus:border-yellow-300 focus:outline-none text-lg font-medium"
                placeholder="Enter your email address here"
                required
              />
              <p className="text-sm text-yellow-200 mt-2 font-medium">This will be your login username</p>
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
                placeholder="Create a password (min 8 characters)"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-400 focus:border-emerald-400 focus:outline-none transition-colors"
                placeholder="Confirm your password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-400 text-sm">
              Already have an account?{' '}
              <button
                onClick={onSwitchToLogin}
                className="text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                Login here
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
