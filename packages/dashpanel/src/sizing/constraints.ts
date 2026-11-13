import type { DashPanelSize } from '../geometry/placement-geometry.ts'
import type {
  DashPanelContentConstraints,
  DashPanelContentMetrics,
  DashPanelDimension,
  DashPanelResize,
  DashPanelResizeTarget,
  DashPanelSizeAxis,
  DashPanelSizingConstraint,
  DashPanelSizingConstraintCode,
  DashPanelSizingInput,
  DashPanelSizingState,
  ResolvedDashPanelResizeOptions,
} from './types.ts'

export const DASH_PANEL_RESIZE_TARGETS: readonly DashPanelResizeTarget[] = Object.freeze([
  'n',
  'ne',
  'e',
  'se',
  's',
  'sw',
  'w',
  'nw',
])

const targetSet = new Set<string>(DASH_PANEL_RESIZE_TARGETS)
const boundKeys = ['minWidth', 'maxWidth', 'minHeight', 'maxHeight'] as const

function isResizeTarget(value: unknown): value is DashPanelResizeTarget {
  return typeof value === 'string' && targetSet.has(value)
}

function nonNegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0)
    throw new TypeError(`${label} must be a non-negative finite number.`)
  return Object.is(value, -0) ? 0 : value
}

type ParsedDimension = { readonly value: number; readonly unit: 'px' | 'rem' | '%' }

function parseDimension(value: DashPanelDimension): ParsedDimension {
  if (typeof value === 'number')
    return { value: nonNegative(value, 'DashPanel dimension'), unit: 'px' }
  const match = /^(\d+(?:\.\d*)?|\.\d+)(px|rem|%)$/.exec(value.trim())
  if (!match || (match[2] !== 'px' && match[2] !== 'rem' && match[2] !== '%'))
    throw new TypeError('DashPanel bounds support only non-negative pixels, rem, or percentages.')
  return { value: nonNegative(Number(match[1]), 'DashPanel dimension'), unit: match[2] }
}

/** Resolves the deliberately small public bound grammar without evaluating arbitrary CSS. */
export function resolveDashPanelDimension(
  value: DashPanelDimension,
  context: { readonly available: number; readonly rootFontSize?: number },
): number {
  const parsed = parseDimension(value)
  const available = nonNegative(context.available, 'DashPanel available size')
  const rootFontSize = nonNegative(context.rootFontSize ?? 16, 'DashPanel root font size')
  const resolved =
    parsed.unit === '%'
      ? (parsed.value / 100) * available
      : parsed.unit === 'rem'
        ? parsed.value * rootFontSize
        : parsed.value
  return nonNegative(resolved, 'DashPanel resolved dimension')
}

function validateComparableBounds(
  minimum: DashPanelDimension | undefined,
  maximum: DashPanelDimension | undefined,
): void {
  const min = minimum === undefined ? undefined : parseDimension(minimum)
  const max = maximum === undefined ? undefined : parseDimension(maximum)
  if (min && max && min.unit === max.unit && min.value > max.value)
    throw new TypeError('DashPanel minimum size cannot exceed its declared maximum.')
}

function ownDataRecord(value: object, allowed: readonly string[], label: string): void {
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null)
    throw new TypeError(`${label} must be a plain record.`)
  const keys = new Set(allowed)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (typeof key !== 'string' || !keys.has(key) || !descriptor || !('value' in descriptor))
      throw new TypeError(`${label} contains an unsupported property.`)
  }
}

export function normalizeDashPanelResize(
  input?: DashPanelResize,
): false | ResolvedDashPanelResizeOptions {
  if (input === false) return false
  if (input !== undefined && (input === null || typeof input !== 'object' || Array.isArray(input)))
    throw new TypeError('DashPanel resize must be false or an options record.')
  if (input) ownDataRecord(input, ['handles', 'targets'], 'DashPanel resize')
  const handles = input?.handles ?? 'auto'
  if (handles !== 'auto' && handles !== 'always' && handles !== 'hidden')
    throw new TypeError('DashPanel resize handles must be auto, always, or hidden.')
  const requested = input?.targets ?? DASH_PANEL_RESIZE_TARGETS
  if (!Array.isArray(requested)) throw new TypeError('DashPanel resize targets must be an array.')
  const seen = new Set<DashPanelResizeTarget>()
  for (const target of requested) {
    if (!isResizeTarget(target)) throw new TypeError('DashPanel resize contains an unknown target.')
    if (seen.has(target)) throw new TypeError('DashPanel resize targets cannot repeat.')
    seen.add(target)
  }
  return Object.freeze({
    handles,
    targets: Object.freeze(DASH_PANEL_RESIZE_TARGETS.filter((target) => seen.has(target))),
  })
}

