import { useCallback, useRef, type ComponentProps, type ReactNode, type RefCallback } from 'react'
import { useStore } from 'zustand'
import { Button } from '../ui/button.js'
import { cn } from '../../utilities/utils.js'
import { usePicodashProviderContext } from '../../state/provider/picodash-provider.js'
import {
  markPicodashPanelTriggerUsed,
  registerPicodashPanelTrigger,
} from '../../state/provider/picodash-panel-triggers.js'

export interface PicodashPanelIdentity {
  getState: () => { readonly panelId: string }
}

export interface PicodashPanelTriggerProps extends Omit<
  ComponentProps<typeof Button>,
  'children' | 'onPress' | 'ref'
> {
  action?: 'activate' | 'toggle'
  children?: ReactNode
  ref?: RefCallback<HTMLButtonElement>
  store: PicodashPanelIdentity
}

export function picodashPanelTriggerLabel(
  panelId: string,
  action: 'activate' | 'toggle',
  visible: boolean,
) {
  return action === 'toggle' && visible ? `Hide ${panelId}` : `Open ${panelId}`
}

export function activatePicodashPanelFromTrigger(
  providerStore: ReturnType<typeof usePicodashProviderContext>['store'],
  panelId: string,
  action: 'activate' | 'toggle',
) {
  const provider = providerStore.getState()
  const wasVisible = provider.panels[panelId]?.visible ?? false
  if (action === 'toggle' && wasVisible) {
    provider.setPanelVisible(panelId, false)
    return
  }
  provider.setPanelVisible(panelId, true)
  provider.activatePanel(panelId)
}

export function PicodashPanelTrigger({
  action = 'activate',
  children,
  className,
  ref,
  store,
  ...props
}: PicodashPanelTriggerProps) {
  const panelId = store.getState().panelId
  const { store: providerStore } = usePicodashProviderContext()
  const panel = useStore(providerStore, (state) => state.panels[panelId])
  const unregisterRef = useRef<(() => void) | null>(null)
  const elementRef = useRef<HTMLButtonElement | null>(null)
  const triggerRef = useCallback(
    (node: HTMLButtonElement | null) => {
      unregisterRef.current?.()
      elementRef.current = node
      unregisterRef.current = node
        ? registerPicodashPanelTrigger(providerStore, panelId, node)
        : null
      ref?.(node)
    },
    [panelId, providerStore, ref],
  )
  const label = picodashPanelTriggerLabel(panelId, action, panel?.visible ?? false)

  return (
    <Button
      {...props}
      ref={triggerRef}
      aria-controls={panelId}
      aria-expanded={panel?.visible ?? false}
      aria-label={props['aria-label'] ?? (typeof children === 'string' ? undefined : label)}
      className={cn(className)}
      onPress={() => {
        const element = elementRef.current
        if (element) markPicodashPanelTriggerUsed(providerStore, panelId, element)
        activatePicodashPanelFromTrigger(providerStore, panelId, action)
      }}
    >
      {children ?? label}
    </Button>
  )
}

export interface PicodashPanelLauncherItem {
  disabled?: boolean
  label: ReactNode
  store: PicodashPanelIdentity
}

export interface PicodashPanelLauncherProps extends Omit<ComponentProps<'div'>, 'children'> {
  items: readonly PicodashPanelLauncherItem[]
  label?: string
}

export function PicodashPanelLauncher({
  className,
  items,
  label = 'Panels',
  ...props
}: PicodashPanelLauncherProps) {
  return (
    <div
      {...props}
      aria-label={label}
      className={cn('flex flex-wrap items-center gap-(--picodash-space-2)', className)}
      role="group"
    >
      {items.map((item) => (
        <PicodashPanelTrigger
          key={item.store.getState().panelId}
          action="toggle"
          disabled={item.disabled}
          store={item.store}
          variant="outline"
        >
          {item.label}
        </PicodashPanelTrigger>
      ))}
    </div>
  )
}
