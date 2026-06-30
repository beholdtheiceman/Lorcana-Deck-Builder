import { render } from '@testing-library/react'
import Skeleton from './Skeleton'

describe('Skeleton', () => {
  it('line variant renders div with h-4 class', () => {
    const { container } = render(<Skeleton variant="line" />)
    expect(container.firstChild).toHaveClass('h-4')
  })

  it('block variant renders div with h-32 class', () => {
    const { container } = render(<Skeleton variant="block" />)
    expect(container.firstChild).toHaveClass('h-32')
  })

  it('card variant renders div with h-40 class', () => {
    const { container } = render(<Skeleton variant="card" />)
    expect(container.firstChild).toHaveClass('h-40')
  })

  it('className merges with base classes', () => {
    const { container } = render(<Skeleton variant="line" className="custom-class" />)
    expect(container.firstChild).toHaveClass('h-4')
    expect(container.firstChild).toHaveClass('custom-class')
    expect(container.firstChild).toHaveClass('bg-white/10')
    expect(container.firstChild).toHaveClass('animate-pulse')
  })
})