/** Validates metrics once where application or DOM measurements enter the solver. */
export function normalizeDashPanelContentMetrics(
  metrics: DashPanelContentMetrics | undefined,
): DashPanelContentMetrics | undefined {
  if (metrics === undefined) return undefined
  if (metrics === null || typeof metrics !== 'object' || Array.isArray(metrics))
    throw new TypeError('DashPanel content metrics must be a record.')
  ownDataRecord(metrics, boundKeys, 'DashPanel content metrics')
  for (const key of boundKeys) {
    const value = metrics[key]
    if (value !== undefined) nonNegative(value, `DashPanel content ${key}`)
  }
  return Object.freeze({ ...metrics })
}

export function normalizeDashPanelContentConstraints(
  constraints: DashPanelContentConstraints | undefined,
): DashPanelContentConstraints | undefined {
  if (constraints === undefined) return undefined
  if (constraints === null || typeof constraints !== 'object' || Array.isArray(constraints))
    throw new TypeError('DashPanel content constraints must be a record.')
  ownDataRecord(constraints, boundKeys, 'DashPanel content constraints')
  for (const key of boundKeys) {
    const value = constraints[key]
    if (value !== undefined && typeof value !== 'boolean')
      throw new TypeError('DashPanel content constraint flags must be boolean.')
  }
  return Object.freeze({ ...constraints })
}

interface AxisResolution {
  readonly desired: number
  readonly resolved: number
  readonly minimum: number
  readonly maximum: number
  readonly requestedMinimum: number
  readonly constraints: readonly DashPanelSizingConstraint[]
}

function resolveAxis(input: {
  readonly axis: DashPanelSizeAxis
  readonly desired: number
  readonly available: number
  readonly allocation: number | undefined
  readonly shellMinimum: number
  readonly minimum: DashPanelDimension | undefined
  readonly maximum: DashPanelDimension | undefined
  readonly contentMinimumEnabled: boolean
  readonly contentMaximumEnabled: boolean
  readonly contentMinimum: number | undefined
  readonly contentMaximum: number | undefined
  readonly rootFontSize: number
}): AxisResolution {
  const constraints: DashPanelSizingConstraint[] = []
  const add = (code: DashPanelSizingConstraintCode, limit?: number): void => {
    constraints.push(
      Object.freeze({ axis: input.axis, code, ...(limit === undefined ? {} : { limit }) }),
    )
  }
  const available = nonNegative(input.available, 'DashPanel available size')
  const allocation =
    input.allocation === undefined
      ? available
      : nonNegative(input.allocation, 'DashPanel allocation')
  const context = { available, rootFontSize: input.rootFontSize }
  const declaredMin =
    input.minimum === undefined ? 0 : resolveDashPanelDimension(input.minimum, context)
  const declaredMax =
    input.maximum === undefined ? available : resolveDashPanelDimension(input.maximum, context)
  const contentMin = input.contentMinimumEnabled ? input.contentMinimum : undefined
  const contentMax = input.contentMaximumEnabled ? input.contentMaximum : undefined
  if (input.contentMinimumEnabled && contentMin === undefined) add('measurement_unavailable')
  if (input.contentMaximumEnabled && contentMax === undefined) add('measurement_unavailable')
  const requestedMinimum = Math.max(declaredMin, input.shellMinimum, contentMin ?? 0)
  const maximum = Math.min(available, allocation, declaredMax, contentMax ?? available)
  const minimum = Math.min(requestedMinimum, maximum)
  const resolved = Math.min(maximum, Math.max(minimum, input.desired))
  if (requestedMinimum > maximum) add('minimum_unavailable', maximum)
  if (
    (contentMin !== undefined && contentMin > maximum) ||
    (contentMax !== undefined && contentMax < Math.max(declaredMin, input.shellMinimum))
  )
    add('content_bounds_conflict', maximum)
  if (input.desired > available) add('boundary', available)
  if (input.desired > allocation && allocation < available) add('allocation', allocation)
  if (input.maximum !== undefined && input.desired > declaredMax) add('maximum', declaredMax)
  if (contentMax !== undefined && input.desired > contentMax) add('content_maximum', contentMax)
  if (input.desired < declaredMin && resolved > input.desired) add('minimum', declaredMin)
  if (input.desired < input.shellMinimum && resolved > input.desired)
    add('shell_minimum', input.shellMinimum)
  if (contentMin !== undefined && input.desired < contentMin && resolved > input.desired)
    add('content_minimum', contentMin)
  return { desired: input.desired, resolved, minimum, maximum, requestedMinimum, constraints }
}

