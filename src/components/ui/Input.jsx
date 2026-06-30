export default function Input({
  label,
  error,
  className = '',
  id,
  ...rest
}) {
  const inputId = id || label.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className={className}>
      <label htmlFor={inputId} className="block text-sm text-gray-400 mb-1">
        {label}
      </label>
      <input
        id={inputId}
        {...rest}
        className={`w-full h-9 px-3 bg-bg-overlay border rounded-md text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-colors duration-fast ${error ? 'border-bad' : 'border-line'}`}
      />
      {error && <p className="mt-1 text-xs text-bad">{error}</p>}
    </div>
  )
}
