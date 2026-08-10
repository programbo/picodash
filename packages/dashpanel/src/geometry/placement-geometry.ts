import type { DashPanelRect, DashPanelRectEdges } from './inset.ts'
import type { DashPanelDockPosition } from '../placement/placement.ts'
import type { DashPanelSnapPosition } from '../placement/placement.ts'

export interface DashPanelPoint {
  readonly x: number
  readonly y: number
}

export interface DashPanelSize {
  readonly width: number
  readonly height: number
}

export interface DashPanelDockTargetOptions {
  /** Maximum height for a left or right side occupant. */
  readonly allocation?: number
}

const finite = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new TypeError(`${label} must be finite.`)
  return Object.is(value, -0) ? 0 : value
}

const nonNegative = (value: unknown, label: string): number => {
  const result = finite(value, label)
  if (result < 0) throw new TypeError(`${label} must be non-negative.`)
  return result
}

function edgeRect(value: unknown, label: string): DashPanelRect {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError(`${label} must be an object.`)
  const candidate = value as Record<string, unknown>
  const top = finite(candidate.top, `${label} top`)
  const right = finite(candidate.right, `${label} right`)
  const bottom = finite(candidate.bottom, `${label} bottom`)
  const left = finite(candidate.left, `${label} left`)
  if (right < left || bottom < top) throw new TypeError(`${label} edges must not be inverted.`)
  return Object.freeze({ top, right, bottom, left, width: right - left, height: bottom - top })
}

export function normalizeDashPanelRect(
  value: unknown,
  label = 'DashPanel rectangle',
): DashPanelRect {
  return edgeRect(value, label)
}

export function normalizeDashPanelSize(value: unknown, label = 'DashPanel size'): DashPanelSize {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError(`${label} must be an object.`)
  const candidate = value as Record<string, unknown>
  return Object.freeze({
    width: nonNegative(candidate.width, `${label} width`),
    height: nonNegative(candidate.height, `${label} height`),
  })
}

export function normalizeDashPanelPoint(value: unknown, label = 'DashPanel point'): DashPanelPoint {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError(`${label} must be an object.`)
  const candidate = value as Record<string, unknown>
  return Object.freeze({
    x: finite(candidate.x, `${label} x`),
    y: finite(candidate.y, `${label} y`),
  })
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum)
}

/**
 * Projects a panel rectangle into a boundary. Oversized panels are reduced to
 * the available axis before their top-left coordinate is clamped. The input
 * objects are read only and the detached result is frozen.
 */
export function projectDashPanelRect(
  panel: DashPanelRectEdges,
  boundary: DashPanelRectEdges,
): DashPanelRect {
  const source = edgeRect(panel, 'DashPanel panel rectangle')
  const target = edgeRect(boundary, 'DashPanel boundary rectangle')
  const width = Math.min(source.width, target.width)
  const height = Math.min(source.height, target.height)
  const left = clamp(source.left, target.left, target.right - width)
  const top = clamp(source.top, target.top, target.bottom - height)
  return Object.freeze({ top, right: left + width, bottom: top + height, left, width, height })
}

/** Projects a top-left position for a panel of the supplied size. */
export function projectDashPanelPosition(
  position: DashPanelPoint,
  size: DashPanelSize,
  boundary: DashPanelRectEdges,
): DashPanelPoint {
  const point = normalizeDashPanelPoint(position)
  const panelSize = normalizeDashPanelSize(size)
  const target = edgeRect(boundary, 'DashPanel boundary rectangle')
  const width = Math.min(panelSize.width, target.width)
  const height = Math.min(panelSize.height, target.height)
  return Object.freeze({
    x: clamp(point.x, target.left, target.right - width),
    y: clamp(point.y, target.top, target.bottom - height),
  })
}

export function rectFromDashPanelPosition(
  position: DashPanelPoint,
  size: DashPanelSize,
): DashPanelRect {
  const point = normalizeDashPanelPoint(position)
  const panelSize = normalizeDashPanelSize(size)
  return Object.freeze({
    top: point.y,
    right: point.x + panelSize.width,
    bottom: point.y + panelSize.height,
    left: point.x,
    width: panelSize.width,
    height: panelSize.height,
  })
}

function safeOffset(value: number | undefined): number {
  return value === undefined ? 0 : nonNegative(value, 'DashPanel snap offset')
}

