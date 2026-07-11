import { useParams, NavLink, Outlet, Navigate } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import Skeleton from '../components/ui/Skeleton'
import ErrorBoundary from '../components/ErrorBoundary'
import { useAuth } from '../contexts/AuthContext'

const NAV_TABS = [
  { label: 'Home',      path: 'home' },
  { label: 'Roster',    path: 'roster' },
  { label: 'Practices', path: 'practices' },
  { label: 'Events',    path: 'events' },
  { label: 'Meta',      path: 'reports' },
  { label: 'Replays',   path: 'reviews' },
  { label: 'Primers',   path: 'primers' },
  { label: 'Match Log', path: 'playtest' },
  { label: 'Ask AI',    path: 'ask' },
]

export default function HubDetailLayout() {
  const { id: hubId } = useParams()
  const [hub, setHub] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const { user } = useAuth()

  const copyInviteLink = useCallback((inviteCode) => {
    const url = `${window.location.origin}/join?code=${inviteCode}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [])

  useEffect(() => {
    fetch(`/api/hubs/${hubId}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => setHub(data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [hubId])

  if (loading) return (
    <div className="space-y-4 p-4">
      <Skeleton variant="block" className="h-16" />
      <Skeleton variant="line" className="w-2/3" />
    </div>
  )

  if (error) return (
    <div className="text-center py-12" style={{ color: 'var(--ruby)' }}>Failed to load hub: {error}</div>
  )

  if (!hub) return null

  const memberCount = (hub.members?.length ?? 0) + 1
  const crestInitial = (hub.name?.trim()?.[0] || 'U').toUpperCase()

  return (
    <div>
      {/* Header — crest hexagon, Fraunces title, invite chip on the flat canvas */}
      <div className="flex items-start gap-5 mb-5 pb-5" style={{ borderBottom: '1px solid var(--line)' }}>
        {/* Crest: hexagon with a conic six-ink gradient and a panel cutout ring */}
        <div
          className="relative shrink-0"
          role="img"
          aria-label="Team crest"
          style={{
            width: 64,
            height: 72,
            clipPath: 'var(--hex)',
            background:
              'conic-gradient(from 210deg, var(--amber), var(--ruby), var(--amethyst), var(--sapphire), var(--steel), var(--emerald), var(--amber))',
          }}
        >
          <span className="absolute" style={{ inset: 4, clipPath: 'var(--hex)', background: 'var(--panel)' }} />
          <span
            className="absolute inset-0 grid place-items-center font-display"
            style={{ fontWeight: 700, fontSize: 22, color: 'var(--text)' }}
          >
            {crestInitial}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--muted)' }}>
            Team Hub
          </div>
          <h2
            className="font-display mt-1 mb-1.5"
            style={{ fontWeight: 560, fontSize: 30, lineHeight: 1.05, letterSpacing: '-0.01em', color: 'var(--text)' }}
          >
            {hub.name}
          </h2>
          <p className="text-sm flex items-center gap-2.5 flex-wrap" style={{ color: 'var(--muted)' }}>
            <span>
              <b className="tabular-nums" style={{ color: 'var(--text)', fontWeight: 600 }}>{memberCount}</b>
              {' '}member{memberCount !== 1 ? 's' : ''}
            </span>
            <span style={{ color: 'var(--faint)' }}>·</span>
            <span className="inline-flex items-center gap-1.5">
              Invite
              <span
                className="font-mono text-xs"
                style={{
                  color: 'var(--muted)',
                  border: '1px dashed var(--line-2)',
                  borderRadius: 'var(--r-sm)',
                  padding: '2px 9px',
                  letterSpacing: '0.1em',
                }}
              >
                {hub.inviteCode}
              </span>
            </span>
            <button
              onClick={() => copyInviteLink(hub.inviteCode)}
              className="text-xs transition-colors"
              style={{ color: copied ? 'var(--emerald)' : 'var(--muted)' }}
              onMouseEnter={(e) => { if (!copied) e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={(e) => { if (!copied) e.currentTarget.style.color = 'var(--muted)' }}
            >
              {copied ? '✓ Copied!' : 'Copy link'}
            </button>
          </p>
        </div>
      </div>

      {/* Sub-nav — quiet muted links, active tab gets the sapphire underline */}
      <div className="flex gap-1 mb-6 overflow-x-auto" style={{ borderBottom: '1px solid var(--line)' }}>
        {NAV_TABS.map(tab => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) =>
              `px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'text-[color:var(--text)] shadow-[inset_0_-2px_0_var(--sapphire)] rounded-t-sm'
                  : 'text-[color:var(--muted)] hover:text-[color:var(--text)]'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      {/* Child route content */}
      <ErrorBoundary>
        <Outlet context={{ hub, user }} />
      </ErrorBoundary>
    </div>
  )
}
