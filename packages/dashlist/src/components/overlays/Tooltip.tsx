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
import { Tooltip as AriaTooltip, TooltipTrigger as AriaTooltipTrigger } from 'react-aria-components'
import { cn } from '../../utilities/utils.js'

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

function tooltipPlacement(
  side: 'top' | 'right' | 'bottom' | 'left',
  align: 'start' | 'center' | 'end',
): AriaTooltipProps['placement'] {
  if (side === 'left' || side === 'right') return side
  if (align === 'start') return `${side} left`
  if (align === 'end') return `${side} right`
  return side
}

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
}: Omit<AriaTooltipProps, 'children' | 'className' | 'style'> & {
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
  return (
    <AriaTooltip
      {...props}
      containerPadding={collisionPadding}
      crossOffset={alignOffset}
      offset={sideOffset ?? 6}
      placement={tooltipPlacement(side, align)}
      shouldFlip={avoidCollisions}
      className={cn(
        'rounded-picodash-surface border-picodash-border bg-picodash-surface-raised text-picodash-text z-(--picodash-layer-tooltip) max-w-64 border px-(--picodash-space-2-5) py-(--picodash-space-2) text-(length:--picodash-font-size-lg) leading-(--picodash-line-tight) shadow-lg outline-none',
        className,
      )}
      style={style}
    >
      {children}
    </AriaTooltip>
  )
}
