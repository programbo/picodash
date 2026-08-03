import { Children, type ComponentProps, type ReactElement, type ReactNode } from 'react'
import {
  Tooltip as TooltipPrimitive,
  TooltipTrigger as TooltipTriggerPrimitive,
} from 'react-aria-components'

export function TooltipTrigger({
  delay = 0,
  children,
  ...props
}: ComponentProps<typeof TooltipTriggerPrimitive> & { children?: ReactNode }) {
  const [trigger, tooltip] = Children.toArray(children)
  return (
    <TooltipTriggerPrimitive data-slot="tooltip-trigger" delay={delay} {...props}>
      {trigger as ReactElement}
      {tooltip}
    </TooltipTriggerPrimitive>
  )
}

export function Tooltip({ children, ...props }: ComponentProps<typeof TooltipPrimitive>) {
  return (
    <TooltipPrimitive data-slot="tooltip-content" {...props}>
      {children}
    </TooltipPrimitive>
  )
}
