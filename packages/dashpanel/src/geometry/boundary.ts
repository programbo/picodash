import type { RefObject } from 'react'

export type DashPanelBoundary = Element | RefObject<Element | null>

export type DashPanelBoundaryInset =
  | number
  | readonly [vertical: number, horizontal: number]
  | readonly [top: number, horizontal: number, bottom: number]
  | readonly [top: number, right: number, bottom: number, left: number]

function isElement(value: unknown): value is Element {
  const elementConstructor = typeof Element === 'function' ? Element : undefined
  const svgElementConstructor = typeof SVGElement === 'function' ? SVGElement : undefined
  return (
    (elementConstructor !== undefined && value instanceof elementConstructor) ||
    (svgElementConstructor !== undefined && value instanceof svgElementConstructor)
  )
}

function resolveBoundaryReference(
  value: DashPanelBoundary | null | undefined,
  label: string,
): Element | null | undefined {
  if (value === undefined || value === null) return value
  if (isElement(value)) return value
  if (typeof value !== 'object' || Array.isArray(value) || !('current' in value))
    throw new TypeError(`${label} must be an Element or RefObject.`)

  const current = (value as RefObject<Element | null>).current
  if (current === null) return undefined
  if (isElement(current)) return current
  throw new TypeError(`${label} RefObject.current must be an Element or null.`)
}

export function resolveDashPanelBoundary(
  panelBoundary: DashPanelBoundary | null | undefined,
  providerBoundary?: DashPanelBoundary | null,
): Element | null {
  if (panelBoundary === null) return null

  const panel = resolveBoundaryReference(panelBoundary, 'Panel boundary')
  if (panel !== undefined && panel !== null) return panel

  const provider = resolveBoundaryReference(providerBoundary, 'Provider boundary')
  return provider ?? null
}
