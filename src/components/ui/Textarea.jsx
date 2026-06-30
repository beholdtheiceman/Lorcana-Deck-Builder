export default function Textarea({
  label,
  error,
  className = '',
  id,
  ...rest
}) {
  const textareaId = id || label.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className={className}>
      <label htmlFor={textareaId} className="block text-sm text-gray-400 mb-1">
        {label}
      </label>
      <textarea
        id={textareaId}
        {...rest}
        className={`w-full px-3 py-2 bg-bg-overlay border rounded-md text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-colors duration-fast resize-none ${error ? 'border-bad' : 'border-line'}`}
      />
      {error && <p className="mt-1 text-xs text-bad">{error}</p>}
    </div>
  )
}
