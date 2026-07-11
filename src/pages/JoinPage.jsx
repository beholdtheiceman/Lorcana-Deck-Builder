import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function JoinPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  const [code, setCode] = useState(searchParams.get('code') || '')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  // Auto-join once auth is ready and code came from URL
  useEffect(() => {
    const urlCode = searchParams.get('code')
    if (!urlCode || authLoading || !user) return
    handleJoin(urlCode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user])

  const handleJoin = async (inviteCode = code) => {
    const trimmed = (inviteCode || '').trim().toUpperCase()
    if (trimmed.length !== 8) {
      setError('Invite codes are 8 characters. Check the link and try again.')
      return
    }
    setJoining(true)
    setError('')
    try {
      const res = await fetch('/api/hubs/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Join failed')
      setDone(true)
      setTimeout(() => navigate('/team-hub', { replace: true }), 1500)
    } catch (e) {
      setError(e.message || 'Something went wrong.')
    } finally {
      setJoining(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading…</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <p className="text-2xl">👥</p>
          <h1 className="font-display text-xl" style={{ fontWeight: 560, color: 'var(--text)' }}>Join a Hub</h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Sign in or create an account to join this hub.</p>
          {searchParams.get('code') && (
            <p className="text-xs" style={{ color: 'var(--faint)' }}>
              Invite code: <span className="font-mono" style={{ color: 'var(--text)' }}>{searchParams.get('code')}</span>
            </p>
          )}
          <div className="flex gap-3 justify-center pt-2">
            <Link
              to={`/?join=${searchParams.get('code') || ''}`}
              className="px-4 py-2 rounded-md text-sm font-semibold transition hover:brightness-110"
              style={{ background: 'var(--sapphire)', color: '#0b1620' }}
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-3xl">✓</p>
          <p className="font-medium" style={{ color: 'var(--text)' }}>You've joined the hub!</p>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Redirecting…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-sm w-full space-y-6">
        <div className="text-center">
          <p className="text-2xl mb-2">👥</p>
          <h1 className="font-display text-xl" style={{ fontWeight: 560, color: 'var(--text)' }}>Join a Hub</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Enter the 8-character invite code from your team.</p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleJoin() }} className="space-y-3">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="XXXXXXXX"
            maxLength={8}
            disabled={joining}
            className="w-full px-4 py-3 text-center text-lg font-mono tracking-widest rounded-xl focus:outline-none disabled:opacity-50"
            style={{ background: 'var(--panel-2)', border: '1px solid var(--line-2)', color: 'var(--text)' }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--sapphire)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--line-2)')}
          />
          {error && <p className="text-sm text-center" style={{ color: 'var(--ruby)' }}>{error}</p>}
          <button
            type="submit"
            disabled={joining || code.trim().length !== 8}
            className="w-full py-2.5 rounded-md font-semibold transition hover:brightness-110 disabled:opacity-40"
            style={{ background: 'var(--sapphire)', color: '#0b1620' }}
          >
            {joining ? 'Joining…' : 'Join Hub'}
          </button>
        </form>

        <p className="text-center text-xs" style={{ color: 'var(--faint)' }}>
          <Link to="/team-hub" className="font-semibold" style={{ color: 'var(--sapphire)' }}>Go to your hubs →</Link>
        </p>
      </div>
    </div>
  )
}
