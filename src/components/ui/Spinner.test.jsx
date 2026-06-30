import { render, screen } from '@testing-library/react'
import Spinner from './Spinner'

test('renders with default size', () => {
  render(<Spinner />)
  expect(screen.getByRole('status')).toBeInTheDocument()
})

test('renders sm size', () => {
  render(<Spinner size="sm" />)
  const el = screen.getByRole('status')
  expect(el).toHaveClass('w-4')
})

test('renders md size', () => {
  render(<Spinner size="md" />)
  const el = screen.getByRole('status')
  expect(el).toHaveClass('w-6')
})
