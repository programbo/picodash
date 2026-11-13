import {
  useLayoutEffect,
  useRef,
  type FocusEvent,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from 'react'
import type {
  NexusInteractionGeometry,
  NexusInteractionInput,
  NexusInteractionPublisher,
  NexusInteractionRect,
  NexusInteractionSource,
} from '@picodash/nexus'
import type { DashPanelRect } from '../geometry/inset.ts'

const sourceFor = (event: { pointerType?: string }): NexusInteractionSource =>
  event.pointerType === 'touch' ? 'touch' : event.pointerType === 'pen' ? 'pen' : 'mouse'
const difference = (
  current: NexusInteractionRect,
  previous: NexusInteractionRect,
): NexusInteractionRect => ({
  x: current.x - previous.x,
  y: current.y - previous.y,
  width: current.width - previous.width,
  height: current.height - previous.height,
})
const dataRect = (rect: DashPanelRect, boundary: DashPanelRect): NexusInteractionRect => ({
  x: rect.left - boundary.left,
  y: rect.top - boundary.top,
  width: rect.width,
  height: rect.height,
})
function targetFor(target: EventTarget | null): string {
  if (!target || !('nodeType' in target) || target.nodeType !== 1) return 'panel'
  const element = target as Element
  const resize = element
    .closest('[data-picodash-panel-resize-target]')
    ?.getAttribute('data-picodash-panel-resize-target')
  if (resize) return `resize:${resize}`
  if (element.closest('[data-picodash-panel-move-handle]')) return 'move'
  if (element.closest('[data-picodash-panel-restore-size]')) return 'restore-size'
  if (element.closest('button, input, select, textarea, a, [role="menuitem"]')) return 'control'
  if (element.closest('[data-picodash-panel-drag-surface]')) return 'header'
  return element.closest('[data-picodash-panel-body]') ? 'content' : 'panel'
}

/** Normalized, frame-bounded observation is separate from canonical state and visual authority. */
export function usePanelInteractions(
  element: RefObject<HTMLElement | null>,
  publish: NexusInteractionPublisher,
) {
  const latestPublish = useRef(publish)
  latestPublish.current = publish
  const pointerFrame = useRef<number | undefined>(undefined)
  const pendingPointer = useRef<NexusInteractionInput | undefined>(undefined)
  const moveFrame = useRef<number | undefined>(undefined)
  const pendingMove = useRef<
    { applied: NexusInteractionRect; requested: NexusInteractionRect } | undefined
  >(undefined)
  const move = useRef<{
    id: string
    input: NexusInteractionSource
    initial: NexusInteractionRect
    previous: NexusInteractionRect
    requested: NexusInteractionRect
    started: boolean
  } | null>(null)
  const sequence = useRef(0)
  const flush = () => {
    pointerFrame.current = undefined
    if (pendingPointer.current) {
      latestPublish.current(pendingPointer.current)
      pendingPointer.current = undefined
    }
  }
  const pointer = (
    phase: 'down' | 'up' | 'cancel' | 'move' | 'click',
    event: ReactPointerEvent<HTMLElement> | ReactMouseEvent<HTMLElement>,
  ) => {
    const input: NexusInteractionInput = {
      type: 'pointer',
      phase,
      target: targetFor(event.target),
      input: sourceFor('pointerType' in event ? event : {}),
      position: { x: event.clientX, y: event.clientY },
      ...(event.button >= 0 ? { button: event.button } : {}),
      buttons: event.buttons,
      modifiers: {
        alt: event.altKey,
        control: event.ctrlKey,
        meta: event.metaKey,
        shift: event.shiftKey,
      },
    }
    if (phase === 'move') {
      pendingPointer.current = input
      const ownerWindow = element.current?.ownerDocument.defaultView
      if (ownerWindow && pointerFrame.current === undefined)
        pointerFrame.current = ownerWindow.requestAnimationFrame(flush)
      return
    }
    if (pointerFrame.current !== undefined)
      element.current?.ownerDocument.defaultView?.cancelAnimationFrame(pointerFrame.current)
    flush()
    latestPublish.current(input)
  }
  const hover = (phase: 'enter' | 'leave', event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === 'touch') return
    const target = targetFor(event.target)
    const related = targetFor(event.relatedTarget)
    if (
      event.relatedTarget &&
      element.current?.contains(event.relatedTarget as Node) &&
      target === related
    )
      return
    latestPublish.current({ type: 'hover', phase, target, input: sourceFor(event) })
  }
  const focus = (phase: 'enter' | 'leave', event: FocusEvent<HTMLElement>) => {
    latestPublish.current({
      type: 'focus',
      phase,
      target: targetFor(event.target),
      input: 'keyboard',
    })
  }
  const moveGeometry = (
    session: NonNullable<typeof move.current>,
    current: NexusInteractionRect,
  ): NexusInteractionGeometry => ({
    initial: session.initial,
    requested: session.requested,
    applied: current,
    delta: difference(current, session.initial),
    stepDelta: difference(current, session.previous),
  })
  const flushMove = () => {
    const next = pendingMove.current
    pendingMove.current = undefined
    const session = move.current
    if (!next || !session) return
    session.requested = next.requested
    if (JSON.stringify(next.applied) === JSON.stringify(session.previous)) return
    latestPublish.current({
      type: 'drag.update',
      operation: 'move',
      interactionId: session.id,
      target: 'move',
      input: session.input,
      geometry: moveGeometry(session, next.applied),
    })
    session.previous = next.applied
  }
  const finishMoveFrame = () => {
    if (moveFrame.current !== undefined)
      element.current?.ownerDocument.defaultView?.cancelAnimationFrame(moveFrame.current)
    moveFrame.current = undefined
    flushMove()
  }
  useLayoutEffect(() => {
    const ownerWindow = element.current?.ownerDocument.defaultView
    return () => {
      if (pointerFrame.current !== undefined)
        ownerWindow?.cancelAnimationFrame(pointerFrame.current)
      pointerFrame.current = undefined
      pendingPointer.current = undefined
      if (moveFrame.current !== undefined) ownerWindow?.cancelAnimationFrame(moveFrame.current)
      moveFrame.current = undefined
      flushMove()
      const session = move.current
      if (session?.started)
        latestPublish.current({
          type: 'drag.cancel',
          operation: 'move',
          interactionId: session.id,
          target: 'move',
          input: session.input,
          reason: 'unmounted',
          geometry: moveGeometry(session, session.previous),
        })
      move.current = null
    }
  }, [element])
  return {
    pointer,
    hover,
    focus,
    beginMove: (
      rect: DashPanelRect | undefined,
      boundary: DashPanelRect | undefined,
      input: NexusInteractionSource,
    ) => {
      if (!rect || !boundary) return
      const initial = dataRect(rect, boundary)
      move.current = {
        id: `move-${++sequence.current}`,
        input,
        initial,
        previous: initial,
        requested: initial,
        started: false,
      }
    },
    updateMove: (rect: DashPanelRect, boundary: DashPanelRect, requested?: DashPanelRect) => {
      const session = move.current
      if (!session) return
      const current = dataRect(rect, boundary)
      if (JSON.stringify(current) === JSON.stringify(session.previous)) return
      if (!session.started) {
        latestPublish.current({
          type: 'drag.start',
          operation: 'move',
          interactionId: session.id,
          target: 'move',
          input: session.input,
          geometry: moveGeometry(session, session.initial),
        })
        session.started = true
      }
      pendingMove.current = {
        applied: current,
        requested: requested ? dataRect(requested, boundary) : current,
      }
      const ownerWindow = element.current?.ownerDocument.defaultView
      if (!ownerWindow) {
        flushMove()
        return
      }
      if (moveFrame.current === undefined)
        moveFrame.current = ownerWindow.requestAnimationFrame(() => {
          moveFrame.current = undefined
          flushMove()
        })
    },
    endMove: (outcome: 'accepted' | 'unchanged' | 'rejected') => {
      finishMoveFrame()
      const session = move.current
      move.current = null
      if (session?.started)
        latestPublish.current({
          type: 'drag.end',
          operation: 'move',
          interactionId: session.id,
          target: 'move',
          input: session.input,
          outcome,
          geometry: moveGeometry(session, session.previous),
        })
    },
    cancelMove: (reason: string) => {
      finishMoveFrame()
      const session = move.current
      move.current = null
      if (session?.started)
        latestPublish.current({
          type: 'drag.cancel',
          operation: 'move',
          interactionId: session.id,
          target: 'move',
          input: session.input,
          reason,
          geometry: moveGeometry(session, session.previous),
        })
    },
  }
}
