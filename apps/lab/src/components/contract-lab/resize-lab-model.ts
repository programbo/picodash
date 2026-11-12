import type { DashPanelProps, DashPanelPlacement } from '@picodash/dashpanel'
import { createPicodashNexus } from '@picodash/nexus'
import { createWebStoragePersistenceDriver } from '@picodash/nexus/web-storage'

export const RESIZE_LAB_SCOPE = 'contract-lab-resize-panel'
export const RESIZE_LAB_STORAGE = 'picodash-contract-lab-resize-v2'
export const RESIZE_LAB_CONFIGURATION = 'picodash:contract-lab:resize-configuration'
export const RESIZE_TARGETS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const

export type ResizeTarget = (typeof RESIZE_TARGETS)[number]
export type ResizeContentKind = 'fixed' | 'text' | 'accordion' | 'list'
export type ResizePlacement =
  | 'free'
  | 'snap-top-right'
  | 'snap-top'
  | 'dock-top-right'
  | 'dock-right'
  | 'dock-top'
export type ResizeDimensionField =
  | 'width'
  | 'height'
  | 'minWidth'
  | 'maxWidth'
  | 'minHeight'
  | 'maxHeight'

export interface ResizeAccordionItem {
  readonly id: number
  readonly paragraphs: number
  readonly open: boolean
}

export interface ResizeLabConfiguration {
  readonly width: string
  readonly height: string
  readonly minWidth: string
  readonly maxWidth: string
  readonly minHeight: string
  readonly maxHeight: string
  readonly enabled: boolean
  readonly handles: 'auto' | 'always' | 'hidden'
  readonly edgeHandles: 'single' | 'parallel'
  readonly cornerHandles: 'single' | 'external' | 'internal'
  readonly targets: readonly ResizeTarget[]
  readonly moveHandle: 'header' | 'grip' | 'both'
  readonly boundary: 'element' | 'viewport'
  readonly boundaryWidth: number
  readonly boundaryHeight: number
  readonly boundaryInset: number
  readonly placement: ResizePlacement
  readonly content: ResizeContentKind
  readonly fixedWidth: number
  readonly fixedHeight: number
  readonly textParagraphs: number
  readonly transition: boolean
  readonly transitionDuration: number
  readonly items: readonly ResizeAccordionItem[]
  readonly contentMinWidth: boolean
  readonly contentMaxWidth: boolean
  readonly contentMinHeight: boolean
  readonly contentMaxHeight: boolean
  readonly explicitMetrics: boolean
  readonly metricMinWidth: string
  readonly metricMaxWidth: string
  readonly metricMinHeight: string
  readonly metricMaxHeight: string
  readonly theme: 'system' | 'light' | 'dark' | 'ocean'
  readonly density: 'regular' | 'compact'
}

export const defaultResizeConfiguration: ResizeLabConfiguration = {
  width: '360',
  height: 'auto',
  minWidth: '200',
  maxWidth: '720',
  minHeight: '120',
  maxHeight: '800',
  enabled: true,
  handles: 'auto',
  edgeHandles: 'single',
  cornerHandles: 'single',
  targets: RESIZE_TARGETS,
  moveHandle: 'header',
  boundary: 'element',
  boundaryWidth: 880,
  boundaryHeight: 640,
  boundaryInset: 16,
  placement: 'free',
  content: 'accordion',
  fixedWidth: 360,
  fixedHeight: 320,
  textParagraphs: 4,
  transition: true,
  transitionDuration: 240,
  items: [
    { id: 1, paragraphs: 1, open: true },
    { id: 2, paragraphs: 3, open: false },
    { id: 3, paragraphs: 2, open: false },
  ],
  contentMinWidth: false,
  contentMaxWidth: false,
  contentMinHeight: false,
  contentMaxHeight: false,
  explicitMetrics: false,
  metricMinWidth: '',
  metricMaxWidth: '',
  metricMinHeight: '',
  metricMaxHeight: '',
  theme: 'system',
  density: 'regular',
}

export const resizeRecipes = {
  free: { label: 'Two-axis resize', configuration: defaultResizeConfiguration },
  locked: {
    label: 'Locked width, automatic height',
    configuration: {
      ...defaultResizeConfiguration,
      width: '360',
      minWidth: '360',
      maxWidth: '360',
    },
  },
  minimum: {
    label: 'Content minimum',
    configuration: {
      ...defaultResizeConfiguration,
      content: 'fixed',
      fixedWidth: 320,
      fixedHeight: 180,
      contentMinWidth: true,
      contentMinHeight: true,
    },
  },
  maximum: {
    label: 'Content maximum',
    configuration: {
      ...defaultResizeConfiguration,
      content: 'fixed',
      fixedWidth: 420,
      fixedHeight: 260,
      contentMaxWidth: true,
      contentMaxHeight: true,
    },
  },
  scroll: {
    label: 'Manual scrolling',
    configuration: {
      ...defaultResizeConfiguration,
      height: 'auto',
      content: 'text',
      textParagraphs: 12,
    },
  },
  accordion: {
    label: 'Animated accordion',
    configuration: { ...defaultResizeConfiguration, transition: true, transitionDuration: 320 },
  },
  roundtrip: {
    label: 'Viewport round trip',
    configuration: {
      ...defaultResizeConfiguration,
      width: '540',
      height: '440',
      content: 'fixed',
      fixedWidth: 420,
      fixedHeight: 360,
    },
  },
} satisfies Record<
  string,
  { readonly label: string; readonly configuration: ResizeLabConfiguration }
