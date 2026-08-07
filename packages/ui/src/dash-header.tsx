import { forwardRef, type ComponentPropsWithRef, type ReactNode } from 'react'

/** Content positions accepted by the product-neutral DashHeader layout. */
export interface DashHeaderSlots {
  leading?: ReactNode
  title?: ReactNode
  actions?: ReactNode
  trailing?: ReactNode
}

/** Props for the product-neutral DashHeader layout primitive. */
export type DashHeaderProps = Omit<ComponentPropsWithRef<'div'>, 'children'> & {
  slots: Readonly<DashHeaderSlots>
}

/** Lays out caller-owned header content without adding product behavior or semantics. */
export const DashHeader = forwardRef<HTMLDivElement, DashHeaderProps>(function DashHeader(
  { slots, ...props },
  ref,
) {
  return (
    <div {...props} ref={ref} data-slot="dash-header">
      {slots.leading != null ? <div data-slot="dash-header-leading">{slots.leading}</div> : null}
      <div data-slot="dash-header-title">{slots.title}</div>
      {slots.actions != null ? <div data-slot="dash-header-actions">{slots.actions}</div> : null}
      {slots.trailing != null ? <div data-slot="dash-header-trailing">{slots.trailing}</div> : null}
    </div>
  )
})
