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
        'peer group/switch relative inline-flex shrink-0 items-center rounded-2xl border-2 transition-all outline-none not-data-selected:border-transparent not-data-selected:bg-tweaker-control/90 after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-tweaker-focus focus-visible:ring-3 focus-visible:ring-tweaker-focus/30 aria-invalid:border-tweaker-danger aria-invalid:ring-3 aria-invalid:ring-tweaker-danger/20 data-focus-visible:border-tweaker-focus data-focus-visible:ring-3 data-focus-visible:ring-tweaker-focus/30 data-invalid:border-tweaker-danger data-invalid:ring-3 data-invalid:ring-tweaker-danger/20 data-[size=default]:h-5 data-[size=default]:w-8 data-[size=sm]:h-4 data-[size=sm]:w-6 dark:aria-invalid:border-tweaker-danger/50 dark:aria-invalid:ring-tweaker-danger/40 dark:data-invalid:border-tweaker-danger/50 dark:data-invalid:ring-tweaker-danger/40 data-checked:border-tweaker-accent data-checked:bg-tweaker-accent data-unchecked:border-transparent data-unchecked:bg-tweaker-control/90 data-selected:border-tweaker-accent data-selected:bg-tweaker-accent data-disabled:cursor-not-allowed data-disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {composeRenderProps(children, (children, { isSelected }) => (
        <>
          <span
            data-slot="switch-thumb"
            data-selected={isSelected || undefined}
            className="bg-tweaker-canvas dark:not-data-selected:bg-tweaker-text dark:data-checked:bg-tweaker-accent-text dark:data-unchecked:bg-tweaker-text dark:data-selected:bg-tweaker-accent-text pointer-events-none block rounded-2xl shadow-sm ring-0 transition-transform not-data-selected:translate-x-0 not-dark:bg-clip-padding group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 data-checked:translate-x-[calc(100%-4px)] data-selected:translate-x-[calc(100%-4px)] data-unchecked:translate-x-0"
          />
          {children}
        </>
      ))}
    </SwitchPrimitive>
  )
}

export { Switch }
