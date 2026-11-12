import type { DashPanelRect, DashPanelRectEdges } from '../geometry/inset.ts'
import type { DashPanelPoint, DashPanelSize } from '../geometry/placement-geometry.ts'
import type { DashPanelPlacement } from '../placement/placement.ts'

/** A finite non-negative size, resolved against the effective boundary. */
export type DashPanelDimension = number | `${number}px` | `${number}rem` | `${number}%`

export type DashPanelHeight = DashPanelDimension | 'auto'
export type DashPanelSizeAxis = 'width' | 'height'
export type DashPanelResizeTarget = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'

export interface DashPanelResizeOptions {
  readonly handles?: 'auto' | 'always' | 'hidden'
  readonly targets?: readonly DashPanelResizeTarget[]
}

export type DashPanelResize = false | DashPanelResizeOptions

export interface ResolvedDashPanelResizeOptions {
  readonly handles: 'auto' | 'always' | 'hidden'
  readonly targets: readonly DashPanelResizeTarget[]
}

export interface DashPanelContentConstraints {
  readonly minWidth?: boolean
  readonly maxWidth?: boolean
  readonly minHeight?: boolean
  readonly maxHeight?: boolean
}

/** Outer-shell equivalents of the content's minimum/maximum contribution. */
export interface DashPanelContentMetrics {
  readonly minWidth?: number
  readonly maxWidth?: number
  readonly minHeight?: number
  readonly maxHeight?: number
}

export type DashPanelManualSize =
  | { readonly width: number; readonly height?: number }
  | { readonly width?: number; readonly height: number }

export type DashPanelSizingConstraintCode =
  | 'minimum'
  | 'maximum'
  | 'boundary'
  | 'allocation'
  | 'content_minimum'
  | 'content_maximum'
  | 'shell_minimum'
  | 'minimum_unavailable'
  | 'content_bounds_conflict'
  | 'measurement_unavailable'

export interface DashPanelSizingConstraint {
  readonly axis: DashPanelSizeAxis
  readonly code: DashPanelSizingConstraintCode
  readonly limit?: number
}

export interface DashPanelSizingBounds {
  readonly minWidth?: DashPanelDimension
  readonly maxWidth?: DashPanelDimension
  readonly minHeight?: DashPanelDimension
  readonly maxHeight?: DashPanelDimension
}

export interface DashPanelSizingInput extends DashPanelSizingBounds {
  /** Natural height must already have been measured at the candidate width. */
  readonly preferred: DashPanelSize
  readonly manual?: DashPanelManualSize
  readonly boundary: DashPanelSize
  readonly allocation?: Partial<DashPanelSize>
  readonly shellMinimum?: Partial<DashPanelSize>
  readonly contentConstraints?: DashPanelContentConstraints
  readonly contentMetrics?: DashPanelContentMetrics
  readonly rootFontSize?: number
}

export interface DashPanelSizingState {
  readonly preferred: DashPanelSize
  readonly desired: DashPanelSize
  readonly resolved: DashPanelSize
  /** Effective, satisfiable limits suitable for gesture geometry. */
  readonly minimum: DashPanelSize
  readonly maximum: DashPanelSize
  readonly requestedMinimum: DashPanelSize
  readonly source: Readonly<Record<DashPanelSizeAxis, 'preferred' | 'manual'>>
  readonly constraints: readonly DashPanelSizingConstraint[]
  readonly measurements?: Readonly<{
    status: 'ready' | 'pending' | 'unavailable'
    content: DashPanelSize
    bounds: DashPanelContentMetrics
  }>
}

export interface DashPanelResizeInput {
  readonly start: DashPanelRectEdges
  readonly target: DashPanelResizeTarget
  readonly delta: DashPanelPoint
  readonly boundary: DashPanelRectEdges
  readonly minimum: DashPanelSize
  readonly maximum: DashPanelSize
  readonly placement: DashPanelPlacement
}

export interface DashPanelResizeDiff {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface DashPanelResizeResult {
  readonly requested: DashPanelRect
  readonly rect: DashPanelRect
  readonly axes: readonly DashPanelSizeAxis[]
  readonly diff: DashPanelResizeDiff
  readonly requestedDiff: DashPanelResizeDiff
}
