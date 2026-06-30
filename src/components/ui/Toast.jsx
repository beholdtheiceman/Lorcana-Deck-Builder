const variants = {
  success: 'bg-good/10 border-good/30 text-good',
  error:   'bg-bad/10 border-bad/30 text-bad',
  info:    'bg-white/5 border-white/20 text-gray-200',
}

export default function Toast({ children, variant = 'info', onDismiss }) {
  return (
    <div
      role="alert"
      className={`flex items-center justify-between gap-3 px-4 py-3 rounded-md border text-sm shadow-card min-w-64 ${variants[variant]}`}
    >
      <span>{children}</span>
      <button
        onClick={onDismiss}
        className="text-current opacity-60 hover:opacity-100 shrink-0"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}
