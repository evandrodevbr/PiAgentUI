import { useEffect, useState } from 'react'
import { getSessionContextUsage, type ApiSessionContextUsage } from '../api'

export function useSessionContextUsage(sessionId: string | null, refreshKey?: unknown): ApiSessionContextUsage | null {
  const [usage, setUsage] = useState<ApiSessionContextUsage | null>(null)

  useEffect(() => {
    let cancelled = false

    if (!sessionId) {
      setUsage(null)
      return () => {
        cancelled = true
      }
    }

    setUsage(null)
    getSessionContextUsage(sessionId)
      .then(nextUsage => {
        if (!cancelled) setUsage(nextUsage)
      })
      .catch(() => {
        if (!cancelled) setUsage(null)
      })

    return () => {
      cancelled = true
    }
  }, [sessionId, refreshKey])

  return usage
}
