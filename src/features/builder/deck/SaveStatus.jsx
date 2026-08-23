const LABELS = {
  idle: 'Draft only',
  'local-only': 'Draft only',
  saving: 'Saving…',
  saved: 'Saved',
  unsaved: 'Unsaved changes',
  error: "Couldn't save",
}

const HINTS = {
  idle: 'Saved on this device. Press Save to store it on your account.',
  'local-only': 'Saved on this device. Press Save to store it on your account.',
  saved: 'Stored on your account',
  unsaved: 'Edited since the last save',
}

function relative(timestamp) {
  if (!timestamp) return ''
  const seconds = Math.round((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  return `${Math.round(minutes / 60)}h ago`
}

export default function SaveStatus({ saveStatus, onSave }) {
  const status = saveStatus?.status || 'idle'
  const busy = status === 'saving'
  const when = status === 'saved' ? relative(saveStatus?.lastSavedAt) : ''

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <button
          type="button"
          onClick={onSave}
          disabled={busy}
          className="shrink-0 rounded-md px-3 py-1.5 text-xs font-medium"
          style={{
            background: busy ? 'var(--line)' : 'var(--sapphire)',
            color: busy ? 'var(--muted)' : 'var(--canvas)',
          }}
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
        <span
          role="status"
          title={HINTS[status] || ''}
          className="text-xs"
          style={{ color: status === 'error' ? 'var(--ruby)' : 'var(--muted)' }}
        >
          {LABELS[status] || LABELS.idle}{when && ` · ${when}`}
        </span>
      </div>

      {status === 'error' && saveStatus?.error?.message && (
        <p className="text-[11px] leading-snug" style={{ color: 'var(--ruby)' }}>
          {saveStatus.error.message}
        </p>
      )}
    </div>
  )
}
