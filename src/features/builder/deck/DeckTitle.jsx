import { useEffect, useRef, useState } from 'react'

const fallbackName = (name) => String(name || '').trim() || 'Untitled Deck'

export default function DeckTitle({ name, onRename }) {
  const visibleName = fallbackName(name)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(visibleName)
  const previousName = useRef(visibleName)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!editing) setDraft(visibleName)
  }, [editing, visibleName])

  useEffect(() => {
    if (!editing) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [editing])

  const beginEditing = () => {
    previousName.current = visibleName
    setDraft(visibleName)
    setEditing(true)
  }

  const commit = () => {
    const nextName = fallbackName(draft)
    setDraft(nextName)
    setEditing(false)
    onRename?.(nextName)
  }

  const cancel = () => {
    setDraft(previousName.current)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        aria-label="Deck name"
        className="h-10 w-full rounded-md border bg-transparent px-2 font-semibold outline-none focus:ring-2"
        style={{ borderColor: 'var(--line)', color: 'var(--text)', '--tw-ring-color': 'var(--sapphire)' }}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commit()
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            cancel()
          }
        }}
      />
    )
  }

  return (
    <button
      type="button"
      aria-label={`Rename deck: ${visibleName}`}
      className="w-full rounded-md border border-transparent px-2 py-1 text-left font-semibold outline-none hover:border-current focus-visible:ring-2"
      style={{ color: 'var(--text)', '--tw-ring-color': 'var(--sapphire)' }}
      onClick={beginEditing}
    >
      {visibleName}
    </button>
  )
}
