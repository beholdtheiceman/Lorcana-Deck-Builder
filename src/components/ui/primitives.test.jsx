import { render, screen } from '@testing-library/react'
import HexGlyph from './HexGlyph'
import CostHex from './CostHex'
import InkLedger from './InkLedger'
import Panel from './Panel'
import InkCurve from './InkCurve'
import InkSplitBar from './InkSplitBar'
import { inkVar } from './inks'

test('inkVar maps known inks and falls back to steel', () => {
  expect(inkVar('Sapphire')).toBe('var(--sapphire)')
  expect(inkVar('ruby')).toBe('var(--ruby)')
  expect(inkVar('Chartreuse')).toBe('var(--steel)')
  expect(inkVar(undefined)).toBe('var(--steel)')
})

test('HexGlyph solid renders one hex, hollow renders a cutout', () => {
  const { container: solid } = render(<HexGlyph ink="Amber" />)
  expect(solid.querySelectorAll('span')).toHaveLength(1)
  const { container: hollow } = render(<HexGlyph ink="Amber" hollow />)
  expect(hollow.querySelectorAll('span')).toHaveLength(2)
})

test('CostHex shows the cost number', () => {
  render(<CostHex cost={3} ink="Ruby" />)
  expect(screen.getByText('3')).toBeInTheDocument()
})

test('InkLedger renders one hex per card with a descriptive label', () => {
  const entries = [
    { ink: 'Sapphire', inkable: true },
    { ink: 'Sapphire', inkable: false },
    { ink: 'Ruby', inkable: true },
  ]
  render(<InkLedger entries={entries} />)
  const strip = screen.getByRole('img')
  expect(strip.getAttribute('aria-label')).toBe('3 cards: 2 sapphire (1 uninkable), 1 ruby')
  expect(strip.children).toHaveLength(3)
})

test('Panel renders kicker title and children', () => {
  render(<Panel title="Ink curve">body</Panel>)
  expect(screen.getByRole('heading', { name: 'Ink curve' })).toBeInTheDocument()
  expect(screen.getByText('body')).toBeInTheDocument()
})

test('InkCurve renders a column per bucket, normalized to the max', () => {
  const buckets = [
    { label: '1', counts: { Sapphire: 4 } },
    { label: '2', counts: { Sapphire: 6, Ruby: 2 } },
    { label: '3', counts: {} },
  ]
  render(<InkCurve buckets={buckets} />)
  const chart = screen.getByRole('img')
  expect(chart.getAttribute('aria-label')).toBe('Cost curve: 1: 4, 2: 8, 3: 0')
  expect(chart.children).toHaveLength(3)
  const tallest = chart.children[1].firstChild
  expect(tallest.style.height).toBe('75%') // 6 of max 8
})

test('InkSplitBar shows counts per ink', () => {
  render(<InkSplitBar segments={[{ ink: 'Sapphire', count: 34 }, { ink: 'Ruby', count: 26 }]} />)
  expect(screen.getByText('34')).toBeInTheDocument()
  expect(screen.getByText('26')).toBeInTheDocument()
})
