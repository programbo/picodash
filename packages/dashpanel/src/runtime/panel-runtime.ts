export interface PanelRuntimeConfig {
  readonly scopeId: string
  readonly defaultVisible?: boolean
  readonly defaultCollapsed?: boolean
  readonly collapsible?: boolean
  readonly onVisibilityChange?: (visible: boolean) => void
  readonly onCollapsedChange?: (collapsed: boolean) => void
}

export type PanelRuntimeUpdate = Pick<
  PanelRuntimeConfig,
  'collapsible' | 'onVisibilityChange' | 'onCollapsedChange'
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
}

interface MutablePanel {
  readonly scopeId: string
  visible: boolean
  collapsed: boolean
  collapsible: boolean
  onVisibilityChange?: (visible: boolean) => void
  onCollapsedChange?: (collapsed: boolean) => void
  readonly generation: symbol
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

function freezePanel(panel: MutablePanel): PanelRuntimePanelSnapshot {
  return Object.freeze({
    scopeId: panel.scopeId,
    visible: panel.visible,
    collapsed: panel.collapsed,
    collapsible: panel.collapsible,
  })
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

      const panel: MutablePanel = {
        scopeId: config.scopeId,
        visible: config.defaultVisible ?? true,
        collapsed: config.defaultCollapsed ?? false,
        collapsible: config.collapsible ?? true,
        onVisibilityChange: config.onVisibilityChange,
        onCollapsedChange: config.onCollapsedChange,
        generation: Symbol(config.scopeId),
      }
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
          if (update.collapsible === undefined || current.collapsible === update.collapsible) return
          current.collapsible = update.collapsible
          const collapsedChanged = !current.collapsible && current.collapsed
          if (collapsedChanged) current.collapsed = false
          publish()
          if (collapsedChanged) current.onCollapsedChange?.(false)
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
  }
  return runtime
}
