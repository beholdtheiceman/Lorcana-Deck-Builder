// Toggleable pill button. Extracted verbatim from App.jsx (H9).
export default function Pill({ children, active = false, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm border transition ${
        active
          ? "bg-emerald-600 text-white border-emerald-600"
          : "bg-gray-600 text-gray-200 border-gray-500 hover:bg-gray-500"
      }`}
    >
      {children}
    </button>
  )
}
