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
      <div className={`bg-[#11151f] border border-white/10 rounded-2xl ${sizeClasses[size]} shadow-2xl`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="text-lg font-semibold font-display">{title}</div>
          <button
            className="px-2.5 py-1 rounded-md text-sm bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10 hover:border-white/20 transition"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="p-4 overflow-y-auto overflow-x-hidden max-h-[calc(95vh-120px)]">{children}</div>
        {footer && <div className="px-4 py-3 border-t border-white/10">{footer}</div>}
      </div>
    </div>
  )
}
