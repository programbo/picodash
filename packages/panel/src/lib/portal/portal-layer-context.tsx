'use client'

import * as React from 'react'

type PortalLayerZIndex = number | string | undefined

const PortalLayerZIndexContext = React.createContext<PortalLayerZIndex>(undefined)

export function PortalLayerZIndexProvider({
  children,
  zIndex,
}: {
  children: React.ReactNode
  zIndex: PortalLayerZIndex
}) {
  return (
    <PortalLayerZIndexContext.Provider value={zIndex}>{children}</PortalLayerZIndexContext.Provider>
  )
}

export function useParentPortalLayerZIndex(): PortalLayerZIndex {
  return React.useContext(PortalLayerZIndexContext)
}

export function resolvePortalLayerZIndex({
  cssVariable,
  floor,
  parentZIndex,
  parentOffset,
}: {
  cssVariable: string
  floor?: number
  parentZIndex?: PortalLayerZIndex
  parentOffset: number
}): PortalLayerZIndex {
  const candidates = [`var(${cssVariable})`]
  if (floor !== undefined) candidates.push(String(floor))

  const parent = serializableZIndex(parentZIndex)
  if (parent !== undefined) candidates.push(`calc(${parent} + ${parentOffset})`)

  return candidates.length > 1 ? `max(${candidates.join(', ')})` : undefined
}

function serializableZIndex(zIndex: PortalLayerZIndex) {
  if (typeof zIndex === 'number') return String(zIndex)
  if (typeof zIndex !== 'string') return undefined

  const value = zIndex.trim()
  return value === '' ||
    ['auto', 'inherit', 'initial', 'revert', 'revert-layer', 'unset'].includes(value)
    ? undefined
    : value
}
