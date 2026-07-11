import Button from './Button'

export default function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon && <div className="mb-4 text-4xl" style={{ color: 'var(--faint)' }}>{icon}</div>}
      <h3 className="text-lg font-medium mb-1" style={{ color: 'var(--text)' }}>{title}</h3>
      {description && <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>{description}</p>}
      {action && (
        <Button onClick={action.onClick}>{action.label}</Button>
      )}
    </div>
  )
}
