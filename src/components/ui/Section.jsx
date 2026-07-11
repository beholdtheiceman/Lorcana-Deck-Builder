// Titled panel used by tournament results / stats surfaces. Extracted verbatim
// from App.jsx (H9).
export default function Section({ title, subtitle, children }) {
  return (
    <div className="p-4 md:p-5 rounded-2xl border shadow-sm" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
      <div className="mb-3">
        <h3 className="text-base md:text-lg font-semibold font-display" style={{ color: 'var(--text)' }}>{title}</h3>
        {subtitle && <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}
