'use client'

import {
  forwardRef,
  useId,
  useEffect,
  useLayoutEffect,
  useImperativeHandle,
  useCallback,
  useRef,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import type { PicodashFieldDefinitions, RootStore } from '@picodash/store'
import {
  PicodashStoreEntityBoundary,
  PicodashStoreProviderBoundary,
} from '@picodash/store/integration'
import { usePicodashRootStore, usePicodashStoreSelector } from '@picodash/store/react'
import {
  ActionMenu,
  ActionMenuItem,
  ActionMenuSeparator,
  ActionSubmenu,
  DashHeader,
  Button,
  PicodashOverlayProvider,
  PicodashThemeProvider,
  usePicodashOverlayDefaults,
} from '@picodash/ui'
import {
  DashPanelActionItems,
  DashPanelActionProvider,
  announceDashPanelLayoutFailure,
  type DashPanelRemoveRequest,
} from './actions.tsx'
import { useDashPanelDefaultActionItems } from './runtime/panel-integration-context.tsx'
import type { PanelRuntimeRegistration } from './runtime/panel-runtime.ts'
import {
  DashPanelPolicyBoundary,
  DashPanelPolicyProvider,
} from './runtime/panel-policy-context.tsx'
import { DashPanelProviderPolicyProvider } from './runtime/provider-policy-context.tsx'
import type { DashPanelBoundary, DashPanelBoundaryInset } from './geometry/boundary.ts'
import { resolveDashPanelBoundary } from './geometry/boundary.ts'
import { resolveDashPanelBoundaryInset } from './geometry/inset.ts'
import {
  DashPanelRuntimeProvider,
  useDashPanelRuntime,
  useDashPanelRuntimeState,
} from './runtime/panel-runtime-context.tsx'
import {
  DashPanelIdentityProvider,
  useDashPanel,
  type DashPanelController,
  type DashPanelCommandResult,
  type DashPanelLayoutCommandResult,
} from './runtime/panel-controller.tsx'
import type {
  ActionMenuConfirmation,
  ActionMenuConfirmationGuard,
  ActionMenuItemProps,
  ActionMenuItemVariant,
  ActionMenuProps,
  ActionMenuSeparatorProps,
  ActionSubmenuProps,
  ButtonProps,
  DashHeaderProps,
  DashHeaderSlots,
  PicodashDensity,
  PicodashThemeOption,
} from '@picodash/ui'
import {
  normalizeDashPanelDefaultLayout,
  normalizeDashPanelPlacementOptions,
  type DashPanelPlacement,
  type DashPanelDockPosition,
  type DashPanelDefaultLayout,
  type DashPanelPlacementOptions,
  type DashPanelPresentation,
  type DashPanelSnapPosition,
} from './placement/placement.ts'
import {
  clearPanelFocusRecord,
  focusPanel,
  recordPanelEntry,
  recordPanelInteraction,
  restorePanelFocus,
} from './runtime/panel-lifecycle.ts'
import { useDashPanelProviderPolicy } from './runtime/provider-policy-context.tsx'
import { resolvePanelDockPositions, classifyDashPanelPlacement } from './placement/dock-policy.ts'
import {
  dockDashPanelRect,
  projectDashPanelPosition,
  projectDashPanelRect,
  rectFromDashPanelPosition,
  snapDashPanelRect,
  snapDashPanelTargets,
  type DashPanelDockTargetOptions,
  type DashPanelPoint,
  type DashPanelSize,
} from './geometry/placement-geometry.ts'
import { insetDashPanelRect, type DashPanelRect } from './geometry/inset.ts'

export type {
  DashPanelDefaultLayout,
  DashPanelDockPosition,
  DashPanelPlacement,
  DashPanelPlacementOptions,
  DashPanelPresentation,
  DashPanelSnapPosition,
} from './placement/placement.ts'

export type { DashPanelController, DashPanelCommandResult, DashPanelLayoutCommandResult }
export { useDashPanel }

export type { DashPanelBoundary, DashPanelBoundaryInset } from './geometry/boundary.ts'
export {
  DashPanelActionItems,
  DashPanelPlacementSubmenu,
  DashPanelResetLayoutItem,
  DashPanelRequestRemoveItem,
} from './actions.tsx'
export type { DashPanelRemoveRequest } from './actions.tsx'

export type DashPanelStyle = Omit<
  CSSProperties,
  | 'blockSize'
  | 'inlineSize'
  | 'maxBlockSize'
  | 'maxInlineSize'
  | 'minBlockSize'
  | 'minHeight'
  | 'minInlineSize'
  | 'minWidth'
  | 'width'
>

export interface DashPanelProviderProps<
  Fields extends PicodashFieldDefinitions = PicodashFieldDefinitions,
  CustomTheme extends string = never,
> {
  children: ReactNode
  store: RootStore<Fields>
  providerId?: string
  boundary?: DashPanelBoundary | null
  boundaryInset?: DashPanelBoundaryInset
  dockPositions?: readonly DashPanelDockPosition[]
  portalContainer?: HTMLElement | null
  layerBase?: number
  theme?: PicodashThemeOption<CustomTheme>
  density?: PicodashDensity
}

export interface DashPanelProps<CustomTheme extends string = never> extends Omit<
  ComponentPropsWithoutRef<'aside'>,
  'aria-hidden' | 'children' | 'hidden' | 'id' | 'inert' | 'style' | 'title'
> {
  id: string
  title: ReactNode
  children?: ReactNode
  style?: DashPanelStyle
  width?: CSSProperties['width']
  boundary?: DashPanelBoundary | null
  boundaryInset?: DashPanelBoundaryInset
  dockPositions?: readonly DashPanelDockPosition[]
  defaultLayout?: DashPanelDefaultLayout
  placementOptions?: DashPanelPlacementOptions
  presentation?: DashPanelPresentation
  defaultCollapsed?: boolean
  collapsible?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  defaultVisible?: boolean
  showCloseButton?: boolean
  onVisibilityChange?: (visible: boolean) => void
  onRequestRemove?: (details: DashPanelRemoveRequest) => void
  actionMenu?: false | readonly ReactElement[]
  theme?: PicodashThemeOption<CustomTheme>
  density?: PicodashDensity
}

export interface DashPanelTriggerProps extends Omit<ButtonProps, 'onPress'> {
  panelId: string
  action?: 'show' | 'toggle'
}

export type DashPanelLauncherItem =
  | {
      panelId: string
      label: string
      accessibleName?: string
      disabled?: boolean
    }
  | {
      panelId: string
      label: Exclude<ReactNode, string>
      accessibleName: string
      disabled?: boolean
    }

export interface DashPanelLauncherProps extends Omit<ComponentPropsWithoutRef<'div'>, 'children'> {
  label: string
  items: readonly DashPanelLauncherItem[]
}

function immutableProviderIdentity<Fields extends PicodashFieldDefinitions>(
  store: RootStore<Fields>,
  providerId: string,
) {
  const identity = useRef<{
    readonly store: RootStore<Fields>
    readonly providerId: string
  } | null>(null)
  if (identity.current === null) identity.current = { store, providerId }
  else if (identity.current.store !== store || identity.current.providerId !== providerId)
    throw new TypeError('DashPanelProvider store and providerId are immutable while mounted.')
}

export function DashPanelProvider<
  Fields extends PicodashFieldDefinitions = PicodashFieldDefinitions,
  CustomTheme extends string = never,
>({
  children,
  store,
  providerId,
  boundary,
  boundaryInset,
  dockPositions,
  portalContainer,
  layerBase,
  theme,
  density,
}: DashPanelProviderProps<Fields, CustomTheme>) {
  if (store.kind !== 'root') throw new TypeError('DashPanelProvider requires a root Store.')
  const resolvedProviderId = providerId ?? 'default'
  immutableProviderIdentity(store, resolvedProviderId)
  return (
    <PicodashStoreProviderBoundary store={store} providerId={resolvedProviderId}>
      <DashPanelProviderPolicyProvider
        boundary={boundary}
        boundaryInset={boundaryInset}
        dockPositions={dockPositions}
      >
        <DashPanelPolicyBoundary>
          <DashPanelRuntimeProvider>
            <PicodashThemeProvider<CustomTheme> theme={theme} density={density}>
              <PicodashOverlayProvider portalContainer={portalContainer} layerBase={layerBase}>
                {children}
              </PicodashOverlayProvider>
            </PicodashThemeProvider>
          </DashPanelRuntimeProvider>
        </DashPanelPolicyBoundary>
      </DashPanelProviderPolicyProvider>
    </PicodashStoreProviderBoundary>
  )
}

function isTextTitle(value: ReactNode): boolean {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint')
    return true
  if (Array.isArray(value)) return value.every(isTextTitle)
  return false
}

function textTitle(value: ReactNode): string {
  if (Array.isArray(value)) return value.map(textTitle).join('')
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint')
    return `${value}`
  return ''
}

function isCornerDockPosition(position: DashPanelDockPosition | undefined): boolean {
  return (
    position === 'top-left' ||
    position === 'top-right' ||
    position === 'bottom-left' ||
    position === 'bottom-right'
  )
}

function assertPanelStyle(style: DashPanelStyle | undefined): void {
  if (!style) return
  for (const property of [
    'width',
    'inlineSize',
    'maxInlineSize',
    'blockSize',
    'maxBlockSize',
    'minWidth',
    'minInlineSize',
    'minHeight',
    'minBlockSize',
  ] as const)
    if (Object.prototype.hasOwnProperty.call(style, property))
      throw new TypeError(
        `DashPanel style.${property} is reserved for placement geometry${
          property === 'width' || property === 'inlineSize' ? '; use the width prop instead' : ''
        }.`,
      )
}

function panelStyle(
  style: DashPanelStyle | undefined,
  width: CSSProperties['width'],
): CSSProperties | undefined {
  if (style === undefined && width === undefined) return undefined
  const resolved = { ...style } as CSSProperties & {
    '--picodash-panel-width'?: CSSProperties['width']
  }
  if (width !== undefined) resolved['--picodash-panel-width'] = width
  return resolved
}

interface PanelGeometryState {
  readonly boundary: DashPanelRect
  readonly size: DashPanelSize
  readonly rect: DashPanelRect
}

const geometryOwnedSizeProperties = [
  'inline-size',
  'max-inline-size',
  'block-size',
  'max-block-size',
] as const

function measurePreferredPanelRect(element: HTMLElement): DOMRect {
  const wasHidden = element.hidden
  const visibility = element.style.getPropertyValue('visibility')
  const visibilityPriority = element.style.getPropertyPriority('visibility')
  const owned = geometryOwnedSizeProperties.map((property) => ({
    property,
    value: element.style.getPropertyValue(property),
    priority: element.style.getPropertyPriority(property),
  }))
  for (const { property } of owned) element.style.removeProperty(property)
  element.style.setProperty('max-inline-size', 'none')
  element.style.setProperty('max-block-size', 'none')
  if (wasHidden) {
    element.style.setProperty('visibility', 'hidden', 'important')
    element.hidden = false
  }
  try {
    return element.getBoundingClientRect()
  } finally {
    if (wasHidden) {
      element.hidden = true
      if (visibility) element.style.setProperty('visibility', visibility, visibilityPriority)
      else element.style.removeProperty('visibility')
    }
    for (const { property, value, priority } of owned) {
      if (value) element.style.setProperty(property, value, priority)
      else element.style.removeProperty(property)
    }
  }
}

function sameMeasuredRect(left: DOMRect | undefined, right: DOMRect | undefined): boolean {
  if (!left || !right) return left === right
  return (
    left.top === right.top &&
    left.right === right.right &&
    left.bottom === right.bottom &&
    left.left === right.left &&
    left.width === right.width &&
    left.height === right.height
  )
}

function viewportRect(): DashPanelRect {
  const visualViewport = typeof window !== 'undefined' ? window.visualViewport : undefined
  if (
    visualViewport &&
    Number.isFinite(visualViewport.width) &&
    Number.isFinite(visualViewport.height) &&
    Number.isFinite(visualViewport.offsetLeft) &&
    Number.isFinite(visualViewport.offsetTop)
  ) {
    const left = visualViewport.offsetLeft
    const top = visualViewport.offsetTop
    const width = visualViewport.width
    const height = visualViewport.height
    return { top, right: left + width, bottom: top + height, left, width, height }
  }
  const width =
    typeof window !== 'undefined' && Number.isFinite(window.innerWidth)
      ? window.innerWidth
      : typeof document !== 'undefined'
        ? (document.documentElement?.clientWidth ?? 0)
        : 0
  const height =
    typeof window !== 'undefined' && Number.isFinite(window.innerHeight)
      ? window.innerHeight
      : typeof document !== 'undefined'
        ? (document.documentElement?.clientHeight ?? 0)
        : 0
  return { top: 0, right: width, bottom: height, left: 0, width, height }
}

function placementRect(
  placement: DashPanelPlacement,
  boundary: DashPanelRect,
  size: DashPanelSize,
  preferredPosition: DashPanelPoint,
  snapOffset: number,
  dockTarget?: DashPanelDockTargetOptions,
): DashPanelRect {
  if (placement.mode === 'floating') {
    if (placement.disposition.kind === 'snapped')
      return snapDashPanelRect(placement.disposition.position, boundary, size, snapOffset)
    return projectDashPanelRect(
      rectFromDashPanelPosition(
        { x: boundary.left + preferredPosition.x, y: boundary.top + preferredPosition.y },
        size,
      ),
      boundary,
    )
  }
  if (placement.disposition.kind === 'docked')
    return dockDashPanelRect(placement.disposition.position, boundary, size, dockTarget)
  if (placement.disposition.kind === 'snapped')
    return snapDashPanelRect(placement.disposition.position, boundary, size, snapOffset)
  return projectDashPanelRect(
    rectFromDashPanelPosition(
      { x: boundary.left + preferredPosition.x, y: boundary.top + preferredPosition.y },
      size,
    ),
    boundary,
  )
}

const floatingSnapPositions: readonly DashPanelSnapPosition[] = [
  'top-left',
  'top',
  'top-right',
  'right',
  'bottom-right',
  'bottom',
  'bottom-left',
  'left',
]

function snapPlacementForMove(
  mode: 'floating' | 'hybrid',
  position: DashPanelPoint,
  geometry: PanelGeometryState | null,
  options: Readonly<{ snapOffset: number; snapProximity: number }>,
): DashPanelPlacement | undefined {
  if (!geometry) return undefined
  const targets = snapDashPanelTargets(geometry.boundary, geometry.size, options.snapOffset)
  const positions = mode === 'hybrid' ? (['top', 'bottom'] as const) : floatingSnapPositions
  const absolute = {
    x: geometry.boundary.left + position.x,
    y: geometry.boundary.top + position.y,
  }
  let nearest: DashPanelSnapPosition | undefined
  let nearestDistance = Number.POSITIVE_INFINITY
  for (const candidate of positions) {
    const target = targets[candidate]
    const distance = Math.hypot(target.left - absolute.x, target.top - absolute.y)
    if (distance <= options.snapProximity && distance < nearestDistance) {
      nearest = candidate
      nearestDistance = distance
    }
  }
  return nearest === undefined
    ? undefined
    : ({ mode, disposition: { kind: 'snapped', position: nearest } } as DashPanelPlacement)
}

function policySafeDefaultLayout(
  layout: DashPanelDefaultLayout,
  dockPositions: readonly DashPanelDockPosition[],
): DashPanelDefaultLayout {
  if (classifyDashPanelPlacement(layout.placement, dockPositions).status === 'available')
    return layout
  const placement: DashPanelPlacement =
    layout.placement.mode === 'hybrid'
      ? { mode: 'hybrid', disposition: { kind: 'snapped', position: 'top' } }
      : dockPositions[0]
        ? { mode: 'fixed', disposition: { kind: 'docked', position: dockPositions[0] } }
        : { mode: 'floating', disposition: { kind: 'snapped', position: 'top-right' } }
  return Object.freeze({
    placement: Object.freeze({
      ...placement,
      disposition: Object.freeze({ ...placement.disposition }),
    }) as DashPanelPlacement,
    ...(layout.preferredPosition ? { preferredPosition: layout.preferredPosition } : {}),
  })
}

function mapRectToContainingBlock(element: HTMLElement | null, rect: DashPanelRect) {
  const offsetParent = element?.offsetParent as HTMLElement | null
  if (!offsetParent) {
    const scrollX = typeof window !== 'undefined' ? window.scrollX || 0 : 0
    const scrollY = typeof window !== 'undefined' ? window.scrollY || 0 : 0
    return { left: rect.left + scrollX, top: rect.top + scrollY }
  }
  const parentRect = offsetParent.getBoundingClientRect()
  return {
    left: rect.left - parentRect.left + offsetParent.scrollLeft - offsetParent.clientLeft,
    top: rect.top - parentRect.top + offsetParent.scrollTop - offsetParent.clientTop,
  }
}

const DashPanelImpl = forwardRef<HTMLElement, DashPanelProps<string>>(function DashPanel(
  {
    id,
    title,
    children,
    style,
    width,
    boundary,
    boundaryInset,
    dockPositions,
    defaultLayout,
    placementOptions,
    presentation,
    defaultCollapsed,
    defaultVisible,
    showCloseButton = true,
    collapsible,
    onVisibilityChange,
    onRequestRemove,
    actionMenu,
    onCollapsedChange,
    theme,
    density,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    className,
    ...asideProps
  },
  ref,
) {
  assertPanelStyle(style)
  const root = usePicodashRootStore()
  const runtime = useDashPanelRuntime()
  const providerPolicy = useDashPanelProviderPolicy()
  const overlayDefaults = usePicodashOverlayDefaults()
  const resolvedPortalContainer = overlayDefaults.portalContainer
  const panelPortal = resolvedPortalContainer?.nodeType === 1 ? resolvedPortalContainer : null
  const defaultActionItems = useDashPanelDefaultActionItems()
  const runtimeState = useDashPanelRuntimeState(id)
  const scoped = root.scope(id)
  const durableLayout = usePicodashStoreSelector(scoped, (state) => state.scope?.dashPanel)
  const resolvedDefaultLayout = useMemo(
    () => normalizeDashPanelDefaultLayout(defaultLayout),
    [defaultLayout],
  )
  const resolvedPlacementOptions = useMemo(
    () => normalizeDashPanelPlacementOptions(placementOptions),
    [placementOptions],
  )
  const resolvedPresentation = useMemo(
    () => presentation ?? { kind: 'panel' as const },
    [presentation],
  )
  if (resolvedPresentation.kind !== 'panel')
    throw new TypeError('DashPanel drawer and sheet presentations are not implemented yet.')
  const resolvedDockPositions = useMemo(
    () => resolvePanelDockPositions(providerPolicy.dockPositions, dockPositions),
    [dockPositions, providerPolicy.dockPositions],
  )
  const resolvedPolicyDefaultLayout = useMemo(
    () => policySafeDefaultLayout(resolvedDefaultLayout, resolvedDockPositions),
    [resolvedDefaultLayout, resolvedDockPositions],
  )
  const resolvedBoundaryInset = useMemo(
    () =>
      boundaryInset === undefined
        ? providerPolicy.boundaryInset
        : resolveDashPanelBoundaryInset(boundaryInset),
    [boundaryInset, providerPolicy.boundaryInset],
  )
  const resolvedPlacement =
    durableLayout &&
    classifyDashPanelPlacement(durableLayout.placement, resolvedDockPositions).status ===
      'available'
      ? (durableLayout.placement as DashPanelPlacement)
      : resolvedPolicyDefaultLayout.placement
  const requestedPlacementMode = resolvedPlacement.mode
  const effectivePlacement = runtimeState?.placement ?? resolvedPlacement
  const headingId = `picodash-panel-heading-${useId()}`
  const bodyId = `picodash-panel-body-${useId()}`
  const moveInstructionsId = `picodash-panel-move-instructions-${useId()}`
  const asideRef = useRef<HTMLElement | null>(null)
  const registration = useRef<PanelRuntimeRegistration | null>(null)
  const previewPositionRef = useRef<DashPanelPoint | null>(null)
  const geometryRef = useRef<PanelGeometryState | null>(null)
  const [geometry, setGeometry] = useState<PanelGeometryState | null>(null)
  const [previewPosition, setPreviewPosition] = useState<DashPanelPoint | null>(null)
  const [moveMode, setMoveMode] = useState<'pointer' | 'keyboard' | null>(null)
  const announcementSequence = useRef(0)
  const [actionAnnouncement, setActionAnnouncement] = useState({ sequence: 0, message: '' })
  const announceAction = useCallback((message: string) => {
    announcementSequence.current += 1
    setActionAnnouncement({ sequence: announcementSequence.current, message })
  }, [])
  const registerMoveHandle = useCallback((element: HTMLButtonElement | null) => {
    // React Aria's Button currently filters this valid global ARIA attribute.
    // Preserve the shared primitive while ensuring the native control exposes it.
    element?.setAttribute(
      'aria-keyshortcuts',
      'Enter Space ArrowUp ArrowDown ArrowLeft ArrowRight Escape',
    )
  }, [])
  const moveSession = useRef<{
    readonly mode: 'pointer' | 'keyboard'
    readonly pointerId?: number
    readonly startClient?: DashPanelPoint
    readonly startPosition: DashPanelPoint
    readonly initialGeometry: PanelGeometryState | null
    readonly captureTarget?: HTMLElement
    readonly startedDocked: boolean
    readonly moved: boolean
  } | null>(null)
  const cancelObservedMoveRef = useRef<() => void>(() => undefined)
  const settledPreferredPosition =
    durableLayout?.preferredPosition ?? resolvedPolicyDefaultLayout.preferredPosition
  const settledLayoutFingerprint = JSON.stringify([
    durableLayout?.placement ?? null,
    resolvedPlacement,
    settledPreferredPosition ?? null,
  ])
  const settledLayoutFingerprintRef = useRef(settledLayoutFingerprint)
  useLayoutEffect(() => {
    if (settledLayoutFingerprintRef.current !== settledLayoutFingerprint && moveSession.current)
      cancelObservedMoveRef.current()
    settledLayoutFingerprintRef.current = settledLayoutFingerprint
  }, [settledLayoutFingerprint])
  const currentPosition = useMemo(
    () => () => {
      if (previewPositionRef.current) return previewPositionRef.current
      const element = asideRef.current
      if (!element || typeof element.getBoundingClientRect !== 'function') return undefined
      const rect = element.getBoundingClientRect()
      const target = resolveDashPanelBoundary(boundary, providerPolicy.boundary)
      const effectiveBoundary = insetDashPanelRect(
        target?.getBoundingClientRect?.() ?? viewportRect(),
        resolvedBoundaryInset,
      )
      const x = rect.left - effectiveBoundary.left
      const y = rect.top - effectiveBoundary.top
      return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : undefined
    },
    [boundary, providerPolicy.boundary, resolvedBoundaryInset],
  )
  const freeMovePosition = useMemo(() => () => previewPositionRef.current ?? undefined, [])
  const resolveDockArena = useMemo(
    () => () => ({
      boundary: resolveDashPanelBoundary(boundary, providerPolicy.boundary),
      inset: resolvedBoundaryInset,
    }),
    [boundary, providerPolicy.boundary, resolvedBoundaryInset],
  )
  const measureGeometry = useMemo(
    () => (): PanelGeometryState | null => {
      const element = asideRef.current
      if (!element || typeof element.getBoundingClientRect !== 'function') return null
      const panelRect = measurePreferredPanelRect(element)
      const target = resolveDashPanelBoundary(boundary, providerPolicy.boundary)
      const boundaryRect = target?.getBoundingClientRect?.() ?? viewportRect()
      const insetBoundary = insetDashPanelRect(boundaryRect, resolvedBoundaryInset)
      const next = {
        boundary: insetBoundary,
        size: { width: Math.max(0, panelRect.width), height: Math.max(0, panelRect.height) },
        rect: panelRect,
      }
      geometryRef.current = next
      return next
    },
    [boundary, providerPolicy.boundary, resolvedBoundaryInset],
  )
  const refreshGeometry = useMemo(
    () => () => {
      const previous = geometryRef.current
      const next = measureGeometry()
      if (!next) return
      const dockPosition =
        effectivePlacement.mode === 'fixed'
          ? effectivePlacement.disposition.position
          : effectivePlacement.mode === 'hybrid' && effectivePlacement.disposition.kind === 'docked'
            ? effectivePlacement.disposition.position
            : undefined
      if (asideRef.current?.hidden && isCornerDockPosition(dockPosition))
        runtime.notifyElementResize(id, next.size.width)
      if (
        moveSession.current &&
        previous &&
        (previous.boundary.left !== next.boundary.left ||
          previous.boundary.top !== next.boundary.top ||
          previous.boundary.right !== next.boundary.right ||
          previous.boundary.bottom !== next.boundary.bottom ||
          previous.size.width !== next.size.width ||
          previous.size.height !== next.size.height)
      )
        cancelObservedMoveRef.current()
      setGeometry((current) =>
        current &&
        current.boundary.left === next.boundary.left &&
        current.boundary.top === next.boundary.top &&
        current.boundary.right === next.boundary.right &&
        current.boundary.bottom === next.boundary.bottom &&
        current.size.width === next.size.width &&
        current.size.height === next.size.height &&
        current.rect.left === next.rect.left &&
        current.rect.top === next.rect.top &&
        current.rect.right === next.rect.right &&
        current.rect.bottom === next.rect.bottom
          ? current
          : next,
      )
    },
    [effectivePlacement, id, measureGeometry, runtime],
  )
  useLayoutEffect(() => {
    refreshGeometry()
  }, [effectivePlacement, panelPortal, refreshGeometry])
  const observedBoundary = resolveDashPanelBoundary(boundary, providerPolicy.boundary)
  const configuredBoundary = boundary === undefined ? providerPolicy.boundary : boundary
  const tracksBoundaryReference =
    configuredBoundary !== null &&
    configuredBoundary !== undefined &&
    typeof configuredBoundary === 'object' &&
    'current' in configuredBoundary
  useEffect(() => {
    const panel = asideRef.current
    if (!panel) return
    const observer =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver((entries) => {
            refreshGeometry()
            if (entries.some((entry) => entry.target === panel)) runtime.notifyElementResize(id)
          })
        : undefined
    observer?.observe(panel)
    if (observedBoundary) observer?.observe(observedBoundary)
    const ownerDocument = panel.ownerDocument
    const mutationRoot = ownerDocument.documentElement
    const inheritedMutationTargets = new Set<Node>()
    const mutationObserver =
      mutationRoot && typeof MutationObserver === 'function'
        ? new MutationObserver((records) => {
            const panelChanged = records.some((record) => {
              const target = record.target
              const targetElement =
                target.nodeType === Node.ELEMENT_NODE ? (target as Element) : target.parentElement
              return (
                targetElement === panel || (targetElement !== null && panel.contains(targetElement))
              )
            })
            const panelAncestorChanged = records.some((record) => {
              const target = record.target
              const targetElement =
                target.nodeType === Node.ELEMENT_NODE ? (target as Element) : target.parentElement
              return targetElement !== null && targetElement.contains(panel)
            })
            const inheritedContextChanged = records.some((record) =>
              inheritedMutationTargets.has(record.target),
            )
            if ((panelChanged || panelAncestorChanged || inheritedContextChanged) && panel.hidden) {
              refreshGeometry()
              mutationObserver?.takeRecords()
            }
            if (
              records.every((record) => {
                const target = record.target
                const targetElement =
                  target.nodeType === Node.ELEMENT_NODE ? (target as Element) : target.parentElement
                return targetElement?.closest('[data-picodash-panel]') !== null
              })
            )
              return
            refreshGeometry()
          })
        : undefined
    const mutationOptions = {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    } as const
    mutationObserver?.observe(panel, mutationOptions)
    const panelRoot = typeof panel.getRootNode === 'function' ? panel.getRootNode() : undefined
    if (mutationObserver && panelRoot && panelRoot !== ownerDocument)
      mutationObserver.observe(panelRoot, mutationOptions)
    let ancestor: Element | null = panel.parentElement
    while (mutationObserver && ancestor) {
      inheritedMutationTargets.add(ancestor)
      mutationObserver.observe(ancestor, { attributes: true })
      if (ancestor.parentElement) {
        ancestor = ancestor.parentElement
        continue
      }
      const root = typeof ancestor.getRootNode === 'function' ? ancestor.getRootNode() : undefined
      ancestor = root && 'host' in root && root.host instanceof Element ? root.host : null
    }
    if (mutationObserver && mutationRoot) mutationObserver.observe(mutationRoot, mutationOptions)
    const settledLayoutEvents = [
      'animationcancel',
      'animationend',
      'load',
      'transitioncancel',
      'transitionend',
    ] as const
    const canObserveDocument = typeof ownerDocument.addEventListener === 'function'
    if (canObserveDocument)
      for (const eventName of settledLayoutEvents)
        ownerDocument.addEventListener(eventName, refreshGeometry, true)
    let animationFrame: number | undefined
    let trackedBoundary = observedBoundary
    let trackedBoundaryRect = observedBoundary?.getBoundingClientRect()
    let trackedPanelRect = panel.getBoundingClientRect()
    const refreshOnAnimationFrame = () => {
      const nextBoundary = resolveDashPanelBoundary(boundary, providerPolicy.boundary)
      const boundaryIdentityChanged = trackedBoundary !== nextBoundary
      const nextBoundaryRect = nextBoundary?.getBoundingClientRect()
      const nextPanelRect = panel.getBoundingClientRect()
      if (
        trackedBoundary !== nextBoundary ||
        !sameMeasuredRect(trackedBoundaryRect, nextBoundaryRect) ||
        !sameMeasuredRect(trackedPanelRect, nextPanelRect)
      )
        refreshGeometry()
      if (boundaryIdentityChanged) {
        cancelObservedMoveRef.current()
        registration.current?.update({ resolveDockArena })
      }
      trackedBoundary = nextBoundary
      trackedBoundaryRect = nextBoundaryRect
      trackedPanelRect = nextPanelRect
      animationFrame = window.requestAnimationFrame(refreshOnAnimationFrame)
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', refreshGeometry)
      window.addEventListener('scroll', refreshGeometry, { capture: true, passive: true })
      window.visualViewport?.addEventListener('resize', refreshGeometry)
      window.visualViewport?.addEventListener('scroll', refreshGeometry)
      if (tracksBoundaryReference && typeof window.requestAnimationFrame === 'function')
        animationFrame = window.requestAnimationFrame(refreshOnAnimationFrame)
    }
    return () => {
      observer?.disconnect()
      mutationObserver?.disconnect()
      if (canObserveDocument)
        for (const eventName of settledLayoutEvents)
          ownerDocument.removeEventListener(eventName, refreshGeometry, true)
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', refreshGeometry)
        window.removeEventListener('scroll', refreshGeometry, true)
        window.visualViewport?.removeEventListener('resize', refreshGeometry)
        window.visualViewport?.removeEventListener('scroll', refreshGeometry)
        if (animationFrame !== undefined && typeof window.cancelAnimationFrame === 'function')
          window.cancelAnimationFrame(animationFrame)
      }
    }
  }, [
    boundary,
    id,
    observedBoundary,
    panelPortal,
    providerPolicy.boundary,
    refreshGeometry,
    resolveDockArena,
    runtime,
    tracksBoundaryReference,
  ])

  const beginMove = (mode: 'pointer' | 'keyboard', event?: ReactPointerEvent<HTMLElement>) => {
    const preferred = durableLayout?.preferredPosition ?? resolvedDefaultLayout.preferredPosition
    const requested =
      (effectivePlacement.disposition.kind === 'free'
        ? (currentPosition() ?? preferred)
        : (preferred ?? currentPosition())) ?? ({ x: 0, y: 0 } as const)
    const initialGeometry = geometryRef.current
    const projected = initialGeometry
      ? projectDashPanelPosition(
          {
            x: initialGeometry.boundary.left + requested.x,
            y: initialGeometry.boundary.top + requested.y,
          },
          initialGeometry.size,
          initialGeometry.boundary,
        )
      : undefined
    const current =
      projected && initialGeometry
        ? {
            x: projected.x - initialGeometry.boundary.left,
            y: projected.y - initialGeometry.boundary.top,
          }
        : requested
    const session = {
      mode,
      ...(event
        ? {
            pointerId: event.pointerId,
            startClient: { x: event.clientX, y: event.clientY },
            captureTarget: event.currentTarget,
          }
        : {}),
      startPosition: current,
      initialGeometry,
      startedDocked:
        effectivePlacement.mode === 'hybrid' && effectivePlacement.disposition.kind === 'docked',
      moved: false,
    } as const
    moveSession.current = session
    previewPositionRef.current = current
    setPreviewPosition(current)
    setMoveMode(mode)
  }

  const cancelMove = () => {
    moveSession.current = null
    previewPositionRef.current = null
    setPreviewPosition(null)
    setMoveMode(null)
  }
  cancelObservedMoveRef.current = () => {
    const session = moveSession.current
    if (session?.mode === 'pointer' && session.pointerId !== undefined)
      session.captureTarget?.releasePointerCapture?.(session.pointerId)
    cancelMove()
  }

  const commitMove = () => {
    const session = moveSession.current
    if (!session) return
    if (!session.moved) {
      cancelMove()
      return { status: 'executed' as const }
    }
    if (requestedPlacementMode === 'fixed') {
      cancelMove()
      return { status: 'not_executed' as const, reason: 'unavailable' as const }
    }
    const preview = previewPositionRef.current ?? session.startPosition
    if (
      session.startedDocked &&
      Math.hypot(preview.x - session.startPosition.x, preview.y - session.startPosition.y) <
        resolvedPlacementOptions.detachDistance
    ) {
      cancelMove()
      return { status: 'executed' as const }
    }
    const latestGeometry = measureGeometry()
    const initialGeometry = session.initialGeometry
    if (
      initialGeometry &&
      (!latestGeometry ||
        initialGeometry.boundary.left !== latestGeometry.boundary.left ||
        initialGeometry.boundary.top !== latestGeometry.boundary.top ||
        initialGeometry.boundary.right !== latestGeometry.boundary.right ||
        initialGeometry.boundary.bottom !== latestGeometry.boundary.bottom ||
        initialGeometry.size.width !== latestGeometry.size.width ||
        initialGeometry.size.height !== latestGeometry.size.height)
    ) {
      cancelMove()
      return { status: 'not_executed' as const, reason: 'unavailable' as const }
    }
    const movableMode = requestedPlacementMode === 'hybrid' ? 'hybrid' : 'floating'
    const placement =
      snapPlacementForMove(movableMode, preview, latestGeometry, resolvedPlacementOptions) ??
      ({ mode: movableMode, disposition: { kind: 'free' } } as const)
    const result = runtime.setPlacement(id, placement)
    announceDashPanelLayoutFailure('Panel movement', result, announceAction)
    cancelMove()
    return result
  }

  const onMovePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (requestedPlacementMode === 'fixed' || event.button !== 0 || moveSession.current) return
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    beginMove('pointer', event)
  }

  const onMovePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const session = moveSession.current
    const currentGeometry = geometryRef.current
    if (!session || session.mode !== 'pointer' || session.pointerId !== event.pointerId) return
    const startClient = session.startClient!
    if (!currentGeometry) return
    const projected = projectDashPanelPosition(
      {
        x: currentGeometry.boundary.left + session.startPosition.x + event.clientX - startClient.x,
        y: currentGeometry.boundary.top + session.startPosition.y + event.clientY - startClient.y,
      },
      currentGeometry.size,
      currentGeometry.boundary,
    )
    const next = {
      x: projected.x - currentGeometry.boundary.left,
      y: projected.y - currentGeometry.boundary.top,
    }
    moveSession.current = {
      ...session,
      moved: next.x !== session.startPosition.x || next.y !== session.startPosition.y,
    }
    previewPositionRef.current = next
    setPreviewPosition(next)
  }

  const onMovePointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const session = moveSession.current
    if (!session || session.mode !== 'pointer' || session.pointerId !== event.pointerId) return
    session.captureTarget?.releasePointerCapture?.(event.pointerId)
    commitMove()
  }

  const onMovePointerCancel = (event?: ReactPointerEvent<HTMLElement>) => {
    const session = moveSession.current
    if (!session || session.mode !== 'pointer') return
    if (event && session.pointerId !== event.pointerId) return
    if (event) session.captureTarget?.releasePointerCapture?.(event.pointerId)
    cancelMove()
  }

  const nativeMoveHandlersRef = useRef({
    move: onMovePointerMove,
    up: onMovePointerUp,
    cancel: onMovePointerCancel,
  })
  useLayoutEffect(() => {
    nativeMoveHandlersRef.current = {
      move: onMovePointerMove,
      up: onMovePointerUp,
      cancel: onMovePointerCancel,
    }
  })

  useEffect(() => {
    if (moveMode !== 'pointer' || typeof window === 'undefined') return
    const move = (event: PointerEvent) =>
      nativeMoveHandlersRef.current.move(event as unknown as ReactPointerEvent<HTMLElement>)
    const up = (event: PointerEvent) =>
      nativeMoveHandlersRef.current.up(event as unknown as ReactPointerEvent<HTMLElement>)
    const cancel = (event: PointerEvent) =>
      nativeMoveHandlersRef.current.cancel(event as unknown as ReactPointerEvent<HTMLElement>)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      const session = moveSession.current
      if (session?.mode === 'pointer') {
        session.captureTarget?.releasePointerCapture?.(session.pointerId ?? -1)
        moveSession.current = null
        previewPositionRef.current = null
      }
    }
  }, [moveMode])

  const onMoveKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    const session = moveSession.current
    if (!session) {
      if (requestedPlacementMode === 'fixed') return
      if (event.key === 'Enter' || event.key === ' ') {
        if (event.repeat) return
        event.preventDefault()
        beginMove('keyboard')
      }
      return
    }
    if (session.mode !== 'keyboard') return
    if (event.key === 'Escape') {
      event.preventDefault()
      cancelMove()
      return
    }
    if (event.key === 'Enter') {
      if (event.repeat) return
      event.preventDefault()
      commitMove()
      return
    }
    const distance = event.shiftKey ? 10 : 1
    let dx = 0
    let dy = 0
    if (event.key === 'ArrowLeft') dx = -distance
    if (event.key === 'ArrowRight') dx = distance
    if (event.key === 'ArrowUp') dy = -distance
    if (event.key === 'ArrowDown') dy = distance
    if (dx === 0 && dy === 0) return
    event.preventDefault()
    const current = previewPositionRef.current ?? session.startPosition
    const currentGeometry = geometryRef.current
    if (!currentGeometry) return
    const projected = projectDashPanelPosition(
      {
        x: currentGeometry.boundary.left + current.x + dx,
        y: currentGeometry.boundary.top + current.y + dy,
      },
      currentGeometry.size,
      currentGeometry.boundary,
    )
    const next = {
      x: projected.x - currentGeometry.boundary.left,
      y: projected.y - currentGeometry.boundary.top,
    }
    moveSession.current = {
      ...session,
      moved: next.x !== session.startPosition.x || next.y !== session.startPosition.y,
    }
    previewPositionRef.current = next
    setPreviewPosition(next)
  }
  const textualTitle = isTextTitle(title)
  const titleText = textualTitle ? textTitle(title) : ''
  const hasAccessibleLabel = typeof ariaLabel === 'string' && ariaLabel.trim() !== ''
  if (ariaLabel !== undefined && !hasAccessibleLabel)
    throw new TypeError('DashPanel aria-label must not be empty.')
  if (!textualTitle && !hasAccessibleLabel)
    throw new TypeError('DashPanel non-text titles require an explicit aria-label.')
  if (textualTitle && titleText.trim() === '' && !hasAccessibleLabel)
    throw new TypeError('DashPanel titles require non-empty text or an explicit aria-label.')

  const generation = useRef<{
    readonly scopeId: string
    readonly defaultCollapsed: boolean
    readonly defaultVisible: boolean
    readonly collapsible: boolean
  } | null>(null)
  if (generation.current !== null && generation.current.scopeId !== id)
    throw new TypeError('DashPanel id is immutable while mounted.')
  if (generation.current === null) {
    const initialCollapsed = defaultCollapsed ?? false
    const initialCollapsible = collapsible ?? true
    if (initialCollapsed && !initialCollapsible)
      throw new TypeError('A non-collapsible Panel cannot start collapsed.')
    generation.current = {
      scopeId: id,
      defaultCollapsed: initialCollapsed,
      defaultVisible: defaultVisible ?? true,
      collapsible: initialCollapsible,
    }
  }
  const initial = generation.current
  const setAsideElement = useMemo(
    () => (element: HTMLElement | null) => {
      asideRef.current = element
      if (registration.current) runtime.registerElement(id, element)
    },
    [id, runtime],
  )
  useLayoutEffect(() => {
    const current = generation.current
    if (current === null || current.scopeId !== id) return
    const next = runtime.acquire({
      scopeId: id,
      defaultVisible: current.defaultVisible,
      defaultCollapsed: current.defaultCollapsed,
      collapsible: current.collapsible,
      onVisibilityChange,
      onCollapsedChange,
      defaultLayout: resolvedPolicyDefaultLayout,
      placement: resolvedPlacement,
      dockPositions: resolvedDockPositions,
      presentation: resolvedPresentation,
      store: scoped,
      currentPosition,
      freeMovePosition,
      preferredPosition: settledPreferredPosition,
      resolveDockArena,
    })
    registration.current = next
    runtime.registerElement(id, asideRef.current)
    return () => {
      clearPanelFocusRecord(runtime, id)
      runtime.registerElement(id, null)
      next.release()
      if (registration.current === next) registration.current = null
    }
  }, [id, runtime, scoped])
  useEffect(() => {
    registration.current?.update({
      collapsible,
      onVisibilityChange,
      onCollapsedChange,
      defaultLayout: resolvedPolicyDefaultLayout,
      placement: resolvedPlacement,
      dockPositions: resolvedDockPositions,
      presentation: resolvedPresentation,
      store: scoped,
      currentPosition,
      freeMovePosition,
      preferredPosition: settledPreferredPosition,
      resolveDockArena,
    })
  }, [
    collapsible,
    onVisibilityChange,
    onCollapsedChange,
    resolvedPolicyDefaultLayout,
    resolvedPlacement,
    resolvedDockPositions,
    resolvedPresentation,
    scoped,
    currentPosition,
    freeMovePosition,
    settledPreferredPosition,
    resolveDockArena,
  ])

  const collapsed = runtimeState?.collapsed ?? initial.defaultCollapsed
  const currentCollapsible = runtimeState?.collapsible ?? initial.collapsible
  const visible = runtimeState?.visible ?? initial.defaultVisible
  const runtimeSnapshot = runtime.getSnapshot()
  const activeVisiblePanelId = [...runtimeSnapshot.activationOrder]
    .reverse()
    .find((scopeId) => runtimeSnapshot.panels[scopeId]?.visible)
  const panelName = titleText.trim() === '' ? ariaLabel! : titleText
  const collapseLabel = `${collapsed ? 'Expand' : 'Collapse'} panel ${panelName}`
  const renderActionMenu =
    actionMenu !== false && (actionMenu === undefined || actionMenu.length > 0)
  const DefaultActionItems = defaultActionItems
  const actionMenuChildren =
    actionMenu === undefined ? (
      <>
        {DefaultActionItems ? <DefaultActionItems scopeId={id} /> : null}
        <DashPanelActionItems />
      </>
    ) : (
      actionMenu
    )
  useImperativeHandle(ref, () => asideRef.current as HTMLElement)

  const resolvedStyle = panelStyle(style, width)
  const preferredPosition =
    previewPosition ??
    durableLayout?.preferredPosition ??
    resolvedDefaultLayout.preferredPosition ??
    currentPosition() ??
    ({ x: 0, y: 0 } as const)
  const renderedPlacement = moveMode
    ? ({
        mode: requestedPlacementMode === 'hybrid' ? 'hybrid' : 'floating',
        disposition: { kind: 'free' },
      } as const)
    : effectivePlacement
  const renderedDockPosition =
    renderedPlacement.mode === 'fixed'
      ? renderedPlacement.disposition.position
      : renderedPlacement.mode === 'hybrid' && renderedPlacement.disposition.kind === 'docked'
        ? renderedPlacement.disposition.position
        : undefined
  const dockTarget =
    geometry && renderedDockPosition ? runtime.getDockTarget(id, geometry.boundary) : undefined
  const renderedRect = geometry
    ? placementRect(
        renderedPlacement,
        geometry.boundary,
        geometry.size,
        preferredPosition,
        resolvedPlacementOptions.snapOffset,
        dockTarget,
      )
    : null
  const geometryStyle: CSSProperties | undefined = renderedRect
    ? {
        position: 'absolute',
        left: `${mapRectToContainingBlock(asideRef.current, renderedRect).left}px`,
        top: `${mapRectToContainingBlock(asideRef.current, renderedRect).top}px`,
        ...(renderedDockPosition === 'full-top' || renderedDockPosition === 'full-bottom'
          ? { inlineSize: `${renderedRect.width}px` }
          : renderedRect.width > 0
            ? { maxInlineSize: `${renderedRect.width}px` }
            : {}),
        ...(renderedDockPosition === 'full-left' || renderedDockPosition === 'full-right'
          ? { blockSize: `${renderedRect.height}px` }
          : renderedRect.height > 0
            ? { maxBlockSize: `${renderedRect.height}px` }
            : {}),
      }
    : undefined
  const combinedStyle =
    resolvedStyle || geometryStyle ? { ...resolvedStyle, ...geometryStyle } : undefined
  const labelledProps = textualTitle
    ? {
        ...(ariaLabel === undefined && ariaLabelledBy === undefined
          ? { 'aria-labelledby': headingId }
          : {}),
        ...(ariaLabel === undefined ? {} : { 'aria-label': ariaLabel }),
        ...(ariaLabelledBy === undefined ? {} : { 'aria-labelledby': ariaLabelledBy }),
      }
    : { 'aria-label': ariaLabel }

  const panelRoot = (
    <DashPanelPolicyProvider
      boundary={boundary}
      boundaryInset={boundaryInset}
      dockPositions={dockPositions}
    >
      <DashPanelIdentityProvider scopeId={id}>
        <DashPanelActionProvider
          scopeId={id}
          onRequestRemove={onRequestRemove}
          announce={announceAction}
        >
          <PicodashStoreEntityBoundary store={scoped} kind="dashPanel">
            <PicodashThemeProvider<string> theme={theme} density={density}>
              <aside
                {...asideProps}
                {...labelledProps}
                ref={setAsideElement}
                className={className ? `picodash-dashpanel ${className}` : 'picodash-dashpanel'}
                style={combinedStyle}
                data-picodash-panel
                data-picodash-placement={
                  moveMode
                    ? `${renderedPlacement.mode}-free-preview`
                    : `${effectivePlacement.mode}-${effectivePlacement.disposition.kind}`
                }
                data-visible={visible ? 'true' : 'false'}
                data-active={activeVisiblePanelId === id ? 'true' : undefined}
                hidden={!visible}
                inert={!visible || undefined}
                aria-hidden={!visible || undefined}
                onFocusCapture={(event) => {
                  asideProps.onFocusCapture?.(event)
                  const related = event.relatedTarget
                  if (
                    typeof Node !== 'undefined' &&
                    related instanceof Node &&
                    event.currentTarget.contains(related)
                  )
                    return
                  recordPanelInteraction(runtime, id, related)
                }}
                onPointerMove={onMovePointerMove}
                onPointerUp={onMovePointerUp}
                onPointerCancel={onMovePointerCancel}
                data-collapsed={collapsed ? 'true' : 'false'}
              >
                <DashHeader
                  slots={{
                    leading: currentCollapsible ? (
                      <Button
                        aria-label={collapseLabel}
                        aria-expanded={!collapsed}
                        aria-controls={bodyId}
                        iconOnly
                        variant="ghost"
                        size="sm"
                        onPress={() => {
                          runtime.toggleCollapsed(id)
                        }}
                      >
                        {collapsed ? '+' : '−'}
                      </Button>
                    ) : undefined,
                    title: <h2 id={headingId}>{title}</h2>,
                    actions: renderActionMenu ? (
                      <ActionMenu label={`Actions for ${panelName}`}>
                        {actionMenuChildren}
                      </ActionMenu>
                    ) : undefined,
                    trailing: (
                      <div data-picodash-panel-actions>
                        <Button
                          ref={registerMoveHandle}
                          data-picodash-panel-move-handle
                          aria-label={`Move panel ${panelName}`}
                          aria-pressed={moveMode !== null}
                          aria-describedby={moveInstructionsId}
                          isDisabled={requestedPlacementMode === 'fixed'}
                          iconOnly
                          variant="ghost"
                          size="sm"
                          onPointerDown={onMovePointerDown}
                          onPointerMoveCapture={onMovePointerMove}
                          onPointerUpCapture={onMovePointerUp}
                          onPointerCancelCapture={onMovePointerCancel}
                          onKeyDown={onMoveKeyDown}
                          onBlur={() => {
                            if (moveSession.current?.mode === 'keyboard') cancelMove()
                          }}
                        >
                          ↕
                        </Button>
                        {showCloseButton ? (
                          <Button
                            aria-label={`Close panel ${panelName}`}
                            iconOnly
                            variant="ghost"
                            size="sm"
                            onPress={() => {
                              const wasVisible = runtime.getSnapshot().panels[id]?.visible ?? false
                              try {
                                runtime.hide(id)
                              } finally {
                                const isVisible = runtime.getSnapshot().panels[id]?.visible ?? false
                                if (wasVisible && !isVisible)
                                  restorePanelFocus(
                                    runtime,
                                    id,
                                    providerPolicy.boundary,
                                    overlayDefaults.portalContainer,
                                  )
                              }
                            }}
                          >
                            ×
                          </Button>
                        ) : undefined}
                      </div>
                    ),
                  }}
                />
                <div
                  id={bodyId}
                  data-picodash-panel-body
                  hidden={collapsed}
                  inert={collapsed || undefined}
                  aria-hidden={collapsed || undefined}
                >
                  {children}
                </div>
                <div
                  key={actionAnnouncement.sequence}
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                  data-picodash-panel-status
                >
                  {actionAnnouncement.message}
                </div>
                <span id={moveInstructionsId} data-picodash-panel-move-instructions>
                  Press Space or Enter to pick up. Use the arrow keys to move; hold Shift for larger
                  steps. Press Enter to commit, or Escape to cancel.
                </span>
              </aside>
            </PicodashThemeProvider>
          </PicodashStoreEntityBoundary>
        </DashPanelActionProvider>
      </DashPanelIdentityProvider>
    </DashPanelPolicyProvider>
  )
  return panelPortal ? createPortal(panelRoot, panelPortal) : panelRoot
})

