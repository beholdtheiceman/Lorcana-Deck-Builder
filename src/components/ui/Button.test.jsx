import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Button from './Button'

test('renders children', () => {
  render(<Button>Save</Button>)
  expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
})

test('calls onClick when clicked', async () => {
  const user = userEvent.setup()
  const onClick = vi.fn()
  render(<Button onClick={onClick}>Save</Button>)
  await user.click(screen.getByRole('button'))
  expect(onClick).toHaveBeenCalledTimes(1)
})

test('is disabled and shows spinner when loading', () => {
  render(<Button loading>Save</Button>)
  const btn = screen.getByRole('button')
  expect(btn).toBeDisabled()
  expect(screen.getByRole('status')).toBeInTheDocument()
})

test('does not fire onClick when disabled', async () => {
  const user = userEvent.setup()
  const onClick = vi.fn()
  render(<Button disabled onClick={onClick}>Save</Button>)
  await user.click(screen.getByRole('button'))
  expect(onClick).not.toHaveBeenCalled()
})
