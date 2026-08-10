import type {
  CoreTransactionResult,
  DashPanelLayoutRecord,
  PersistentTransactionResult,
} from '@picodash/store'
import type {
  DashPanelDefaultLayout,
  DashPanelDockPosition,
  DashPanelPlacement,
  DashPanelPresentation,
} from '../placement/placement.ts'
import {
  resolveDashPanelDockSideAllocation,
  resolveDashPanelDockSlot,
} from '../placement/dock-arena.ts'

export type DashPanelCommandResult =
  | { readonly status: 'executed' }
  | {
      readonly status: 'not_executed'
      readonly reason: 'unavailable' | 'not_collapsible' | 'modal_occupied' | 'modal_presentation'
    }

export type DashPanelLayoutCommandResult =
  | {
      readonly status: 'executed'
      readonly transaction: CoreTransactionResult | PersistentTransactionResult
    }
  | {
      readonly status: 'not_executed'
      readonly reason: 'unavailable' | 'dock_occupied' | 'position_disabled' | 'modal_presentation'
    }

interface PanelLayoutStore {
  setDashPanelLayout(
    layout: DashPanelLayoutRecord,
  ): CoreTransactionResult | PersistentTransactionResult
  resetDashPanelLayout(): CoreTransactionResult | PersistentTransactionResult
}

type PanelRuntimePanelConfig = Readonly<{
  readonly defaultLayout: DashPanelDefaultLayout
  readonly placement: DashPanelPlacement
  readonly dockPositions: readonly DashPanelDockPosition[]
  readonly presentation: DashPanelPresentation
}>

export interface PanelRuntimeDockArena {
  readonly boundary: object | null
  readonly inset: Readonly<{ top: number; right: number; bottom: number; left: number }>
}

export interface PanelRuntimeDockTarget {
  readonly allocation?: number
  readonly offset?: number
  readonly inlineAllocation?: number
  readonly inlineOffset?: number
}

export interface PanelRuntimeConfig {
  readonly scopeId: string
  readonly defaultVisible?: boolean
  readonly defaultCollapsed?: boolean
  readonly collapsible?: boolean
  readonly onVisibilityChange?: (visible: boolean) => void
  readonly onCollapsedChange?: (collapsed: boolean) => void
  readonly defaultLayout?: DashPanelDefaultLayout
  readonly placement?: DashPanelPlacement
  readonly dockPositions?: readonly DashPanelDockPosition[]
  readonly presentation?: DashPanelPresentation
  readonly store?: PanelLayoutStore
  readonly currentPosition?: () => Readonly<{ x: number; y: number }> | undefined
  readonly freeMovePosition?: () => Readonly<{ x: number; y: number }> | undefined
  readonly preferredPosition?: Readonly<{ x: number; y: number }>
  readonly resolveDockArena?: () => PanelRuntimeDockArena
}

export type PanelRuntimeUpdate = Pick<
  PanelRuntimeConfig,
  | 'collapsible'
  | 'onVisibilityChange'
  | 'onCollapsedChange'
  | 'defaultLayout'
  | 'placement'
  | 'dockPositions'
  | 'presentation'
  | 'store'
  | 'currentPosition'
  | 'freeMovePosition'
  | 'preferredPosition'
  | 'resolveDockArena'
>

export type PanelRuntimeCommandResult =
  | { readonly status: 'executed' }
  | { readonly status: 'not_executed'; readonly reason: 'unavailable' | 'not_collapsible' }

export interface PanelRuntimeRegistration {
  update(update: PanelRuntimeUpdate): void
  release(): void
}

export interface PanelRuntimePanelSnapshot {
  readonly scopeId: string
  readonly visible: boolean
  readonly collapsed: boolean
  readonly collapsible: boolean
  readonly placement: DashPanelPlacement
  readonly placementFallbackReason?: 'dock_occupied'
}

export interface PanelRuntimeSnapshot {
  readonly panels: Readonly<Record<string, PanelRuntimePanelSnapshot>>
  readonly activationOrder: readonly string[]
}

