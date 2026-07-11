// App-wide modal shell. Extracted verbatim from App.jsx (H9).
export default function Modal({ open, onClose, title, children, footer, size = "md" }) {
  if (!open) return null

  // Size classes
  const sizeClasses = {
    sm: "w-[min(100%-2rem,500px)] max-h-[70vh]",
    md: "w-[min(100%-2rem,700px)] max-h-[80vh]",
    lg: "w-[min(100%-2rem,900px)] max-h-[85vh]",
    xl: "w-[min(100%-2rem,1200px)] max-h-[90vh]",
    full: "w-[min(100%-1rem,1400px)] max-h-[95vh]",
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`border rounded-2xl ${sizeClasses[size]} shadow-2xl`} style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--line)' }}>
          <div className="text-lg font-semibold font-display" style={{ color: 'var(--text)' }}>{title}</div>
          <button
            className="px-2.5 py-1 rounded-md text-sm border transition hover:brightness-110"
            style={{ background: 'var(--panel-2)', borderColor: 'var(--line-2)', color: 'var(--text)' }}
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="p-4 overflow-y-auto overflow-x-hidden max-h-[calc(95vh-120px)]">{children}</div>
        {footer && <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--line)' }}>{footer}</div>}
      </div>
    </div>
  )
}
