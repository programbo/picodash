import { type DragEndEvent, type DragStartEvent } from '@dnd-kit/react'
import { useEffect, useRef } from 'react'

export function useRowDragInteraction(
  panelId: string,
  setInteractionActive: (interactionId: string, active: boolean) => void,
) {
  const interactionIdRef = useRef<string | null>(null)
  const interactionTokenRef = useRef(0)
  const settleTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (settleTimeoutRef.current !== null) {
        window.clearTimeout(settleTimeoutRef.current)
      }
    }
  }, [])

  function clearInteraction() {
    if (settleTimeoutRef.current !== null) {
      window.clearTimeout(settleTimeoutRef.current)
      settleTimeoutRef.current = null
    }
    const interactionId = interactionIdRef.current
    if (!interactionId) return
    interactionIdRef.current = null
    setInteractionActive(interactionId, false)
  }

  function settleInteraction() {
    const token = interactionTokenRef.current
    if (settleTimeoutRef.current !== null) {
      window.clearTimeout(settleTimeoutRef.current)
    }
    settleTimeoutRef.current = window.setTimeout(() => {
      if (interactionTokenRef.current === token) {
        clearInteraction()
      }
    }, 180)
  }

  function handleDragStart(event: DragStartEvent) {
    const source = event.operation.source
    if (!source || source.data.panelId !== panelId) return

    if (settleTimeoutRef.current !== null) {
      window.clearTimeout(settleTimeoutRef.current)
      settleTimeoutRef.current = null
    }
    interactionTokenRef.current += 1
    const interactionId = `dnd:${String(source.id)}`
    interactionIdRef.current = interactionId
    setInteractionActive(interactionId, true)
  }

  function handleDragEnd(event: DragEndEvent) {
    const source = event.operation.source
    if (!source || source.data.panelId !== panelId) {
      clearInteraction()
      return
    }
    settleInteraction()
  }

  return { handleDragStart, handleDragEnd }
}