/** Returns the settled rectangle for one of the eight canonical snap targets. */
export function snapDashPanelRect(
  position: DashPanelSnapPosition,
  boundary: DashPanelRectEdges,
  size: DashPanelSize,
  snapOffset?: number,
): DashPanelRect {
  const target = edgeRect(boundary, 'DashPanel boundary rectangle')
  const panelSize = normalizeDashPanelSize(size)
  const offset = safeOffset(snapOffset)
  const width = Math.min(panelSize.width, target.width)
  const height = Math.min(panelSize.height, target.height)
  const horizontalCenter = target.left + (target.width - width) / 2
  const verticalCenter = target.top + (target.height - height) / 2
  let x: number
  let y: number
  switch (position) {
    case 'top-left':
      x = target.left + offset
      y = target.top + offset
      break
    case 'top':
      x = horizontalCenter
      y = target.top + offset
      break
    case 'top-right':
      x = target.right - width - offset
      y = target.top + offset
      break
    case 'right':
      x = target.right - width - offset
      y = verticalCenter
      break
    case 'bottom-right':
      x = target.right - width - offset
      y = target.bottom - height - offset
      break
    case 'bottom':
      x = horizontalCenter
      y = target.bottom - height - offset
      break
    case 'bottom-left':
      x = target.left + offset
      y = target.bottom - height - offset
      break
    case 'left':
      x = target.left + offset
      y = verticalCenter
      break
  }
  return projectDashPanelRect({ top: y, right: x + width, bottom: y + height, left: x }, target)
}

function sideAllocationHeight(
  position: DashPanelDockPosition,
  options: DashPanelDockTargetOptions | undefined,
  boundaryHeight: number,
): number | undefined {
  if (!position.endsWith('-left') && !position.endsWith('-right')) return undefined
  if (options?.allocation === undefined) return undefined
  const allocation = nonNegative(options.allocation, 'DashPanel dock allocation')
  return Math.min(allocation, boundaryHeight)
}

/** Returns the flush rectangle for one of the twelve canonical dock targets. */
export function dockDashPanelRect(
  position: DashPanelDockPosition,
  boundary: DashPanelRectEdges,
  size: DashPanelSize,
  options?: DashPanelDockTargetOptions,
): DashPanelRect {
  const target = edgeRect(boundary, 'DashPanel boundary rectangle')
  const panelSize = normalizeDashPanelSize(size)
  const width = Math.min(panelSize.width, target.width)
  const height = Math.min(panelSize.height, target.height)
  const sideHeight = sideAllocationHeight(position, options, target.height)
  const isFullSide = position === 'full-left' || position === 'full-right'
  const allocatedHeight = sideHeight ?? (isFullSide ? target.height : height)
  let x = target.left
  let y = target.top
  let resultWidth = width
  let resultHeight = allocatedHeight
  switch (position) {
    case 'top-left':
      break
    case 'top-right':
      x = target.right - width
      break
    case 'bottom-right':
      x = target.right - width
      y = target.bottom - allocatedHeight
      resultHeight = allocatedHeight
      break
    case 'bottom-left':
      y = target.bottom - allocatedHeight
      resultHeight = allocatedHeight
      break
    case 'full-left':
      break
    case 'center-left':
      y = target.top + (target.height - allocatedHeight) / 2
      break
    case 'full-right':
      x = target.right - width
      break
    case 'center-right':
      x = target.right - width
      y = target.top + (target.height - allocatedHeight) / 2
      break
    case 'full-top':
      resultWidth = target.width
      resultHeight = height
      break
    case 'center-top':
      x = target.left + (target.width - width) / 2
      resultHeight = height
      break
    case 'full-bottom':
      y = target.bottom - height
      resultWidth = target.width
      resultHeight = height
      break
    case 'center-bottom':
      x = target.left + (target.width - width) / 2
      y = target.bottom - height
      resultHeight = height
      break
  }
  return Object.freeze({
    top: y,
    right: x + resultWidth,
    bottom: y + resultHeight,
    left: x,
    width: resultWidth,
    height: resultHeight,
  })
}

export function snapDashPanelTargets(
  boundary: DashPanelRectEdges,
  size: DashPanelSize,
  snapOffset?: number,
): Readonly<Record<DashPanelSnapPosition, DashPanelRect>> {
  const positions: readonly DashPanelSnapPosition[] = [
    'top-left',
    'top',
    'top-right',
    'right',
    'bottom-right',
    'bottom',
    'bottom-left',
    'left',
  ]
  const result = Object.fromEntries(
    positions.map((position) => [
      position,
      snapDashPanelRect(position, boundary, size, snapOffset),
    ]),
  ) as Record<DashPanelSnapPosition, DashPanelRect>
  return Object.freeze(result)
}

export function dockDashPanelTargets(
  boundary: DashPanelRectEdges,
  size: DashPanelSize,
  options?: DashPanelDockTargetOptions,
): Readonly<Record<DashPanelDockPosition, DashPanelRect>> {
  const positions: readonly DashPanelDockPosition[] = [
    'top-left',
    'top-right',
    'bottom-right',
    'bottom-left',
    'full-left',
    'center-left',
    'full-right',
    'center-right',
    'full-top',
    'center-top',
    'full-bottom',
    'center-bottom',
  ]
  const result = Object.fromEntries(
    positions.map((position) => [position, dockDashPanelRect(position, boundary, size, options)]),
  ) as Record<DashPanelDockPosition, DashPanelRect>
  return Object.freeze(result)
}
