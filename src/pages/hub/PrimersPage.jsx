import { useState, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import PrimerEditor from '../../components/PrimerEditor'

const VERDICT_COLOR = {
  Favored: 'var(--emerald)',
  Even: 'var(--muted)',
  Behind: 'var(--ruby)',
}

const CONFIDENCE_STYLE = {
  Draft: { borderColor: 'var(--line-2)', color: 'var(--faint)' },
  Tentative: { borderColor: 'color-mix(in srgb, var(--amber) 40%, transparent)', color: 'var(--amber)' },
  Solid: { borderColor: 'color-mix(in srgb, var(--emerald) 40%, transparent)', color: 'var(--emerald)' },
}

export default function PrimersPage() {
  const { hub, user } = useOutletContext()
  const [primers, setPrimers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // null=closed, false=new, primer obj=edit
  const [deleting, setDeleting] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetch(`/api/primers?hubId=${encodeURIComponent(hub.id)}`)
      .then(r => { if (!r.ok) throw new Error('load'); return r.json() })
      .then(data => { if (!cancelled) setPrimers(Array.isArray(data) ? data : []) })
      .catch(() => { if (!cancelled) setError('Failed to load primers.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [hub.id])

  const handleSaved = (saved) => {
    setPrimers(prev => {
      const idx = prev.findIndex(p => p.id === saved.id)
      return idx >= 0 ? prev.map(p => p.id === saved.id ? saved : p) : [saved, ...prev]
    })
    setEditing(null)
  }

  const handleDelete = async (primer) => {
    const prev = primers
    setPrimers(ps => ps.filter(p => p.id !== primer.id))
    setDeleting(primer.id)
    try {
      const r = await fetch(`/api/primers/${primer.id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('delete')
    } catch {
      setPrimers(prev)
      setError('Failed to delete primer.')
    } finally {
      setDeleting(null)
    }
  }

  // Group by deckArchetype for display
  const grouped = primers.reduce((acc, p) => {
    if (!acc[p.deckArchetype]) acc[p.deckArchetype] = []
    acc[p.deckArchetype].push(p)
    return acc
  }, {})

  const isOwner = hub.ownerId === user?.id || hub.ownerId === user?.uid

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-display text-lg" style={{ fontWeight: 560, color: 'var(--text)' }}>Strategy Primers</h3>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>Matchup write-ups for your team's archetypes</p>
        </div>
        <button
          onClick={() => setEditing(false)}
          className="px-4 py-2 rounded-lg text-sm font-semibold shadow transition hover:brightness-110"
          style={{ background: 'var(--sapphire)', color: '#0b1620' }}
        >
          + New Primer
        </button>
      </div>

      {error && <p className="text-sm mb-4" style={{ color: 'var(--ruby)' }}>{error}</p>}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: 'var(--panel)' }} />
          ))}
        </div>
      ) : primers.length === 0 ? (
        <div className="text-center py-16" style={{ color: 'var(--faint)' }}>
          <p className="text-4xl mb-3">📖</p>
          <p className="text-sm">No primers yet. Write up a matchup to get started.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([deck, group]) => (
            <div key={deck}>
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.1em] mb-3" style={{ color: 'var(--faint)' }}>
                {deck}
              </h4>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {group.map(primer => (
                  <PrimerCard
                    key={primer.id}
                    primer={primer}
                    userId={user?.id || user?.uid}
                    isOwner={isOwner}
                    deleting={deleting === primer.id}
                    onEdit={() => setEditing(primer)}
                    onDelete={() => handleDelete(primer)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing !== null && (
        <PrimerEditor
          primer={editing || null}
          hubId={hub.id}
          onSaved={handleSaved}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function PrimerCard({ primer, userId, isOwner, deleting, onEdit, onDelete }) {
  const canDelete = primer.ownerId === userId || isOwner
  const verdictColor = VERDICT_COLOR[primer.verdict] || 'var(--muted)'
  const confStyle = CONFIDENCE_STYLE[primer.confidence] || CONFIDENCE_STYLE.Draft
  const [confirming, setConfirming] = useState(false)

  return (
    <div
      className="group relative rounded-xl border p-4 transition-colors"
      style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--line-2)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--line)')}
    >
      <button onClick={onEdit} className="w-full text-left">
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="text-sm font-medium leading-snug" style={{ color: 'var(--text)' }}>
            vs {primer.vsArchetype}
          </span>
          {primer.verdict && (
            <span className="text-xs font-semibold shrink-0" style={{ color: verdictColor }}>
              {primer.verdict}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] border rounded px-1.5 py-0.5" style={confStyle}>
            {primer.confidence}
          </span>
          {primer.gameplan && (
            <span className="text-[11px] truncate" style={{ color: 'var(--faint)' }}>
              {primer.gameplan.slice(0, 60)}…
            </span>
          )}
        </div>
      </button>

      {canDelete && !confirming && (
        <button
          onClick={() => setConfirming(true)}
          disabled={deleting}
          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all text-xs px-1"
          style={{ color: 'var(--faint)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ruby)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--faint)')}
        >
          {deleting ? '…' : '✕'}
        </button>
      )}
      {canDelete && confirming && (
        <div className="absolute top-3 right-3 flex items-center gap-1">
          <button onClick={onDelete} disabled={deleting} className="text-xs hover:brightness-110" style={{ color: 'var(--ruby)' }}>Sure?</button>
          <button onClick={() => setConfirming(false)} className="text-xs" style={{ color: 'var(--faint)' }}>✕</button>
        </div>
      )}
    </div>
  )
}
