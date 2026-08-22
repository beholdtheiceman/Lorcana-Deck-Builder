const LABELS = {
  idle: 'Draft saved on this device',
  'local-only': 'Draft saved on this device',
  saving: 'Saving…',
  saved: 'Saved to your account',
  unsaved: 'Unsaved changes',
  error: "Couldn't save",
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
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={busy}
          className="rounded-md px-3 py-1.5 text-xs font-medium"
          style={{
            background: busy ? 'var(--line)' : 'var(--sapphire)',
            color: busy ? 'var(--muted)' : 'var(--canvas)',
          }}
        >
          {busy ? 'Saving…' : 'Save deck'}
        </button>
        <span role="status" style={{ color: status === 'error' ? 'var(--ruby)' : 'var(--muted)' }}>
          {LABELS[status] || LABELS.idle}{when && ` · ${when}`}
        </span>
      </div>

      {status === 'error' && saveStatus?.error?.message && (
        <p className="text-[11px]" style={{ color: 'var(--ruby)' }}>
          {saveStatus.error.message}
        </p>
      )}
    </div>
  )
}
