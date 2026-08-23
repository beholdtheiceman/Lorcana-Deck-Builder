import { useEffect, useRef, useState } from 'react'
import { parseTextImport } from '../../lib/import/textImport.js'

const PLACEHOLDER = `4 Cinderella - Ballroom Sensation
3 Mulan - Imperial Soldier
2 Be Prepared`

function countEntries(deck) {
  return Object.values(deck?.entries || {}).reduce((n, e) => n + (Number(e?.count) || 0), 0)
}

/**
 * Paste a decklist and import it.
 *
 * The parser resolves each line against the card pool and already tracks what
 * it could not match — it just used to log that and drop it. Here the preview
 * is the point: you see exactly which lines landed and which did not before
 * anything replaces your deck.
 */
export default function ImportDeckModal({ open, cards, currentDeckTotal = 0, onClose, onImport }) {
  const [text, setText] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const panelRef = useRef(null)
  const returnFocusRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    setText('')
    setResult(null)
    setError(null)
    returnFocusRef.current = document.activeElement
    panelRef.current?.focus()

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose?.()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      const previous = returnFocusRef.current
      if (previous && typeof previous.focus === 'function') previous.focus()
    }
  }, [open, onClose])

  if (!open) return null

  const preview = () => {
    setError(null)
    setResult(null)
    try {
      const deck = parseTextImport(text, cards)
      setResult({
        deck,
        matched: deck?._report?.matched || [],
        unmatched: deck?._report?.unmatched || [],
        total: countEntries(deck),
      })
    } catch (caught) {
      setError(caught?.message || 'Could not read that decklist')
    }
  }

  const confirm = () => {
    if (!result) return
    const { _report, ...clean } = result.deck
    onImport?.(clean)
    onClose?.()
  }

  const quiet = { borderColor: 'var(--line)', color: 'var(--text)', background: 'var(--canvas)' }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8">
      <div
        className="absolute inset-0"
        style={{ background: 'color-mix(in srgb, var(--canvas) 70%, black)' }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Import a deck"
        tabIndex={-1}
        className="relative flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-xl border outline-none"
        style={{ background: 'var(--canvas)', borderColor: 'var(--line)', color: 'var(--text)' }}
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b px-5 py-3" style={{ borderColor: 'var(--line)' }}>
          <h2 className="text-base font-semibold">Import a deck</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close import"
            className="rounded-md border px-2 py-1 text-xs"
            style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <label htmlFor="import-text" className="mb-1.5 block text-xs" style={{ color: 'var(--muted)' }}>
            Paste a decklist — one card per line, count first
          </label>
          <textarea
            id="import-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={9}
            spellCheck={false}
            placeholder={PLACEHOLDER}
            className="w-full rounded-md border p-3 font-mono text-xs"
            style={quiet}
          />

          {error && (
            <p role="alert" className="mt-3 text-sm" style={{ color: 'var(--ruby)' }}>{error}</p>
          )}

          {result && (
            <div className="mt-4 rounded-md border p-3" style={{ borderColor: 'var(--line)' }}>
              <p className="text-sm">
                <span className="font-semibold">{result.total}</span> cards
                {result.unmatched.length > 0 && (
                  <span style={{ color: 'var(--ruby)' }}>
                    {' '}· {result.unmatched.length} line{result.unmatched.length === 1 ? '' : 's'} not recognised
                  </span>
                )}
              </p>

              {result.unmatched.length > 0 && (
                <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                  Unrecognised lines are still added, as placeholder cards you can
                  correct — nothing is dropped silently.
                </p>
              )}

              {result.unmatched.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {result.unmatched.map((item, index) => (
                    <li key={`${item.name}-${index}`} className="text-xs" style={{ color: 'var(--muted)' }}>
                      {item.count ? `${item.count} ` : ''}{item.name}
                      {item.reason === 'ambiguous-needs-resolution' && ' — matches more than one card'}
                      {item.reason === 'not-found' && ' — no matching card'}
                    </li>
                  ))}
                </ul>
              )}

              {currentDeckTotal > 0 && (
                <p className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>
                  This replaces your current deck of {currentDeckTotal} cards.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t px-5 py-3" style={{ borderColor: 'var(--line)' }}>
          <button
            type="button"
            onClick={preview}
            disabled={!text.trim()}
            className="rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed"
            style={quiet}
          >
            Preview
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!result || result.total === 0}
            className="rounded-md px-3 py-2 text-sm font-medium disabled:cursor-not-allowed"
            style={{
              background: result && result.total > 0 ? 'var(--sapphire)' : 'var(--line)',
              color: result && result.total > 0 ? 'var(--canvas)' : 'var(--muted)',
            }}
          >
            Import
          </button>
        </div>
      </div>
    </div>
  )
}
