import { useEffect, useState } from 'react'

export function useDelayedRender(show: boolean, delayMs: number = 320): boolean {
  const [shouldRender, setShouldRender] = useState(show)

  useEffect(() => {
    let frameId: number | null = null

    if (show) {
      frameId = requestAnimationFrame(() => {
        setShouldRender(true)
      })

      return () => {
        if (frameId !== null) {
          cancelAnimationFrame(frameId)
        }
      }
    }

    const timer = setTimeout(() => setShouldRender(false), delayMs)

    return () => {
      clearTimeout(timer)
      if (frameId !== null) {
        cancelAnimationFrame(frameId)
      }
    }
  }, [show, delayMs])

  return shouldRender
}
