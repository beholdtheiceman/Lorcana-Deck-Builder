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
          className="px-3 py-2 rounded-md border text-sm font-medium transition hover:bg-white/5"
          style={{ borderColor: 'var(--line-2)', color: 'var(--text)' }}
        >
          Login
        </button>
        <button
          onClick={() => setShowRegister(true)}
          className="px-3 py-2 rounded-md text-sm font-semibold transition hover:brightness-110"
          style={{ background: 'var(--sapphire)', color: '#0b1620' }}
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