export const DashPanel = DashPanelImpl

export function DashPanelTrigger({
  panelId,
  action = 'show',
  isDisabled,
  ...props
}: DashPanelTriggerProps) {
  const runtime = useDashPanelRuntime()
  const state = useDashPanelRuntimeState(panelId)
  const policy = useDashPanelProviderPolicy()
  const overlay = usePicodashOverlayDefaults()
  return (
    <Button
      {...props}
      isDisabled={isDisabled || !state}
      onPress={(event) => {
        const trigger = event.target as HTMLElement
        const before = typeof document !== 'undefined' ? document.activeElement : null
        const visible = runtime.getSnapshot().panels[panelId]?.visible ?? false
        recordPanelEntry(runtime, panelId, trigger, before)
        try {
          if (action === 'toggle' && visible) runtime.hide(panelId)
          else runtime.show(panelId)
        } finally {
          const nextVisible = runtime.getSnapshot().panels[panelId]?.visible ?? false
          if (visible && !nextVisible)
            restorePanelFocus(runtime, panelId, policy.boundary, overlay.portalContainer)
          else if (nextVisible && (action === 'show' || !visible))
            queueMicrotask(() => focusPanel(runtime, panelId))
        }
      }}
    />
  )
}

export function DashPanelLauncher({ label, items, ...props }: DashPanelLauncherProps) {
  if (!label.trim()) throw new TypeError('DashPanelLauncher label must not be empty.')
  return (
    <div {...props} role="group" aria-label={label}>
      {items.map((item) => {
        const accessibleName = item.accessibleName
        if (accessibleName !== undefined && !accessibleName.trim())
          throw new TypeError('DashPanelLauncher item accessibleName must not be empty.')
        if (accessibleName === undefined && (typeof item.label !== 'string' || !item.label.trim()))
          throw new TypeError(
            'DashPanelLauncher items require a non-empty text label or accessibleName.',
          )
        return (
          <DashPanelTrigger
            key={item.panelId}
            panelId={item.panelId}
            isDisabled={item.disabled}
            aria-label={accessibleName}
          >
            {item.label}
          </DashPanelTrigger>
        )
      })}
    </div>
  )
}

export { ActionMenu, ActionMenuItem, ActionMenuSeparator, ActionSubmenu, DashHeader }

export type {
  ActionMenuConfirmation,
  ActionMenuConfirmationGuard,
  ActionMenuItemProps,
  ActionMenuItemVariant,
  ActionMenuProps,
  ActionMenuSeparatorProps,
  ActionSubmenuProps,
  DashHeaderProps,
  DashHeaderSlots,
}
