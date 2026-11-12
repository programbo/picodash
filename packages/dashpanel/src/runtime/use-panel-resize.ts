import {
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from 'react'
import type {
  DashPanelLayoutRecord,
  NexusInteractionGeometry,
  NexusInteractionPublisher,
  NexusInteractionRect,
  NexusInteractionSource,
} from '@picodash/nexus'
import {
  resizeDashPanelRect,
  resolveDashPanelResizeTargets,
  normalizeDashPanelResize,
  type DashPanelManualSize,
  type DashPanelResize,
  type DashPanelResizeTarget,
  type DashPanelSizingState,
} from '../sizing/index.ts'
import type { DashPanelPlacement } from '../placement/placement.ts'
import type { DashPanelRect } from '../geometry/inset.ts'
import type { DashPanelLayoutCommandResult } from './panel-runtime.ts'

type Preview = Readonly<{ rect: DashPanelRect; axes: readonly ('width' | 'height')[] }>
type Session = {
  readonly kind: 'pressed' | 'resizing'
  readonly input: NexusInteractionSource
  readonly id: string
  readonly target: DashPanelResizeTarget
  readonly start: DashPanelRect
  readonly boundary: DashPanelRect
  readonly sizing: DashPanelSizingState
  readonly startPointer: Readonly<{ x: number; y: number }>
  readonly pointerId?: number
  readonly capture?: HTMLElement
  readonly delta: Readonly<{ x: number; y: number }>
  readonly preview?: Preview
  readonly previous: DashPanelRect
  readonly sourceFingerprint: string
  readonly invalidated?: boolean
}
type ResizeState = { readonly kind: 'idle' } | Session
const idle = { kind: 'idle' } as const
const rectData = (rect: DashPanelRect, boundary: DashPanelRect): NexusInteractionRect => ({
  x: rect.left - boundary.left,
  y: rect.top - boundary.top,
  width: rect.width,
  height: rect.height,
})
const difference = (
  rect: NexusInteractionRect,
  from: NexusInteractionRect,
): NexusInteractionRect => ({
  x: rect.x - from.x,
  y: rect.y - from.y,
  width: rect.width - from.width,
  height: rect.height - from.height,
})
const toRect = (rect: DOMRect): DashPanelRect => ({
  left: rect.left,
  top: rect.top,
  right: rect.right,
  bottom: rect.bottom,
  width: rect.width,
  height: rect.height,
})

export interface PanelResizeInputs {
  readonly element: RefObject<HTMLElement | null>
  readonly boundary?: DashPanelRect
  readonly sizing?: DashPanelSizingState
  readonly placement: DashPanelPlacement
  readonly resize?: DashPanelResize
  readonly available: boolean
  readonly moving: boolean
  readonly fingerprint: string
  readonly preferredPosition?: Readonly<{ x: number; y: number }>
  readonly publish: NexusInteractionPublisher
  readonly commit: (
    size: DashPanelManualSize,
    position?: Readonly<{ x: number; y: number }>,
  ) => DashPanelLayoutCommandResult
  readonly announce: (message: string) => void
  readonly beforeStart: () => void
  readonly getCanonicalLayout: () => DashPanelLayoutRecord | undefined
  readonly subscribeCanonical: (listener: () => void) => () => void
}

/** One capture owner: pressed → resizing → commit/cancel, with frame-bounded previews. */
export function usePanelResize(inputs: PanelResizeInputs) {
  const latest = useRef(inputs)
  latest.current = inputs
  const state = useRef<ResizeState>(idle)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [activeTarget, setActiveTarget] = useState<DashPanelResizeTarget | null>(null)
  const frame = useRef<number | undefined>(undefined)
  const canonicalSubscription = useRef<(() => void) | undefined>(undefined)
  const inputSubscription = useRef<(() => void) | undefined>(undefined)
  const sequence = useRef(0)
  const normalized = normalizeDashPanelResize(inputs.resize)
  const targets = resolveDashPanelResizeTargets({
    placement: inputs.placement,
    resize: inputs.resize,
    minimum: inputs.sizing?.minimum,
    maximum: inputs.sizing?.maximum,
    available: inputs.available && !inputs.moving,
  })
  const geometry = (
    session: Session,
    applied: DashPanelRect,
    requested = applied,
  ): NexusInteractionGeometry => {
    const initial = rectData(session.start, session.boundary)
    const current = rectData(applied, session.boundary)
    return {
      initial,
      requested: rectData(requested, session.boundary),
      applied: current,
      delta: difference(current, initial),
      stepDelta: difference(current, rectData(session.previous, session.boundary)),
      pointerDelta: session.delta,
      constraints: session.sizing.constraints.map((reason) => `${reason.axis}:${reason.code}`),
    }
  }
  const cleanup = () => {
    const session = state.current
    state.current = idle
    inputSubscription.current?.()
    inputSubscription.current = undefined
    canonicalSubscription.current?.()
    canonicalSubscription.current = undefined
    const ownerWindow = latest.current.element.current?.ownerDocument.defaultView
    if (frame.current !== undefined) ownerWindow?.cancelAnimationFrame(frame.current)
    frame.current = undefined
    if (
      session.kind !== 'idle' &&
      session.pointerId !== undefined &&
      session.capture?.hasPointerCapture?.(session.pointerId)
    )
      session.capture.releasePointerCapture(session.pointerId)
    latest.current.element.current?.removeAttribute('data-picodash-resizing')
    setPreview(null)
    setActiveTarget(null)
  }
  const cancel = (reason = 'cancelled') => {
    const session = state.current
    if (session.kind === 'idle') return
    if (session.kind === 'resizing') {
      latest.current.publish({
        type: 'drag.cancel',
        interactionId: session.id,
        operation: 'resize',
        target: `resize:${session.target}`,
        input: session.input,
        reason,
        geometry: geometry(session, session.preview?.rect ?? session.start),
      })
      latest.current.announce('Panel resizing cancelled.')
    }
    cleanup()
  }
  const update = (delta: Readonly<{ x: number; y: number }>) => {
    const session = state.current
    if (session.kind === 'idle') return
    if (session.invalidated) {
      cancel('metadata_changed')
      return
    }
    if (session.kind === 'pressed' && Math.hypot(delta.x, delta.y) < 3) return
    const sizing = latest.current.sizing ?? session.sizing
    const result = resizeDashPanelRect({
      start: session.start,
      target: session.target,
      delta,
      boundary: session.boundary,
      minimum: sizing.minimum,
      maximum: sizing.maximum,
      placement: latest.current.placement,
    })
    const next: Session = {
      ...session,
      kind: 'resizing',
      sizing,
      delta,
      preview: { rect: result.rect, axes: result.axes },
    }
    if (session.kind === 'pressed') {
      latest.current.beforeStart()
      latest.current.publish({
        type: 'drag.start',
        interactionId: session.id,
        operation: 'resize',
        target: `resize:${session.target}`,
        input: session.input,
        geometry: geometry(next, session.start),
      })
      latest.current.announce(`Resizing Panel from ${session.target}. Press Escape to cancel.`)
      latest.current.element.current?.setAttribute('data-picodash-resizing', session.target)
    }
    latest.current.publish({
      type: 'drag.update',
      interactionId: session.id,
      operation: 'resize',
      target: `resize:${session.target}`,
      input: session.input,
      geometry: geometry(next, result.rect, result.requested),
    })
    state.current = { ...next, previous: result.rect }
    setPreview(next.preview ?? null)
    setActiveTarget(session.target)
  }
  const finish = () => {
    const session = state.current
    if (session.kind !== 'resizing' || !session.preview) {
      cleanup()
      return
    }
    if (
      session.invalidated ||
      JSON.stringify(latest.current.getCanonicalLayout() ?? null) !== session.sourceFingerprint
    ) {
      cancel('metadata_changed')
      return
    }
    const { rect, axes } = session.preview
    const widthChanged = axes.includes('width') && Math.abs(rect.width - session.start.width) >= 0.5
    const heightChanged =
      axes.includes('height') && Math.abs(rect.height - session.start.height) >= 0.5
    const size = widthChanged
      ? { width: rect.width, ...(heightChanged ? { height: rect.height } : {}) }
      : heightChanged
        ? { height: rect.height }
        : undefined
    const changesPosition =
      latest.current.placement.disposition.kind === 'free' &&
      (session.target.includes('w') || session.target.includes('n'))
    const position = changesPosition
      ? {
          x: session.target.includes('w')
            ? rect.left - session.boundary.left
            : (latest.current.preferredPosition?.x ?? session.start.left - session.boundary.left),
          y: session.target.includes('n')
            ? rect.top - session.boundary.top
            : (latest.current.preferredPosition?.y ?? session.start.top - session.boundary.top),
        }
      : undefined
    // Release capture and clear active state before the canonical write can synchronously rerender.
    const finalGeometry = geometry(session, rect)
    cleanup()
    let outcome: 'accepted' | 'unchanged' | 'rejected' = 'unchanged'
    if (size) {
      const result = latest.current.commit(size, position)
      outcome = result.status === 'executed' && result.transaction.ok ? 'accepted' : 'rejected'
    }
    latest.current.publish({
      type: 'drag.end',
      interactionId: session.id,
      operation: 'resize',
      target: `resize:${session.target}`,
      input: session.input,
      outcome,
      geometry: finalGeometry,
    })
    latest.current.announce(
      outcome === 'accepted'
        ? `Panel size ${Math.round(rect.width)} by ${Math.round(rect.height)} pixels.`
        : outcome === 'rejected'
          ? 'Panel resizing was rejected.'
          : 'Panel size unchanged.',
    )
  }
  const handlers = useRef({ update, finish, cancel })
  handlers.current = { update, finish, cancel }
  const finishPointer = (event: Pick<PointerEvent, 'pointerId' | 'clientX' | 'clientY'>) => {
    const session = state.current
    if (session.kind === 'idle' || session.pointerId !== event.pointerId) return
    const ownerWindow = session.capture?.ownerDocument.defaultView
    if (frame.current !== undefined) ownerWindow?.cancelAnimationFrame(frame.current)
    frame.current = undefined
    handlers.current.update({
      x: event.clientX - session.startPointer.x,
      y: event.clientY - session.startPointer.y,
    })
    handlers.current.finish()
  }
  const subscribeInput = (ownerWindow: Window) => {
    let pending: Readonly<{ x: number; y: number }> | undefined
    const flush = () => {
      frame.current = undefined
      if (pending) {
        const delta = pending
        pending = undefined
        handlers.current.update(delta)
      }
    }
    const move = (event: PointerEvent) => {
      const session = state.current
      if (session.kind === 'idle' || session.pointerId !== event.pointerId) return
      pending = {
        x: event.clientX - session.startPointer.x,
        y: event.clientY - session.startPointer.y,
      }
      if (frame.current === undefined) frame.current = ownerWindow.requestAnimationFrame(flush)
    }
    const up = (event: PointerEvent) => {
      finishPointer(event)
    }
    const pointerCancel = (event: PointerEvent) => {
      const session = state.current
      if (session.kind !== 'idle' && session.pointerId === event.pointerId)
        handlers.current.cancel('pointercancel')
    }
    const blur = () => handlers.current.cancel('window_blur')
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        handlers.current.cancel('escape')
      }
    }
    ownerWindow.addEventListener('pointermove', move)
    ownerWindow.addEventListener('pointerup', up)
    ownerWindow.addEventListener('pointercancel', pointerCancel)
    ownerWindow.addEventListener('blur', blur)
    ownerWindow.addEventListener('keydown', escape)
    return () => {
      ownerWindow.removeEventListener('pointermove', move)
      ownerWindow.removeEventListener('pointerup', up)
      ownerWindow.removeEventListener('pointercancel', pointerCancel)
      ownerWindow.removeEventListener('blur', blur)
      ownerWindow.removeEventListener('keydown', escape)
      if (frame.current !== undefined) ownerWindow.cancelAnimationFrame(frame.current)
      frame.current = undefined
    }
  }
  const begin = (
    target: DashPanelResizeTarget,
    input: NexusInteractionSource,
    event?: ReactPointerEvent<HTMLElement>,
  ) => {
    const current = latest.current
    if (
      !targets.includes(target) ||
      !current.element.current ||
      !current.boundary ||
      !current.sizing ||
      state.current.kind !== 'idle'
    )
      return
    const start = toRect(current.element.current.getBoundingClientRect())
    const session: Session = {
      kind: input === 'keyboard' ? 'resizing' : 'pressed',
      id: `resize-${++sequence.current}`,
      target,
      input,
      start,
      boundary: current.boundary,
      sizing: current.sizing,
      startPointer: { x: event?.clientX ?? 0, y: event?.clientY ?? 0 },
      ...(event ? { pointerId: event.pointerId, capture: event.currentTarget } : {}),
      delta: { x: 0, y: 0 },
      previous: start,
      sourceFingerprint: JSON.stringify(current.getCanonicalLayout() ?? null),
    }
    state.current = session
    canonicalSubscription.current = current.subscribeCanonical(() => {
      const active = state.current
      if (
        active.kind === 'idle' ||
        active.invalidated ||
        JSON.stringify(latest.current.getCanonicalLayout() ?? null) === active.sourceFingerprint
      )
        return
      state.current = { ...active, invalidated: true }
      queueMicrotask(() => {
        const pending = state.current
        if (pending.kind !== 'idle' && pending.id === active.id && pending.invalidated)
          handlers.current.cancel('metadata_changed')
      })
    })
    const ownerWindow = current.element.current.ownerDocument.defaultView
    if (ownerWindow) inputSubscription.current = subscribeInput(ownerWindow)
    setActiveTarget(target)
    if (event) event.currentTarget.setPointerCapture?.(event.pointerId)
    if (input === 'keyboard') {
      current.beforeStart()
      current.element.current.setAttribute('data-picodash-resizing', target)
      current.publish({
        type: 'drag.start',
        interactionId: session.id,
        operation: 'resize',
        target: `resize:${target}`,
        input,
        geometry: geometry(session, start),
      })
      current.announce(`Resizing Panel from ${target}. Use arrows; Enter applies, Escape cancels.`)
    }
  }
  const policyKey = JSON.stringify([
    inputs.fingerprint,
    inputs.boundary,
    inputs.placement,
    inputs.resize,
    inputs.available,
  ])
  const previousPolicy = useRef(policyKey)
  useLayoutEffect(() => {
    if (policyKey !== previousPolicy.current) handlers.current.cancel('layout_changed')
    previousPolicy.current = policyKey
  }, [policyKey])
  useLayoutEffect(() => {
    const ownerWindow = inputs.element.current?.ownerDocument.defaultView
    return () => {
      inputSubscription.current?.()
      inputSubscription.current = undefined
      if (frame.current !== undefined) ownerWindow?.cancelAnimationFrame(frame.current)
      frame.current = undefined
      canonicalSubscription.current?.()
      canonicalSubscription.current = undefined
      const session = state.current
      if (session.kind !== 'idle') {
        if (session.kind === 'resizing')
          latest.current.publish({
            type: 'drag.cancel',
            interactionId: session.id,
            operation: 'resize',
            target: `resize:${session.target}`,
            input: session.input,
            reason: 'unmounted',
            geometry: geometry(session, session.preview?.rect ?? session.start),
          })
        state.current = idle
        if (
          session.pointerId !== undefined &&
          session.capture?.hasPointerCapture?.(session.pointerId)
        )
          session.capture.releasePointerCapture(session.pointerId)
      }
    }
  }, [])
  return {
    preview,
    active: activeTarget !== null,
    activeTarget,
    targets,
    handles: normalized === false ? 'hidden' : normalized.handles,
    cancel,
    onPointerDown: (target: DashPanelResizeTarget, event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0 || event.isPrimary === false) return
      event.preventDefault()
      event.stopPropagation()
      begin(
        target,
        event.pointerType === 'touch' ? 'touch' : event.pointerType === 'pen' ? 'pen' : 'mouse',
        event,
      )
    },
    onLostPointerCapture: (event: ReactPointerEvent<HTMLElement>) => {
      const session = state.current
      if (
        session.kind === 'idle' ||
        session.pointerId !== event.pointerId ||
        session.capture !== event.target
      )
        return
      // Some browser hosts deliver implicit capture release before pointerup.
      if ((event.buttons & 1) === 0) finishPointer(event)
      else handlers.current.cancel('capture_lost')
    },
    onKeyDown: (target: DashPanelResizeTarget, event: ReactKeyboardEvent<HTMLElement>) => {
      const session = state.current
      if (session.kind === 'idle') {
        if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
          event.preventDefault()
          begin(target, 'keyboard')
        }
        return
      }
      if (session.input !== 'keyboard' || session.target !== target) return
      if (event.key === 'Enter') {
        event.preventDefault()
        update(session.delta)
        finish()
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        cancel('escape')
        return
      }
      const step = event.shiftKey ? 10 : 1
      const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0
      const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0
      if (dx || dy) {
        event.preventDefault()
        update({ x: session.delta.x + dx, y: session.delta.y + dy })
      }
    },
  }
}
