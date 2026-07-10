import { useState, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import PrimerEditor from '../../components/PrimerEditor'

const VERDICT_COLOR = {
  Favored: 'text-emerald-400',
  Even: 'text-gray-400',
  Behind: 'text-rose-400',
}

const CONFIDENCE_STYLE = {
  Draft: 'border-white/10 text-gray-500',
  Tentative: 'border-yellow-500/40 text-yellow-400',
  Solid: 'border-emerald-500/40 text-emerald-400',
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
          <h3 className="text-lg font-semibold text-gray-100">Strategy Primers</h3>
          <p className="text-sm text-gray-400 mt-0.5">Matchup write-ups for your team's archetypes</p>
        </div>
        <button
          onClick={() => setEditing(false)}
          className="px-4 py-2 rounded-lg bg-gradient-to-b from-violet-500 to-indigo-600 text-white text-sm font-medium shadow hover:opacity-90 transition-opacity"
        >
          + New Primer
        </button>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-20 rounded-xl bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      ) : primers.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-4xl mb-3">📖</p>
          <p className="text-sm">No primers yet. Write up a matchup to get started.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([deck, group]) => (
            <div key={deck}>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
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
  const verdictCls = VERDICT_COLOR[primer.verdict] || 'text-gray-400'
  const confCls = CONFIDENCE_STYLE[primer.confidence] || CONFIDENCE_STYLE.Draft
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="group relative rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:border-white/20 transition-colors">
      <button onClick={onEdit} className="w-full text-left">
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="text-sm font-medium text-gray-100 leading-snug">
            vs {primer.vsArchetype}
          </span>
          {primer.verdict && (
            <span className={`text-xs font-semibold shrink-0 ${verdictCls}`}>
              {primer.verdict}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] border rounded px-1.5 py-0.5 ${confCls}`}>
            {primer.confidence}
          </span>
          {primer.gameplan && (
            <span className="text-[11px] text-gray-500 truncate">
              {primer.gameplan.slice(0, 60)}…
            </span>
          )}
        </div>
      </button>

      {canDelete && !confirming && (
        <button
          onClick={() => setConfirming(true)}
          disabled={deleting}
          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all text-xs px-1"
        >
          {deleting ? '…' : '✕'}
        </button>
      )}
      {canDelete && confirming && (
        <div className="absolute top-3 right-3 flex items-center gap-1">
          <button onClick={onDelete} disabled={deleting} className="text-red-400 hover:text-red-300 text-xs">Sure?</button>
          <button onClick={() => setConfirming(false)} className="text-gray-500 hover:text-gray-300 text-xs">✕</button>
        </div>
      )}
    </div>
  )
}