export interface PanelRuntime {
  getSnapshot(): PanelRuntimeSnapshot
  subscribe(listener: () => void): () => void
  acquire(config: PanelRuntimeConfig): PanelRuntimeRegistration
  show(scopeId: string): PanelRuntimeCommandResult
  hide(scopeId: string): PanelRuntimeCommandResult
  toggleVisibility(scopeId: string): PanelRuntimeCommandResult
  activate(scopeId: string): PanelRuntimeCommandResult
  expand(scopeId: string): PanelRuntimeCommandResult
  collapse(scopeId: string): PanelRuntimeCommandResult
  toggleCollapsed(scopeId: string): PanelRuntimeCommandResult
  setPlacement(scopeId: string, placement: DashPanelPlacement): DashPanelLayoutCommandResult
  resetLayout(scopeId: string): DashPanelLayoutCommandResult
  getPanelConfig(scopeId: string): PanelRuntimePanelConfig | undefined
  isDockPositionOccupied(scopeId: string, position: DashPanelDockPosition): boolean
  getDockTarget(
    scopeId: string,
    available: Readonly<{ width: number; height: number }>,
  ): PanelRuntimeDockTarget | undefined
  registerElement(scopeId: string, element: HTMLElement | null): void
  notifyElementResize(scopeId: string): void
  getElement(scopeId: string): HTMLElement | null
}

interface MutablePanel {
  readonly scopeId: string
  visible: boolean
  collapsed: boolean
  collapsible: boolean
  onVisibilityChange?: (visible: boolean) => void
  onCollapsedChange?: (collapsed: boolean) => void
  defaultLayout: DashPanelDefaultLayout
  placement: DashPanelPlacement
  dockPositions: readonly DashPanelDockPosition[]
  presentation: DashPanelPresentation
  requestedPlacement: DashPanelPlacement
  placementFallbackReason?: 'dock_occupied'
  store?: PanelRuntimeConfig['store']
  currentPosition?: PanelRuntimeConfig['currentPosition']
  freeMovePosition?: PanelRuntimeConfig['freeMovePosition']
  preferredPosition?: PanelRuntimeConfig['preferredPosition']
  resolveDockArena?: PanelRuntimeConfig['resolveDockArena']
  configSnapshot?: PanelRuntimePanelConfig
  readonly generation: symbol
  element: HTMLElement | null
}

const executed = (): PanelRuntimeCommandResult => ({ status: 'executed' })
const unavailable = (): PanelRuntimeCommandResult => ({
  status: 'not_executed',
  reason: 'unavailable',
})
const notCollapsible = (): PanelRuntimeCommandResult => ({
  status: 'not_executed',
  reason: 'not_collapsible',
})

const modalPresentation = (): DashPanelLayoutCommandResult => ({
  status: 'not_executed',
  reason: 'modal_presentation',
})

function freezePanel(panel: MutablePanel): PanelRuntimePanelSnapshot {
  return Object.freeze({
    scopeId: panel.scopeId,
    visible: panel.visible,
    collapsed: panel.collapsed,
    collapsible: panel.collapsible,
    placement: panel.placement,
    ...(panel.placementFallbackReason
      ? { placementFallbackReason: panel.placementFallbackReason }
      : {}),
  })
}

const DEFAULT_DOCK_ARENA: PanelRuntimeDockArena = Object.freeze({
  boundary: null,
  inset: Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 }),
})

const CONTAINED_FLOATING_FALLBACK: DashPanelPlacement = Object.freeze({
  mode: 'floating',
  disposition: Object.freeze({ kind: 'snapped', position: 'top-right' }),
})

function dockedPosition(placement: DashPanelPlacement): DashPanelDockPosition | undefined {
  if (placement.mode === 'fixed') return placement.disposition.position
  return placement.mode === 'hybrid' && placement.disposition.kind === 'docked'
    ? placement.disposition.position
    : undefined
}

function placementKey(placement: DashPanelPlacement): string {
  return `${placement.mode}:${placement.disposition.kind}:${'position' in placement.disposition ? placement.disposition.position : ''}`
}

