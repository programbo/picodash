// Keep unknown/custom properties conservative: they may change inherited size or placement.
const paintOnlyProperties = new Set([
  'opacity',
  'color',
  'background-color',
  'border-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
  'text-decoration-color',
  'box-shadow',
  'text-shadow',
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-opacity',
  'stroke-dasharray',
  'stroke-dashoffset',
])

export function isPaintOnlyTransition(event: Event): boolean {
  return (
    'propertyName' in event &&
    typeof event.propertyName === 'string' &&
    paintOnlyProperties.has(event.propertyName)
  )
}
