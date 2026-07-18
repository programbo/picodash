import { Tooltip as TooltipPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'
import { useStore } from 'zustand'
import { useTweakerTheme } from './tweaker-theme-context.js'
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
  const theme = useTweakerTheme()
  const { portalContainer, store } = useTweakerProviderContext()
  const zIndexFloor = useStore(store, (state) => portalLayerZIndexForState(state, 1))
  const usesTokenOffset = sideOffset === undefined

  return (
    <TooltipPrimitive.Portal container={portalContainer}>
      <TooltipPrimitive.Content
        {...props}
        data-tweaker-theme={theme}
        data-tweaker-token-offset={usesTokenOffset ? 'true' : undefined}
        className={cn(
          'z-(--tweaker-layer-tooltip) max-w-64 rounded-tweaker-surface border border-tweaker-border bg-tweaker-surface-raised px-(--tweaker-space-2-5) py-(--tweaker-space-2) text-(length:--tweaker-font-size-lg) leading-(--tweaker-line-tight) text-tweaker-text shadow-[0_10px_15px_-3px_rgb(0_0_0/0.25),0_4px_6px_-4px_rgb(0_0_0/0.25)] outline-none data-[tweaker-token-offset=true]:data-[side=bottom]:mt-(--tweaker-space-1-5) data-[tweaker-token-offset=true]:data-[side=left]:mr-(--tweaker-space-1-5) data-[tweaker-token-offset=true]:data-[side=right]:ml-(--tweaker-space-1-5) data-[tweaker-token-offset=true]:data-[side=top]:mb-(--tweaker-space-1-5) data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95',
          className,
        )}
        sideOffset={sideOffset ?? 0}
        style={{
          ...style,
          zIndex: portalLayerZIndexValue('--tweaker-layer-tooltip', zIndexFloor),
        }}
      >
        {children}
        <TooltipPrimitive.Arrow className="fill-tweaker-surface-raised" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}