function sameDockArena(first: PanelRuntimeDockArena, second: PanelRuntimeDockArena): boolean {
  return (
    first.boundary === second.boundary &&
    first.inset.top === second.inset.top &&
    first.inset.right === second.inset.right &&
    first.inset.bottom === second.inset.bottom &&
    first.inset.left === second.inset.left
  )
}

function freezePanels(
  panels: ReadonlyMap<string, MutablePanel>,
): Readonly<Record<string, PanelRuntimePanelSnapshot>> {
  const record: Record<string, PanelRuntimePanelSnapshot> = Object.create(null)
  for (const [scopeId, panel] of panels) record[scopeId] = freezePanel(panel)
  return Object.freeze(record)
}

export function createPanelRuntime(): PanelRuntime {
  const panels = new Map<string, MutablePanel>()
  const activationOrder: string[] = []
  const listeners = new Set<() => void>()
  let snapshot = Object.freeze({
    panels: freezePanels(panels),
    activationOrder: Object.freeze([] as string[]),
  }) as PanelRuntimeSnapshot

  const publish = (): void => {
    snapshot = Object.freeze({
      panels: freezePanels(panels),
      activationOrder: Object.freeze([...activationOrder]),
    })
    for (const listener of listeners) listener()
  }

  const panelFor = (scopeId: string): MutablePanel | undefined => panels.get(scopeId)

  const dockArenaFor = (panel: MutablePanel): PanelRuntimeDockArena =>
    panel.resolveDockArena?.() ?? DEFAULT_DOCK_ARENA

  const dockOccupant = (
    panel: MutablePanel,
    position: DashPanelDockPosition,
  ): MutablePanel | undefined =>
    [...panels.values()].find((other) => {
      if (
        other.scopeId === panel.scopeId ||
        !sameDockArena(dockArenaFor(panel), dockArenaFor(other))
      )
        return false
      const otherPosition = dockedPosition(other.placement)
      return (
        otherPosition !== undefined &&
        resolveDashPanelDockSlot(otherPosition) === resolveDashPanelDockSlot(position)
      )
    })

  const materializePlacement = (
    panel: MutablePanel,
    requested: DashPanelPlacement,
  ): { placement: DashPanelPlacement; fallbackReason?: 'dock_occupied' } => {
    const position = dockedPosition(requested)
    if (position === undefined || dockOccupant(panel, position) === undefined)
      return { placement: requested }
    const declared = panel.defaultLayout.placement
    const declaredPosition = dockedPosition(declared)
    if (declaredPosition === undefined || dockOccupant(panel, declaredPosition) === undefined)
      return { placement: declared, fallbackReason: 'dock_occupied' }
    const fallback =
      requested.mode === 'hybrid'
        ? ({ mode: 'hybrid', disposition: { kind: 'snapped', position: 'top' } } as const)
        : CONTAINED_FLOATING_FALLBACK
    return { placement: fallback, fallbackReason: 'dock_occupied' }
  }

  const activatePanel = (panel: MutablePanel): boolean => {
    const currentIndex = activationOrder.indexOf(panel.scopeId)
    if (currentIndex === activationOrder.length - 1) return false
    if (currentIndex >= 0) activationOrder.splice(currentIndex, 1)
    activationOrder.push(panel.scopeId)
    return true
  }

  const commitVisibility = (panel: MutablePanel, visible: boolean): boolean => {
    if (panel.visible === visible) return false
    panel.visible = visible
    return true
  }

  const commitCollapsed = (panel: MutablePanel, collapsed: boolean): boolean => {
    if (panel.collapsed === collapsed) return false
    panel.collapsed = collapsed
    return true
  }

  const notifyVisibility = (panel: MutablePanel): void => {
    panel.onVisibilityChange?.(panel.visible)
  }

  const notifyCollapsed = (panel: MutablePanel): void => {
    panel.onCollapsedChange?.(panel.collapsed)
  }

  const command = (
    scopeId: string,
    mutate: (panel: MutablePanel) => {
      changed: boolean
      notifyVisibility: boolean
      notifyCollapsed: boolean
    },
  ): PanelRuntimeCommandResult => {
    const panel = panelFor(scopeId)
    if (!panel) return unavailable()
    const result = mutate(panel)
    if (!result.changed) return executed()
    publish()
    if (result.notifyVisibility) notifyVisibility(panel)
    if (result.notifyCollapsed) notifyCollapsed(panel)
    return executed()
  }

  const runtime: PanelRuntime = {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      let active = true
      return () => {
        if (!active) return
        active = false
        listeners.delete(listener)
      }
    },
    acquire(config) {
      if (config.defaultCollapsed === true && config.collapsible === false)
        throw new TypeError('A non-collapsible Panel cannot start collapsed.')
      if (panels.has(config.scopeId))
        throw new TypeError(`Panel scope is already active: ${config.scopeId}`)

      const requestedPlacement =
        config.placement ??
        config.defaultLayout?.placement ??
        ({
          mode: 'floating',
          disposition: { kind: 'snapped', position: 'top-right' },
        } as DashPanelPlacement)
      const panel: MutablePanel = {
        scopeId: config.scopeId,
        visible: config.defaultVisible ?? true,
        collapsed: config.defaultCollapsed ?? false,
        collapsible: config.collapsible ?? true,
        onVisibilityChange: config.onVisibilityChange,
        onCollapsedChange: config.onCollapsedChange,
        generation: Symbol(config.scopeId),
        element: null,
        defaultLayout:
          config.defaultLayout ??
          ({
            placement: {
              mode: 'floating',
              disposition: { kind: 'snapped', position: 'top-right' },
            },
          } as DashPanelDefaultLayout),
        placement: requestedPlacement,
        requestedPlacement,
        dockPositions: [...(config.dockPositions ?? [])],
        presentation: config.presentation ?? { kind: 'panel' },
        store: config.store,
        currentPosition: config.currentPosition,
        freeMovePosition: config.freeMovePosition,
        preferredPosition: config.preferredPosition,
        resolveDockArena: config.resolveDockArena,
      }
      const materialized = materializePlacement(panel, requestedPlacement)
      panel.placement = materialized.placement
      panel.placementFallbackReason = materialized.fallbackReason
      panels.set(config.scopeId, panel)
      activationOrder.push(config.scopeId)
      publish()

      let released = false
      const generation = panel.generation
      return {
        update(update) {
          if (released || panels.get(config.scopeId)?.generation !== generation) return
          const current = panels.get(config.scopeId)
          if (!current) return
          if (Object.prototype.hasOwnProperty.call(update, 'onVisibilityChange'))
            current.onVisibilityChange = update.onVisibilityChange
          if (Object.prototype.hasOwnProperty.call(update, 'onCollapsedChange'))
            current.onCollapsedChange = update.onCollapsedChange
          let changed = false
          if (update.collapsible !== undefined && current.collapsible !== update.collapsible) {
            current.collapsible = update.collapsible
            const collapsedChanged = !current.collapsible && current.collapsed
            if (collapsedChanged) {
              current.collapsed = false
              current.onCollapsedChange?.(false)
            }
            changed = true
          }
          if (update.defaultLayout !== undefined) {
            current.defaultLayout = update.defaultLayout
            current.configSnapshot = undefined
            changed = true
          }
          if (update.placement !== undefined) {
            if (placementKey(update.placement) !== placementKey(current.requestedPlacement)) {
              current.requestedPlacement = update.placement
              const materialized = materializePlacement(current, update.placement)
              current.placement = materialized.placement
              current.placementFallbackReason = materialized.fallbackReason
              current.configSnapshot = undefined
              changed = true
            }
          }
          if (update.dockPositions !== undefined) {
            current.dockPositions = [...update.dockPositions]
            current.configSnapshot = undefined
            changed = true
          }
          if (update.presentation !== undefined) {
            current.presentation = update.presentation
            current.configSnapshot = undefined
            changed = true
          }
          if (Object.prototype.hasOwnProperty.call(update, 'store')) {
            current.store = update.store
            changed = true
          }
          if (Object.prototype.hasOwnProperty.call(update, 'currentPosition')) {
            current.currentPosition = update.currentPosition
            changed = true
          }
          if (Object.prototype.hasOwnProperty.call(update, 'freeMovePosition')) {
            current.freeMovePosition = update.freeMovePosition
            changed = true
          }
          if (Object.prototype.hasOwnProperty.call(update, 'preferredPosition')) {
            current.preferredPosition = update.preferredPosition
            changed = true
          }
          if (Object.prototype.hasOwnProperty.call(update, 'resolveDockArena')) {
            current.resolveDockArena = update.resolveDockArena
            if (!current.placementFallbackReason) {
              const materialized = materializePlacement(current, current.placement)
              current.placement = materialized.placement
              current.placementFallbackReason = materialized.fallbackReason
            }
            current.configSnapshot = undefined
            changed = true
          }
          if (changed) publish()
        },
        release() {
          if (released || panels.get(config.scopeId)?.generation !== generation) return
          released = true
          panels.delete(config.scopeId)
          const index = activationOrder.indexOf(config.scopeId)
          if (index >= 0) activationOrder.splice(index, 1)
          publish()
        },
      }
    },
    show(scopeId) {
      return command(scopeId, (panel) => {
        const changedVisibility = commitVisibility(panel, true)
        const changedActivation = activatePanel(panel)
        return {
          changed: changedVisibility || changedActivation,
          notifyVisibility: changedVisibility,
          notifyCollapsed: false,
        }
      })
    },
    hide(scopeId) {
      return command(scopeId, (panel) => {
        const changed = commitVisibility(panel, false)
        return { changed, notifyVisibility: changed, notifyCollapsed: false }
      })
    },
    toggleVisibility(scopeId) {
      return command(scopeId, (panel) => {
        const visible = !panel.visible
        const changedVisibility = commitVisibility(panel, visible)
        const changedActivation = visible && activatePanel(panel)
        return {
          changed: changedVisibility || changedActivation,
          notifyVisibility: changedVisibility,
          notifyCollapsed: false,
        }
      })
    },
    activate(scopeId) {
      return command(scopeId, (panel) => ({
        changed: activatePanel(panel),
        notifyVisibility: false,
        notifyCollapsed: false,
      }))
    },
    expand(scopeId) {
      const panel = panelFor(scopeId)
      if (!panel) return unavailable()
      if (!panel.collapsible) return notCollapsible()
      return command(scopeId, (panel) => {
        const changed = commitCollapsed(panel, false)
        return { changed, notifyVisibility: false, notifyCollapsed: changed }
      })
    },
    collapse(scopeId) {
      const panel = panelFor(scopeId)
      if (!panel) return unavailable()
      if (!panel.collapsible) return notCollapsible()
      return command(scopeId, (panel) => {
        const changed = commitCollapsed(panel, true)
        return { changed, notifyVisibility: false, notifyCollapsed: changed }
      })
    },
    toggleCollapsed(scopeId) {
      const panel = panelFor(scopeId)
      if (!panel) return unavailable()
      if (!panel.collapsible) return notCollapsible()
      return command(scopeId, (panel) => {
        const changed = commitCollapsed(panel, !panel.collapsed)
        return { changed, notifyVisibility: false, notifyCollapsed: changed }
      })
    },
    setPlacement(scopeId, placement) {
      const panel = panelFor(scopeId)
      if (!panel) return { status: 'not_executed', reason: 'unavailable' }
      if (panel.presentation.kind !== 'panel') return modalPresentation()
      const docked =
        placement.mode === 'fixed'
          ? placement.disposition.position
          : placement.mode === 'hybrid' && placement.disposition.kind === 'docked'
            ? placement.disposition.position
            : undefined
      if (docked !== undefined && !panel.dockPositions.includes(docked))
        return { status: 'not_executed', reason: 'position_disabled' }
      const occupant = docked === undefined ? undefined : dockOccupant(panel, docked)
      if (occupant) return { status: 'not_executed', reason: 'dock_occupied' }
      const preferred =
        (placement.disposition.kind === 'free' ? panel.freeMovePosition?.() : undefined) ??
        panel.preferredPosition ??
        panel.defaultLayout.preferredPosition ??
        panel.currentPosition?.()
      if (!preferred) return { status: 'not_executed', reason: 'unavailable' }
      const transaction = panel.store?.setDashPanelLayout({
        placement,
        preferredPosition: { x: preferred.x, y: preferred.y },
      } as DashPanelLayoutRecord)
      if (transaction === undefined) return { status: 'not_executed', reason: 'unavailable' }
      if (transaction.ok) {
        panel.requestedPlacement = placement
        panel.placement = placement
        panel.placementFallbackReason = undefined
        panel.preferredPosition = Object.freeze({ x: preferred.x, y: preferred.y })
        panel.configSnapshot = undefined
        publish()
      }
      return { status: 'executed', transaction }
    },
    resetLayout(scopeId) {
      const panel = panelFor(scopeId)
      if (!panel) return { status: 'not_executed', reason: 'unavailable' }
      if (panel.presentation.kind !== 'panel') return modalPresentation()
      const transaction = panel.store?.resetDashPanelLayout()
      if (transaction === undefined) return { status: 'not_executed', reason: 'unavailable' }
      if (transaction.ok) {
        panel.requestedPlacement = panel.defaultLayout.placement
        const materialized = materializePlacement(panel, panel.defaultLayout.placement)
        panel.placement = materialized.placement
        panel.placementFallbackReason = materialized.fallbackReason
        panel.preferredPosition = panel.defaultLayout.preferredPosition
        panel.configSnapshot = undefined
        publish()
      }
      return { status: 'executed', transaction }
    },
    getPanelConfig(scopeId) {
      const panel = panelFor(scopeId)
      if (!panel) return undefined
      if (panel.configSnapshot) return panel.configSnapshot
      panel.configSnapshot = Object.freeze({
        defaultLayout: panel.defaultLayout,
        placement: panel.placement,
        dockPositions: Object.freeze([...panel.dockPositions]),
        presentation: panel.presentation,
      })
      return panel.configSnapshot
    },
    isDockPositionOccupied(scopeId, position) {
      const panel = panelFor(scopeId)
      return panel ? dockOccupant(panel, position) !== undefined : false
    },
    getDockTarget(scopeId, available) {
      const panel = panelFor(scopeId)
      if (
        !panel ||
        !Number.isFinite(available.width) ||
        available.width < 0 ||
        !Number.isFinite(available.height) ||
        available.height < 0
      )
        return undefined
      const position = dockedPosition(panel.placement)
      if (!position) return undefined
      const arena = dockArenaFor(panel)
      const occupants = [...panels.values()].flatMap((other) => {
        if (!sameDockArena(arena, dockArenaFor(other))) return []
        const otherPosition = dockedPosition(other.placement)
        return otherPosition ? [{ id: other.scopeId, position: otherPosition, panel: other }] : []
      })
      if (position.endsWith('-left') || position.endsWith('-right')) {
        const side = position.endsWith('-left') ? 'left' : 'right'
        const allocation = resolveDashPanelDockSideAllocation(
          side,
          occupants,
          available.height,
        ).allocations.find((value) => value.position === position)
        return allocation
          ? Object.freeze({ allocation: allocation.max, offset: allocation.offset })
          : undefined
      }
      if (position !== 'full-top' && position !== 'full-bottom') return undefined
      const edge = position === 'full-top' ? 'top' : 'bottom'
      const cornerWidth = (cornerPosition: DashPanelDockPosition) => {
        const occupant = occupants.find((value) => value.position === cornerPosition)
        const width = occupant?.panel.element?.getBoundingClientRect().width
        return typeof width === 'number' && Number.isFinite(width) && width > 0 ? width : 0
      }
      const left = Math.min(cornerWidth(`${edge}-left`), available.width)
      const right = Math.min(cornerWidth(`${edge}-right`), available.width - left)
      if (left === 0 && right === 0) return undefined
      return Object.freeze({
        inlineAllocation: available.width - left - right,
        inlineOffset: left,
      })
    },
    registerElement(scopeId, element) {
      const panel = panelFor(scopeId)
      if (panel && panel.element !== element) {
        panel.element = element
        publish()
      }
    },
    notifyElementResize(scopeId) {
      if (panelFor(scopeId)?.element) publish()
    },
    getElement(scopeId) {
      return panelFor(scopeId)?.element ?? null
    },
  }
  return runtime
}
