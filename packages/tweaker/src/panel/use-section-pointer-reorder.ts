import { useEffect, type RefObject } from 'react'

interface UseSectionPointerReorderOptions {
  listRef: RefObject<HTMLDivElement | null>
  pointerDragIdRef: RefObject<string | null>
  moveControlToPointer: (id: string, clientX: number, clientY: number) => void
  endPointerMove: (id: string, clientX: number, clientY: number) => void
  cancelPointerMove: () => void
}

export function useSectionPointerReorder({
  listRef,
  pointerDragIdRef,
  moveControlToPointer,
  endPointerMove,
  cancelPointerMove,
}: UseSectionPointerReorderOptions) {
  useEffect(() => {
    const ownerDocument = listRef.current?.ownerDocument ?? document

    function handlePointerMove(event: globalThis.PointerEvent) {
      const activeId = pointerDragIdRef.current
      if (!activeId) return
      moveControlToPointer(activeId, event.clientX, event.clientY)
    }

    function handlePointerUp(event: globalThis.PointerEvent) {
      const activeId = pointerDragIdRef.current
      if (!activeId) return
      endPointerMove(activeId, event.clientX, event.clientY)
    }

    function handlePointerCancel() {
      if (!pointerDragIdRef.current) return
      cancelPointerMove()
    }

    ownerDocument.addEventListener('pointermove', handlePointerMove, true)
    ownerDocument.addEventListener('pointerup', handlePointerUp, true)
    ownerDocument.addEventListener('pointercancel', handlePointerCancel, true)
    return () => {
      ownerDocument.removeEventListener('pointermove', handlePointerMove, true)
      ownerDocument.removeEventListener('pointerup', handlePointerUp, true)
      ownerDocument.removeEventListener('pointercancel', handlePointerCancel, true)
    }
  }, [listRef, pointerDragIdRef, cancelPointerMove, endPointerMove, moveControlToPointer])
}
