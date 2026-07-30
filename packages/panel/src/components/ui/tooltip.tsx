import * as React from 'react'
import {
  Focusable,
  OverlayArrow,
  Tooltip as TooltipPrimitive,
  TooltipTrigger as TooltipTriggerPrimitive,
} from 'react-aria-components'

import { cn } from '#lib/utils'
import { useResolvedPicodashTheme } from '../../lib/theme/picodash-theme-context.js'
import {
  portalLayerZIndexForState,
  portalLayerZIndexValue,
  useOptionalPicodashProviderContext,
} from '../../state/provider/picodash-provider.js'

const standaloneProviderState = { panelOrder: [] as string[] }
const standaloneProviderSubscribe = () => () => undefined
const standaloneProviderSnapshot = () => standaloneProviderState

function TooltipTrigger({
  delay = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipTriggerPrimitive>) {
  const [trigger, tooltip] = React.Children.toArray(children)

  return (
    <TooltipTriggerPrimitive data-slot="tooltip-trigger" delay={delay} {...props}>
      <Focusable>{trigger as React.ComponentProps<typeof Focusable>['children']}</Focusable>
      {tooltip}
    </TooltipTriggerPrimitive>
  )
}

function Tooltip({
  arrowClassName,
  className,
  placement = 'top',
  offset = 4,
  crossOffset = 0,
  children,
  portalContainer,
  style,
  'data-picodash-theme': picodashTheme,
  ...props
}: Omit<React.ComponentProps<typeof TooltipPrimitive>, 'children' | 'className'> & {
  className?: string
  children?: React.ReactNode
  arrowClassName?: string
  portalContainer?: Element | null
  style?: React.ComponentProps<typeof TooltipPrimitive>['style']
  'data-picodash-theme'?: string
}) {
  const theme = useResolvedPicodashTheme(picodashTheme)
  const provider = useOptionalPicodashProviderContext()
  const providerState = React.useSyncExternalStore(
    provider?.store.subscribe ?? standaloneProviderSubscribe,
    provider?.store.getState ?? standaloneProviderSnapshot,
    provider?.store.getState ?? standaloneProviderSnapshot,
  )
  const zIndexFloor = portalLayerZIndexForState(providerState, 1)
  const resolvedPortalContainer =
    portalContainer === undefined ? provider?.portalContainer : portalContainer
  const resolvedZIndex =
    typeof style === 'object' && style?.zIndex !== undefined
      ? style.zIndex
      : provider
        ? portalLayerZIndexValue('--picodash-layer-tooltip', zIndexFloor)
        : undefined

  return (
    <TooltipPrimitive
      data-slot="tooltip-content"
      data-picodash-theme={theme}
      placement={placement}
      offset={offset}
      crossOffset={crossOffset}
      UNSTABLE_portalContainer={resolvedPortalContainer ?? undefined}
      className={cn(
        'pointer-events-auto',
        'rounded-picodash-surface border-picodash-border bg-picodash-text text-picodash-canvas data-entering:animate-in data-entering:fade-in-0 data-entering:zoom-in-95 data-exiting:animate-out data-exiting:fade-out-0 data-exiting:zoom-out-95 data-[placement=bottom]:slide-in-from-top-2 data-[placement=left]:slide-in-from-right-2 data-[placement=right]:slide-in-from-left-2 data-[placement=top]:slide-in-from-bottom-2 **:data-[slot=kbd]:rounded-picodash-control z-(--picodash-layer-tooltip) inline-flex w-fit max-w-xs origin-(--trigger-anchor-point) items-center gap-(--picodash-space-1-5) border px-(--picodash-space-3) py-(--picodash-space-1-5) text-(length:--picodash-font-size-lg) shadow-(--picodash-shadow-md) has-data-[slot=kbd]:pr-(--picodash-space-1-5) **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate',
        className,
      )}
      style={
        typeof style === 'function'
          ? (values) => {
              const resolvedStyle = style(values)
              return {
                ...resolvedStyle,
                ...(resolvedStyle?.zIndex === undefined && resolvedZIndex !== undefined
                  ? { zIndex: resolvedZIndex }
                  : {}),
              }
            }
          : {
              ...style,
              ...(resolvedZIndex === undefined ? {} : { zIndex: resolvedZIndex }),
            }
      }
      {...props}
    >
      {children}
      <OverlayArrow
        className={cn(
          'bg-picodash-text fill-picodash-text size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-xs',
          arrowClassName,
        )}
        style={({ placement, defaultStyle }) => ({
          ...defaultStyle,
          rotate: '0deg',
          translate: '0 0',
          transform:
            placement === 'bottom'
              ? 'translate(-50%, calc(50% + 2px)) rotate(45deg)'
              : placement === 'top'
                ? 'translate(-50%, calc(-50% - 2px)) rotate(45deg)'
                : placement === 'left'
                  ? 'translate(calc(-50% - 2px), -50%) rotate(45deg)'
                  : 'translate(calc(50% + 2px), -50%) rotate(45deg)',
        })}
      />
    </TooltipPrimitive>
  )
}

export { Tooltip, TooltipTrigger }
