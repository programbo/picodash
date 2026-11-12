import type { DashPanelRect } from '../geometry/inset.ts'
import { normalizeDashPanelRect } from '../geometry/placement-geometry.ts'
import type { DashPanelPlacement } from '../placement/placement.ts'
import { normalizeDashPanelResize } from './constraints.ts'
import type {
  DashPanelResize,
  DashPanelResizeDiff,
  DashPanelResizeInput,
  DashPanelResizeResult,
  DashPanelResizeTarget,
  DashPanelSizeAxis,
} from './types.ts'

type Anchor = 'start' | 'end' | 'center' | 'free' | 'fill'
interface PlacementAnchors {
  readonly width: Anchor
  readonly height: Anchor
}

function placementAnchors(placement: DashPanelPlacement): PlacementAnchors {
  const disposition = placement.disposition
  if (disposition.kind === 'free') return { width: 'free', height: 'free' }
  switch (disposition.position) {
    case 'top-left':
      return { width: 'start', height: 'start' }
    case 'top-right':
      return { width: 'end', height: 'start' }
    case 'bottom-left':
      return { width: 'start', height: 'end' }
    case 'bottom-right':
      return { width: 'end', height: 'end' }
    case 'left':
    case 'center-left':
      return { width: 'start', height: 'center' }
    case 'right':
    case 'center-right':
      return { width: 'end', height: 'center' }
    case 'top':
    case 'center-top':
      return { width: 'center', height: 'start' }
    case 'bottom':
    case 'center-bottom':
      return { width: 'center', height: 'end' }
    case 'full-left':
      return { width: 'start', height: 'fill' }
    case 'full-right':
      return { width: 'end', height: 'fill' }
    case 'full-top':
      return { width: 'fill', height: 'start' }
    case 'full-bottom':
      return { width: 'fill', height: 'end' }
  }
}

function movesAxis(target: DashPanelResizeTarget, axis: DashPanelSizeAxis): boolean {
  return axis === 'width'
    ? target.includes('w') || target.includes('e')
    : target.includes('n') || target.includes('s')
}

function permitsDirection(anchor: Anchor, negative: boolean, positive: boolean): boolean {
  if (!negative && !positive) return true
  if (anchor === 'fill') return false
  return !(negative && anchor === 'start') && !(positive && anchor === 'end')
}

