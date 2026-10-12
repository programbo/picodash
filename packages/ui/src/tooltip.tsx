import {
  Children,
  createContext,
  forwardRef,
  Fragment,
  isValidElement,
  useContext,
  useState,
  useMemo,
  type ReactElement,
  type ReactNode,
  type RefAttributes,
} from 'react'
import {
  OverlayArrow,
  Tooltip as ReactAriaTooltip,
  TooltipTrigger as ReactAriaTooltipTrigger,
  TooltipTriggerStateContext,
  composeRenderProps,
  type TooltipProps as ReactAriaTooltipProps,
  type TooltipTriggerComponentProps as ReactAriaTooltipTriggerComponentProps,
} from 'react-aria-components'
import { UNSAFE_PortalProvider, mergeRefs } from 'react-aria'
import { useHelpOverlay } from './help-overlay.ts'
import { usePicodashDensity, usePicodashTheme } from './theme-provider.tsx'
import { usePicodashOverlayDefaults, validateLayerBase } from './overlay-provider.tsx'
import { ActiveOverlayLayer, resolveOverlayLayer, useActiveOverlayLayer } from './overlay-layer.tsx'

export interface TooltipProviderProps {
  children: ReactNode
  delay?: number
  closeDelay?: number
}

export type TooltipProps = Pick<
  ReactAriaTooltipTriggerComponentProps,
  'closeDelay' | 'defaultOpen' | 'delay' | 'isOpen' | 'onOpenChange'
> & {
  children: ReactNode
}

export interface TooltipTriggerProps {
  children: ReactElement
}

export type TooltipContentProps = Omit<
  ReactAriaTooltipProps,
  | 'children'
  | 'defaultOpen'
  | 'isEntering'
  | 'isExiting'
  | 'isOpen'
  | 'onOpenChange'
  | 'triggerRef'
  | 'UNSTABLE_portalContainer'
> &
  RefAttributes<HTMLDivElement> & {
    children: ReactNode
    portalContainer?: HTMLElement | null
    layerBase?: number
  }

interface TooltipTiming {
  delay: number
  closeDelay: number
}

const tooltipTimingContext = createContext<TooltipTiming>({ delay: 500, closeDelay: 0 })

function isTooltipTriggerElement(node: ReactNode): node is ReactElement<TooltipTriggerProps> {
  return isValidElement<TooltipTriggerProps>(node) && node.type === TooltipTrigger
}

function isTooltipContentElement(node: ReactNode): node is ReactElement<TooltipContentProps> {
  return isValidElement<TooltipContentProps>(node) && node.type === TooltipContent
}

export function TooltipProvider({ children, delay, closeDelay }: TooltipProviderProps) {
  const inherited = useContext(tooltipTimingContext)
  const value = {
    delay: delay ?? inherited.delay,
    closeDelay: closeDelay ?? inherited.closeDelay,
  }
  return <tooltipTimingContext.Provider value={value}>{children}</tooltipTimingContext.Provider>
}

/**
 * A wrapperless trigger slot. Tooltip consumes this element and gives it React Aria's
 * interaction props; rendering the slot on its own returns the supplied element unchanged.
 */
export function TooltipTrigger({ children }: TooltipTriggerProps): ReactElement {
  return children
}

function findComposition(children: ReactNode) {
  const flatten = (nodes: ReactNode): ReactNode[] =>
    Children.toArray(nodes).flatMap((node) =>
      isValidElement<{ children?: ReactNode }>(node) && node.type === Fragment
        ? flatten(node.props.children)
        : [node],
    )
  const items = flatten(children)
  const trigger = items[0]
  const content = items[1]
  if (
    items.length !== 2 ||
    !isTooltipTriggerElement(trigger) ||
    !isTooltipContentElement(content)
  ) {
    throw new TypeError('Tooltip requires exactly TooltipTrigger followed by TooltipContent')
  }
  return { trigger: trigger.props.children, content }
}

