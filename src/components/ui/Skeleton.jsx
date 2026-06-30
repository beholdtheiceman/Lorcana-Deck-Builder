const variants = {
  line: 'h-4 rounded w-full',
  block: 'h-32 rounded-md w-full',
  card: 'h-40 rounded-md w-full',
}

export default function Skeleton({ variant = 'line', className = '', ...rest }) {
  return (
    <div
      aria-hidden="true"
      className={`bg-white/10 animate-pulse ${variants[variant]} ${className}`}
      {...rest}
    />
  )
}
