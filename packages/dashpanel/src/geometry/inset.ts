import type { DashPanelBoundaryInset } from './boundary.ts'

export interface ResolvedDashPanelBoundaryInset {
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly left: number
}

export interface DashPanelRectEdges {
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly left: number
}

export interface DashPanelRect extends DashPanelRectEdges {
  readonly width: number
  readonly height: number
}

const ZERO_INSET: ResolvedDashPanelBoundaryInset = Object.freeze({
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
})

function finiteNonNegative(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    throw new TypeError(`${label} must be a finite non-negative number.`)
  return Object.is(value, -0) ? 0 : value
}

function resolveInsetValue(value: unknown): ResolvedDashPanelBoundaryInset {
  if (typeof value === 'number') {
    const normalized = finiteNonNegative(value, 'DashPanel boundary inset')
    return Object.freeze({
      top: normalized,
      right: normalized,
      bottom: normalized,
      left: normalized,
    })
  }
  if (!Array.isArray(value))
    throw new TypeError('DashPanel boundary inset must be a number or tuple.')

  const length = value.length
  if (length !== 2 && length !== 3 && length !== 4)
    throw new TypeError('DashPanel boundary inset tuple must have length 2, 3, or 4.')

  const values: number[] = []
  for (let index = 0; index < length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index))
      throw new TypeError('DashPanel boundary inset tuple cannot be sparse.')
    values.push(finiteNonNegative(value[index], `DashPanel boundary inset tuple[${index}]`))
  }

  const [first, second, third, fourth] = values
  if (length === 2) return Object.freeze({ top: first, right: second, bottom: first, left: second })
  if (length === 3) return Object.freeze({ top: first, right: second, bottom: third, left: second })
  return Object.freeze({ top: first, right: second, bottom: third, left: fourth })
}

export function resolveDashPanelBoundaryInset(
  panelInset: DashPanelBoundaryInset | undefined,
  providerInset?: DashPanelBoundaryInset,
): ResolvedDashPanelBoundaryInset {
  const selected = panelInset !== undefined ? panelInset : providerInset
  return selected === undefined ? ZERO_INSET : resolveInsetValue(selected)
}

function finiteRectEdge(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new TypeError(`${label} must be finite.`)
  return value
}

export function insetDashPanelRect(
  rect: DashPanelRectEdges,
  inset: ResolvedDashPanelBoundaryInset,
): DashPanelRect {
  if (rect === null || typeof rect !== 'object')
    throw new TypeError('DashPanel rectangle must be an object.')

  const top = finiteRectEdge(rect.top, 'DashPanel rectangle top')
  const right = finiteRectEdge(rect.right, 'DashPanel rectangle right')
  const bottom = finiteRectEdge(rect.bottom, 'DashPanel rectangle bottom')
  const left = finiteRectEdge(rect.left, 'DashPanel rectangle left')
  const width = right - left
  const height = bottom - top
  if (!Number.isFinite(width) || !Number.isFinite(height))
    throw new TypeError('DashPanel rectangle span must be finite.')
  if (right < left || bottom < top)
    throw new TypeError('DashPanel rectangle edges must not be inverted.')

  const insetLeft = Math.min(right, left + inset.left)
  const insetRight = Math.max(insetLeft, right - inset.right)
  const insetTop = Math.min(bottom, top + inset.top)
  const insetBottom = Math.max(insetTop, bottom - inset.bottom)
  return Object.freeze({
    top: insetTop,
    right: insetRight,
    bottom: insetBottom,
    left: insetLeft,
    width: insetRight - insetLeft,
    height: insetBottom - insetTop,
  })
}
