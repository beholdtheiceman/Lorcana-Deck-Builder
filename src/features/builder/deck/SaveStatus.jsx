const labels = {
  idle: 'Not saved',
  saving: 'Saving',
  saved: 'Saved',
  'local-only': 'Saved locally',
  'sync-failed': 'Sync failed',
}

export default function SaveStatus({ saveStatus }) {
  const status = saveStatus?.status || 'idle'
  const label = labels[status] || labels.idle

  return (
    <div className="flex items-center gap-2" style={{ color: 'var(--muted)' }} role="status">
      <span>{label}</span>
      {status === 'sync-failed' && (
        <button
          type="button"
          className="rounded border px-2 py-1 font-semibold"
          style={{ borderColor: 'var(--line)', color: 'var(--ruby)' }}
          onClick={saveStatus?.retry}
        >
          Retry
        </button>
      )}
    </div>
  )
}
