import { render, screen, fireEvent } from '@testing-library/react'
import Toast from './Toast'
import ToastProvider from './ToastProvider'
import { useToast } from './useToast'

function Tester({ fn }) {
  const { toast } = useToast()
  return <button onClick={() => toast[fn]('Test message')}>Fire</button>
}

describe('Toast', () => {
  it('renders message text', () => {
    render(<Toast>Hello world</Toast>)
    expect(screen.getByText('Hello world')).toBeTruthy()
  })

  it('has role="alert"', () => {
    render(<Toast>Alert toast</Toast>)
    expect(screen.getByRole('alert')).toBeTruthy()
  })

  it('dismiss button calls onDismiss', () => {
    const onDismiss = vi.fn()
    render(<Toast onDismiss={onDismiss}>Dismissable</Toast>)
    fireEvent.click(screen.getByLabelText('Dismiss'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('ToastProvider: toast.success shows a success toast', () => {
    render(
      <ToastProvider>
        <Tester fn="success" />
      </ToastProvider>
    )
    fireEvent.click(screen.getByText('Fire'))
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText('Test message')).toBeTruthy()
  })

  it('ToastProvider: toast.error shows an error toast', () => {
    render(
      <ToastProvider>
        <Tester fn="error" />
      </ToastProvider>
    )
    fireEvent.click(screen.getByText('Fire'))
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText('Test message')).toBeTruthy()
  })
})
