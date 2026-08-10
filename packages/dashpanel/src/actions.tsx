import { Fragment, useContext, createContext, type ReactNode } from 'react'
import { ActionMenuItem, ActionMenuSeparator, ActionSubmenu } from '@picodash/ui'
import {
  useDashPanel,
  type DashPanelController,
  type DashPanelLayoutCommandResult,
} from './runtime/panel-controller.tsx'
import { useDashPanelPolicy } from './runtime/panel-policy-context.tsx'
import { useDashPanelRuntime } from './runtime/panel-runtime-context.tsx'
import type {
  DashPanelDockPosition,
  DashPanelPlacement,
  DashPanelSnapPosition,
} from './placement/placement.ts'

export interface DashPanelRemoveRequest {
  readonly scopeId: string
}

interface DashPanelActionContextValue {
  readonly scopeId: string
  readonly onRequestRemove?: (details: DashPanelRemoveRequest) => void
  readonly announce: (message: string) => void
}

const DashPanelActionContext = createContext<DashPanelActionContextValue | undefined>(undefined)

export function DashPanelActionProvider({
  scopeId,
  onRequestRemove,
  announce,
  children,
}: DashPanelActionContextValue & { readonly children: ReactNode }) {
  return (
    <DashPanelActionContext.Provider value={{ scopeId, onRequestRemove, announce }}>
      {children}
    </DashPanelActionContext.Provider>
  )
}

function useActionContext(): DashPanelActionContextValue {
  const context = useContext(DashPanelActionContext)
  if (context === undefined) throw new TypeError('DashPanel actions require an active DashPanel.')
  return context
}

function samePlacement(left: DashPanelPlacement, right: DashPanelPlacement): boolean {
  return (
    left.mode === right.mode &&
    left.disposition.kind === right.disposition.kind &&
    (left.disposition.kind === 'free' ||
      (right.disposition.kind !== 'free' &&
        left.disposition.position === right.disposition.position))
  )
}

function placementItem(
  controller: DashPanelController,
  placement: DashPanelPlacement,
  label: string,
  announce: (message: string) => void,
  occupied = false,
) {
  if (controller.availability === 'unavailable') return null
  return (
    <ActionMenuItem
      key={`${placement.mode}-${placement.disposition.kind}-${
        placement.disposition.kind === 'free' ? 'free' : placement.disposition.position
      }`}
      label={label}
      isDisabled={occupied || samePlacement(controller.placement, placement)}
      onAction={() => {
        announceDashPanelLayoutFailure(
          'Panel placement',
          controller.setPlacement(placement),
          announce,
        )
      }}
    />
  )
}

const layoutFailureReasons = {
  unavailable: 'The Panel is unavailable.',
  dock_occupied: 'The dock position is occupied.',
  position_disabled: 'The placement is disabled.',
  modal_presentation: 'The current presentation does not support layout changes.',
} as const

export function announceDashPanelLayoutFailure(
  action: string,
  result: DashPanelLayoutCommandResult,
  announce: (message: string) => void,
): void {
  if (result.status === 'not_executed') {
    announce(`${action} failed: ${layoutFailureReasons[result.reason]}`)
    return
  }
  if (!result.transaction.ok)
    announce(
      `${action} failed: ${
        result.transaction.error.issues[0]?.message ?? 'The Store rejected the change.'
      }`,
    )
}

const snapLabels: Readonly<Record<DashPanelSnapPosition, string>> = Object.freeze({
  'top-left': 'Snap top-left',
  top: 'Snap top',
  'top-right': 'Snap top-right',
  right: 'Snap right',
  'bottom-right': 'Snap bottom-right',
  bottom: 'Snap bottom',
  'bottom-left': 'Snap bottom-left',
  left: 'Snap left',
})

const dockLabels: Readonly<Record<DashPanelDockPosition, string>> = Object.freeze({
  'top-left': 'Dock top-left',
  'top-right': 'Dock top-right',
  'bottom-right': 'Dock bottom-right',
  'bottom-left': 'Dock bottom-left',
  'full-left': 'Dock full-left',
  'center-left': 'Dock center-left',
  'full-right': 'Dock full-right',
  'center-right': 'Dock center-right',
  'full-top': 'Dock full-top',
  'center-top': 'Dock center-top',
  'full-bottom': 'Dock full-bottom',
  'center-bottom': 'Dock center-bottom',
})

