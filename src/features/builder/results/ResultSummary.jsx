function valuesOf(value) {
  if (value instanceof Set) return [...value]
  return Array.isArray(value) ? value : []
}

function compactRange(values) {
  const costs = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b)
  if (!costs.length) return ''
  if (costs.length === 1) return `cost ${costs[0]}`
  return `cost ${costs[0]}–${costs[costs.length - 1]}`
}

export function describeActiveFilters(filters = {}) {
  const descriptions = []
  const text = String(filters.text || '').trim()
  const inks = valuesOf(filters.inks)
  const costs = compactRange(valuesOf(filters.selectedCosts))

  if (text) descriptions.push(`search “${text}”`)
  if (inks.length) descriptions.push(inks.join(', '))
  if (costs) descriptions.push(costs)

  for (const [key, label] of [
    ['types', 'type'],
    ['rarities', 'rarity'],
    ['sets', 'set'],
    ['classifications', 'classification'],
    ['abilities', 'ability'],
  ]) {
    const values = valuesOf(filters[key])
    if (values.length) descriptions.push(`${label} ${values.join(', ')}`)
  }

  if (filters.inkable === 'yes') descriptions.push('inkable only')
  if (filters.inkable === 'no') descriptions.push('uninkable only')

  // Format is always shown, never hidden behind a label. Core silently
  // excludes sets 1-8, so the count has to say why.
  const format = String(filters.gamemode || '').trim()
  if (format) descriptions.push(format === 'Core Constructed' ? 'Core' : format)

  for (const [key, label] of [
    ['setNumber', 'set number'],
    ['franchise', 'franchise'],
  ]) {
    const value = String(filters[key] || '').trim()
    if (value) descriptions.push(`${label} ${value}`)
  }

  return descriptions.join(' · ')
}

export default function ResultSummary({ count = 0, filters }) {
  const description = describeActiveFilters(filters)

  return (
    <p className="text-sm" style={{ color: 'var(--muted)' }}>
      <span className="font-medium" style={{ color: 'var(--text)' }}>{count} cards</span>
      {description && ` · ${description}`}
    </p>
  )
}
