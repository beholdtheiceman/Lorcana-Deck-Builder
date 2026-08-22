import { isNewBuilderEnabled } from '../features/builder/flag.js'

beforeEach(() => localStorage.clear())

describe('isNewBuilderEnabled', () => {
  it('is false by default', () => {
    expect(isNewBuilderEnabled()).toBe(false)
  })

  it('is true with the localStorage override', () => {
    localStorage.setItem('newBuilder', '1')
    expect(isNewBuilderEnabled()).toBe(true)
  })

  it('is false for any other localStorage value', () => {
    localStorage.setItem('newBuilder', 'yes')
    expect(isNewBuilderEnabled()).toBe(false)
  })
})
