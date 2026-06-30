const variants = {
  default:   'bg-white/10 text-gray-300 border-white/20',
  good:      'bg-good/10 text-good border-good/30',
  warn:      'bg-warn/10 text-warn border-warn/30',
  bad:       'bg-bad/10 text-bad border-bad/30',
  amber:     'bg-ink-amber/10 text-ink-amber border-ink-amber/30',
  amethyst:  'bg-ink-amethyst/10 text-ink-amethyst border-ink-amethyst/30',
  emerald:   'bg-ink-emerald/10 text-ink-emerald border-ink-emerald/30',
  ruby:      'bg-ink-ruby/10 text-ink-ruby border-ink-ruby/30',
  sapphire:  'bg-ink-sapphire/10 text-ink-sapphire border-ink-sapphire/30',
  steel:     'bg-ink-steel/10 text-ink-steel border-ink-steel/30',
}

export default function Badge({
  children,
  variant = 'default',
  className = '',
  ...rest
}) {
  return (
    <span
      {...rest}
      className={`
        inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium border
        ${variants[variant]} ${className}
      `}
    >
      {children}
    </span>
  )
}