/** Resolves size policy only; placement remains the owning placement solver's responsibility. */
export function resolveDashPanelSizing(input: DashPanelSizingInput): DashPanelSizingState {
  validateComparableBounds(input.minWidth, input.maxWidth)
  validateComparableBounds(input.minHeight, input.maxHeight)
  const preferred: DashPanelSize = Object.freeze({
    width: nonNegative(input.preferred.width, 'DashPanel preferred width'),
    height: nonNegative(input.preferred.height, 'DashPanel preferred height'),
  })
  if (input.manual) {
    for (const axis of ['width', 'height'] as const) {
      const value = input.manual[axis]
      if (value !== undefined && nonNegative(value, `DashPanel manual ${axis}`) === 0)
        throw new TypeError('DashPanel manual sizes must be positive.')
    }
  }
  const metrics = normalizeDashPanelContentMetrics(input.contentMetrics)
  const flags = normalizeDashPanelContentConstraints(input.contentConstraints)
  const rootFontSize = nonNegative(input.rootFontSize ?? 16, 'DashPanel root font size')
  const width = resolveAxis({
    axis: 'width',
    desired: input.manual?.width ?? preferred.width,
    available: input.boundary.width,
    allocation: input.allocation?.width,
    shellMinimum: nonNegative(input.shellMinimum?.width ?? 0, 'DashPanel shell minimum width'),
    minimum: input.minWidth,
    maximum: input.maxWidth,
    contentMinimumEnabled: flags?.minWidth === true,
    contentMaximumEnabled: flags?.maxWidth === true,
    contentMinimum: metrics?.minWidth,
    contentMaximum: metrics?.maxWidth,
    rootFontSize,
  })
  const height = resolveAxis({
    axis: 'height',
    desired: input.manual?.height ?? preferred.height,
    available: input.boundary.height,
    allocation: input.allocation?.height,
    shellMinimum: nonNegative(input.shellMinimum?.height ?? 0, 'DashPanel shell minimum height'),
    minimum: input.minHeight,
    maximum: input.maxHeight,
    contentMinimumEnabled: flags?.minHeight === true,
    contentMaximumEnabled: flags?.maxHeight === true,
    contentMinimum: metrics?.minHeight,
    contentMaximum: metrics?.maxHeight,
    rootFontSize,
  })
  return Object.freeze({
    preferred,
    desired: Object.freeze({ width: width.desired, height: height.desired }),
    resolved: Object.freeze({ width: width.resolved, height: height.resolved }),
    minimum: Object.freeze({ width: width.minimum, height: height.minimum }),
    maximum: Object.freeze({ width: width.maximum, height: height.maximum }),
    requestedMinimum: Object.freeze({
      width: width.requestedMinimum,
      height: height.requestedMinimum,
    }),
    source: Object.freeze({
      width: input.manual?.width === undefined ? 'preferred' : 'manual',
      height: input.manual?.height === undefined ? 'preferred' : 'manual',
    }),
    constraints: Object.freeze([...width.constraints, ...height.constraints]),
  })
}
