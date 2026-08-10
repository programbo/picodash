import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type {
  DashPanelCommandResult,
  DashPanelLayoutCommandResult,
  PanelRuntime,
} from './panel-runtime.ts'
import { useDashPanelRuntime, useDashPanelRuntimeState } from './panel-runtime-context.tsx'
import {
  normalizeDashPanelPlacement,
  type DashPanelPlacement,
  type DashPanelPresentation,
} from '../placement/placement.ts'

export type { DashPanelCommandResult, DashPanelLayoutCommandResult }

export interface DashPanelControllerCommands {
  show(): DashPanelCommandResult
  hide(): DashPanelCommandResult
  toggleVisibility(): DashPanelCommandResult
  activate(): DashPanelCommandResult
  expand(): DashPanelCommandResult
  collapse(): DashPanelCommandResult
  toggleCollapsed(): DashPanelCommandResult
  setPlacement(placement: DashPanelPlacement): DashPanelLayoutCommandResult
  resetLayout(): DashPanelLayoutCommandResult
}

export type DashPanelController =
  | (DashPanelControllerCommands & {
      readonly availability: 'unavailable'
      readonly scopeId: string
    })
  | (DashPanelControllerCommands & {
      readonly availability: 'available'
      readonly scopeId: string
      readonly visible: boolean
      readonly collapsed: boolean
      readonly collapsible: boolean
      readonly placement: DashPanelPlacement
      readonly presentation: DashPanelPresentation
    })

const PanelIdentityContext = createContext<string | undefined>(undefined)

export function DashPanelIdentityProvider({
  scopeId,
  children,
}: {
  readonly scopeId: string
  readonly children: ReactNode
}) {
  return <PanelIdentityContext.Provider value={scopeId}>{children}</PanelIdentityContext.Provider>
}

const unavailableByRuntime = new WeakMap<PanelRuntime, Map<string, DashPanelController>>()

function unavailableController(runtime: PanelRuntime, scopeId: string): DashPanelController {
  let controllers = unavailableByRuntime.get(runtime)
  if (!controllers) {
    controllers = new Map()
    unavailableByRuntime.set(runtime, controllers)
  }
  const existing = controllers.get(scopeId)
  if (existing) return existing
  const unavailable = (): DashPanelCommandResult => ({
    status: 'not_executed',
    reason: 'unavailable',
  })
  const unavailableLayout = (): DashPanelLayoutCommandResult => ({
    status: 'not_executed',
    reason: 'unavailable',
  })
  const controller = Object.freeze({
    availability: 'unavailable' as const,
    scopeId,
    show: unavailable,
    hide: unavailable,
    toggleVisibility: unavailable,
    activate: unavailable,
    expand: unavailable,
    collapse: unavailable,
    toggleCollapsed: unavailable,
    setPlacement: unavailableLayout,
    resetLayout: unavailableLayout,
  }) as DashPanelController
  controllers.set(scopeId, controller)
  return controller
}

export function useDashPanel(panelId?: string): DashPanelController {
  const runtime = useDashPanelRuntime()
  const nearestId = useContext(PanelIdentityContext)
  const scopeId = panelId ?? nearestId
  if (scopeId === undefined)
    throw new TypeError('useDashPanel without panelId requires a nearest DashPanel.')
  const state = useDashPanelRuntimeState(scopeId)
  const config = runtime.getPanelConfig(scopeId)
  return useMemo(() => {
    if (!state || !config) return unavailableController(runtime, scopeId)
    return Object.freeze({
      availability: 'available' as const,
      scopeId,
      visible: state.visible,
      collapsed: state.collapsed,
      collapsible: state.collapsible,
      placement: state.placement,
      presentation: config.presentation,
      show: () => runtime.show(scopeId),
      hide: () => runtime.hide(scopeId),
      toggleVisibility: () => runtime.toggleVisibility(scopeId),
      activate: () => runtime.activate(scopeId),
      expand: () => runtime.expand(scopeId),
      collapse: () => runtime.collapse(scopeId),
      toggleCollapsed: () => runtime.toggleCollapsed(scopeId),
      setPlacement: (placement: DashPanelPlacement) =>
        runtime.setPlacement(scopeId, normalizeDashPanelPlacement(placement)),
      resetLayout: () => runtime.resetLayout(scopeId),
    }) as DashPanelController
  }, [config, runtime, scopeId, state])
}
