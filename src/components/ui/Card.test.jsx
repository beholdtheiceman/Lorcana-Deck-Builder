import { render, screen } from '@testing-library/react'
import Card from './Card'

test('renders children inside a div', () => {
  render(<Card>Card content</Card>)
  expect(screen.getByText('Card content')).toBeInTheDocument()
})

test('applies base card classes', () => {
  const { container } = render(<Card>Content</Card>)
  const cardDiv = container.firstChild
  expect(cardDiv).toHaveClass('bg-bg-raised')
  expect(cardDiv).toHaveClass('border-line')
  expect(cardDiv).toHaveClass('rounded-md')
  expect(cardDiv).toHaveClass('shadow-card')
})

test('merges extra className prop with base classes', () => {
  const { container } = render(<Card className="p-8">Content</Card>)
  const cardDiv = container.firstChild
  expect(cardDiv).toHaveClass('bg-bg-raised')
  expect(cardDiv).toHaveClass('p-8')
})
