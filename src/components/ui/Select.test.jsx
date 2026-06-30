import { render, screen } from '@testing-library/react'
import Select from './Select'

test('renders label and select', () => {
  render(
    <Select label="Country">
      <option value="">Choose...</option>
      <option value="us">United States</option>
    </Select>
  )
  expect(screen.getByLabelText('Country')).toBeInTheDocument()
  expect(screen.getByRole('combobox')).toBeInTheDocument()
})

test('renders children options', () => {
  render(
    <Select label="Country">
      <option value="">Choose...</option>
      <option value="us">United States</option>
      <option value="ca">Canada</option>
    </Select>
  )
  expect(screen.getByRole('option', { name: 'United States' })).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'Canada' })).toBeInTheDocument()
})

test('error shows error paragraph', () => {
  render(
    <Select label="Country" error="Country is required">
      <option value="">Choose...</option>
    </Select>
  )
  const errorPara = screen.getByText('Country is required')
  expect(errorPara).toBeInTheDocument()
  expect(errorPara).toHaveClass('text-bad')
})