const snapPositions: readonly DashPanelSnapPosition[] = [
  'top-left',
  'top',
  'top-right',
  'right',
  'bottom-right',
  'bottom',
  'bottom-left',
  'left',
]

const dockPositions: readonly DashPanelDockPosition[] = [
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

function floatingPlacement(disposition: DashPanelPlacement['disposition']): DashPanelPlacement {
  return { mode: 'floating', disposition } as DashPanelPlacement
}

function hybridPlacement(disposition: DashPanelPlacement['disposition']): DashPanelPlacement {
  return { mode: 'hybrid', disposition } as DashPanelPlacement
}

export function DashPanelPlacementSubmenu() {
  const controller = useDashPanel()
  const { announce } = useActionContext()
  const policy = useDashPanelPolicy()
  const runtime = useDashPanelRuntime()
  if (controller.availability === 'unavailable') return null

  const mode =
    runtime.getPanelConfig(controller.scopeId)?.requestedPlacement.mode ?? controller.placement.mode
  const snaps =
    mode === 'floating'
      ? snapPositions.map((position) =>
          placementItem(
            controller,
            floatingPlacement({ kind: 'snapped', position }),
            snapLabels[position],
            announce,
          ),
        )
      : mode === 'hybrid'
        ? (['top', 'bottom'] as const).map((position) =>
            placementItem(
              controller,
              hybridPlacement({ kind: 'snapped', position }),
              snapLabels[position],
              announce,
            ),
          )
        : []
  const free =
    mode === 'floating'
      ? placementItem(controller, floatingPlacement({ kind: 'free' }), 'Free', announce)
      : mode === 'hybrid'
        ? placementItem(controller, hybridPlacement({ kind: 'free' }), 'Free', announce)
        : null
  const docks =
    mode === 'fixed' || mode === 'hybrid'
      ? dockPositions
          .filter((position) => policy.dockPositions.includes(position))
          .map((position) =>
            placementItem(
              controller,
              mode === 'fixed'
                ? { mode: 'fixed', disposition: { kind: 'docked', position } }
                : { mode: 'hybrid', disposition: { kind: 'docked', position } },
              dockLabels[position],
              announce,
              runtime.isDockPositionOccupied(controller.scopeId, position),
            ),
          )
      : []
  return (
    <ActionSubmenu label="Placement">
      {free}
      {snaps}
      {docks}
    </ActionSubmenu>
  )
}

export function DashPanelResetLayoutItem() {
  const controller = useDashPanel()
  const { announce } = useActionContext()
  if (controller.availability === 'unavailable') return null
  return (
    <ActionMenuItem
      label="Reset layout"
      onAction={() => {
        announceDashPanelLayoutFailure('Panel layout reset', controller.resetLayout(), announce)
      }}
    />
  )
}

export function DashPanelRequestRemoveItem() {
  const controller = useDashPanel()
  const { onRequestRemove } = useActionContext()
  if (controller.availability === 'unavailable' || onRequestRemove === undefined) return null
  return (
    <ActionMenuItem
      label="Remove panel…"
      variant="destructive"
      confirmation={{
        title: 'Remove panel?',
        description: 'The application will decide whether to unmount this panel.',
        actionLabel: 'Remove panel',
      }}
      onAction={() => {
        onRequestRemove({ scopeId: controller.scopeId })
      }}
    />
  )
}

export function DashPanelActionItems() {
  const remove = <DashPanelRequestRemoveItem />
  const actionContext = useContext(DashPanelActionContext)
  return (
    <Fragment>
      <DashPanelPlacementSubmenu />
      <ActionMenuSeparator />
      <DashPanelResetLayoutItem />
      {actionContext?.onRequestRemove ? (
        <Fragment>
          <ActionMenuSeparator />
          {remove}
        </Fragment>
      ) : null}
    </Fragment>
  )
}
