import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function UserMenu() {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    setIsOpen(false);
  };

  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-md border transition-colors hover:brightness-125"
        style={{ background: 'var(--panel-2)', borderColor: 'var(--line-2)' }}
      >
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium"
          style={{ background: 'var(--emerald)', color: '#0b1620' }}
        >
          {user.email.charAt(0).toUpperCase()}
        </div>
        <span className="text-sm hidden sm:block" style={{ color: 'var(--muted)' }}>
          {user.email}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          style={{ color: 'var(--faint)' }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-md border shadow-lg z-50" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
          <div className="py-2">
            <div className="px-4 py-2 border-b" style={{ borderColor: 'var(--line)' }}>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Signed in as</p>
              <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{user.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 text-sm transition-colors hover:bg-[color:var(--panel-2)]"
              style={{ color: 'var(--muted)' }}
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
