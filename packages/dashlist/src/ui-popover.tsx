'use client'

import { Popover } from '@picodash/ui'
import type { ReactElement, ReactNode } from 'react'

interface ChoicePopoverProps {
  readonly children: ReactNode
}

export function ChoicePopover({ children }: ChoicePopoverProps): ReactElement {
  return <Popover className="picodash-dashlist-popover">{children}</Popover>
}
