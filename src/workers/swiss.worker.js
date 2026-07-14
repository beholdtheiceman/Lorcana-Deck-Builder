import { simulate } from '../lib/swiss'

self.onmessage = ({ data }) => {
  const id = data?.id
  try {
    const result = simulate(data?.params ?? data)
    self.postMessage({ type: 'result', id, result })
  } catch (error) {
    self.postMessage({ type: 'error', id, error: error instanceof Error ? error.message : String(error) })
  }
}
