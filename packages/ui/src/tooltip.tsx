import {
  Children,
  createContext,
  forwardRef,
  Fragment,
  isValidElement,
  useContext,
  type ReactElement,
  type ReactNode,
  type RefAttributes,
} from 'react'
import {
  OverlayArrow,
  Tooltip as ReactAriaTooltip,
  TooltipTrigger as ReactAriaTooltipTrigger,
  composeRenderProps,
  type TooltipProps as ReactAriaTooltipProps,
  type TooltipTriggerComponentProps as ReactAriaTooltipTriggerComponentProps,
} from 'react-aria-components'
import { UNSAFE_PortalProvider } from 'react-aria'
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

export function Tooltip({ children, delay, closeDelay, ...props }: TooltipProps) {
  const inherited = useContext(tooltipTimingContext)
  const composition = findComposition(children)
  return (
    <ReactAriaTooltipTrigger
      {...props}
      delay={delay ?? inherited.delay}
      closeDelay={closeDelay ?? inherited.closeDelay}
    >
      {composition.trigger}
      {composition.content}
    </ReactAriaTooltipTrigger>
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
    const defaults = usePicodashOverlayDefaults()
    const parentLayer = useActiveOverlayLayer()
    const resolvedBase = layerBase === undefined ? defaults.layerBase : validateLayerBase(layerBase)
    const resolvedLayer = resolveOverlayLayer('tooltip', resolvedBase, parentLayer)
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
          ref={ref}
          className={composeRenderProps(className, (previous) =>
            previous ? `picodash-tooltip ${previous}` : 'picodash-tooltip',
          )}
          style={composeTooltipStyle(style, resolvedLayer)}
          data-slot="tooltip"
          data-picodash-theme={theme}
          data-picodash-density={density}
        >
          <OverlayArrow className="picodash-tooltip-arrow" aria-hidden="true" />
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
