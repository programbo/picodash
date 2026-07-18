import { Tooltip as TooltipPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'
import { useStore } from 'zustand'
import {
  portalLayerZIndexForState,
  portalLayerZIndexValue,
  useTweakerProviderContext,
} from './tweaker-provider.js'
import { cn } from './utils.js'

export function TooltipProvider({
  delayDuration = 250,
  skipDelayDuration = 100,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      delayDuration={delayDuration}
      skipDelayDuration={skipDelayDuration}
      {...props}
    />
  )
}

export function Tooltip(props: ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root {...props} />
}

export function TooltipTrigger(props: ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger {...props} />
}

export function TooltipContent({
  children,
  className,
  sideOffset,
  style,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Content>) {
  const usesTokenOffset = sideOffset === undefined
  const { portalContainer, store, theme } = useTweakerProviderContext()
  const zIndexFloor = useStore(store, (state) => portalLayerZIndexForState(state, 1))

  return (
    <TooltipPrimitive.Portal container={portalContainer}>
      <TooltipPrimitive.Content
        data-tweaker-theme={theme}
        data-tweaker-token-offset={usesTokenOffset ? 'true' : undefined}
        className={cn(
          'z-(--tweaker-layer-tooltip) max-w-(--tweaker-tooltip-max-width) rounded-(--tweaker-tooltip-radius) border border-(--tweaker-tooltip-border) bg-(--tweaker-tooltip-background) px-(--tweaker-tooltip-padding-inline) py-(--tweaker-tooltip-padding-block) text-(length:--tweaker-font-size-lg) leading-(--tweaker-line-tight) text-(--tweaker-tooltip-foreground) shadow-(--tweaker-tooltip-shadow) outline-none data-[tweaker-token-offset=true]:data-[side=bottom]:mt-(--tweaker-tooltip-offset) data-[tweaker-token-offset=true]:data-[side=left]:mr-(--tweaker-tooltip-offset) data-[tweaker-token-offset=true]:data-[side=right]:ml-(--tweaker-tooltip-offset) data-[tweaker-token-offset=true]:data-[side=top]:mb-(--tweaker-tooltip-offset) data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95',
          className,
        )}
        sideOffset={sideOffset ?? 0}
        style={{
          ...style,
          zIndex: portalLayerZIndexValue('--tweaker-layer-tooltip', zIndexFloor),
        }}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="fill-(--tweaker-tooltip-background)" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}