const HelpPresentationContext = createContext<
  ReturnType<typeof useHelpOverlay<HTMLDivElement>> | undefined
>(undefined)

function AnimatedTooltip({ children }: { children: ReactNode }) {
  const state = useContext(TooltipTriggerStateContext)
  // RAC retains positioning and exit completion. Keep the requested fast animation even during
  // its warmed-up immediate handoff, without adding a second presence implementation.
  return (
    <TooltipTriggerStateContext.Provider
      value={state ? { ...state, shouldSkipAnimation: false } : state}
    >
      {children}
    </TooltipTriggerStateContext.Provider>
  )
}

export function Tooltip({
  children,
  delay,
  closeDelay,
  isOpen,
  defaultOpen = false,
  onOpenChange,
}: TooltipProps) {
  const inherited = useContext(tooltipTimingContext)
  const defaults = usePicodashOverlayDefaults()
  const [localOpen, setLocalOpen] = useState(defaultOpen)
  const help = useHelpOverlay<HTMLDivElement>({
    enabled: true,
    isOpen: isOpen ?? localOpen,
    onOpenChange: (open) => {
      setLocalOpen(open)
      onOpenChange?.(open)
    },
    ownerDocument:
      defaults.portalContainer?.ownerDocument ??
      (typeof document === 'undefined' ? undefined : document),
  })
  const composition = findComposition(children)
  return (
    <HelpPresentationContext.Provider value={help}>
      <ReactAriaTooltipTrigger
        isOpen={help.isOpen}
        onOpenChange={help.changeOpen}
        delay={help.hasActiveHelp ? 0 : (delay ?? inherited.delay)}
        closeDelay={closeDelay ?? inherited.closeDelay}
      >
        {composition.trigger}
        <AnimatedTooltip>{composition.content}</AnimatedTooltip>
      </ReactAriaTooltipTrigger>
    </HelpPresentationContext.Provider>
  )
}

function composeTooltipStyle(
  style: TooltipContentProps['style'],
  resolvedLayer: string,
): TooltipContentProps['style'] {
  return composeRenderProps(style, (previous) => ({
    ...previous,
    zIndex: resolvedLayer,
  }))
}

export const TooltipContent = forwardRef<HTMLDivElement, TooltipContentProps>(
  function TooltipContent(
    { children, className, style, portalContainer, layerBase, ...props },
    ref,
  ) {
    const help = useContext(HelpPresentationContext)
    const helpElement = help?.element
    const composedRef = useMemo(
      () => (helpElement ? mergeRefs(ref, helpElement) : ref),
      [ref, helpElement],
    )
    const defaults = usePicodashOverlayDefaults()
    const parentLayer = useActiveOverlayLayer()
    const resolvedBase = layerBase === undefined ? defaults.layerBase : validateLayerBase(layerBase)
    const minimumLayer = resolveOverlayLayer('tooltip', resolvedBase, parentLayer)
    const resolvedLayer = help ? `max(${minimumLayer}, ${help.layer})` : minimumLayer
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
        <ReactAriaTooltip
          {...props}
          ref={composedRef}
          className={composeRenderProps(className, (previous) =>
            previous ? `picodash-tooltip ${previous}` : 'picodash-tooltip',
          )}
          style={composeTooltipStyle(style, resolvedLayer)}
          data-slot="tooltip"
          data-picodash-theme={theme}
          data-picodash-density={density}
        >
          <OverlayArrow className="picodash-tooltip-arrow" aria-hidden="true">
            <svg width="15" height={7.5} viewBox="0 0 12 6">
              <path d="M0 0L6 6L12 0" />
            </svg>
          </OverlayArrow>
          {children}
        </ReactAriaTooltip>
      </ActiveOverlayLayer>
    )
    return portalProps ? (
      <UNSAFE_PortalProvider {...portalProps}>{content}</UNSAFE_PortalProvider>
    ) : (
      content
    )
  },
)
