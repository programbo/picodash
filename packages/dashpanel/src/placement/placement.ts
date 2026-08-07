export type DashPanelSnapPosition =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'right'
  | 'bottom-right'
  | 'bottom'
  | 'bottom-left'
  | 'left'

export type DashPanelDockPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-right'
  | 'bottom-left'
  | 'full-left'
  | 'center-left'
  | 'full-right'
  | 'center-right'
  | 'full-top'
  | 'center-top'
  | 'full-bottom'
  | 'center-bottom'

export type DashPanelPlacement =
  | {
      readonly mode: 'floating'
      readonly disposition:
        | { readonly kind: 'free' }
        | { readonly kind: 'snapped'; readonly position: DashPanelSnapPosition }
    }
  | {
      readonly mode: 'fixed'
      readonly disposition: { readonly kind: 'docked'; readonly position: DashPanelDockPosition }
    }
  | {
      readonly mode: 'hybrid'
      readonly disposition:
        | { readonly kind: 'free' }
        | { readonly kind: 'snapped'; readonly position: 'top' | 'bottom' }
        | { readonly kind: 'docked'; readonly position: DashPanelDockPosition }
    }

export interface DashPanelDefaultLayout {
  readonly placement: DashPanelPlacement
  readonly preferredPosition?: Readonly<{ readonly x: number; readonly y: number }>
}

export interface DashPanelPlacementOptions {
  readonly snapOffset?: number
  readonly snapProximity?: number
  readonly detachDistance?: number
}

export type DashPanelPresentation =
  | { readonly kind: 'panel' }
  | { readonly kind: 'drawer'; readonly edge: 'left' | 'right' }
  | { readonly kind: 'sheet'; readonly edge: 'top' | 'bottom' }

export interface ResolvedDashPanelPlacementOptions {
  readonly snapOffset: number
  readonly snapProximity: number
  readonly detachDistance: number
}

const DEFAULT_PLACEMENT: DashPanelPlacement = Object.freeze({
  mode: 'floating',
  disposition: Object.freeze({ kind: 'snapped', position: 'top-right' }),
})

const DEFAULT_LAYOUT: DashPanelDefaultLayout = Object.freeze({ placement: DEFAULT_PLACEMENT })

const DEFAULT_OPTIONS: ResolvedDashPanelPlacementOptions = Object.freeze({
  snapOffset: 8,
  snapProximity: 16,
  detachDistance: 40,
})

const SNAP_POSITIONS = new Set<DashPanelSnapPosition>([
  'top-left',
  'top',
  'top-right',
  'right',
  'bottom-right',
  'bottom',
  'bottom-left',
  'left',
])

const DOCK_POSITIONS = new Set<DashPanelDockPosition>([
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
])

const hasOwn = (value: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, key)

function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError(`${label} must be a record.`)
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null)
    throw new TypeError(`${label} must be a plain record.`)
  const descriptors = Object.getOwnPropertyDescriptors(value)
  for (const key of Reflect.ownKeys(descriptors)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor || !('value' in descriptor))
      throw new TypeError(`${label} cannot contain accessors.`)
  }
  return value as Record<string, unknown>
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  const allowed = new Set(keys)
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !allowed.has(key))
      throw new TypeError(`${label} contains an unknown key.`)
  }
}

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new TypeError(`${label} must be finite.`)
  return value
}

function nonNegativeNumber(value: unknown, label: string): number {
  const number = finiteNumber(value, label)
  if (number < 0) throw new TypeError(`${label} must be non-negative.`)
  return number
}

function snapPosition(value: unknown): DashPanelSnapPosition {
  if (typeof value !== 'string' || !SNAP_POSITIONS.has(value as DashPanelSnapPosition))
    throw new TypeError('Invalid DashPanel snap position.')
  return value as DashPanelSnapPosition
}

function dockPosition(value: unknown): DashPanelDockPosition {
  if (typeof value !== 'string' || !DOCK_POSITIONS.has(value as DashPanelDockPosition))
    throw new TypeError('Invalid DashPanel dock position.')
  return value as DashPanelDockPosition
}