/** Canonical placement-compatible targets; unavailable/locked axes offer no misleading handles. */
export function resolveDashPanelResizeTargets(input: {
  readonly placement: DashPanelPlacement
  readonly resize?: DashPanelResize
  readonly minimum?: Readonly<{ width: number; height: number }>
  readonly maximum?: Readonly<{ width: number; height: number }>
  readonly available?: boolean
}): readonly DashPanelResizeTarget[] {
  const options = normalizeDashPanelResize(input.resize)
  if (options === false || input.available === false) return Object.freeze([])
  const anchors = placementAnchors(input.placement)
  return Object.freeze(
    options.targets.filter((target) => {
      for (const axis of ['width', 'height'] as const) {
        if (
          movesAxis(target, axis) &&
          input.minimum &&
          input.maximum &&
          input.minimum[axis] >= input.maximum[axis]
        )
          return false
      }
      return (
        permitsDirection(anchors.width, target.includes('w'), target.includes('e')) &&
        permitsDirection(anchors.height, target.includes('n'), target.includes('s'))
      )
    }),
  )
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite.`)
  return Object.is(value, -0) ? 0 : value
}

function nonNegative(value: number, label: string): number {
  const result = finite(value, label)
  if (result < 0) throw new TypeError(`${label} must be non-negative.`)
  return result
}

function axisResize(input: {
  readonly start: number
  readonly end: number
  readonly boundaryStart: number
  readonly boundaryEnd: number
  readonly delta: number
  readonly negative: boolean
  readonly positive: boolean
  readonly anchor: Anchor
  readonly minimum: number
  readonly maximum: number
}): {
  readonly requestedStart: number
  readonly requestedEnd: number
  readonly start: number
  readonly end: number
} {
  if (!input.negative && !input.positive)
    return {
      requestedStart: input.start,
      requestedEnd: input.end,
      start: input.start,
      end: input.end,
    }
  const anchor = input.anchor === 'free' ? (input.negative ? 'end' : 'start') : input.anchor
  if (anchor === 'fill' || !permitsDirection(anchor, input.negative, input.positive))
    return {
      requestedStart: input.start,
      requestedEnd: input.end,
      start: input.start,
      end: input.end,
    }
  const center = (input.start + input.end) / 2
  const requestedSize = Math.max(
    0,
    input.end -
      input.start +
      input.delta * (input.negative ? -1 : 1) * (anchor === 'center' ? 2 : 1),
  )
  const geometricMaximum = Math.max(
    0,
    anchor === 'center'
      ? 2 * Math.min(center - input.boundaryStart, input.boundaryEnd - center)
      : anchor === 'end'
        ? input.end - input.boundaryStart
        : input.boundaryEnd - input.start,
  )
  const maximum = Math.min(input.maximum, geometricMaximum)
  const minimum = Math.min(input.minimum, maximum)
  const size = Math.min(maximum, Math.max(minimum, requestedSize))
  const start =
    anchor === 'center' ? center - size / 2 : anchor === 'end' ? input.end - size : input.start
  const requestedStart =
    anchor === 'center'
      ? center - requestedSize / 2
      : anchor === 'end'
        ? input.end - requestedSize
        : input.start
  return { requestedStart, requestedEnd: requestedStart + requestedSize, start, end: start + size }
}

function diff(start: DashPanelRect, next: DashPanelRect): DashPanelResizeDiff {
  return Object.freeze({
    x: next.left - start.left,
    y: next.top - start.top,
    width: next.width - start.width,
    height: next.height - start.height,
  })
}

/** Applies a cumulative gesture delta while preserving the placement's opposite or named anchor. */
export function resizeDashPanelRect(input: DashPanelResizeInput): DashPanelResizeResult {
  const start = normalizeDashPanelRect(input.start, 'DashPanel resize start')
  const boundary = normalizeDashPanelRect(input.boundary, 'DashPanel resize boundary')
  const eligible = resolveDashPanelResizeTargets({
    placement: input.placement,
    resize: { targets: [input.target] },
  })
  if (eligible.length === 0)
    return Object.freeze({
      rect: start,
      requested: start,
      axes: Object.freeze([]),
      diff: diff(start, start),
      requestedDiff: diff(start, start),
    })
  const anchors = placementAnchors(input.placement)
  const x = axisResize({
    start: start.left,
    end: start.right,
    boundaryStart: boundary.left,
    boundaryEnd: boundary.right,
    delta: finite(input.delta.x, 'DashPanel resize delta x'),
    negative: input.target.includes('w'),
    positive: input.target.includes('e'),
    anchor: anchors.width,
    minimum: nonNegative(input.minimum.width, 'DashPanel minimum width'),
    maximum: nonNegative(input.maximum.width, 'DashPanel maximum width'),
  })
  const y = axisResize({
    start: start.top,
    end: start.bottom,
    boundaryStart: boundary.top,
    boundaryEnd: boundary.bottom,
    delta: finite(input.delta.y, 'DashPanel resize delta y'),
    negative: input.target.includes('n'),
    positive: input.target.includes('s'),
    anchor: anchors.height,
    minimum: nonNegative(input.minimum.height, 'DashPanel minimum height'),
    maximum: nonNegative(input.maximum.height, 'DashPanel maximum height'),
  })
  const rect = normalizeDashPanelRect({ left: x.start, right: x.end, top: y.start, bottom: y.end })
  const requested = normalizeDashPanelRect({
    left: x.requestedStart,
    right: x.requestedEnd,
    top: y.requestedStart,
    bottom: y.requestedEnd,
  })
  const axes: DashPanelSizeAxis[] = eligible.length
    ? ['width', 'height'].filter(
        (axis): axis is DashPanelSizeAxis =>
          (axis === 'width' || axis === 'height') && movesAxis(input.target, axis),
      )
    : []
  return Object.freeze({
    rect,
    requested,
    axes: Object.freeze(axes),
    diff: diff(start, rect),
    requestedDiff: diff(start, requested),
  })
}
