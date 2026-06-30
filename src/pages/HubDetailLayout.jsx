import { useParams, NavLink, Outlet, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Skeleton from '../components/ui/Skeleton'

const NAV_TABS = [
  { label: 'Roster',    path: 'roster' },
  { label: 'Pods',      path: 'pods' },
  { label: 'Practices', path: 'practices' },
  { label: 'Events',    path: 'events' },
  { label: 'Reports',   path: 'reports' },
  { label: 'Reviews',   path: 'reviews' },
  { label: 'Primers',   path: 'primers' },
  { label: 'Playtest',  path: 'playtest' },
]

export default function HubDetailLayout() {
  const { id: hubId } = useParams()
  const [hub, setHub] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // Get current user from localStorage (same pattern as existing code)
  const user = JSON.parse(localStorage.getItem('user') || 'null')

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
    <div className="text-bad text-center py-12">Failed to load hub: {error}</div>
  )

  if (!hub) return null

  const memberCount = (hub.members?.length ?? 0) + 1

  return (
    <div>
      {/* Header */}
      <div className="mb-4 pb-4 border-b border-line">
        <h2 className="text-xl font-semibold text-gray-100">{hub.name}</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          {memberCount} member{memberCount !== 1 ? 's' : ''} · Invite:{' '}
          <span className="font-mono bg-bg-overlay px-1.5 py-0.5 rounded text-gray-300">
            {hub.inviteCode}
          </span>
        </p>
      </div>

      {/* Sub-nav */}
      <div className="flex gap-1 border-b border-line mb-6 overflow-x-auto">
        {NAV_TABS.map(tab => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) =>
              `px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors duration-fast ${
                isActive
                  ? 'border-brand text-brand'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      {/* Child route content */}
      <Outlet context={{ hub, user }} />
    </div>
  )
}
