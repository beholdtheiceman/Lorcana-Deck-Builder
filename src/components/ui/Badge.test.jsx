import { render, screen } from '@testing-library/react'
import Badge from './Badge'

test('renders children text', () => {
  render(<Badge>New</Badge>)
  expect(screen.getByText('New')).toBeInTheDocument()
})

test('default variant applies bg-white/10 class', () => {
  render(<Badge>Label</Badge>)
  const badge = screen.getByText('Label')
  expect(badge).toHaveClass('bg-white/10')
})

test('good variant applies text-good class', () => {
  render(<Badge variant="good">Active</Badge>)
  const badge = screen.getByText('Active')
  expect(badge).toHaveClass('text-good')
})

test('bad variant applies text-bad class', () => {
  render(<Badge variant="bad">Error</Badge>)
  const badge = screen.getByText('Error')
  expect(badge).toHaveClass('text-bad')
})
