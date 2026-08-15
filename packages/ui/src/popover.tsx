'use client'

import { forwardRef, type RefAttributes } from 'react'
import { UNSAFE_PortalProvider } from 'react-aria'
import {
  Popover as ReactAriaPopover,
  composeRenderProps,
  type PopoverProps as ReactAriaPopoverProps,
} from 'react-aria-components'
import { ActiveOverlayLayer, resolveOverlayLayer, useActiveOverlayLayer } from './overlay-layer.tsx'
import { usePicodashOverlayDefaults, validateLayerBase } from './overlay-provider.tsx'
import { usePicodashDensity, usePicodashTheme } from './theme-provider.tsx'

export type PopoverProps = Omit<ReactAriaPopoverProps, 'UNSTABLE_portalContainer'> &
  RefAttributes<HTMLElement> & {
    portalContainer?: HTMLElement | null
    layerBase?: number
  }

function composePopoverStyle(
  style: PopoverProps['style'],
  resolvedLayer: string,
): PopoverProps['style'] {
  return composeRenderProps(style, (previous) => ({
    ...previous,
    zIndex: resolvedLayer,
  }))
}

export const Popover = forwardRef<HTMLElement, PopoverProps>(function Popover(
  { portalContainer, layerBase, style, ...props },
  ref,
) {
  const defaults = usePicodashOverlayDefaults()
  const parentLayer = useActiveOverlayLayer()
  const resolvedBase = layerBase === undefined ? defaults.layerBase : validateLayerBase(layerBase)
  const resolvedLayer = resolveOverlayLayer('popover', resolvedBase, parentLayer)
  const theme = usePicodashTheme()
  const density = usePicodashDensity()
  const portalProps =
    portalContainer === undefined
      ? undefined
      : {
          getContainer: () =>
            portalContainer ?? (typeof document !== 'undefined' ? document.body : null),
        }
  const content = (
    <ActiveOverlayLayer value={resolvedLayer}>
      <ReactAriaPopover
        {...props}
        ref={ref}
        style={composePopoverStyle(style, resolvedLayer)}
        data-slot="popover"
        data-picodash-theme={theme}
        data-picodash-density={density}
      />
    </ActiveOverlayLayer>
  )

  return portalProps ? (
    <UNSAFE_PortalProvider {...portalProps}>{content}</UNSAFE_PortalProvider>
  ) : (
    content
  )
})
