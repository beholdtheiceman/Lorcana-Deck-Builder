import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import LoginModal from './LoginModal';
import RegisterModal from './RegisterModal';
import UserMenu from './UserMenu';

export default function AuthButton() {
  const { user } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  if (user) {
    return <UserMenu />;
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowLogin(true)}
          className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 transition"
        >
          Login
        </button>
        <button
          onClick={() => setShowRegister(true)}
          className="px-3 py-2 rounded-lg bg-gradient-to-b from-violet-500 to-indigo-500 hover:brightness-110 text-white shadow-[0_3px_12px_-3px_rgba(139,108,255,0.7)] transition"
        >
          Register
        </button>
      </div>

      <LoginModal
        isOpen={showLogin}
        onClose={() => setShowLogin(false)}
        onSwitchToRegister={() => {
          setShowLogin(false);
          setShowRegister(true);
        }}
      />

      <RegisterModal
        isOpen={showRegister}
        onClose={() => setShowRegister(false)}
        onSwitchToLogin={() => {
          setShowRegister(false);
          setShowLogin(true);
        }}
      />
    </>
  );
}
