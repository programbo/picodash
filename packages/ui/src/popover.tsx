'use client'

import {
  forwardRef,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefAttributes,
} from 'react'
import { UNSAFE_PortalProvider, mergeRefs } from 'react-aria'
import { useHelpOverlay } from './help-overlay.ts'
import {
  Popover as ReactAriaPopover,
  OverlayTriggerStateContext,
  PopoverContext,
  useSlottedContext,
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
    variant?: 'help'
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
  { portalContainer, layerBase, style, variant, ...props },
  ref,
) {
  const defaults = usePicodashOverlayDefaults()
  const parentLayer = useActiveOverlayLayer()
  const resolvedBase = layerBase === undefined ? defaults.layerBase : validateLayerBase(layerBase)
  const minimumLayer = resolveOverlayLayer('popover', resolvedBase, parentLayer)
  const triggerState = useContext(OverlayTriggerStateContext)
  const popoverContext = useSlottedContext(PopoverContext, props.slot)
  const triggerRef = props.triggerRef ?? popoverContext?.triggerRef
  const outsidePolicy =
    props.shouldCloseOnInteractOutside ?? popoverContext?.shouldCloseOnInteractOutside
  const [localOpen, setLocalOpen] = useState(props.defaultOpen ?? false)
  const help = useHelpOverlay({
    enabled: variant === 'help',
    isOpen: props.isOpen ?? triggerState?.isOpen ?? localOpen,
    onOpenChange: (open) => {
      setLocalOpen(open)
      if (props.onOpenChange) props.onOpenChange(open)
      else triggerState?.setOpen(open)
    },
    ownerDocument:
      (portalContainer ?? defaults.portalContainer)?.ownerDocument ??
      (typeof document === 'undefined' ? undefined : document),
  })
  const resolvedLayer = variant === 'help' ? `max(${minimumLayer}, ${help.layer})` : minimumLayer
  const composedRef = useMemo(
    () => (variant === 'help' ? mergeRefs(ref, help.element) : ref),
    [variant, ref, help.element],
  )
  const retainedHelpRoot = useRef<HTMLElement | null>(null)
  useLayoutEffect(() => {
    if (variant !== 'help') return
    if (!help.isOpen) {
      retainedHelpRoot.current = help.element.current
      return
    }
    const element = help.element.current
    const reactivated = element !== null && element === retainedHelpRoot.current
    retainedHelpRoot.current = null
    if (!reactivated || !element || element.contains(element.ownerDocument.activeElement)) return
    // Only a still-mounted exit needs this. Preserve Dialog's normal initial autofocus,
    // including application-chosen interactive content, and avoid scrolling on reactivation.
    const dialog = element.querySelector<HTMLElement>('[role="dialog"]') ?? element
    dialog.focus({ preventScroll: true })
  }, [variant, help.isOpen, help.element])
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
        ref={composedRef}
        {...(variant === 'help'
          ? {
              isOpen: help.isOpen,
              onOpenChange: help.changeOpen,
              isNonModal: props.isNonModal ?? true,
              // A pointer press focuses its trigger before RAC toggles. Treat that focus return
              // as part of the toggle, not an outside blur that closes then immediately reopens.
              shouldCloseOnInteractOutside: (target: Element) =>
                !triggerRef?.current?.contains(target) && (outsidePolicy?.(target) ?? true),
            }
          : undefined)}
        style={composePopoverStyle(style, resolvedLayer)}
        data-slot="popover"
        data-picodash-popover-variant={variant}
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
