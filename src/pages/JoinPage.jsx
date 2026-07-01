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
        <p className="text-gray-400 text-sm">Loading…</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <p className="text-2xl">👥</p>
          <h1 className="text-xl font-semibold text-white">Join a Hub</h1>
          <p className="text-sm text-gray-400">Sign in or create an account to join this hub.</p>
          {searchParams.get('code') && (
            <p className="text-xs text-gray-500">
              Invite code: <span className="font-mono text-gray-300">{searchParams.get('code')}</span>
            </p>
          )}
          <div className="flex gap-3 justify-center pt-2">
            <Link
              to={`/?join=${searchParams.get('code') || ''}`}
              className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700"
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
          <p className="text-white font-medium">You've joined the hub!</p>
          <p className="text-sm text-gray-400">Redirecting…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-sm w-full space-y-6">
        <div className="text-center">
          <p className="text-2xl mb-2">👥</p>
          <h1 className="text-xl font-semibold text-white">Join a Hub</h1>
          <p className="text-sm text-gray-400 mt-1">Enter the 8-character invite code from your team.</p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleJoin() }} className="space-y-3">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="XXXXXXXX"
            maxLength={8}
            disabled={joining}
            className="w-full px-4 py-3 text-center text-lg font-mono tracking-widest rounded-xl border border-white/10 bg-white/[0.03] text-white placeholder-gray-600 focus:border-violet-400/60 focus:outline-none disabled:opacity-50"
          />
          {error && <p className="text-sm text-red-400 text-center">{error}</p>}
          <button
            type="submit"
            disabled={joining || code.trim().length !== 8}
            className="w-full py-2.5 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-700 disabled:opacity-40 transition-colors"
          >
            {joining ? 'Joining…' : 'Join Hub'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-500">
          <Link to="/team-hub" className="text-violet-400 hover:text-violet-300">Go to your hubs →</Link>
        </p>
      </div>
    </div>
  )
}
