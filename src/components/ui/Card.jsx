export default function Card({ children, className = '', ...rest }) {
  return (
    <div
      className={`bg-bg-raised border border-line rounded-md shadow-card p-4 ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}
