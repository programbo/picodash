'use client'

import { Toolbar as ToolbarPrimitive } from '../ui/toolbar.tsx'

export type ToolbarProps = React.ComponentProps<typeof ToolbarPrimitive>

function Toolbar({ 'aria-label': ariaLabel = 'Dashlet actions', ...props }: ToolbarProps) {
  return (
    <div data-slot="dashlet-toolbar" className="min-w-0">
      <ToolbarPrimitive {...props} aria-label={ariaLabel} />
    </div>
  )
}

export { Toolbar }
