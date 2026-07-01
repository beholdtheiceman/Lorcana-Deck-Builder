import Spinner from './Spinner'

const variants = {
  primary: 'bg-brand text-brand-fg hover:bg-violet-500 border-transparent',
  ghost:   'bg-transparent text-gray-200 hover:bg-white/10 border-line',
  danger:  'bg-bad/10 text-bad hover:bg-bad/20 border-bad/40',
  subtle:  'bg-white/5 text-gray-300 hover:bg-white/10 border-transparent',
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon = null,
  className = '',
  disabled,
  ...props
}) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || loading}
      className={`
        inline-flex items-center gap-2 font-medium rounded-md border
        transition-colors duration-fast
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]} ${sizes[size]} ${className}
      `}
    >
      {loading ? <Spinner size="sm" /> : icon}
      {children}
    </button>
  )
}