>

export type ResizeRecipeId = keyof typeof resizeRecipes
type Dimension = NonNullable<DashPanelProps['minWidth']>
type SizingProps = Pick<
  DashPanelProps,
  'width' | 'height' | 'minWidth' | 'maxWidth' | 'minHeight' | 'maxHeight' | 'contentMetrics'
>
export type ResizeConfigurationResult =
  | { readonly ok: true; readonly props: SizingProps }
  | { readonly ok: false; readonly message: string }

function parseDimension(value: string, automatic = false): Dimension | 'auto' | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (automatic && trimmed === 'auto') return 'auto'
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|%)?$/.test(trimmed))
    throw new TypeError('Use a non-negative number, px, rem, or %.')
  const numeric = Number.parseFloat(trimmed)
  if (!Number.isFinite(numeric)) throw new TypeError('Dimensions must be finite.')
  if (trimmed.endsWith('px')) return `${numeric}px`
  if (trimmed.endsWith('rem')) return `${numeric}rem`
  if (trimmed.endsWith('%')) return `${numeric}%`
  return numeric
}

function preferredWidth(value: string): DashPanelProps['width'] {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (['auto', 'fit-content', 'min-content', 'max-content'].includes(trimmed)) return trimmed
  if (
    typeof CSS !== 'undefined' &&
    CSS.supports('width', trimmed) &&
    !/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(trimmed)
  )
    return trimmed
  const parsed = parseDimension(trimmed)
  return parsed
}

function metric(value: string): number | undefined {
  if (!value.trim()) return undefined
  const result = Number(value)
  if (!Number.isFinite(result) || result < 0)
    throw new TypeError('Content metrics must be non-negative finite pixels.')
  return result
}

export function parseResizeConfiguration(
  configuration: ResizeLabConfiguration,
): ResizeConfigurationResult {
  try {
    const width = preferredWidth(configuration.width)
    const height = parseDimension(configuration.height, true)
    const minWidth = parseDimension(configuration.minWidth)
    const maxWidth = parseDimension(configuration.maxWidth)
    const minHeight = parseDimension(configuration.minHeight)
    const maxHeight = parseDimension(configuration.maxHeight)
    if (typeof minWidth === 'number' && typeof maxWidth === 'number' && minWidth > maxWidth)
      return { ok: false, message: 'Minimum width must not exceed maximum width.' }
    if (typeof minHeight === 'number' && typeof maxHeight === 'number' && minHeight > maxHeight)
      return { ok: false, message: 'Minimum height must not exceed maximum height.' }
    for (const value of [
      configuration.boundaryWidth,
      configuration.boundaryHeight,
      configuration.fixedWidth,
      configuration.fixedHeight,
    ])
      if (!Number.isFinite(value) || value <= 0)
        return {
          ok: false,
          message: 'Boundary and fixed-content dimensions must be positive finite pixels.',
        }
    if (!Number.isFinite(configuration.boundaryInset) || configuration.boundaryInset < 0)
      return { ok: false, message: 'Boundary inset must be non-negative.' }
    if (
      !Number.isSafeInteger(configuration.textParagraphs) ||
      configuration.textParagraphs < 1 ||
      configuration.textParagraphs > 30
    )
      return { ok: false, message: 'Text content must have between 1 and 30 whole paragraphs.' }
    if (
      configuration.items.length > 50 ||
      new Set(configuration.items.map((item) => item.id)).size !== configuration.items.length
    )
      return { ok: false, message: 'Use at most 50 accordion items with distinct identities.' }
    if (
      !Number.isFinite(configuration.transitionDuration) ||
      configuration.transitionDuration < 0 ||
      configuration.transitionDuration > 2000
    )
      return { ok: false, message: 'Accordion duration must be between 0 and 2000 milliseconds.' }
    const contentMetrics = configuration.explicitMetrics
      ? {
          minWidth: metric(configuration.metricMinWidth),
          maxWidth: metric(configuration.metricMaxWidth),
          minHeight: metric(configuration.metricMinHeight),
          maxHeight: metric(configuration.metricMaxHeight),
        }
      : undefined
    if (
      contentMetrics?.minWidth !== undefined &&
      contentMetrics.maxWidth !== undefined &&
      contentMetrics.minWidth > contentMetrics.maxWidth
    )
      return { ok: false, message: 'Content minimum width must not exceed content maximum width.' }
    if (
      contentMetrics?.minHeight !== undefined &&
      contentMetrics.maxHeight !== undefined &&
      contentMetrics.minHeight > contentMetrics.maxHeight
    )
      return {
        ok: false,
        message: 'Content minimum height must not exceed content maximum height.',
      }
    return {
      ok: true,
      props: {
        width,
        height,
        minWidth: minWidth === 'auto' ? undefined : minWidth,
        maxWidth: maxWidth === 'auto' ? undefined : maxWidth,
        minHeight: minHeight === 'auto' ? undefined : minHeight,
        maxHeight: maxHeight === 'auto' ? undefined : maxHeight,
        contentMetrics,
      },
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Invalid resize configuration.',
    }
  }
}

