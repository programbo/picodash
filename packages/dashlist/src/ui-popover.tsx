'use client'

import { usePicodashDensity, usePicodashOverlayDefaults, usePicodashTheme } from '@picodash/ui'
import { Popover } from 'react-aria-components'
import type { ReactElement, ReactNode } from 'react'

interface ChoicePopoverProps {
  readonly children: ReactNode
}

function resolveChoicePopoverLayer(layerBase: number | undefined): string {
  const semanticLayer = 'var(--picodash-layer-popover)'
  return layerBase === undefined ? semanticLayer : `max(${semanticLayer}, ${layerBase})`
}

export function ChoicePopover({ children }: ChoicePopoverProps): ReactElement {
  const theme = usePicodashTheme()
  const density = usePicodashDensity()
  const { layerBase } = usePicodashOverlayDefaults()

  return (
    <Popover
      className="picodash-dashlist-popover"
      style={{ zIndex: resolveChoicePopoverLayer(layerBase) }}
      data-picodash-theme={theme}
      data-picodash-density={density}
    >
      {children}
    </Popover>
  )
}
