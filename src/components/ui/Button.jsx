import Spinner from './Spinner'

// Variants follow design/comps: primary is the deck's accent ink (sapphire
// default) with dark text; ghost is the comp's bordered transparent button.
const variants = {
  primary: 'bg-ink-sapphire text-[#0b1620] hover:brightness-110 border-transparent',
  ghost:   'bg-transparent text-[color:var(--text)] hover:bg-bg-overlay border-line',
  danger:  'bg-bad/10 text-bad hover:bg-bad/20 border-bad/40',
  subtle:  'bg-white/5 text-[color:var(--muted)] hover:bg-white/10 border-transparent',
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
