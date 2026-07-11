export default function Select({
  label,
  error,
  className = '',
  id,
  children,
  ...rest
}) {
  const selectId = id || label.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className={className}>
      <label htmlFor={selectId} className="block text-sm text-[color:var(--muted)] mb-1">
        {label}
      </label>
      <select
        id={selectId}
        {...rest}
        className={`w-full h-9 px-3 bg-bg-overlay border rounded-md text-sm text-[color:var(--text)] appearance-none focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-colors duration-fast ${error ? 'border-bad' : 'border-line'}`}
      >
        {children}
      </select>
      {error && <p className="mt-1 text-xs text-bad">{error}</p>}
    </div>
  )
}
