// Titled panel used by tournament results / stats surfaces. Extracted verbatim
// from App.jsx (H9).
export default function Section({ title, subtitle, children }) {
  return (
    <div className="p-4 md:p-5 rounded-2xl border border-gray-600 bg-gray-700 shadow-sm">
      <div className="mb-3">
        <h3 className="text-base md:text-lg font-semibold text-emerald-300">{title}</h3>
        {subtitle && <p className="text-sm text-gray-300 mt-1">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}
