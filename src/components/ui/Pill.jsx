// Toggleable pill button. Extracted verbatim from App.jsx (H9).
export default function Pill({ children, active = false, onClick }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-sm border transition hover:brightness-110"
      style={
        active
          ? { background: 'var(--sapphire)', borderColor: 'var(--sapphire)', color: '#0b1620' }
          : { background: 'var(--panel-2)', borderColor: 'var(--line-2)', color: 'var(--text)' }
      }
    >
      {children}
    </button>
  )
}
