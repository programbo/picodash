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
        'peer group/switch relative inline-flex h-(--_tweaker-switch-height) w-(--_tweaker-switch-width) shrink-0 items-center rounded-full border border-transparent bg-tweaker-control transition-colors duration-(--tweaker-duration-fast) outline-none after:absolute after:-inset-x-3 after:-inset-y-2 data-focus-visible:ring-2 data-focus-visible:ring-tweaker-focus data-selected:bg-tweaker-accent data-disabled:cursor-not-allowed data-disabled:opacity-(--tweaker-opacity-disabled) data-readonly:cursor-default aria-invalid:border-tweaker-danger aria-invalid:ring-2 aria-invalid:ring-tweaker-danger/20',
        className,
      )}
      {...props}
    >
      {composeRenderProps(children, (children, { isSelected }) => (
        <>
          <span
            data-slot="switch-thumb"
            data-selected={isSelected || undefined}
            className="bg-tweaker-canvas shadow-tweaker-sm pointer-events-none block size-(--_tweaker-switch-thumb-size) translate-x-0 rounded-full transition-transform duration-(--tweaker-duration-fast) data-selected:translate-x-(--_tweaker-switch-thumb-translate)"
          />
          {children}
        </>
      ))}
    </SwitchPrimitive>
  )
}

export { Switch }
