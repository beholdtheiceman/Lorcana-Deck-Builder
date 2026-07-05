import '@testing-library/jest-dom'

// jsdom doesn't implement ResizeObserver, but recharts' <ResponsiveContainer>
// (used by DeckPresentationView's charts, now reachable from more pages than
// just the Deck Lab) requires one to mount without throwing.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
