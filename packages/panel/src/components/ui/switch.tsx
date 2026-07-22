'use client'

import {
  composeRenderProps,
  Switch as SwitchPrimitive,
  type SwitchProps as SwitchPrimitiveProps,
} from 'react-aria-components'

import { cn } from '#lib/utils'

function Switch({
  className,
  size = 'default',
  children,
  ...props
}: SwitchPrimitiveProps & {
  size?: 'sm' | 'default'
}) {
  return (
    <SwitchPrimitive
      data-slot="switch"
      data-size={size}
      className={cn(
        'peer group/switch relative inline-flex h-(--_picodash-switch-height) w-(--_picodash-switch-width) shrink-0 items-center rounded-full border border-transparent bg-picodash-control transition-colors duration-(--picodash-duration-fast) outline-none after:absolute after:-inset-x-3 after:-inset-y-2 data-focus-visible:ring-2 data-focus-visible:ring-picodash-focus data-selected:bg-picodash-accent data-disabled:cursor-not-allowed data-disabled:opacity-(--picodash-opacity-disabled) data-readonly:cursor-default aria-invalid:border-picodash-danger aria-invalid:ring-2 aria-invalid:ring-picodash-danger/20',
        className,
      )}
      {...props}
    >
      {composeRenderProps(children, (children, { isSelected }) => (
        <>
          <span
            data-slot="switch-thumb"
            data-selected={isSelected || undefined}
            className="bg-picodash-canvas shadow-picodash-sm pointer-events-none block size-(--_picodash-switch-thumb-size) translate-x-0 rounded-full transition-transform duration-(--picodash-duration-fast) data-selected:translate-x-(--_picodash-switch-thumb-translate)"
          />
          {children}
        </>
      ))}
    </SwitchPrimitive>
  )
}

export { Switch }
