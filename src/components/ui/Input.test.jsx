import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Input from './Input'

test('renders label and input', () => {
  render(<Input label="Email" />)
  expect(screen.getByLabelText('Email')).toBeInTheDocument()
  expect(screen.getByRole('textbox')).toBeInTheDocument()
})

test('error string shows error paragraph with text-bad class', () => {
  render(<Input label="Email" error="Email is required" />)
  const errorPara = screen.getByText('Email is required')
  expect(errorPara).toBeInTheDocument()
  expect(errorPara).toHaveClass('text-bad')
})

test('no error → no error paragraph', () => {
  render(<Input label="Email" />)
  expect(screen.queryByRole('paragraph')).not.toBeInTheDocument()
})

test('rest props spread to input', async () => {
  const user = userEvent.setup()
  render(<Input label="Email" placeholder="user@example.com" type="email" />)
  const input = screen.getByPlaceholderText('user@example.com')
  expect(input).toHaveAttribute('type', 'email')
  await user.type(input, 'test@example.com')
  expect(input).toHaveValue('test@example.com')
})
