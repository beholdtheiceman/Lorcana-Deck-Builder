import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchAllCards } from '../../../lib/cardsApi.js'

export default function useCardPool() {
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [requestNumber, setRequestNumber] = useState(0)
  const requestRef = useRef(0)

  const retry = useCallback(() => {
    setRequestNumber((number) => number + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const request = requestRef.current + 1
    requestRef.current = request

    setLoading(true)
    setError(null)

    fetchAllCards({ signal: controller.signal })
      .then((nextCards) => {
        if (requestRef.current !== request || controller.signal.aborted) return
        setCards(nextCards)
        setLoading(false)
      })
      .catch((nextError) => {
        if (requestRef.current !== request || controller.signal.aborted) return
        setError(nextError)
        setLoading(false)
      })

    return () => {
      controller.abort()
    }
  }, [requestNumber])

  return { cards, loading, error, retry }
}
