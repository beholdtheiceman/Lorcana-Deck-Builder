const sizeClass = { sm: 'w-4 h-4', md: 'w-6 h-6' }

export default function Spinner({ size = 'md' }) {
  return (
    <span
      role="status"
      className={`inline-block ${sizeClass[size]} border-2 border-current border-t-transparent rounded-full animate-spin opacity-70`}
    />
  )
}
