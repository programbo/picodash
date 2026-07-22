import {
  Children,
  createContext,
  isValidElement,
  useContext,
  type ComponentProps,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react'
import { useStore } from 'zustand'
import {
  Tooltip as AriaTooltip,
  TooltipTrigger as AriaTooltipTrigger,
} from './components/ui/tooltip.js'
import { usePicodashTheme } from './picodash-theme-context.js'
import {
  portalLayerZIndexForState,
  portalLayerZIndexValue,
  usePicodashProviderContext,
} from './picodash-provider.js'
import { cn } from './utils.js'

const TooltipDelayContext = createContext(250)

export function TooltipProvider({
  children,
  delayDuration = 250,
}: {
  children?: ReactNode
  delayDuration?: number
  skipDelayDuration?: number
}) {
  return (
    <TooltipDelayContext.Provider value={delayDuration}>{children}</TooltipDelayContext.Provider>
  )
}

export function Tooltip({
  children,
  defaultOpen,
  delayDuration,
  onOpenChange,
  open,
}: {
  children?: ReactNode
  defaultOpen?: boolean
  delayDuration?: number
  onOpenChange?: (open: boolean) => void
  open?: boolean
}) {
  const providerDelay = useContext(TooltipDelayContext)
  const [triggerElement, contentElement] = Children.toArray(children)
  const trigger =
    isValidElement<{ children?: ReactNode }>(triggerElement) &&
    triggerElement.type === TooltipTrigger
      ? triggerElement.props.children
      : triggerElement

  return (
    <AriaTooltipTrigger
      delay={delayDuration ?? providerDelay}
      defaultOpen={defaultOpen}
      isOpen={open}
      onOpenChange={onOpenChange}
    >
      {trigger}
      {contentElement}
    </AriaTooltipTrigger>
  )
}

export function TooltipTrigger({ children }: { asChild?: boolean; children: ReactElement }) {
  return children
}

type AriaTooltipProps = ComponentProps<typeof AriaTooltip>

export function TooltipContent({
  align = 'center',
  alignOffset = 0,
  avoidCollisions = true,
  children,
  className,
  collisionPadding,
  side = 'top',
  sideOffset,
  style,
  ...props
}: Omit<
  AriaTooltipProps,
  | 'children'
  | 'className'
  | 'containerPadding'
  | 'crossOffset'
  | 'offset'
  | 'placement'
  | 'portalContainer'
  | 'shouldFlip'
  | 'style'
> & {
  align?: 'start' | 'center' | 'end'
  alignOffset?: number
  avoidCollisions?: boolean
  children?: ReactNode
  className?: string
  collisionPadding?: number
  side?: 'top' | 'right' | 'bottom' | 'left'
  sideOffset?: number
  style?: CSSProperties
}) {
  const theme = usePicodashTheme()
  const { portalContainer, store } = usePicodashProviderContext()
  const zIndexFloor = useStore(store, (state) => portalLayerZIndexForState(state, 1))
  const usesTokenOffset = sideOffset === undefined
  const placement =
    `${side}${align === 'center' ? '' : ` ${align}`}` as AriaTooltipProps['placement']

  return (
    <AriaTooltip
      {...props}
      arrowClassName="bg-picodash-surface-raised fill-picodash-surface-raised"
      data-picodash-theme={theme}
      data-picodash-token-offset={usesTokenOffset ? 'true' : undefined}
      className={cn(
        'z-(--picodash-layer-tooltip) max-w-64 rounded-picodash-surface border border-picodash-border bg-picodash-surface-raised px-(--picodash-space-2-5) py-(--picodash-space-2) text-(length:--picodash-font-size-lg) leading-(--picodash-line-tight) text-picodash-text shadow-[0_10px_15px_-3px_rgb(0_0_0/0.25),0_4px_6px_-4px_rgb(0_0_0/0.25)] outline-none data-entering:animate-in data-entering:fade-in-0 data-entering:zoom-in-95',
        className,
      )}
      containerPadding={collisionPadding}
      crossOffset={alignOffset}
      offset={sideOffset ?? 6}
      placement={placement}
      portalContainer={portalContainer}
      shouldFlip={avoidCollisions}
      style={{
        ...style,
        zIndex: portalLayerZIndexValue('--picodash-layer-tooltip', zIndexFloor),
      }}
    >
      {children}
    </AriaTooltip>
  )
}
