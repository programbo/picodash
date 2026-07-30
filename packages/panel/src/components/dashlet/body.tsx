import * as React from 'react'

import { cn } from '#lib/utils'

export type BodyProps = React.ComponentProps<'div'>

function Body({ className, ...props }: BodyProps) {
  return <div {...props} data-slot="dashlet-body" className={cn('min-w-0', className)} />
}

export { Body }
