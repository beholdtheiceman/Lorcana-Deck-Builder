import { useEffect, useRef } from 'react'

/**
 * A bottom sheet used below `lg` to host a builder pane that has its own
 * column on desktop. Rendered in normal flow as a fixed overlay; focus moves
 * in on open and returns to whatever was focused before on close.
 */
function Sheet({ open, onClose, label, side, children }) {
  const panelRef = useRef(null)
  const returnFocusRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

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

  const anchor =
    side === 'bottom'
      ? 'inset-x-0 bottom-0 max-h-[85vh] rounded-t-xl'
      : 'inset-y-0 left-0 w-[85vw] max-w-xs'

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
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
        aria-label={label}
        tabIndex={-1}
        className={`absolute overflow-y-auto border p-4 outline-none ${anchor}`}
        style={{ background: 'var(--canvas)', borderColor: 'var(--line)', color: 'var(--text)' }}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">{label}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${label.toLowerCase()}`}
            className="rounded border px-2 py-1 text-xs"
            style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function FilterSheet({ open, onClose, children }) {
  return (
    <Sheet open={open} onClose={onClose} label="Filters" side="left">
      {children}
    </Sheet>
  )
}

export function DeckSheet({ open, onClose, children }) {
  return (
    <Sheet open={open} onClose={onClose} label="Deck" side="bottom">
      {children}
    </Sheet>
  )
}

export default Sheet