export function resizePlacement(value: ResizePlacement): DashPanelPlacement {
  switch (value) {
    case 'free':
      return { mode: 'floating', disposition: { kind: 'free' } }
    case 'snap-top-right':
      return { mode: 'floating', disposition: { kind: 'snapped', position: 'top-right' } }
    case 'snap-top':
      return { mode: 'floating', disposition: { kind: 'snapped', position: 'top' } }
    case 'dock-top-right':
      return { mode: 'hybrid', disposition: { kind: 'docked', position: 'top-right' } }
    case 'dock-right':
      return { mode: 'fixed', disposition: { kind: 'docked', position: 'full-right' } }
    case 'dock-top':
      return { mode: 'fixed', disposition: { kind: 'docked', position: 'full-top' } }
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function readResizeConfiguration(): ResizeLabConfiguration {
  try {
    const raw: unknown = JSON.parse(
      window.sessionStorage.getItem(RESIZE_LAB_CONFIGURATION) ?? 'null',
    )
    if (!record(raw)) return defaultResizeConfiguration
    if (Object.keys(raw).some((key) => !Object.hasOwn(defaultResizeConfiguration, key)))
      return defaultResizeConfiguration
    const candidate = { ...defaultResizeConfiguration }
    for (const key of Object.keys(defaultResizeConfiguration) as (keyof ResizeLabConfiguration)[]) {
      if (key === 'items' || key === 'targets') continue
      if (typeof raw[key] !== typeof defaultResizeConfiguration[key])
        return defaultResizeConfiguration
    }
    if (
      !Array.isArray(raw.items) ||
      raw.items.length > 50 ||
      !raw.items.every(
        (item: unknown) =>
          record(item) &&
          Number.isSafeInteger(item.id) &&
          Number(item.id) > 0 &&
          Number.isSafeInteger(item.paragraphs) &&
          Number(item.paragraphs) > 0 &&
          Number(item.paragraphs) <= 12 &&
          typeof item.open === 'boolean',
      )
    )
      return defaultResizeConfiguration
    if (
      !Array.isArray(raw.targets) ||
      raw.targets.length > RESIZE_TARGETS.length ||
      new Set(raw.targets).size !== raw.targets.length ||
      !raw.targets.every((target: unknown) => RESIZE_TARGETS.some((allowed) => allowed === target))
    )
      return defaultResizeConfiguration
    if (
      !['auto', 'always', 'hidden'].includes(String(raw.handles)) ||
      !['single', 'parallel'].includes(String(raw.edgeHandles)) ||
      !['single', 'external', 'internal'].includes(String(raw.cornerHandles)) ||
      !['header', 'grip', 'both'].includes(String(raw.moveHandle)) ||
      !['element', 'viewport'].includes(String(raw.boundary)) ||
      !['free', 'snap-top-right', 'snap-top', 'dock-top-right', 'dock-right', 'dock-top'].includes(
        String(raw.placement),
      ) ||
      !['fixed', 'text', 'accordion', 'list'].includes(String(raw.content)) ||
      !['system', 'light', 'dark', 'ocean'].includes(String(raw.theme)) ||
      !['regular', 'compact'].includes(String(raw.density))
    )
      return defaultResizeConfiguration
    // All own configuration fields, union members and nested records were validated above.
    const configuration = Object.assign(candidate, raw)
    return parseResizeConfiguration(configuration).ok ? configuration : defaultResizeConfiguration
  } catch {
    return defaultResizeConfiguration
  }
}

export function clearResizeLabPersistence(): void {
  try {
    window.localStorage.removeItem(RESIZE_LAB_STORAGE)
    window.sessionStorage.removeItem(RESIZE_LAB_CONFIGURATION)
    window.sessionStorage.removeItem('picodash:contract-lab:placement-scenario')
    window.sessionStorage.removeItem('picodash:contract-lab:resize-contracted')
  } catch {
    /* The unavailable-storage message remains visible in the Lab. */
  }
}

export function createResizeLabNexus() {
  return createPicodashNexus({
    valueOwner: 'nexus',
    nexusId: 'contract-lab-resize',
    schemaVersion: 1,
    fields: {},
    persistence: {
      storageKey: RESIZE_LAB_STORAGE,
      driver: createWebStoragePersistenceDriver('local'),
      values: { defaultFieldPolicy: 'omit' },
    },
  })
}

export type ResizeLabNexus = ReturnType<typeof createResizeLabNexus>
