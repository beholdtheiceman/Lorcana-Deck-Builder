import { useEffect, useRef, useState } from 'react'

/**
 * Actions for a saved deck.
 *
 * The three copy actions are collapsed into one menu: they are variations of
 * the same intent, and as sibling buttons they read as three unrelated
 * features. Everything else is a single quiet row — there is one primary
 * action here (Save), so only Save is filled.
 */
function CopyMenu({ items }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(null)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDown = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false)
    }
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (!copied) return undefined
    const timer = setTimeout(() => setCopied(null), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  const run = (item) => {
    item.onSelect()
    setCopied(item.label)
    setOpen(false)
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border px-3 py-2 text-sm"
        style={{ borderColor: 'var(--line)', color: 'var(--text)', background: 'var(--canvas)' }}
      >
        {copied ? `Copied ${copied}` : 'Copy'}
        <span aria-hidden="true" className="ml-1.5 text-xs" style={{ color: 'var(--muted)' }}>▾</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Copy deck"
          className="absolute right-0 z-20 mt-1 min-w-[13rem] overflow-hidden rounded-md border py-1 shadow-lg"
          style={{ background: 'var(--canvas)', borderColor: 'var(--line)' }}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => run(item)}
              className="block w-full px-3 py-2 text-left text-sm hover:brightness-125"
              style={{ color: 'var(--text)' }}
            >
              <span className="block">{item.label}</span>
              {item.hint && (
                <span className="block text-xs" style={{ color: 'var(--muted)' }}>{item.hint}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function DeckActionBar({
  canSave = true,
  onSave,
  onDownloadImage,
  isGeneratingImage = false,
  onPrint,
  onCopyDeckList,
  onCopyLorcanito,
  onCopyStats,
  teamHub,
}) {
  const quiet = {
    borderColor: 'var(--line)',
    color: 'var(--text)',
    background: 'var(--canvas)',
  }

  return (
    <div
      className="mt-6 border-t pt-5"
      style={{ borderColor: 'var(--line)' }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className="rounded-md px-3 py-2 text-sm font-medium disabled:cursor-not-allowed"
          style={{
            background: canSave ? 'var(--sapphire)' : 'var(--line)',
            color: canSave ? 'var(--canvas)' : 'var(--muted)',
          }}
        >
          Save deck
        </button>

        <CopyMenu
          items={[
            { label: 'Deck list', hint: '4 Nick Wilde - Soggy Fox', onSelect: onCopyDeckList },
            { label: 'Lorcanito format', onSelect: onCopyLorcanito },
            { label: 'Stats summary', onSelect: onCopyStats },
          ]}
        />

        <button
          type="button"
          onClick={onDownloadImage}
          disabled={isGeneratingImage}
          className="rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed"
          style={quiet}
        >
          {isGeneratingImage ? 'Generating…' : 'Download image'}
        </button>

        <button
          type="button"
          onClick={onPrint}
          className="rounded-md border px-3 py-2 text-sm"
          style={quiet}
        >
          Print
        </button>

        {teamHub && (
          <div className="ml-auto flex items-center gap-2">
            <label
              htmlFor="deck-team-hub"
              className="text-sm"
              style={{ color: 'var(--muted)' }}
            >
              Team Hub
            </label>
            <select
              id="deck-team-hub"
              value={teamHub.selectedId}
              onChange={(event) => teamHub.onSelect(event.target.value)}
              disabled={teamHub.loading}
              className="rounded-md border px-2 py-2 text-sm"
              style={quiet}
            >
              <option value="">Select…</option>
              {teamHub.hubs.map((hub) => (
                <option key={hub.id} value={hub.id}>{hub.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={teamHub.onSave}
              disabled={!teamHub.selectedId || teamHub.saving}
              className="rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed"
              style={quiet}
            >
              {teamHub.saving ? 'Adding…' : 'Add'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
