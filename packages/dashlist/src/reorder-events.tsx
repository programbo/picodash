import {
  createContext,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  type MutableRefObject,
  type ReactNode,
} from 'react'
import type {
  NexusInteractionGeometry,
  NexusInteractionPublisher,
  NexusInteractionRect,
  NexusInteractionSource,
} from '@picodash/nexus'
import { useNexusInteractionPublisher } from '@picodash/nexus/integration'

export type ReorderPublisherRef = MutableRefObject<NexusInteractionPublisher | null>
const ReorderPublisherContext = createContext<ReorderPublisherRef | null>(null)

/** Bind the root controller to its own committed List entity, including standalone Lists. */
export function DashListInteractionBoundary({
  publisherRef,
  children,
}: {
  readonly publisherRef: ReorderPublisherRef
  readonly children: ReactNode
}) {
  const publisher = useNexusInteractionPublisher()
  useLayoutEffect(() => {
    publisherRef.current = publisher
    return () => {
      publisherRef.current = null
    }
  }, [publisher, publisherRef])
  return (
    <ReorderPublisherContext.Provider value={publisherRef}>
      {children}
    </ReorderPublisherContext.Provider>
  )
}

export function reorderPointerSource(pointerType?: string): NexusInteractionSource {
  return pointerType === 'touch' || pointerType === 'pen' ? pointerType : 'mouse'
}

function difference(current: NexusInteractionRect, initial: NexusInteractionRect) {
  return {
    x: current.x - initial.x,
    y: current.y - initial.y,
    width: current.width - initial.width,
    height: current.height - initial.height,
  }
}

export function useReorderInteraction(providedPublisher?: ReorderPublisherRef) {
  const inherited = useContext(ReorderPublisherContext)
  const publisher = providedPublisher ?? inherited
  const namespace = useId()
  const nextId = useRef(0)
  const interaction = useMemo(() => {
    let session:
      | {
          readonly id: string
          readonly target: string
          readonly input: NexusInteractionSource
          readonly measure?: () => NexusInteractionRect
          readonly initial?: NexusInteractionRect
          previous?: NexusInteractionRect
          readonly view?: Window
          frame?: number
          pending: boolean
        }
      | undefined
    const geometry = (): NexusInteractionGeometry | undefined => {
      if (!session?.measure || !session.initial) return undefined
      const applied = session.measure()
      const result = {
        initial: session.initial,
        requested: applied,
        applied,
        delta: difference(applied, session.initial),
        stepDelta: difference(applied, session.previous ?? session.initial),
      }
      session.previous = applied
      return result
    }
    const base = () => {
      if (!session) return undefined
      const measured = geometry()
      return {
        target: session.target,
        input: session.input,
        interactionId: session.id,
        operation: 'reorder' as const,
        ...(measured ? { geometry: measured } : {}),
      }
    }
    const flush = () => {
      if (!session) return
      if (session.frame !== undefined) session.view?.cancelAnimationFrame(session.frame)
      session.frame = undefined
      if (!session.pending) return
      session.pending = false
      const event = base()
      if (event) publisher?.current?.({ type: 'drag.update', ...event })
    }
    return {
      start(target: string, input: NexusInteractionSource, handle?: HTMLElement) {
        if (session) return
        const view = handle?.ownerDocument?.defaultView ?? undefined
        const row = view ? handle?.closest<HTMLElement>('[role="listitem"]') : undefined
        const list = view ? handle?.closest<HTMLElement>('[role="list"]') : undefined
        const measure =
          row && list
            ? () => {
                const rect = row.getBoundingClientRect()
                const boundary = list.getBoundingClientRect()
                return {
                  x: rect.left - boundary.left,
                  y: rect.top - boundary.top,
                  width: rect.width,
                  height: rect.height,
                }
              }
            : undefined
        nextId.current += 1
        session = {
          id: `reorder-${namespace}-${nextId.current}`,
          target,
          input,
          ...(measure ? { measure, initial: measure() } : {}),
          ...(view ? { view } : {}),
          pending: false,
        }
        const event = base()
        if (event) publisher?.current?.({ type: 'drag.start', ...event })
      },
      update() {
        if (!session) return
        session.pending = true
        if (session.frame === undefined && session.view)
          session.frame = session.view.requestAnimationFrame(flush)
      },
      end(outcome: 'accepted' | 'unchanged' | 'rejected') {
        flush()
        const event = base()
        if (event) publisher?.current?.({ type: 'drag.end', ...event, outcome })
        session = undefined
      },
      cancel(reason: string) {
        flush()
        const event = base()
        if (event) publisher?.current?.({ type: 'drag.cancel', ...event, reason })
        session = undefined
      },
    }
  }, [namespace, publisher])
  useLayoutEffect(() => () => interaction.cancel('unmounted'), [interaction])
  return interaction
}

export function useReorderHandleEvents(target: string) {
  const publish = useNexusInteractionPublisher()
  return {
    onPointerEnter: (event: { pointerType?: string }) =>
      publish({
        type: 'hover',
        phase: 'enter',
        target,
        input: reorderPointerSource(event.pointerType),
      }),
    onPointerLeave: (event: { pointerType?: string }) =>
      publish({
        type: 'hover',
        phase: 'leave',
        target,
        input: reorderPointerSource(event.pointerType),
      }),
    onFocus: () => publish({ type: 'focus', phase: 'enter', target, input: 'keyboard' }),
    onBlur: () => publish({ type: 'focus', phase: 'leave', target, input: 'keyboard' }),
  }
}