function normalizeDisposition(
  value: unknown,
  mode: DashPanelPlacement['mode'],
): DashPanelPlacement['disposition'] {
  const disposition = record(value, 'DashPanel placement disposition')
  const kind = disposition.kind
  if (kind === 'free') {
    exactKeys(disposition, ['kind'], 'DashPanel free disposition')
    if (mode === 'fixed') throw new TypeError('Fixed placement requires a docked disposition.')
    return Object.freeze({ kind: 'free' })
  }
  if (kind === 'snapped') {
    exactKeys(disposition, ['kind', 'position'], 'DashPanel snapped disposition')
    if (!hasOwn(disposition, 'position'))
      throw new TypeError('Snapped placement requires a position.')
    const position = snapPosition(disposition.position)
    if (mode === 'fixed') throw new TypeError('Fixed placement requires a docked disposition.')
    if (mode === 'hybrid' && position !== 'top' && position !== 'bottom')
      throw new TypeError('Hybrid snapped placement only supports top or bottom.')
    return Object.freeze({ kind: 'snapped', position }) as DashPanelPlacement['disposition']
  }
  if (kind === 'docked') {
    exactKeys(disposition, ['kind', 'position'], 'DashPanel docked disposition')
    if (!hasOwn(disposition, 'position'))
      throw new TypeError('Docked placement requires a position.')
    if (mode === 'floating') throw new TypeError('Floating placement cannot be docked.')
    return Object.freeze({
      kind: 'docked',
      position: dockPosition(disposition.position),
    }) as DashPanelPlacement['disposition']
  }
  throw new TypeError('Invalid DashPanel placement disposition kind.')
}

export function normalizeDashPanelPlacement(value: unknown): DashPanelPlacement {
  if (value === undefined)
    return Object.freeze({
      mode: 'floating' as const,
      disposition: Object.freeze({ kind: 'snapped', position: 'top-right' }),
    })
  const placement = record(value, 'DashPanel placement')
  exactKeys(placement, ['mode', 'disposition'], 'DashPanel placement')
  if (!hasOwn(placement, 'mode') || !hasOwn(placement, 'disposition'))
    throw new TypeError('DashPanel placement requires mode and disposition.')
  const mode = placement.mode
  if (mode !== 'floating' && mode !== 'fixed' && mode !== 'hybrid')
    throw new TypeError('Invalid DashPanel placement mode.')
  return Object.freeze({
    mode,
    disposition: normalizeDisposition(placement.disposition, mode),
  }) as DashPanelPlacement
}

function normalizePreferredPosition(value: unknown): Readonly<{ x: number; y: number }> {
  const position = record(value, 'DashPanel preferred position')
  exactKeys(position, ['x', 'y'], 'DashPanel preferred position')
  if (!hasOwn(position, 'x') || !hasOwn(position, 'y'))
    throw new TypeError('DashPanel preferred position requires x and y.')
  return Object.freeze({
    x: finiteNumber(position.x, 'DashPanel preferred position x'),
    y: finiteNumber(position.y, 'DashPanel preferred position y'),
  })
}

export function normalizeDashPanelDefaultLayout(value?: unknown): DashPanelDefaultLayout {
  if (value === undefined)
    return Object.freeze({ placement: normalizeDashPanelPlacement(DEFAULT_LAYOUT.placement) })
  const layout = record(value, 'DashPanel default layout')
  exactKeys(layout, ['placement', 'preferredPosition'], 'DashPanel default layout')
  if (!hasOwn(layout, 'placement') || layout.placement === undefined)
    throw new TypeError('DashPanel default layout requires placement.')
  const preferredPosition = hasOwn(layout, 'preferredPosition')
    ? normalizePreferredPosition(layout.preferredPosition)
    : undefined
  return Object.freeze(
    preferredPosition === undefined
      ? { placement: normalizeDashPanelPlacement(layout.placement) }
      : { placement: normalizeDashPanelPlacement(layout.placement), preferredPosition },
  )
}

export function normalizeDashPanelPlacementOptions(
  value?: unknown,
): ResolvedDashPanelPlacementOptions {
  if (value === undefined) return DEFAULT_OPTIONS
  const options = record(value, 'DashPanel placement options')
  exactKeys(
    options,
    ['snapOffset', 'snapProximity', 'detachDistance'],
    'DashPanel placement options',
  )
  return Object.freeze({
    snapOffset: hasOwn(options, 'snapOffset')
      ? nonNegativeNumber(options.snapOffset, 'DashPanel snapOffset')
      : DEFAULT_OPTIONS.snapOffset,
    snapProximity: hasOwn(options, 'snapProximity')
      ? nonNegativeNumber(options.snapProximity, 'DashPanel snapProximity')
      : DEFAULT_OPTIONS.snapProximity,
    detachDistance: hasOwn(options, 'detachDistance')
      ? nonNegativeNumber(options.detachDistance, 'DashPanel detachDistance')
      : DEFAULT_OPTIONS.detachDistance,
  })
}
