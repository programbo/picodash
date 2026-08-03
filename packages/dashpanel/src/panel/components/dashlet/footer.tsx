import * as React from 'react'

import { cn } from '../../lib/utils.js'

export type FooterProps = React.ComponentProps<'footer'>

function Footer({ className, ...props }: FooterProps) {
  return (
    <footer
      {...props}
      data-slot="dashlet-footer"
      className={cn(
        'text-picodash-muted flex min-w-0 flex-wrap items-center gap-(--picodash-space-2) text-(length:--picodash-font-size-md) leading-(--picodash-line-tight)',
        className,
      )}
    />
  )
}

export { Footer }
