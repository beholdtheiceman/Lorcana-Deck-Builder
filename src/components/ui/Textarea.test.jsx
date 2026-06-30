import { render, screen } from '@testing-library/react'
import Textarea from './Textarea'

test('renders label and textarea', () => {
  render(<Textarea label="Description" />)
  expect(screen.getByLabelText('Description')).toBeInTheDocument()
  expect(screen.getByRole('textbox')).toBeInTheDocument()
})

test('error shows error paragraph', () => {
  render(<Textarea label="Description" error="Description is required" />)
  const errorPara = screen.getByText('Description is required')
  expect(errorPara).toBeInTheDocument()
  expect(errorPara).toHaveClass('text-bad')
})

test('no error → no error paragraph', () => {
  render(<Textarea label="Description" />)
  expect(screen.queryByRole('paragraph')).not.toBeInTheDocument()
})

test('spreads rest props to textarea', () => {
  render(<Textarea label="Notes" placeholder="Enter notes" />)
  expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', 'Enter notes')
})
