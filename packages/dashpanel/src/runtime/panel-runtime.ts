import type {
  CoreTransactionResult,
  DashPanelLayoutRecord,
  PersistentTransactionResult,
} from '@picodash/nexus'
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
import type { DashPanelManualSize, DashPanelSizingState } from '../sizing/index.ts'

export interface DashPanelRestoreSizeOptions {
  readonly axes?: 'both' | 'width' | 'height'
}
export type DashPanelSizeRequest = DashPanelManualSize

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

interface PanelLayoutNexus {
  getState?(): Readonly<{
    scope: Readonly<{ dashPanel?: DashPanelLayoutRecord }> | undefined
  }>
  setDashPanelLayout(
    layout: DashPanelLayoutRecord,
  ): CoreTransactionResult | PersistentTransactionResult
  resetDashPanelLayout(): CoreTransactionResult | PersistentTransactionResult
}

type PanelRuntimePanelConfig = Readonly<{
  readonly defaultLayout: DashPanelDefaultLayout
  readonly placement: DashPanelPlacement
  readonly requestedPlacement: DashPanelPlacement
  readonly dockPositions: readonly DashPanelDockPosition[]
  readonly presentation: DashPanelPresentation
  readonly manualSize?: DashPanelManualSize
  readonly sizing?: DashPanelSizingState
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

type PanelRuntimeDockTargetRequest =
  | {
      readonly kind: 'settled'
      readonly scopeId: string
      readonly available: Readonly<{ width: number; height: number }>
    }
  | {
      readonly kind: 'prospective'
      readonly scopeId: string
      readonly position: DashPanelDockPosition
      readonly available: Readonly<{ width: number; height: number }>
    }

export type PanelRuntimeDockAllocationPreview =
  | { readonly kind: 'free' }
  | { readonly kind: 'docked'; readonly position: DashPanelDockPosition }

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
  readonly nexus?: PanelLayoutNexus
  readonly currentPosition?: () => Readonly<{ x: number; y: number }> | undefined
  readonly freeMovePosition?: () => Readonly<{ x: number; y: number }> | undefined
  readonly preferredPosition?: Readonly<{ x: number; y: number }>
  readonly resolveDockArena?: () => PanelRuntimeDockArena
  readonly layout?: DashPanelLayoutRecord
  readonly sizing?: DashPanelSizingState
  readonly onCommand?: (
    command: string,
    outcome: 'accepted' | 'unchanged' | 'rejected',
    reason?: string,
  ) => void
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
  | 'nexus'
  | 'currentPosition'
  | 'freeMovePosition'
  | 'preferredPosition'
  | 'resolveDockArena'
  | 'layout'
  | 'sizing'
  | 'onCommand'
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
  setSize(scopeId: string, size: DashPanelSizeRequest): DashPanelLayoutCommandResult
  restorePreferredSize(
    scopeId: string,
    options?: DashPanelRestoreSizeOptions,
  ): DashPanelLayoutCommandResult
  commitResize(
    scopeId: string,
    size: DashPanelManualSize,
    position?: Readonly<{ x: number; y: number }>,
  ): DashPanelLayoutCommandResult
  getPanelConfig(scopeId: string): PanelRuntimePanelConfig | undefined
  isDockPositionOccupied(scopeId: string, position: DashPanelDockPosition): boolean
  setDockAllocationPreview(scopeId: string, preview: PanelRuntimeDockAllocationPreview | null): void
  resolveDockTarget(request: PanelRuntimeDockTargetRequest): PanelRuntimeDockTarget | undefined
  registerElement(scopeId: string, element: HTMLElement | null): void
  notifyElementResize(scopeId: string, inlineSize?: number): void
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
  nexus?: PanelRuntimeConfig['nexus']
  currentPosition?: PanelRuntimeConfig['currentPosition']
  freeMovePosition?: PanelRuntimeConfig['freeMovePosition']
  preferredPosition?: PanelRuntimeConfig['preferredPosition']
  resolveDockArena?: PanelRuntimeConfig['resolveDockArena']
  layout?: DashPanelLayoutRecord
  sizing?: DashPanelSizingState
  onCommand?: PanelRuntimeConfig['onCommand']
  dockArena: PanelRuntimeDockArena
  configSnapshot?: PanelRuntimePanelConfig
  readonly generation: symbol
  element: HTMLElement | null
  lastCornerInlineSize?: number
  dockAllocationPreview?: PanelRuntimeDockAllocationPreview
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

function sameDefaultLayout(first: DashPanelDefaultLayout, second: DashPanelDefaultLayout): boolean {
  return (
    placementKey(first.placement) === placementKey(second.placement) &&
    first.preferredPosition?.x === second.preferredPosition?.x &&
    first.preferredPosition?.y === second.preferredPosition?.y
  )
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

  // Declarative registration follows React effects, while public Nexus writes are synchronous.
  // Read the canonical record at the command boundary so untouched overrides cannot be lost.
  // Only legacy internal test stubs lack getState; an actual missing record must remain missing.
  const currentLayout = (panel: MutablePanel): DashPanelLayoutRecord | undefined =>
    panel.nexus?.getState ? panel.nexus.getState().scope?.dashPanel : panel.layout

  const dockArenaFor = (panel: MutablePanel): PanelRuntimeDockArena => panel.dockArena

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

  const dockOccupants = (panel: MutablePanel, prospectivePosition?: DashPanelDockPosition) =>
    [...panels.values()].flatMap((other) => {
      if (!sameDockArena(dockArenaFor(panel), dockArenaFor(other))) return []
      const previewPosition =
        other.dockAllocationPreview?.kind === 'docked'
          ? other.dockAllocationPreview.position
          : other.dockAllocationPreview?.kind === 'free'
            ? undefined
            : dockedPosition(other.placement)
      const position =
        other.scopeId === panel.scopeId && prospectivePosition !== undefined
          ? prospectivePosition
          : previewPosition
      return position ? [{ id: other.scopeId, position, panel: other }] : []
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

  const cacheCornerInlineSize = (panel: MutablePanel, measuredInlineSize?: number): void => {
    const position = dockedPosition(panel.placement)
    if (
      position !== 'top-left' &&
      position !== 'top-right' &&
      position !== 'bottom-left' &&
      position !== 'bottom-right'
    )
      return
    const element = panel.element
    if (!element) return
    let width = measuredInlineSize ?? element.getBoundingClientRect().width
    if ((!Number.isFinite(width) || width <= 0) && panel.lastCornerInlineSize === undefined) {
      const wasHidden = element.hidden
      if (wasHidden) {
        const visibility = element.style.getPropertyValue('visibility')
        const priority = element.style.getPropertyPriority('visibility')
        element.style.setProperty('visibility', 'hidden', 'important')
        element.hidden = false
        try {
          width = element.getBoundingClientRect().width
        } finally {
          element.hidden = true
          if (visibility) element.style.setProperty('visibility', visibility, priority)
          else element.style.removeProperty('visibility')
        }
      }
    }
    if (Number.isFinite(width) && (width > 0 || (width === 0 && panel.visible)))
      panel.lastCornerInlineSize = width
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
        nexus: config.nexus,
        currentPosition: config.currentPosition,
        freeMovePosition: config.freeMovePosition,
        preferredPosition: config.preferredPosition,
        resolveDockArena: config.resolveDockArena,
        dockArena: config.resolveDockArena?.() ?? DEFAULT_DOCK_ARENA,
        layout: config.layout,
        sizing: config.sizing,
        onCommand: config.onCommand,
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
          if (Object.hasOwn(update, 'layout') && current.layout !== update.layout) {
            current.layout = update.layout
            current.configSnapshot = undefined
            changed = true
          }
          if (
            Object.hasOwn(update, 'sizing') &&
            JSON.stringify(current.sizing) !== JSON.stringify(update.sizing)
          ) {
            current.sizing = update.sizing
            current.configSnapshot = undefined
            changed = true
          }
          if (Object.hasOwn(update, 'onCommand')) current.onCommand = update.onCommand
          let notifyExpandedAfterPublish = false
          if (update.collapsible !== undefined && current.collapsible !== update.collapsible) {
            current.collapsible = update.collapsible
            const collapsedChanged = !current.collapsible && current.collapsed
            if (collapsedChanged) {
              current.collapsed = false
              notifyExpandedAfterPublish = true
            }
            changed = true
          }
          if (
            update.defaultLayout !== undefined &&
            !sameDefaultLayout(current.defaultLayout, update.defaultLayout)
          ) {
            current.defaultLayout = update.defaultLayout
            const materialized = materializePlacement(current, current.requestedPlacement)
            current.placement = materialized.placement
            current.placementFallbackReason = materialized.fallbackReason
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
          if (Object.prototype.hasOwnProperty.call(update, 'nexus')) {
            current.nexus = update.nexus
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
            const previousArena = dockArenaFor(current)
            current.resolveDockArena = update.resolveDockArena
            const nextArena = current.resolveDockArena?.() ?? DEFAULT_DOCK_ARENA
            current.dockArena = nextArena
            if (!sameDockArena(previousArena, nextArena)) {
              const materialized = materializePlacement(current, current.requestedPlacement)
              current.placement = materialized.placement
              current.placementFallbackReason = materialized.fallbackReason
              current.configSnapshot = undefined
              changed = true
            }
          }
          if (changed) publish()
          if (notifyExpandedAfterPublish) current.onCollapsedChange?.(false)
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
      if (docked !== undefined && !panel.dockPositions.includes(docked)) {
        panel.onCommand?.('setPlacement', 'rejected', 'position_disabled')
        return { status: 'not_executed', reason: 'position_disabled' }
      }
      const occupant = docked === undefined ? undefined : dockOccupant(panel, docked)
      if (occupant) {
        panel.onCommand?.('setPlacement', 'rejected', 'dock_occupied')
        return { status: 'not_executed', reason: 'dock_occupied' }
      }
      const previousLayout = currentLayout(panel)
      const preferred =
        (placement.disposition.kind === 'free' ? panel.freeMovePosition?.() : undefined) ??
        previousLayout?.preferredPosition ??
        (panel.nexus?.getState ? undefined : panel.preferredPosition) ??
        panel.defaultLayout.preferredPosition ??
        panel.currentPosition?.()
      if (!preferred) return { status: 'not_executed', reason: 'unavailable' }
      const layout: DashPanelLayoutRecord = {
        ...previousLayout,
        version: 2,
        placement,
        preferredPosition: { x: preferred.x, y: preferred.y },
      }
      const transaction = panel.nexus?.setDashPanelLayout(layout)
      if (transaction === undefined) return { status: 'not_executed', reason: 'unavailable' }
      if (transaction.ok) {
        panel.layout = layout
        panel.requestedPlacement = placement
        panel.placement = placement
        panel.placementFallbackReason = undefined
        panel.preferredPosition = Object.freeze({ x: preferred.x, y: preferred.y })
        panel.configSnapshot = undefined
        publish()
      }
      panel.onCommand?.('setPlacement', transaction.ok ? 'accepted' : 'rejected')
      return { status: 'executed', transaction }
    },
    resetLayout(scopeId) {
      const panel = panelFor(scopeId)
      if (!panel) return { status: 'not_executed', reason: 'unavailable' }
      if (panel.presentation.kind !== 'panel') return modalPresentation()
      const transaction = panel.nexus?.resetDashPanelLayout()
      if (transaction === undefined) return { status: 'not_executed', reason: 'unavailable' }
      if (transaction.ok) {
        panel.layout = undefined
        panel.requestedPlacement = panel.defaultLayout.placement
        const materialized = materializePlacement(panel, panel.defaultLayout.placement)
        panel.placement = materialized.placement
        panel.placementFallbackReason = materialized.fallbackReason
        panel.preferredPosition = panel.defaultLayout.preferredPosition
        panel.configSnapshot = undefined
        publish()
      }
      panel.onCommand?.(
        'resetLayout',
        transaction.ok
          ? transaction.changedScopeIds.length
            ? 'accepted'
            : 'unchanged'
          : 'rejected',
      )
      return { status: 'executed', transaction }
    },
    setSize(scopeId, size) {
      return runtime.commitResize(scopeId, size)
    },
    commitResize(scopeId, size, position) {
      const panel = panelFor(scopeId)
      if (!panel) return { status: 'not_executed', reason: 'unavailable' }
      if (panel.presentation.kind !== 'panel') return modalPresentation()
      if (size === null || typeof size !== 'object' || Array.isArray(size))
        throw new TypeError('Panel size must contain width or height.')
      const prototype = Object.getPrototypeOf(size)
      if (prototype !== Object.prototype && prototype !== null)
        throw new TypeError('Panel size must be a plain record.')
      const descriptors = Object.getOwnPropertyDescriptors(size)
      const keys = Reflect.ownKeys(descriptors)
      if (keys.length === 0 || keys.some((key) => key !== 'width' && key !== 'height'))
        throw new TypeError('Panel size must contain only width or height.')
      for (const descriptor of Object.values(descriptors))
        if (
          !('value' in descriptor) ||
          !descriptor.enumerable ||
          typeof descriptor.value !== 'number' ||
          !Number.isFinite(descriptor.value) ||
          descriptor.value <= 0
        )
          throw new TypeError('Panel size values must be positive finite CSS pixels.')
      const previousLayout = currentLayout(panel)
      const layout: DashPanelLayoutRecord = {
        ...previousLayout,
        version: 2,
        manualSize: { ...previousLayout?.manualSize, ...size },
        ...(position ? { preferredPosition: position } : {}),
      }
      const transaction = panel.nexus?.setDashPanelLayout(layout)
      if (transaction === undefined) return { status: 'not_executed', reason: 'unavailable' }
      if (transaction.ok) {
        panel.layout = layout
        if (position) panel.preferredPosition = position
        panel.configSnapshot = undefined
        publish()
      }
      panel.onCommand?.(
        'setSize',
        transaction.ok
          ? transaction.changedScopeIds.length
            ? 'accepted'
            : 'unchanged'
          : 'rejected',
      )
      return { status: 'executed', transaction }
    },
    restorePreferredSize(scopeId, options = {}) {
      const panel = panelFor(scopeId)
      if (!panel) return { status: 'not_executed', reason: 'unavailable' }
      if (panel.presentation.kind !== 'panel') return modalPresentation()
      const axes = options.axes ?? 'both'
      if (axes !== 'both' && axes !== 'width' && axes !== 'height')
        throw new TypeError('Invalid restore-size axes.')
      const previousLayout = currentLayout(panel)
      const previousSize = previousLayout?.manualSize
      const width = axes === 'both' || axes === 'width' ? undefined : previousSize?.width
      const height = axes === 'both' || axes === 'height' ? undefined : previousSize?.height
      const manualSize =
        width !== undefined
          ? { width, ...(height !== undefined ? { height } : {}) }
          : height !== undefined
            ? { height }
            : undefined
      const placement = previousLayout?.placement
      const preferredPosition = previousLayout?.preferredPosition
      const layout: DashPanelLayoutRecord | undefined = placement
        ? {
            version: 2,
            placement,
            ...(preferredPosition ? { preferredPosition } : {}),
            ...(manualSize ? { manualSize } : {}),
          }
        : preferredPosition
          ? { version: 2, preferredPosition, ...(manualSize ? { manualSize } : {}) }
          : manualSize
            ? { version: 2, manualSize }
            : undefined
      const transaction = layout
        ? panel.nexus?.setDashPanelLayout(layout)
        : panel.nexus?.resetDashPanelLayout()
      if (transaction === undefined) return { status: 'not_executed', reason: 'unavailable' }
      if (transaction.ok) {
        panel.layout = layout
        panel.configSnapshot = undefined
        publish()
      }
      panel.onCommand?.(
        'restorePreferredSize',
        transaction.ok
          ? transaction.changedScopeIds.length
            ? 'accepted'
            : 'unchanged'
          : 'rejected',
      )
      return { status: 'executed', transaction }
    },
    getPanelConfig(scopeId) {
      const panel = panelFor(scopeId)
      if (!panel) return undefined
      if (panel.configSnapshot) return panel.configSnapshot
      panel.configSnapshot = Object.freeze({
        defaultLayout: panel.defaultLayout,
        placement: panel.placement,
        requestedPlacement: panel.requestedPlacement,
        dockPositions: Object.freeze([...panel.dockPositions]),
        presentation: panel.presentation,
        manualSize: panel.layout?.manualSize,
        sizing: panel.sizing,
      })
      return panel.configSnapshot
    },
    isDockPositionOccupied(scopeId, position) {
      const panel = panelFor(scopeId)
      return panel ? dockOccupant(panel, position) !== undefined : false
    },
    setDockAllocationPreview(scopeId, preview) {
      const panel = panelFor(scopeId)
      if (!panel) return
      const current = panel.dockAllocationPreview
      if (
        (preview === null && current === undefined) ||
        (preview?.kind === 'free' && current?.kind === 'free') ||
        (preview?.kind === 'docked' &&
          current?.kind === 'docked' &&
          preview.position === current.position)
      )
        return
      panel.dockAllocationPreview = preview ?? undefined
      publish()
    },
    resolveDockTarget(request) {
      const panel = panelFor(request.scopeId)
      const { available } = request
      if (
        !panel ||
        !Number.isFinite(available.width) ||
        available.width < 0 ||
        !Number.isFinite(available.height) ||
        available.height < 0
      )
        return undefined
      const position =
        request.kind === 'prospective' ? request.position : dockedPosition(panel.placement)
      if (!position) return undefined
      if (request.kind === 'prospective' && dockOccupant(panel, position)) return undefined
      const occupants = dockOccupants(
        panel,
        request.kind === 'prospective' ? request.position : undefined,
      )
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
        if (!occupant) return 0
        const width = occupant.panel.element?.getBoundingClientRect().width
        if (
          typeof width === 'number' &&
          Number.isFinite(width) &&
          (width > 0 || (width === 0 && occupant.panel.visible))
        ) {
          occupant.panel.lastCornerInlineSize = width
          return width
        }
        return occupant.panel.lastCornerInlineSize ?? 0
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
        cacheCornerInlineSize(panel)
        publish()
      }
    },
    notifyElementResize(scopeId, inlineSize) {
      const panel = panelFor(scopeId)
      if (panel?.element) {
        cacheCornerInlineSize(panel, inlineSize)
        publish()
      }
    },
    getElement(scopeId) {
      return panelFor(scopeId)?.element ?? null
    },
  }
  for (const name of [
    'show',
    'hide',
    'toggleVisibility',
    'activate',
    'expand',
    'collapse',
    'toggleCollapsed',
  ] as const) {
    const execute = runtime[name]
    runtime[name] = (scopeId) => {
      const before = snapshot
      const result = execute(scopeId)
      const panel = panelFor(scopeId)
      panel?.onCommand?.(
        name,
        result.status === 'executed'
          ? before === snapshot
            ? 'unchanged'
            : 'accepted'
          : 'rejected',
        result.status === 'not_executed' ? result.reason : undefined,
      )
      return result
    }
  }
  return runtime
}
