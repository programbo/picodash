import {
  resolveDashPanelSizing,
  resolveDashPanelDimension,
  type DashPanelContentConstraints,
  type DashPanelContentMetrics,
  type DashPanelDimension,
  type DashPanelHeight,
  type DashPanelManualSize,
  type DashPanelSizingState,
} from '../sizing/index.ts'
import type { DashPanelSize } from '../geometry/placement-geometry.ts'

export interface PanelSizingPolicy {
  readonly height?: DashPanelHeight
  readonly minWidth?: DashPanelDimension
  readonly maxWidth?: DashPanelDimension
  readonly minHeight?: DashPanelDimension
  readonly maxHeight?: DashPanelDimension
  readonly contentConstraints?: DashPanelContentConstraints
  readonly contentMetrics?: DashPanelContentMetrics
}

const ownedSizes = ['inline-size', 'max-inline-size', 'block-size', 'max-block-size'] as const

function isPanelDimension(value: unknown): value is DashPanelDimension {
  return typeof value === 'number'
    ? Number.isFinite(value) && value >= 0
    : typeof value === 'string' && /^(?:\d+(?:\.\d*)?|\.\d+)(?:px|rem|%)$/.test(value)
}

/** Reads natural content at the resolved candidate width without mounting a second tree. */
export function measurePanelSizing(
  panel: HTMLElement,
  boundary: DashPanelSize,
  policy: PanelSizingPolicy,
  manual: DashPanelManualSize | undefined,
  shellMinimumHeight: number,
  allocation?: Partial<DashPanelSize>,
  measurementWidth?: number,
): Readonly<{ sizing: DashPanelSizingState; unallocatedSize: DashPanelSize }> {
  const ownsDockTransform = panel.hasAttribute('data-picodash-dock-allocation-motion')
  const measurementProperties = ownsDockTransform ? [...ownedSizes, 'transform'] : ownedSizes
  const owned = measurementProperties.map((property) => ({
    property,
    value: panel.style.getPropertyValue(property),
    priority: panel.style.getPropertyPriority(property),
  }))
  const ownerWindow = panel.ownerDocument.defaultView
  const rootFontSize =
    Number.parseFloat(
      ownerWindow?.getComputedStyle(panel.ownerDocument.documentElement).fontSize ?? '16',
    ) || 16
  const header = panel.querySelector<HTMLElement>(":scope > [data-slot='dash-header']")
  const body = panel.querySelector<HTMLElement>(':scope > [data-picodash-panel-body]')
  const content = body?.querySelector<HTMLElement>(':scope > [data-picodash-panel-content]') ?? body
  const wasHidden = panel.hidden
  const visibility = panel.style.visibility
  if (wasHidden) {
    panel.style.visibility = 'hidden'
    panel.hidden = false
  }
  try {
    for (const { property } of owned) panel.style.removeProperty(property)
    // FLIP changes the painted rectangle, not the content's natural size. Every metric below
    // must use the same unscaled box, including the candidate-width/content pass.
    if (ownsDockTransform) panel.style.setProperty('transform', 'none', 'important')
    panel.style.setProperty('max-inline-size', 'none')
    panel.style.setProperty('max-block-size', 'none')
    const preferredRect = panel.getBoundingClientRect()
    const headerHeight = header?.getBoundingClientRect().height ?? shellMinimumHeight
    let shellMinimumWidth = 0
    if (header) {
      const inline = header.style.inlineSize
      try {
        header.style.inlineSize = 'min-content'
        shellMinimumWidth = header.getBoundingClientRect().width
      } finally {
        header.style.inlineSize = inline
      }
    }
    const chrome = Math.max(0, preferredRect.height - (body?.getBoundingClientRect().height ?? 0))
    const projectionAllocation =
      panel.getAttribute('data-collapsed') === 'true' &&
      panel.getAttribute('data-picodash-docked-minimized') !== 'true'
        ? { ...allocation, height: headerHeight }
        : allocation
    const measuredMetrics: {
      minWidth?: number
      maxWidth?: number
      minHeight?: number
      maxHeight?: number
    } = {}
    if (content && (policy.contentConstraints?.minWidth || policy.contentConstraints?.maxWidth)) {
      const previous = content.style.inlineSize
      const previousMax = content.style.maxInlineSize
      try {
        content.style.maxInlineSize = 'none'
        if (policy.contentConstraints.minWidth) {
          content.style.inlineSize = 'min-content'
          measuredMetrics.minWidth = Math.max(
            shellMinimumWidth,
            content.getBoundingClientRect().width,
          )
        }
        if (policy.contentConstraints.maxWidth) {
          content.style.inlineSize = 'max-content'
          measuredMetrics.maxWidth = Math.max(
            shellMinimumWidth,
            content.getBoundingClientRect().width,
          )
        }
      } finally {
        content.style.inlineSize = previous
        content.style.maxInlineSize = previousMax
      }
    }
    const preliminary = resolveDashPanelSizing({
      preferred: { width: preferredRect.width, height: preferredRect.height },
      manual,
      boundary,
      shellMinimum: {
        width: Math.min(shellMinimumWidth, boundary.width),
        height: Math.max(headerHeight, shellMinimumHeight),
      },
      ...policy,
      contentMetrics: { ...measuredMetrics, ...policy.contentMetrics },
      rootFontSize,
      allocation: projectionAllocation,
    })
    panel.style.setProperty('inline-size', `${measurementWidth ?? preliminary.resolved.width}px`)
    panel.style.setProperty('block-size', 'auto')
    const naturalRect = panel.getBoundingClientRect()
    const naturalHeight = Math.max(
      headerHeight,
      (content?.getBoundingClientRect().height ?? 0) + chrome,
      naturalRect.height,
    )
    measuredMetrics.minHeight = naturalHeight
    measuredMetrics.maxHeight = naturalHeight
    let preferredHeight = naturalHeight
    const declaredHeight =
      policy.height ??
      ownerWindow?.getComputedStyle(panel).getPropertyValue('--picodash-panel-height').trim()
    if (declaredHeight !== undefined && declaredHeight !== '' && declaredHeight !== 'auto') {
      const value = typeof declaredHeight === 'string' ? declaredHeight.trim() : declaredHeight
      if (!isPanelDimension(value))
        throw new TypeError('DashPanel height supports only pixels, rem, percentages, or auto.')
      preferredHeight = resolveDashPanelDimension(value, {
        available: boundary.height,
        rootFontSize,
      })
    }
    const sizingInput = {
      preferred: { width: Math.max(0, preferredRect.width), height: Math.max(0, preferredHeight) },
      manual,
      boundary,
      shellMinimum: {
        width: Math.min(shellMinimumWidth, boundary.width),
        height: Math.max(headerHeight, shellMinimumHeight),
      },
      ...policy,
      contentMetrics: { ...measuredMetrics, ...policy.contentMetrics },
      rootFontSize,
      allocation: projectionAllocation,
    }
    const sizing = resolveDashPanelSizing(sizingInput)
    // Placement owns allocation. Retain its uncapped input so a changed peer allocation can
    // grow a Panel even before ResizeObserver has another physical box change to observe.
    const collapsedAllocation =
      panel.getAttribute('data-collapsed') === 'true' &&
      panel.getAttribute('data-picodash-docked-minimized') !== 'true'
        ? { height: headerHeight }
        : undefined
    const unallocatedSize = resolveDashPanelSizing({
      ...sizingInput,
      allocation: collapsedAllocation,
    }).resolved
    const contentRect = content?.getBoundingClientRect()
    return Object.freeze({
      unallocatedSize,
      sizing: Object.freeze({
        ...sizing,
        measurements: Object.freeze({
          status: !content
            ? ('unavailable' as const)
            : panel.ownerDocument.fonts?.status === 'loading'
              ? ('pending' as const)
              : ('ready' as const),
          content: Object.freeze({
            width: Math.max(0, contentRect?.width ?? 0),
            height: Math.max(0, contentRect?.height ?? 0),
          }),
          bounds: Object.freeze({ ...measuredMetrics, ...policy.contentMetrics }),
        }),
      }),
    })
  } finally {
    for (const { property, value, priority } of owned) {
      if (value) panel.style.setProperty(property, value, priority)
      else panel.style.removeProperty(property)
    }
    if (wasHidden) {
      panel.hidden = true
      panel.style.visibility = visibility
    }
  }
}
