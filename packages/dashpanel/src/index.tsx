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
import { animate } from 'motion/mini'
import type { PicodashFieldDefinitions, RootNexus } from '@picodash/nexus'
import {
  PicodashNexusEntityBoundary,
  PicodashNexusProviderBoundary,
  useNexusInteractionPublisher,
} from '@picodash/nexus/integration'
import { usePicodashRootNexus, usePicodashNexusSelector } from '@picodash/nexus/react'
import {
  ActionMenu,
  ActionMenuItem,
  ActionMenuSeparator,
  ActionSubmenu,
  DashHeader,
  Button,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
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
  resolveDashPanelBoundaryContact,
  snapDashPanelRect,
  type DashPanelDockTargetOptions,
  type DashPanelPoint,
  type DashPanelSize,
} from './geometry/placement-geometry.ts'
import { insetDashPanelRect, type DashPanelRect } from './geometry/inset.ts'
import {
  resolveDashPanelHybridDockIntent,
  resolveDashPanelSnapDragIntent,
  type DashPanelHybridDockIntent,
  type DashPanelSnapDragIntent,
} from './placement/drag-intent.ts'
import {
  resolveDashPanelDockedMinimizePresentation,
  type DashPanelDockArrowDirection,
} from './placement/docked-minimize.ts'
import {
  capturePanelScrollOffsets,
  measurePanelSizing,
  type PanelSizingPolicy,
} from './runtime/panel-size-measurement.ts'
import { cn } from './runtime/class-name.ts'
import { usePanelInteractions } from './runtime/use-panel-interactions.ts'
import { usePanelResize } from './runtime/use-panel-resize.ts'
import { PanelSizeEditor } from './runtime/panel-size-editor.tsx'
import {
  normalizeDashPanelContentConstraints,
  normalizeDashPanelContentMetrics,
  resolveDashPanelDimension,
  type DashPanelContentConstraints,
  type DashPanelContentMetrics,
  type DashPanelDimension,
  type DashPanelHeight,
  type DashPanelResize,
  type DashPanelSizingState,
} from './sizing/index.ts'

export type {
  DashPanelDimension,
  DashPanelHeight,
  DashPanelResize,
  DashPanelResizeOptions,
  DashPanelResizeTarget,
  DashPanelContentConstraints,
  DashPanelContentMetrics,
  DashPanelManualSize,
  DashPanelSizingState,
  DashPanelSizingConstraint,
} from './sizing/index.ts'
export type { DashPanelSizeRequest, DashPanelRestoreSizeOptions } from './runtime/panel-runtime.ts'

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
  DashPanelRestoreSizeItem,
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
  | 'height'
  | 'maxWidth'
  | 'maxHeight'
>

export interface DashPanelProviderProps<
  Fields extends PicodashFieldDefinitions = PicodashFieldDefinitions,
  CustomTheme extends string = never,
> {
  children: ReactNode
  nexus: RootNexus<Fields>
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
  height?: DashPanelHeight
  minWidth?: DashPanelDimension
  maxWidth?: DashPanelDimension
  minHeight?: DashPanelDimension
  maxHeight?: DashPanelDimension
  resize?: DashPanelResize
  contentConstraints?: DashPanelContentConstraints
  contentMetrics?: DashPanelContentMetrics
  moveHandle?: 'header' | 'grip' | 'both'
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
      itemId?: string
      panelId: string
      label: string
      accessibleName?: string
      disabled?: boolean
    }
  | {
      itemId?: string
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
  nexus: RootNexus<Fields>,
  providerId: string,
) {
  const identity = useRef<{
    readonly nexus: RootNexus<Fields>
    readonly providerId: string
  } | null>(null)
  if (identity.current === null) identity.current = { nexus, providerId }
  else if (identity.current.nexus !== nexus || identity.current.providerId !== providerId)
    throw new TypeError('DashPanelProvider nexus and providerId are immutable while mounted.')
}

export function DashPanelProvider<
  Fields extends PicodashFieldDefinitions = PicodashFieldDefinitions,
  CustomTheme extends string = never,
>({
  children,
  nexus,
  providerId,
  boundary,
  boundaryInset,
  dockPositions,
  portalContainer,
  layerBase,
  theme,
  density,
}: DashPanelProviderProps<Fields, CustomTheme>) {
  if (nexus.kind !== 'root') throw new TypeError('DashPanelProvider requires a root Nexus.')
  const resolvedProviderId = providerId ?? 'default'
  immutableProviderIdentity(nexus, resolvedProviderId)
  return (
    <PicodashNexusProviderBoundary nexus={nexus} providerId={resolvedProviderId}>
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
    </PicodashNexusProviderBoundary>
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

function CollapseIcon({ collapsed }: { readonly collapsed: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      data-picodash-collapse-chevron
      data-expanded={collapsed ? undefined : 'true'}
    >
      <path
        d="m6 3 5 5-5 5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  )
}

const dockArrowRotations = {
  up: -90,
  'up-right': -45,
  right: 0,
  'down-right': 45,
  down: 90,
  'down-left': 135,
  left: 180,
  'up-left': -135,
} satisfies Readonly<Record<DashPanelDockArrowDirection, number>>

function DockArrowIcon({ direction }: { readonly direction: DashPanelDockArrowDirection }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      data-picodash-arrow-direction={direction}
      style={{ transform: `rotate(${dockArrowRotations[direction]}deg)` }}
    >
      <path
        d="M3 8h9m-3.5-3.5L12 8l-3.5 3.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="m4 4 8 8m0-8-8 8"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  )
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
    'height',
    'maxWidth',
    'maxHeight',
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
  height?: DashPanelHeight,
): CSSProperties | undefined {
  if (style === undefined && width === undefined && height === undefined) return undefined
  const resolved = { ...style } as CSSProperties & {
    '--picodash-panel-width'?: CSSProperties['width']
    '--picodash-panel-height'?: string
  }
  if (width !== undefined)
    resolved['--picodash-panel-width'] = typeof width === 'number' ? `${width}px` : width
  if (height !== undefined)
    resolved['--picodash-panel-height'] = typeof height === 'number' ? `${height}px` : height
  return resolved
}

interface PanelGeometryState {
  readonly boundary: DashPanelRect
  readonly minimumHeight: number
  readonly size: DashPanelSize
  readonly rect: DashPanelRect
  readonly sizing: DashPanelSizingState
}

type PanelHeightTransitionState =
  | { readonly kind: 'idle'; readonly settledHeight?: number }
  | { readonly kind: 'pending'; readonly fromHeight: number }
  | {
      readonly kind: 'animating'
      readonly animation: ReturnType<typeof animate>
      readonly targetHeight: number
      readonly blockSize: string
      readonly blockSizePriority: string
      readonly maxBlockSize: string
      readonly maxBlockSizePriority: string
    }

type PanelMotionEasing = NonNullable<NonNullable<Parameters<typeof animate>[2]>['ease']>

interface PanelTimedMotion {
  readonly duration: number
  readonly easing: PanelMotionEasing
}

function cssTimeToMilliseconds(value: string): number | undefined {
  const trimmed = value.trim()
  const multiplier = trimmed.endsWith('ms') ? 1 : trimmed.endsWith('s') ? 1000 : undefined
  if (multiplier === undefined) return undefined
  const amount = Number(trimmed.slice(0, trimmed.endsWith('ms') ? -2 : -1))
  return Number.isFinite(amount) && amount >= 0 ? amount * multiplier : undefined
}

type PanelMagneticMotionKind = 'snap' | 'detach'

interface PanelMagneticMotion extends PanelTimedMotion {
  readonly bounce: number
}

interface PendingPanelMagneticMotion {
  readonly kind: PanelMagneticMotionKind
  readonly from: Readonly<{ left: number; top: number }>
}

interface PanelDockPreviewMotionTarget {
  readonly opacity: number
  readonly transform: string
}

interface PanelDockAllocationGeometry {
  readonly position: DashPanelDockPosition
  readonly allocationKey: string
  readonly rect: DashPanelRect
}

function cssEasingToMotion(value: string): PanelMotionEasing {
  const easing = value.trim()
  if (easing === 'linear') return 'linear'
  if (easing === 'ease-in') return 'easeIn'
  if (easing === 'ease-in-out' || easing === 'ease') return 'easeInOut'
  if (easing === 'ease-out') return 'easeOut'
  const cubicBezier = /^cubic-bezier\(\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^,]+)\s*\)$/.exec(
    easing,
  )
  if (cubicBezier) {
    const values = cubicBezier.slice(1).map(Number)
    if (
      values.length === 4 &&
      values.every(Number.isFinite) &&
      values[0]! >= 0 &&
      values[0]! <= 1 &&
      values[2]! >= 0 &&
      values[2]! <= 1
    )
      return [values[0]!, values[1]!, values[2]!, values[3]!]
  }
  return 'easeOut'
}

function resolvePanelTimedMotion(
  element: HTMLElement,
  durationToken: string,
  easingToken: string,
): PanelTimedMotion | undefined {
  const ownerWindow = element.ownerDocument.defaultView
  if (!ownerWindow || ownerWindow.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
    return undefined
  const style = ownerWindow.getComputedStyle(element)
  const duration = cssTimeToMilliseconds(style.getPropertyValue(durationToken))
  if (duration === undefined || duration === 0) return undefined
  return {
    duration,
    easing: cssEasingToMotion(style.getPropertyValue(easingToken)),
  }
}

function resolveSharedPanelMotion(element: HTMLElement): PanelTimedMotion | undefined {
  return resolvePanelTimedMotion(element, '--picodash-duration-fast', '--picodash-easing-out')
}

function resolvePanelMagneticMotion(
  element: HTMLElement,
  kind: PanelMagneticMotionKind,
): PanelMagneticMotion | undefined {
  const timed = resolvePanelTimedMotion(
    element,
    `--picodash-panel-${kind}-duration`,
    `--picodash-panel-${kind}-easing`,
  )
  if (!timed) return undefined
  const style = element.ownerDocument.defaultView!.getComputedStyle(element)
  const bounceValue = Number(style.getPropertyValue(`--picodash-panel-${kind}-bounce`).trim())
  const bounce = Number.isFinite(bounceValue) ? Math.min(0.25, Math.max(0, bounceValue)) : 0
  return { ...timed, bounce }
}

function magneticMotionTransition(
  previous: DashPanelSnapDragIntent | null,
  next: DashPanelSnapDragIntent,
): PanelMagneticMotionKind | undefined {
  if (!previous) return undefined
  const previousAttached = previous.kind !== 'free'
  const nextAttached = next.kind !== 'free'
  if (!previousAttached && nextAttached) return 'snap'
  if (previousAttached && !nextAttached) return 'detach'
  if (previousAttached && nextAttached && previous.target !== next.target) return 'snap'
  return undefined
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

function measureMinimumPanelHeight(
  element: HTMLElement,
  preferredHeight: number,
  preferredWidth: number,
): number {
  const inlineSize = element.style.getPropertyValue('inline-size')
  const inlineSizePriority = element.style.getPropertyPriority('inline-size')
  const blockSize = element.style.getPropertyValue('block-size')
  const blockSizePriority = element.style.getPropertyPriority('block-size')
  const maxBlockSize = element.style.getPropertyValue('max-block-size')
  const maxBlockSizePriority = element.style.getPropertyPriority('max-block-size')
  element.style.setProperty('inline-size', `${preferredWidth}px`)
  element.style.setProperty('block-size', 'min-content')
  element.style.removeProperty('max-block-size')
  try {
    const measured = element.getBoundingClientRect().height
    const header = element.querySelector<HTMLElement>(
      ":scope > [data-picodash-panel-surface] > [data-slot='dash-header']",
    )
    const headerHeight = Math.max(0, header?.getBoundingClientRect().height ?? 0)
    if (Number.isFinite(measured) && measured > headerHeight && measured < preferredHeight)
      return measured
    return Math.min(preferredHeight, headerHeight)
  } finally {
    if (inlineSize) element.style.setProperty('inline-size', inlineSize, inlineSizePriority)
    else element.style.removeProperty('inline-size')
    if (blockSize) element.style.setProperty('block-size', blockSize, blockSizePriority)
    else element.style.removeProperty('block-size')
    if (maxBlockSize)
      element.style.setProperty('max-block-size', maxBlockSize, maxBlockSizePriority)
    else element.style.removeProperty('max-block-size')
  }
}

function sameMeasuredRect(left: DOMRect | undefined, right: DOMRect | undefined): boolean {
  if (!left || !right) return left === right
  return (
    sameMeasuredLength(left.top, right.top) &&
    sameMeasuredLength(left.right, right.right) &&
    sameMeasuredLength(left.bottom, right.bottom) &&
    sameMeasuredLength(left.left, right.left) &&
    sameMeasuredLength(left.width, right.width) &&
    sameMeasuredLength(left.height, right.height)
  )
}

function sameMeasuredLength(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.5
}

function viewportRect(ownerDocument?: Document): DashPanelRect {
  const ownerWindow =
    ownerDocument?.defaultView ?? (typeof window !== 'undefined' ? window : undefined)
  const visualViewport = ownerWindow?.visualViewport
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
    ownerWindow && Number.isFinite(ownerWindow.innerWidth)
      ? ownerWindow.innerWidth
      : ownerDocument
        ? (ownerDocument.documentElement?.clientWidth ?? 0)
        : typeof document !== 'undefined'
          ? (document.documentElement?.clientWidth ?? 0)
          : 0
  const height =
    ownerWindow && Number.isFinite(ownerWindow.innerHeight)
      ? ownerWindow.innerHeight
      : ownerDocument
        ? (ownerDocument.documentElement?.clientHeight ?? 0)
        : typeof document !== 'undefined'
          ? (document.documentElement?.clientHeight ?? 0)
          : 0
  return { top: 0, right: width, bottom: height, left: 0, width, height }
}

function placementRect(
  placement: DashPanelPlacement,
  boundary: DashPanelRect,
  size: DashPanelSize,
  minimumHeight: number,
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
      minimumHeight,
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
    minimumHeight,
  )
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
    const ownerWindow = element?.ownerDocument.defaultView
    const scrollX = ownerWindow?.scrollX || 0
    const scrollY = ownerWindow?.scrollY || 0
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
    height,
    minWidth,
    maxWidth,
    minHeight,
    maxHeight,
    resize,
    contentConstraints,
    contentMetrics,
    moveHandle = 'header',
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
  if (height !== undefined && height !== 'auto')
    resolveDashPanelDimension(height, { available: 1000, rootFontSize: 16 })
  for (const bound of [minWidth, maxWidth, minHeight, maxHeight])
    if (bound !== undefined) resolveDashPanelDimension(bound, { available: 1000, rootFontSize: 16 })
  if (typeof minWidth === 'number' && typeof maxWidth === 'number' && minWidth > maxWidth)
    throw new TypeError('DashPanel minWidth cannot exceed maxWidth.')
  if (typeof minHeight === 'number' && typeof maxHeight === 'number' && minHeight > maxHeight)
    throw new TypeError('DashPanel minHeight cannot exceed maxHeight.')
  if (!['header', 'grip', 'both'].includes(moveHandle))
    throw new TypeError('Invalid DashPanel moveHandle.')
  normalizeDashPanelContentConstraints(contentConstraints)
  normalizeDashPanelContentMetrics(contentMetrics)
  const publishInteraction = useNexusInteractionPublisher()
  const root = usePicodashRootNexus()
  const runtime = useDashPanelRuntime()
  const providerPolicy = useDashPanelProviderPolicy()
  const overlayDefaults = usePicodashOverlayDefaults()
  const resolvedPortalContainer = overlayDefaults.portalContainer
  const panelPortal = resolvedPortalContainer?.nodeType === 1 ? resolvedPortalContainer : null
  const defaultActionItems = useDashPanelDefaultActionItems()
  const runtimeState = useDashPanelRuntimeState(id)
  const scoped = root.scope(id)
  const durableLayout = usePicodashNexusSelector(scoped, (state) => state.scope?.dashPanel)
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
    durableLayout?.placement &&
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
  const interactions = usePanelInteractions(asideRef, publishInteraction)
  const previewPositionRef = useRef<DashPanelPoint | null>(null)
  const snapIntentRef = useRef<DashPanelSnapDragIntent | null>(null)
  const dockIntentRef = useRef<DashPanelHybridDockIntent | null>(null)
  const geometryRef = useRef<PanelGeometryState | null>(null)
  const panelHeightTransitionRef = useRef<PanelHeightTransitionState>({ kind: 'idle' })
  const panelMagneticAnimationRef = useRef<ReturnType<typeof animate> | null>(null)
  const pendingPanelMagneticMotionRef = useRef<PendingPanelMagneticMotion | null>(null)
  const dockPreviewElementRef = useRef<HTMLDivElement | null>(null)
  const dockPreviewAnimationRef = useRef<ReturnType<typeof animate> | null>(null)
  const dockPreviewMotionTargetRef = useRef<PanelDockPreviewMotionTarget | null>(null)
  const dockPreviewReturnRef = useRef<{
    readonly from: PanelDockPreviewMotionTarget
    readonly startedAt: number
  } | null>(null)
  const dockAllocationAnimationRef = useRef<ReturnType<typeof animate> | null>(null)
  const dockAllocationGeometryRef = useRef<PanelDockAllocationGeometry | null>(null)
  const pendingDockReleaseRectRef = useRef<DashPanelRect | null>(null)
  const renderedMappedRef = useRef<Readonly<{ left: number; top: number }> | null>(null)
  const [geometry, setGeometry] = useState<PanelGeometryState | null>(null)
  const [panelHeightTransitionRevision, setPanelHeightTransitionRevision] = useState(0)
  const [previewPosition, setPreviewPosition] = useState<DashPanelPoint | null>(null)
  const [snapIntent, setSnapIntent] = useState<DashPanelSnapDragIntent | null>(null)
  const [dockIntent, setDockIntent] = useState<DashPanelHybridDockIntent | null>(null)
  const [moveMode, setMoveMode] = useState<'pointer' | 'keyboard' | null>(null)
  const announcementSequence = useRef(0)
  const [actionAnnouncement, setActionAnnouncement] = useState({ sequence: 0, message: '' })
  const announceAction = useCallback((message: string) => {
    announcementSequence.current += 1
    setActionAnnouncement({ sequence: announcementSequence.current, message })
  }, [])
  const [sizeEditorOpen, setSizeEditorOpen] = useState(false)
  const sizingPolicy = useMemo<PanelSizingPolicy>(
    () => ({
      height,
      minWidth,
      maxWidth,
      minHeight,
      maxHeight,
      contentConstraints,
      contentMetrics,
    }),
    [height, minWidth, maxWidth, minHeight, maxHeight, contentConstraints, contentMetrics],
  )
  const resizeInteraction = usePanelResize({
    element: asideRef,
    boundary: geometry?.boundary,
    sizing: geometry?.sizing,
    placement: effectivePlacement,
    resize,
    available:
      (runtimeState?.visible ?? defaultVisible ?? true) &&
      !(runtimeState?.collapsed ?? defaultCollapsed ?? false),
    moving: moveMode !== null,
    fingerprint: JSON.stringify([durableLayout, sizingPolicy]),
    preferredPosition:
      durableLayout?.preferredPosition ?? resolvedPolicyDefaultLayout.preferredPosition,
    publish: publishInteraction,
    getCanonicalLayout: () => scoped.getState().scope?.dashPanel,
    subscribeCanonical: (listener) => scoped.subscribe(listener),
    commit: (size, position) => runtime.commitResize(id, size, position),
    announce: announceAction,
    beforeStart: () => {
      cancelPanelHeightTransition()
      cancelPanelMagneticMotion()
    },
  })
  const resizePreviewRef = useRef(resizeInteraction.preview)
  resizePreviewRef.current = resizeInteraction.preview
  const onRuntimeCommand = useCallback(
    (command: string, outcome: 'accepted' | 'unchanged' | 'rejected', reason?: string) => {
      publishInteraction({
        type: 'command',
        target: 'panel',
        input: 'programmatic',
        command,
        outcome,
        ...(reason ? { reason } : {}),
      })
    },
    [publishInteraction],
  )
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
    readonly rawPosition: DashPanelPoint
    readonly initialGeometry: PanelGeometryState | null
    readonly captureTarget?: HTMLElement
    readonly startedDocked: boolean
    readonly dockDetached: boolean
    readonly activeSnapTarget?: DashPanelSnapPosition | undefined
    readonly moved: boolean
    readonly sourceFingerprint: string
  } | null>(null)
  const cancelObservedMoveRef = useRef<() => void>(() => undefined)
  const cancelResizeRef = useRef<(reason: string) => void>(() => undefined)
  cancelResizeRef.current = resizeInteraction.cancel
  const revalidateLayoutObservationRef = useRef<() => boolean>(() => true)
  const cancelPanelHeightTransition = useCallback((settledHeight?: number) => {
    const state = panelHeightTransitionRef.current
    panelHeightTransitionRef.current = { kind: 'idle', settledHeight }
    if (state.kind !== 'animating') return
    state.animation.cancel()
    const panel = asideRef.current
    panel?.removeAttribute('data-picodash-height-motion')
    if (state.blockSize)
      panel?.style.setProperty('block-size', state.blockSize, state.blockSizePriority)
    else panel?.style.removeProperty('block-size')
    if (state.maxBlockSize)
      panel?.style.setProperty('max-block-size', state.maxBlockSize, state.maxBlockSizePriority)
    else panel?.style.removeProperty('max-block-size')
  }, [])
  const cancelPanelMagneticMotion = useCallback(() => {
    pendingPanelMagneticMotionRef.current = null
    const animation = panelMagneticAnimationRef.current
    panelMagneticAnimationRef.current = null
    animation?.stop()
    const panel = asideRef.current
    panel?.style.removeProperty('translate')
    panel?.removeAttribute('data-picodash-magnetic-motion')
  }, [])
  const queuePanelMagneticMotion = (next: DashPanelSnapDragIntent) => {
    const kind = magneticMotionTransition(snapIntentRef.current, next)
    const panel = asideRef.current
    const from = panel
      ? mapRectToContainingBlock(panel, panel.getBoundingClientRect())
      : renderedMappedRef.current
    if (!kind || !from) return
    pendingPanelMagneticMotionRef.current = { kind, from }
  }
  const settledPreferredPosition =
    durableLayout?.preferredPosition ?? resolvedPolicyDefaultLayout.preferredPosition
  const settledLayoutFingerprint = JSON.stringify([
    durableLayout?.manualSize ?? null,
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
        target?.getBoundingClientRect?.() ?? viewportRect(element.ownerDocument),
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
      // A dock FLIP scales the painted box, not the content's intrinsic size.
      // Exclude that owned transform from both measurements before feeding layout again.
      const transform = element.style.getPropertyValue('transform')
      const transformPriority = element.style.getPropertyPriority('transform')
      const layoutMotion = element.hasAttribute('data-picodash-dock-allocation-motion')
      const restoreScroll = capturePanelScrollOffsets(element)
      let panelRect: DOMRect
      let minimumHeight: number
      try {
        if (layoutMotion) element.style.setProperty('transform', 'none', 'important')
        panelRect = measurePreferredPanelRect(element)
        minimumHeight = measureMinimumPanelHeight(element, panelRect.height, panelRect.width)
        const target = resolveDashPanelBoundary(boundary, providerPolicy.boundary)
        const boundaryRect =
          target?.getBoundingClientRect?.() ?? viewportRect(element.ownerDocument)
        const insetBoundary = insetDashPanelRect(boundaryRect, resolvedBoundaryInset)
        const preview = resizePreviewRef.current
        const previewWidth = preview?.axes.includes('width')
          ? preview.rect.width
          : durableLayout?.manualSize?.width
        const previewHeight = preview?.axes.includes('height')
          ? preview.rect.height
          : durableLayout?.manualSize?.height
        const manual =
          previewWidth !== undefined
            ? {
                width: previewWidth,
                ...(previewHeight !== undefined ? { height: previewHeight } : {}),
              }
            : previewHeight !== undefined
              ? { height: previewHeight }
              : undefined
        const position =
          effectivePlacement.disposition.kind === 'docked'
            ? effectivePlacement.disposition.position
            : undefined
        const targetAllocation = position
          ? runtime.resolveDockTarget({ kind: 'settled', scopeId: id, available: insetBoundary })
          : undefined
        const measured = measurePanelSizing(
          element,
          insetBoundary,
          sizingPolicy,
          manual,
          minimumHeight,
          targetAllocation
            ? {
                ...(targetAllocation.allocation !== undefined
                  ? { height: targetAllocation.allocation }
                  : {}),
                ...(targetAllocation.inlineAllocation !== undefined
                  ? { width: targetAllocation.inlineAllocation }
                  : {}),
              }
            : undefined,
          position === 'full-top' || position === 'full-bottom'
            ? (targetAllocation?.inlineAllocation ?? insetBoundary.width)
            : undefined,
        )
        const sizing = measured.sizing
        const next = {
          boundary: insetBoundary,
          minimumHeight: Math.min(minimumHeight, sizing.resolved.height),
          size: measured.unallocatedSize,
          rect: panelRect,
          sizing,
        }
        geometryRef.current = next
        return next
      } finally {
        if (layoutMotion) {
          if (transform) element.style.setProperty('transform', transform, transformPriority)
          else element.style.removeProperty('transform')
        }
        restoreScroll()
      }
    },
    [
      boundary,
      providerPolicy.boundary,
      resolvedBoundaryInset,
      durableLayout?.manualSize,
      effectivePlacement,
      sizingPolicy,
      id,
      runtime,
    ],
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
        (!sameMeasuredLength(previous.boundary.left, next.boundary.left) ||
          !sameMeasuredLength(previous.boundary.top, next.boundary.top) ||
          !sameMeasuredLength(previous.boundary.right, next.boundary.right) ||
          !sameMeasuredLength(previous.boundary.bottom, next.boundary.bottom) ||
          !sameMeasuredLength(previous.size.width, next.size.width) ||
          !sameMeasuredLength(previous.size.height, next.size.height) ||
          !sameMeasuredLength(previous.minimumHeight, next.minimumHeight))
      )
        cancelObservedMoveRef.current()
      setGeometry((current) =>
        current &&
        sameMeasuredLength(current.boundary.left, next.boundary.left) &&
        sameMeasuredLength(current.boundary.top, next.boundary.top) &&
        sameMeasuredLength(current.boundary.right, next.boundary.right) &&
        sameMeasuredLength(current.boundary.bottom, next.boundary.bottom) &&
        sameMeasuredLength(current.size.width, next.size.width) &&
        sameMeasuredLength(current.size.height, next.size.height) &&
        sameMeasuredLength(current.minimumHeight, next.minimumHeight) &&
        sameMeasuredLength(current.rect.left, next.rect.left) &&
        sameMeasuredLength(current.rect.top, next.rect.top) &&
        sameMeasuredLength(current.rect.right, next.rect.right) &&
        sameMeasuredLength(current.rect.bottom, next.rect.bottom) &&
        JSON.stringify(current.sizing) === JSON.stringify(next.sizing)
          ? current
          : next,
      )
    },
    [effectivePlacement, id, measureGeometry, runtime],
  )
  useLayoutEffect(() => {
    refreshGeometry()
  }, [effectivePlacement, panelPortal, refreshGeometry, resizeInteraction.preview])
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
            const panelChanged = entries.some((entry) => entry.target === panel)
            const boundaryChanged =
              entries.length === 0 || entries.some((entry) => entry.target === observedBoundary)
            if (boundaryChanged) {
              if (!panel.hasAttribute('data-picodash-resizing'))
                cancelPanelHeightTransition(panel.getBoundingClientRect().height)
              refreshGeometry()
            } else if (panelChanged && panelHeightTransitionRef.current.kind === 'idle') {
              panelHeightTransitionRef.current = {
                kind: 'idle',
                settledHeight: panel.getBoundingClientRect().height,
              }
              refreshGeometry()
            } else if (entries.some((entry) => entry.target !== panel)) refreshGeometry()
            if (panelChanged && panelHeightTransitionRef.current.kind === 'idle')
              runtime.notifyElementResize(id)
          })
        : undefined
    observer?.observe(panel)
    const naturalContent = panel.querySelector<HTMLElement>('[data-picodash-panel-content]')
    if (naturalContent) {
      observer?.observe(naturalContent)
      for (const child of naturalContent.children) observer?.observe(child)
    }
    if (observedBoundary) observer?.observe(observedBoundary)
    const panelBody = panel.querySelector<HTMLElement>(
      ':scope > [data-picodash-panel-surface] > [data-picodash-panel-body]',
    )
    const contentBoundsActive = Object.values(contentConstraints ?? {}).some(Boolean)
    const refreshLoadedContent = () => {
      if (contentBoundsActive) cancelResizeRef.current('content_constraints_changed')
      refreshGeometry()
    }
    panelBody?.addEventListener('load', refreshLoadedContent, true)
    panelBody?.addEventListener('error', refreshLoadedContent, true)
    panel.ownerDocument.fonts?.addEventListener('loadingdone', refreshLoadedContent)
    panel.ownerDocument.fonts?.addEventListener('loadingerror', refreshLoadedContent)
    const contentObserver =
      panelBody && typeof MutationObserver === 'function'
        ? new MutationObserver(() => {
            if (contentBoundsActive) cancelResizeRef.current('content_constraints_changed')
            for (const child of naturalContent?.children ?? []) observer?.observe(child)
            const state = panelHeightTransitionRef.current
            const renderedHeight = panel.getBoundingClientRect().height
            const fromHeight =
              state.kind === 'animating'
                ? renderedHeight
                : state.kind === 'pending'
                  ? state.fromHeight
                  : (state.settledHeight ?? renderedHeight)
            cancelPanelHeightTransition()
            if (
              panel.hidden ||
              panel.hasAttribute('data-picodash-dragging') ||
              panel.hasAttribute('data-picodash-resizing')
            ) {
              panelHeightTransitionRef.current = { kind: 'idle', settledHeight: renderedHeight }
              refreshGeometry()
              return
            }
            panelHeightTransitionRef.current = { kind: 'pending', fromHeight }
            refreshGeometry()
            setPanelHeightTransitionRevision((revision) => revision + 1)
          })
        : undefined
    if (panelBody && contentObserver) {
      contentObserver.observe(panelBody, {
        attributeFilter: ['data-collapsed', 'hidden'],
        attributes: true,
        characterData: true,
        childList: true,
        subtree: true,
      })
    }
    const ownerDocument = panel.ownerDocument
    const ownerWindow = ownerDocument.defaultView
    const mutationRoot = ownerDocument.documentElement
    const inheritedMutationTargets = new Set<Node>()
    let observedPanelRoot: Node | undefined
    const settledLayoutEvents = [
      'animationcancel',
      'animationend',
      'load',
      'transitioncancel',
      'transitionend',
    ] as const
    const movingLayoutEvents = ['animationstart', 'transitionrun', 'transitionstart'] as const
    const relevantLayoutAncestors = new Set<Node>()
    let observedPanelAncestors: readonly Node[] = []
    let observedPortalAncestors: readonly Node[] = []
    let observedBoundaryAncestors: readonly Node[] = []
    const layoutEventTargets = new Set<EventTarget>()
    const composedHost = (root: unknown): Node | null => {
      if (root === null || typeof root !== 'object' || !('host' in root)) return null
      const host = (root as { readonly host?: unknown }).host
      return host !== null && typeof host === 'object' && 'nodeType' in host ? (host as Node) : null
    }
    const readComposedAncestors = (start: Node | null | undefined) => {
      const ancestors: Node[] = []
      let current = start
      while (current) {
        ancestors.push(current)
        const assignedSlot =
          'assignedSlot' in current
            ? (current as Node & { assignedSlot?: HTMLSlotElement }).assignedSlot
            : null
        if (assignedSlot) {
          current = assignedSlot
          continue
        }
        if (current.parentNode) {
          current = current.parentNode
          continue
        }
        const root = typeof current.getRootNode === 'function' ? current.getRootNode() : undefined
        current = composedHost(root)
      }
      return ancestors
    }
    const sameNodeSequence = (first: readonly Node[], second: readonly Node[]) => {
      if (first.length !== second.length) return false
      return first.every((node, index) => node === second[index])
    }
    const containsTarget = (container: Node | null | undefined, target: EventTarget) => {
      try {
        return container?.contains(target as Node) ?? false
      } catch {
        return false
      }
    }
    const cancelForLayoutMotion = (event: Event) => {
      const origin = event.composedPath()[0] ?? event.target
      if (origin instanceof Node && panel.contains(origin)) return
      if (
        origin !== null &&
        typeof origin === 'object' &&
        relevantLayoutAncestors.has(origin as Node)
      )
        cancelObservedMoveRef.current()
    }
    const refreshForSettledLayout = (event: Event) => {
      // UI's scroll-driven mask cannot change layout. Measuring intrinsic size here would
      // temporarily remove overflow and reset the scroll position that just drove the mask.
      if (
        'animationName' in event &&
        (event.animationName === 'picodash-scroll-fade-start' ||
          event.animationName === 'picodash-scroll-fade-end')
      )
        return
      refreshGeometry()
    }
    const refreshForScroll = (event: Event) => {
      const origin = event.composedPath()[0] ?? event.target
      // Scrolling Panel content does not move its shell or boundary. Intrinsic measurement
      // removes the height cap temporarily, which would reset the content's scroll offset.
      if (origin instanceof Node && panel.contains(origin)) return
      refreshGeometry()
    }
    const addLayoutEventTarget = (target: unknown) => {
      if (
        target !== null &&
        typeof target === 'object' &&
        typeof (target as EventTarget).addEventListener === 'function'
      )
        layoutEventTargets.add(target as EventTarget)
    }
    let rebuildMutationContext = () => undefined
    const slotChangeTargets = new Set<EventTarget>()
    const slotDiscoveryRoots = new Set<Node>()
    const rebuildForSlotChange = () => {
      cancelObservedMoveRef.current()
      rebuildMutationContext()
      refreshGeometry()
    }
    const addSlotChangeTarget = (target: EventTarget) => {
      if (slotChangeTargets.has(target)) return
      target.addEventListener('slotchange', rebuildForSlotChange)
      slotChangeTargets.add(target)
    }
    const addSlotsFromRoot = (root: unknown) => {
      if (
        root === null ||
        typeof root !== 'object' ||
        !('querySelectorAll' in root) ||
        typeof root.querySelectorAll !== 'function'
      )
        return
      if ('nodeType' in root) slotDiscoveryRoots.add(root as unknown as Node)
      for (const slot of root.querySelectorAll('slot')) addSlotChangeTarget(slot)
    }
    const removeLayoutEventListeners = () => {
      for (const target of layoutEventTargets) {
        for (const eventName of settledLayoutEvents)
          target.removeEventListener(eventName, refreshForSettledLayout, true)
        for (const eventName of movingLayoutEvents)
          target.removeEventListener(eventName, cancelForLayoutMotion, true)
      }
      layoutEventTargets.clear()
      for (const target of slotChangeTargets)
        target.removeEventListener('slotchange', rebuildForSlotChange)
      slotChangeTargets.clear()
      slotDiscoveryRoots.clear()
    }
    const rebuildLayoutEventContext = () => {
      removeLayoutEventListeners()
      relevantLayoutAncestors.clear()
      observedPanelAncestors = readComposedAncestors(panel)
      for (const ancestor of observedPanelAncestors) relevantLayoutAncestors.add(ancestor)
      observedPortalAncestors = readComposedAncestors(panelPortal)
      for (const ancestor of observedPortalAncestors) relevantLayoutAncestors.add(ancestor)
      observedBoundaryAncestors = readComposedAncestors(observedBoundary)
      for (const ancestor of observedBoundaryAncestors) relevantLayoutAncestors.add(ancestor)
      addLayoutEventTarget(ownerDocument)
      for (const target of relevantLayoutAncestors) addLayoutEventTarget(target)
      for (const target of relevantLayoutAncestors) {
        if (target.nodeType === 1 && (target as Element).localName === 'slot')
          addSlotChangeTarget(target)
        if (target.nodeType === 11) addSlotsFromRoot(target)
        if (target.nodeType === 1 && 'shadowRoot' in target)
          addSlotsFromRoot((target as Element).shadowRoot)
      }
      for (const target of layoutEventTargets) {
        for (const eventName of settledLayoutEvents)
          target.addEventListener(eventName, refreshForSettledLayout, true)
        for (const eventName of movingLayoutEvents)
          target.addEventListener(eventName, cancelForLayoutMotion, true)
      }
    }
    const mutationObserver =
      mutationRoot && typeof MutationObserver === 'function'
        ? new MutationObserver((records) => {
            const panelChanged = records.some((record) => {
              const target = record.target
              const targetElement =
                target.nodeType === 1 ? (target as Element) : target.parentElement
              return (
                targetElement === panel || (targetElement !== null && panel.contains(targetElement))
              )
            })
            const panelAncestorChanged = records.some((record) => {
              const target = record.target
              const targetElement =
                target.nodeType === 1 ? (target as Element) : target.parentElement
              return targetElement !== null && targetElement.contains(panel)
            })
            const inheritedContextChanged = records.some((record) =>
              inheritedMutationTargets.has(record.target),
            )
            const slotDiscoveryChanged = records.some((record) => {
              if (record.type !== 'childList') return false
              const changedNodes = [...record.addedNodes, ...record.removedNodes]
              if (
                !changedNodes.some(
                  (node) =>
                    node.nodeType === 1 &&
                    ((node as Element).localName === 'slot' ||
                      (node as Element).querySelector('slot') !== null),
                )
              )
                return false
              return [...slotDiscoveryRoots].some(
                (root) => root === record.target || containsTarget(root, record.target),
              )
            })
            const currentPanelRoot =
              typeof panel.getRootNode === 'function' ? panel.getRootNode() : undefined
            const rootChanged = currentPanelRoot !== observedPanelRoot
            const panelAncestorsChanged = !sameNodeSequence(
              observedPanelAncestors,
              readComposedAncestors(panel),
            )
            const portalAncestorsChanged = !sameNodeSequence(
              observedPortalAncestors,
              readComposedAncestors(panelPortal),
            )
            const boundaryAncestorsChanged = !sameNodeSequence(
              observedBoundaryAncestors,
              readComposedAncestors(observedBoundary),
            )
            if (
              rootChanged ||
              panelAncestorsChanged ||
              portalAncestorsChanged ||
              boundaryAncestorsChanged ||
              slotDiscoveryChanged
            )
              rebuildMutationContext()
            if (
              (panelChanged ||
                panelAncestorChanged ||
                inheritedContextChanged ||
                rootChanged ||
                panelAncestorsChanged ||
                portalAncestorsChanged ||
                boundaryAncestorsChanged ||
                slotDiscoveryChanged) &&
              panel.hidden
            ) {
              refreshGeometry()
              mutationObserver?.takeRecords()
            }
            if (
              records.every((record) => {
                const target = record.target
                const targetElement =
                  target.nodeType === 1 ? (target as Element) : target.parentElement
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
    rebuildMutationContext = () => {
      mutationObserver?.disconnect()
      inheritedMutationTargets.clear()
      observedPanelRoot = typeof panel.getRootNode === 'function' ? panel.getRootNode() : undefined
      rebuildLayoutEventContext()
      if (mutationObserver) {
        mutationObserver.observe(panel, mutationOptions)
        if (observedPanelRoot && observedPanelRoot !== ownerDocument) {
          inheritedMutationTargets.add(observedPanelRoot)
          mutationObserver.observe(observedPanelRoot, mutationOptions)
        }
        const observedBoundaryRoot = observedBoundary?.getRootNode?.()
        if (
          observedBoundaryRoot &&
          observedBoundaryRoot !== ownerDocument &&
          observedBoundaryRoot !== observedPanelRoot
        ) {
          inheritedMutationTargets.add(observedBoundaryRoot)
          mutationObserver.observe(observedBoundaryRoot, mutationOptions)
        }
        for (const ancestor of relevantLayoutAncestors) {
          if (ancestor.nodeType !== 11 || inheritedMutationTargets.has(ancestor)) continue
          inheritedMutationTargets.add(ancestor)
          mutationObserver.observe(ancestor, mutationOptions)
        }
        for (const root of slotDiscoveryRoots) {
          if (inheritedMutationTargets.has(root)) continue
          inheritedMutationTargets.add(root)
          mutationObserver.observe(root, mutationOptions)
        }
        let ancestor: Element | null = panel.parentElement
        while (ancestor) {
          inheritedMutationTargets.add(ancestor)
          mutationObserver.observe(ancestor, { attributes: true })
          if (ancestor.parentElement) {
            ancestor = ancestor.parentElement
            continue
          }
          const root =
            typeof ancestor.getRootNode === 'function' ? ancestor.getRootNode() : undefined
          ancestor = composedHost(root) as Element | null
        }
        if (mutationRoot) mutationObserver.observe(mutationRoot, mutationOptions)
      }
    }
    rebuildMutationContext()
    const revalidateLayoutObservation = () => {
      const layoutContextChanged =
        (typeof panel.getRootNode === 'function' ? panel.getRootNode() : undefined) !==
          observedPanelRoot ||
        !sameNodeSequence(observedPanelAncestors, readComposedAncestors(panel)) ||
        !sameNodeSequence(observedPortalAncestors, readComposedAncestors(panelPortal)) ||
        !sameNodeSequence(observedBoundaryAncestors, readComposedAncestors(observedBoundary))
      rebuildMutationContext()
      if (!layoutContextChanged || !moveSession.current) return true
      cancelObservedMoveRef.current()
      refreshGeometry()
      return false
    }
    revalidateLayoutObservationRef.current = revalidateLayoutObservation
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
        (panelHeightTransitionRef.current.kind === 'idle' &&
          !panel.hasAttribute('data-picodash-dock-allocation-motion') &&
          !sameMeasuredRect(trackedPanelRect, nextPanelRect))
      )
        refreshGeometry()
      if (boundaryIdentityChanged) {
        cancelObservedMoveRef.current()
        registration.current?.update({ resolveDockArena })
      }
      trackedBoundary = nextBoundary
      trackedBoundaryRect = nextBoundaryRect
      trackedPanelRect = nextPanelRect
      animationFrame = ownerWindow?.requestAnimationFrame(refreshOnAnimationFrame)
    }
    if (ownerWindow && typeof ownerWindow.addEventListener === 'function') {
      ownerWindow.addEventListener('resize', refreshGeometry)
      ownerWindow.addEventListener('scroll', refreshForScroll, { capture: true, passive: true })
      ownerWindow.visualViewport?.addEventListener('resize', refreshGeometry)
      ownerWindow.visualViewport?.addEventListener('scroll', refreshGeometry)
      if (tracksBoundaryReference && typeof ownerWindow.requestAnimationFrame === 'function')
        animationFrame = ownerWindow.requestAnimationFrame(refreshOnAnimationFrame)
    }
    return () => {
      if (revalidateLayoutObservationRef.current === revalidateLayoutObservation)
        revalidateLayoutObservationRef.current = () => true
      observer?.disconnect()
      contentObserver?.disconnect()
      panelBody?.removeEventListener('load', refreshLoadedContent, true)
      panelBody?.removeEventListener('error', refreshLoadedContent, true)
      panel.ownerDocument.fonts?.removeEventListener('loadingdone', refreshLoadedContent)
      panel.ownerDocument.fonts?.removeEventListener('loadingerror', refreshLoadedContent)
      mutationObserver?.disconnect()
      cancelPanelHeightTransition()
      removeLayoutEventListeners()
      if (ownerWindow && typeof ownerWindow.removeEventListener === 'function') {
        ownerWindow.removeEventListener('resize', refreshGeometry)
        ownerWindow.removeEventListener('scroll', refreshForScroll, true)
        ownerWindow.visualViewport?.removeEventListener('resize', refreshGeometry)
        ownerWindow.visualViewport?.removeEventListener('scroll', refreshGeometry)
        if (animationFrame !== undefined && typeof ownerWindow.cancelAnimationFrame === 'function')
          ownerWindow.cancelAnimationFrame(animationFrame)
      }
    }
  }, [
    boundary,
    cancelPanelHeightTransition,
    contentConstraints,
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
    revalidateLayoutObservationRef.current()
    asideRef.current?.setAttribute('data-picodash-dragging', 'true')
    const preferred = durableLayout?.preferredPosition ?? resolvedDefaultLayout.preferredPosition
    const requested = currentPosition() ?? preferred ?? ({ x: 0, y: 0 } as const)
    const initialGeometry = measureGeometry() ?? geometryRef.current
    const projected = initialGeometry
      ? projectDashPanelPosition(
          {
            x: initialGeometry.boundary.left + requested.x,
            y: initialGeometry.boundary.top + requested.y,
          },
          initialGeometry.size,
          initialGeometry.boundary,
          initialGeometry.minimumHeight,
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
      rawPosition: current,
      initialGeometry,
      startedDocked:
        effectivePlacement.mode === 'hybrid' && effectivePlacement.disposition.kind === 'docked',
      dockDetached: false,
      ...(effectivePlacement.disposition.kind === 'snapped'
        ? { activeSnapTarget: effectivePlacement.disposition.position }
        : {}),
      moved: false,
      sourceFingerprint: JSON.stringify(scoped.getState().scope?.dashPanel ?? null),
    } as const
    moveSession.current = session
    const actual = asideRef.current?.getBoundingClientRect()
    interactions.beginMove(
      actual,
      initialGeometry?.boundary,
      mode === 'keyboard'
        ? 'keyboard'
        : event?.pointerType === 'touch'
          ? 'touch'
          : event?.pointerType === 'pen'
            ? 'pen'
            : 'mouse',
    )
    previewPositionRef.current = current
    const initialSnapIntent: DashPanelSnapDragIntent =
      effectivePlacement.disposition.kind === 'snapped'
        ? {
            kind: 'snapped',
            position: current,
            target: effectivePlacement.disposition.position,
          }
        : { kind: 'free', position: current }
    snapIntentRef.current = initialSnapIntent
    dockIntentRef.current = null
    setPreviewPosition(current)
    setSnapIntent(initialSnapIntent)
    setDockIntent(null)
    setMoveMode(mode)
  }

  const cancelMove = (reason = 'cancelled') => {
    interactions.cancelMove(reason)
    cancelPanelMagneticMotion()
    runtime.setDockAllocationPreview(id, null)
    asideRef.current?.removeAttribute('data-picodash-dragging')
    moveSession.current = null
    previewPositionRef.current = null
    snapIntentRef.current = null
    dockIntentRef.current = null
    setPreviewPosition(null)
    setSnapIntent(null)
    setDockIntent(null)
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
    if (!revalidateLayoutObservationRef.current())
      return { status: 'not_executed' as const, reason: 'unavailable' as const }
    if (session.sourceFingerprint !== JSON.stringify(scoped.getState().scope?.dashPanel ?? null)) {
      cancelMove('metadata_changed')
      return { status: 'not_executed' as const, reason: 'unavailable' as const }
    }
    if (!session.moved) {
      interactions.endMove('unchanged')
      cancelMove()
      return { status: 'executed' as const }
    }
    if (requestedPlacementMode === 'fixed') {
      cancelMove()
      return { status: 'not_executed' as const, reason: 'unavailable' as const }
    }
    if (session.startedDocked && !session.dockDetached) {
      cancelMove()
      return { status: 'executed' as const }
    }
    const latestGeometry = measureGeometry()
    const initialGeometry = session.initialGeometry
    if (
      initialGeometry &&
      (!latestGeometry ||
        !sameMeasuredLength(initialGeometry.boundary.left, latestGeometry.boundary.left) ||
        !sameMeasuredLength(initialGeometry.boundary.top, latestGeometry.boundary.top) ||
        !sameMeasuredLength(initialGeometry.boundary.right, latestGeometry.boundary.right) ||
        !sameMeasuredLength(initialGeometry.boundary.bottom, latestGeometry.boundary.bottom) ||
        !sameMeasuredLength(initialGeometry.size.width, latestGeometry.size.width) ||
        !sameMeasuredLength(initialGeometry.size.height, latestGeometry.size.height) ||
        !sameMeasuredLength(initialGeometry.minimumHeight, latestGeometry.minimumHeight))
    ) {
      cancelMove()
      return { status: 'not_executed' as const, reason: 'unavailable' as const }
    }
    const movableMode = requestedPlacementMode === 'hybrid' ? 'hybrid' : 'floating'
    const currentDockIntent = dockIntentRef.current
    const currentSnapIntent = snapIntentRef.current
    if (currentDockIntent?.kind === 'blocked') {
      cancelMove()
      return { status: 'executed' as const }
    }
    let placement: DashPanelPlacement
    if (movableMode === 'hybrid') {
      if (currentDockIntent?.kind === 'available') {
        placement = {
          mode: 'hybrid',
          disposition: { kind: 'docked', position: currentDockIntent.position },
        }
      } else if (
        (currentSnapIntent?.kind === 'snapped' || currentSnapIntent?.kind === 'resisted') &&
        (currentSnapIntent.target === 'top' || currentSnapIntent.target === 'bottom')
      ) {
        placement = {
          mode: 'hybrid',
          disposition: { kind: 'snapped', position: currentSnapIntent.target },
        }
      } else placement = { mode: 'hybrid', disposition: { kind: 'free' } }
    } else {
      placement =
        currentSnapIntent?.kind === 'snapped' || currentSnapIntent?.kind === 'resisted'
          ? {
              mode: 'floating',
              disposition: { kind: 'snapped', position: currentSnapIntent.target },
            }
          : { mode: 'floating', disposition: { kind: 'free' } }
    }
    const panel = asideRef.current
    if (panel && placement.disposition.kind === 'docked') {
      // Capture the visual release position before replacing the drag's base coordinates.
      pendingDockReleaseRectRef.current = panel.getBoundingClientRect()
      panel.setAttribute('data-picodash-dock-allocation-motion', 'true')
    }
    const result = runtime.setPlacement(id, placement)
    if (result.status !== 'executed') {
      pendingDockReleaseRectRef.current = null
      panel?.removeAttribute('data-picodash-dock-allocation-motion')
    }
    interactions.endMove(
      result.status === 'executed' && result.transaction.ok ? 'accepted' : 'rejected',
    )
    announceDashPanelLayoutFailure('Panel movement', result, announceAction)
    cancelMove()
    return result
  }

  const onMovePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (
      requestedPlacementMode === 'fixed' ||
      event.button !== 0 ||
      moveSession.current ||
      resizeInteraction.active
    )
      return
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    beginMove('pointer', event)
  }

  const onHeaderPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (moveHandle === 'grip') return
    const ownerWindow = event.currentTarget.ownerDocument.defaultView
    if (
      ownerWindow &&
      event.target instanceof ownerWindow.Element &&
      event.target.closest('button, a, input, select, textarea, [role="button"], [role="menuitem"]')
    )
      return
    onMovePointerDown(event)
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
      currentGeometry.minimumHeight,
    )
    const next = {
      x: projected.x - currentGeometry.boundary.left,
      y: projected.y - currentGeometry.boundary.top,
    }
    const moved =
      session.moved || next.x !== session.startPosition.x || next.y !== session.startPosition.y
    if (
      session.startedDocked &&
      !session.dockDetached &&
      Math.hypot(next.x - session.startPosition.x, next.y - session.startPosition.y) <
        resolvedPlacementOptions.detachDistance
    ) {
      const heldIntent = { kind: 'free', position: session.startPosition } as const
      moveSession.current = { ...session, rawPosition: next, moved }
      previewPositionRef.current = session.startPosition
      snapIntentRef.current = heldIntent
      dockIntentRef.current = null
      setPreviewPosition(session.startPosition)
      setSnapIntent(heldIntent)
      setDockIntent(null)
      return
    }
    const movableMode = requestedPlacementMode === 'hybrid' ? 'hybrid' : 'floating'
    const nextSnapIntent = resolveDashPanelSnapDragIntent({
      activeTarget: session.activeSnapTarget,
      boundary: currentGeometry.boundary,
      detachDistance: resolvedPlacementOptions.detachDistance,
      mode: movableMode,
      position: next,
      size: currentGeometry.size,
      snapOffset: resolvedPlacementOptions.snapOffset,
      snapProximity: resolvedPlacementOptions.snapProximity,
    })
    const unresolvedDockIntent =
      movableMode === 'hybrid'
        ? resolveDashPanelHybridDockIntent({
            boundary: currentGeometry.boundary,
            isOccupied: (position) => runtime.isDockPositionOccupied(id, position),
            panel: rectFromDashPanelPosition(
              {
                x: currentGeometry.boundary.left + next.x,
                y: currentGeometry.boundary.top + next.y,
              },
              currentGeometry.size,
            ),
            pointer: { x: event.clientX, y: event.clientY },
            positions: resolvedDockPositions,
            proximity: Math.max(
              resolvedPlacementOptions.snapOffset,
              resolvedPlacementOptions.snapProximity,
            ),
            size: currentGeometry.size,
          })
        : undefined
    const nextDockIntent =
      unresolvedDockIntent?.kind === 'available'
        ? {
            kind: 'available' as const,
            position: unresolvedDockIntent.position,
            rect: dockDashPanelRect(
              unresolvedDockIntent.position,
              currentGeometry.boundary,
              currentGeometry.size,
              runtime.resolveDockTarget({
                kind: 'prospective',
                scopeId: id,
                position: unresolvedDockIntent.position,
                available: currentGeometry.boundary,
              }),
            ),
          }
        : unresolvedDockIntent
    if (movableMode === 'hybrid')
      runtime.setDockAllocationPreview(
        id,
        nextDockIntent?.kind === 'available'
          ? { kind: 'docked', position: nextDockIntent.position }
          : { kind: 'free' },
      )
    queuePanelMagneticMotion(nextSnapIntent)
    moveSession.current = {
      ...session,
      rawPosition: next,
      dockDetached: session.dockDetached || session.startedDocked,
      ...(nextSnapIntent.kind === 'free'
        ? { activeSnapTarget: undefined }
        : { activeSnapTarget: nextSnapIntent.target }),
      moved,
    }
    interactions.updateMove(
      rectFromDashPanelPosition(
        {
          x: currentGeometry.boundary.left + nextSnapIntent.position.x,
          y: currentGeometry.boundary.top + nextSnapIntent.position.y,
        },
        currentGeometry.size,
      ),
      currentGeometry.boundary,
      rectFromDashPanelPosition(
        { x: currentGeometry.boundary.left + next.x, y: currentGeometry.boundary.top + next.y },
        currentGeometry.size,
      ),
    )
    previewPositionRef.current = nextSnapIntent.position
    snapIntentRef.current = nextSnapIntent
    dockIntentRef.current = nextDockIntent ?? null
    setPreviewPosition(nextSnapIntent.position)
    setSnapIntent(nextSnapIntent)
    setDockIntent(nextDockIntent ?? null)
  }

  const onMovePointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const session = moveSession.current
    if (!session || session.mode !== 'pointer' || session.pointerId !== event.pointerId) return
    // Release can contain a newer position than the last delivered/coalesced move sample.
    onMovePointerMove(event)
    commitMove()
    session.captureTarget?.releasePointerCapture?.(event.pointerId)
  }

  const onMovePointerCancel = (event?: ReactPointerEvent<HTMLElement>) => {
    const session = moveSession.current
    if (!session || session.mode !== 'pointer') return
    if (event && session.pointerId !== event.pointerId) return
    cancelMove('pointercancel')
    if (event) session.captureTarget?.releasePointerCapture?.(event.pointerId)
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
    const ownerWindow = asideRef.current?.ownerDocument.defaultView
    if (
      moveMode !== 'pointer' ||
      !ownerWindow ||
      typeof ownerWindow.addEventListener !== 'function' ||
      typeof ownerWindow.removeEventListener !== 'function'
    )
      return
    const move = (event: PointerEvent) =>
      nativeMoveHandlersRef.current.move(event as unknown as ReactPointerEvent<HTMLElement>)
    const up = (event: PointerEvent) =>
      nativeMoveHandlersRef.current.up(event as unknown as ReactPointerEvent<HTMLElement>)
    const cancel = (event: PointerEvent) =>
      nativeMoveHandlersRef.current.cancel(event as unknown as ReactPointerEvent<HTMLElement>)
    ownerWindow.addEventListener('pointermove', move)
    ownerWindow.addEventListener('pointerup', up)
    ownerWindow.addEventListener('pointercancel', cancel)
    return () => {
      ownerWindow.removeEventListener('pointermove', move)
      ownerWindow.removeEventListener('pointerup', up)
      ownerWindow.removeEventListener('pointercancel', cancel)
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
      cancelMove('escape')
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
    const current = session.rawPosition
    const currentGeometry = geometryRef.current
    if (!currentGeometry) return
    const projected = projectDashPanelPosition(
      {
        x: currentGeometry.boundary.left + current.x + dx,
        y: currentGeometry.boundary.top + current.y + dy,
      },
      currentGeometry.size,
      currentGeometry.boundary,
      currentGeometry.minimumHeight,
    )
    const next = {
      x: projected.x - currentGeometry.boundary.left,
      y: projected.y - currentGeometry.boundary.top,
    }
    const moved =
      session.moved || next.x !== session.startPosition.x || next.y !== session.startPosition.y
    if (
      session.startedDocked &&
      !session.dockDetached &&
      Math.hypot(next.x - session.startPosition.x, next.y - session.startPosition.y) <
        resolvedPlacementOptions.detachDistance
    ) {
      const heldIntent = { kind: 'free', position: session.startPosition } as const
      moveSession.current = { ...session, rawPosition: next, moved }
      previewPositionRef.current = session.startPosition
      snapIntentRef.current = heldIntent
      setPreviewPosition(session.startPosition)
      setSnapIntent(heldIntent)
      return
    }
    const movableMode = requestedPlacementMode === 'hybrid' ? 'hybrid' : 'floating'
    const nextSnapIntent = resolveDashPanelSnapDragIntent({
      activeTarget: session.activeSnapTarget,
      boundary: currentGeometry.boundary,
      detachDistance: resolvedPlacementOptions.detachDistance,
      mode: movableMode,
      position: next,
      size: currentGeometry.size,
      snapOffset: resolvedPlacementOptions.snapOffset,
      snapProximity: resolvedPlacementOptions.snapProximity,
    })
    queuePanelMagneticMotion(nextSnapIntent)
    moveSession.current = {
      ...session,
      rawPosition: next,
      dockDetached: session.dockDetached || session.startedDocked,
      ...(nextSnapIntent.kind === 'free'
        ? { activeSnapTarget: undefined }
        : { activeSnapTarget: nextSnapIntent.target }),
      moved,
    }
    interactions.updateMove(
      rectFromDashPanelPosition(
        {
          x: currentGeometry.boundary.left + nextSnapIntent.position.x,
          y: currentGeometry.boundary.top + nextSnapIntent.position.y,
        },
        currentGeometry.size,
      ),
      currentGeometry.boundary,
      rectFromDashPanelPosition(
        { x: currentGeometry.boundary.left + next.x, y: currentGeometry.boundary.top + next.y },
        currentGeometry.size,
      ),
    )
    previewPositionRef.current = nextSnapIntent.position
    snapIntentRef.current = nextSnapIntent
    setPreviewPosition(nextSnapIntent.position)
    setSnapIntent(nextSnapIntent)
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
      nexus: scoped,
      layout: durableLayout,
      onCommand: onRuntimeCommand,
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
      nexus: scoped,
      layout: durableLayout,
      onCommand: onRuntimeCommand,
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
    durableLayout,
    onRuntimeCommand,
  ])

  const collapsed = runtimeState?.collapsed ?? initial.defaultCollapsed
  const currentCollapsible = runtimeState?.collapsible ?? initial.collapsible
  const visible = runtimeState?.visible ?? initial.defaultVisible
  const runtimeSnapshot = runtime.getSnapshot()
  const activeVisiblePanelId = [...runtimeSnapshot.activationOrder]
    .reverse()
    .find((scopeId) => runtimeSnapshot.panels[scopeId]?.visible)
  const panelName = titleText.trim() === '' ? ariaLabel! : titleText
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

  const resolvedStyle = panelStyle(style, width, height)
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
  const dockedMinimizePresentation = renderedDockPosition
    ? resolveDashPanelDockedMinimizePresentation(renderedDockPosition)
    : undefined
  const dockedMinimized = visible && collapsed && dockedMinimizePresentation !== undefined
  const collapseLabel = `${dockedMinimizePresentation ? 'Minimize' : collapsed ? 'Expand' : 'Collapse'} panel ${panelName}`
  const dockTarget =
    geometry && renderedDockPosition
      ? runtime.resolveDockTarget({
          kind: 'settled',
          scopeId: id,
          available: geometry.boundary,
        })
      : undefined
  const settledRenderedRect = geometry
    ? placementRect(
        renderedPlacement,
        geometry.boundary,
        geometry.size,
        geometry.minimumHeight,
        preferredPosition,
        resolvedPlacementOptions.snapOffset,
        dockTarget,
      )
    : null
  const resizePreview = resizeInteraction.preview
  const renderedRect =
    resizePreview && settledRenderedRect
      ? {
          ...settledRenderedRect,
          left: resizePreview.rect.left,
          top: resizePreview.rect.top,
          width: resizePreview.rect.width,
          height: resizePreview.axes.includes('height')
            ? resizePreview.rect.height
            : settledRenderedRect.height,
          right: resizePreview.rect.left + resizePreview.rect.width,
          bottom:
            resizePreview.rect.top +
            (resizePreview.axes.includes('height')
              ? resizePreview.rect.height
              : settledRenderedRect.height),
        }
      : settledRenderedRect
  const renderedSizing = useMemo<DashPanelSizingState | undefined>(() => {
    if (!geometry || !renderedRect) return undefined
    const constraints = [...geometry.sizing.constraints]
    for (const axis of ['width', 'height'] as const) {
      const code = renderedDockPosition ? 'allocation' : 'boundary'
      if (
        Math.abs(renderedRect[axis] - geometry.sizing.resolved[axis]) >= 0.5 &&
        !constraints.some((reason) => reason.axis === axis && reason.code === code)
      )
        constraints.push({ axis, code, limit: renderedRect[axis] })
    }
    return {
      ...geometry.sizing,
      resolved: { width: renderedRect.width, height: renderedRect.height },
      constraints,
    }
  }, [geometry?.sizing, renderedRect?.width, renderedRect?.height])
  useLayoutEffect(() => {
    registration.current?.update({ sizing: renderedSizing })
  }, [renderedSizing])
  const previousLayoutEvent = useRef<{
    rect: DashPanelRect
    boundary: DashPanelRect
    fingerprint: string
  } | null>(null)
  useLayoutEffect(() => {
    if (!renderedRect || !geometry || moveMode || resizeInteraction.active) return
    const previous = previousLayoutEvent.current
    previousLayoutEvent.current = {
      rect: renderedRect,
      boundary: geometry.boundary,
      fingerprint: settledLayoutFingerprint,
    }
    if (!previous || sameMeasuredRect(previous.rect as DOMRect, renderedRect as DOMRect)) return
    const current = {
      x: renderedRect.left - geometry.boundary.left,
      y: renderedRect.top - geometry.boundary.top,
      width: renderedRect.width,
      height: renderedRect.height,
    }
    const initial = {
      x: previous.rect.left - previous.boundary.left,
      y: previous.rect.top - previous.boundary.top,
      width: previous.rect.width,
      height: previous.rect.height,
    }
    const diff = {
      x: current.x - initial.x,
      y: current.y - initial.y,
      width: current.width - initial.width,
      height: current.height - initial.height,
    }
    publishInteraction({
      type: 'layout',
      target: 'panel',
      input: 'automatic',
      reason:
        previous.fingerprint !== settledLayoutFingerprint
          ? 'policy'
          : JSON.stringify(previous.boundary) !== JSON.stringify(geometry.boundary)
            ? 'boundary'
            : 'content',
      geometry: {
        initial,
        requested: {
          ...current,
          width: geometry.sizing.desired.width,
          height: geometry.sizing.desired.height,
        },
        applied: current,
        delta: diff,
        stepDelta: diff,
        constraints: geometry.sizing.constraints.map((reason) => `${reason.axis}:${reason.code}`),
      },
    })
  }, [
    renderedRect?.left,
    renderedRect?.top,
    renderedRect?.width,
    renderedRect?.height,
    moveMode,
    resizeInteraction.active,
    publishInteraction,
    settledLayoutFingerprint,
  ])
  const renderedBoundaryContactEdges =
    renderedDockPosition && renderedRect && geometry
      ? resolveDashPanelBoundaryContact(renderedRect, geometry.boundary)
      : undefined
  const renderedBoundaryContact = renderedBoundaryContactEdges?.join(' ')
  const revealBoundaryContact = dockedMinimizePresentation
    ? (renderedBoundaryContactEdges ?? dockedMinimizePresentation.revealBoundaryContact)
        .filter((edge) => dockedMinimizePresentation.revealBoundaryContact.includes(edge))
        .join(' ')
    : undefined
  const renderedMapped = renderedRect
    ? mapRectToContainingBlock(asideRef.current, renderedRect)
    : null
  const dockAllocationPosition = renderedDockPosition
  const dockAllocationKey = renderedDockPosition
    ? [
        renderedDockPosition,
        dockTarget?.allocation ?? '',
        dockTarget?.offset ?? '',
        dockTarget?.inlineAllocation ?? '',
        dockTarget?.inlineOffset ?? '',
      ].join(':')
    : null
  useLayoutEffect(() => {
    const panel = asideRef.current
    if (!panel) return

    const previousGeometry = dockAllocationGeometryRef.current
    const previousAnimation = dockAllocationAnimationRef.current
    const releaseRect = pendingDockReleaseRectRef.current
    pendingDockReleaseRectRef.current = null
    const restoreTransform = () => {
      panel.style.transform = dockedMinimized
        ? dockedMinimizePresentation.exitTransform
        : (resolvedStyle?.transform ?? '')
    }
    if (!visible || dockedMinimized) {
      previousAnimation?.cancel()
      dockAllocationAnimationRef.current = null
      dockAllocationGeometryRef.current = null
      restoreTransform()
      panel.removeAttribute('data-picodash-dock-allocation-motion')
      return
    }
    const allocationChanged =
      previousGeometry !== null &&
      previousGeometry.position === dockAllocationPosition &&
      previousGeometry.allocationKey !== dockAllocationKey
    if (!allocationChanged && !releaseRect) {
      if (previousAnimation) {
        previousAnimation.cancel()
        dockAllocationAnimationRef.current = null
        restoreTransform()
        panel.removeAttribute('data-picodash-dock-allocation-motion')
      }
      if (!dockAllocationAnimationRef.current) {
        const rect = panel.getBoundingClientRect()
        dockAllocationGeometryRef.current =
          dockAllocationPosition && dockAllocationKey
            ? {
                position: dockAllocationPosition,
                allocationKey: dockAllocationKey,
                rect: {
                  top: rect.top,
                  right: rect.right,
                  bottom: rect.bottom,
                  left: rect.left,
                  width: rect.width,
                  height: rect.height,
                },
              }
            : null
      }
      return
    }
    let fromRect = releaseRect ?? previousGeometry?.rect
    if (previousAnimation) {
      if (!releaseRect) {
        const visualRect = panel.getBoundingClientRect()
        fromRect = {
          top: visualRect.top,
          right: visualRect.right,
          bottom: visualRect.bottom,
          left: visualRect.left,
          width: visualRect.width,
          height: visualRect.height,
        }
      }
      previousAnimation.cancel()
      dockAllocationAnimationRef.current = null
      restoreTransform()
    }
    // Suppress the CSS minimize transition while measuring the new, untransformed dock.
    panel.setAttribute('data-picodash-dock-allocation-motion', 'true')
    const targetRect = panel.getBoundingClientRect()
    const nextGeometry: PanelDockAllocationGeometry | null =
      dockAllocationPosition && dockAllocationKey
        ? {
            position: dockAllocationPosition,
            allocationKey: dockAllocationKey,
            rect: {
              top: targetRect.top,
              right: targetRect.right,
              bottom: targetRect.bottom,
              left: targetRect.left,
              width: targetRect.width,
              height: targetRect.height,
            },
          }
        : null
    dockAllocationGeometryRef.current = nextGeometry

    if (
      !fromRect ||
      !nextGeometry ||
      (!releaseRect && previousGeometry?.position !== nextGeometry.position) ||
      moveMode !== null ||
      dockedMinimized
    ) {
      panel.removeAttribute('data-picodash-dock-allocation-motion')
      return
    }

    if (
      sameMeasuredLength(fromRect.left, targetRect.left) &&
      sameMeasuredLength(fromRect.top, targetRect.top) &&
      sameMeasuredLength(fromRect.width, targetRect.width) &&
      sameMeasuredLength(fromRect.height, targetRect.height)
    ) {
      panel.removeAttribute('data-picodash-dock-allocation-motion')
      return
    }
    const motion = resolveSharedPanelMotion(panel)
    if (!motion || targetRect.width <= 0 || targetRect.height <= 0) {
      panel.removeAttribute('data-picodash-dock-allocation-motion')
      return
    }

    const translateX = fromRect.left - targetRect.left
    const translateY = fromRect.top - targetRect.top
    const scaleX = fromRect.width / targetRect.width
    const scaleY = fromRect.height / targetRect.height
    let animation: ReturnType<typeof animate> | undefined
    animation = animate(
      panel,
      {
        transform: [
          `translate3d(${translateX}px, ${translateY}px, 0) scale(${scaleX}, ${scaleY})`,
          'translate3d(0, 0, 0) scale(1, 1)',
        ],
      },
      {
        duration: motion.duration / 1_000,
        ease: motion.easing,
        onComplete: () => {
          if (dockAllocationAnimationRef.current !== animation) return
          dockAllocationAnimationRef.current = null
          animation.cancel()
          restoreTransform()
          panel.removeAttribute('data-picodash-dock-allocation-motion')
        },
      },
    )
    dockAllocationAnimationRef.current = animation
  }, [
    dockAllocationPosition,
    dockAllocationKey,
    dockedMinimized,
    moveMode,
    visible,
    resolvedStyle?.transform,
  ])
  useLayoutEffect(() => {
    const panel = asideRef.current
    if (!panel || !visible || dockedMinimized || dockAllocationAnimationRef.current) return
    const rect = panel.getBoundingClientRect()
    dockAllocationGeometryRef.current =
      dockAllocationPosition && dockAllocationKey
        ? {
            position: dockAllocationPosition,
            allocationKey: dockAllocationKey,
            rect: {
              top: rect.top,
              right: rect.right,
              bottom: rect.bottom,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            },
          }
        : null
  })
  useEffect(
    () => () => {
      dockAllocationAnimationRef.current?.cancel()
      dockAllocationAnimationRef.current = null
      dockAllocationGeometryRef.current = null
    },
    [],
  )
  useLayoutEffect(() => {
    const pending = pendingPanelMagneticMotionRef.current
    renderedMappedRef.current = renderedMapped
      ? { left: renderedMapped.left, top: renderedMapped.top }
      : null
    if (!pending) return
    pendingPanelMagneticMotionRef.current = null
    const panel = asideRef.current
    if (!panel || !renderedMapped || moveMode === null) return
    const motion = resolvePanelMagneticMotion(panel, pending.kind)
    if (!motion) return
    const offsetX = pending.from.left - renderedMapped.left
    const offsetY = pending.from.top - renderedMapped.top
    if (Math.hypot(offsetX, offsetY) < 0.5) return

    const previousAnimation = panelMagneticAnimationRef.current
    panelMagneticAnimationRef.current = null
    previousAnimation?.stop()
    panel.style.removeProperty('translate')
    panel.setAttribute('data-picodash-magnetic-motion', pending.kind)
    let animation: ReturnType<typeof animate> | undefined
    animation = animate(
      panel,
      {
        translate: [
          `${offsetX}px ${offsetY}px`,
          `${-offsetX * motion.bounce}px ${-offsetY * motion.bounce}px`,
          '0px 0px',
        ],
      },
      {
        duration: motion.duration / 1_000,
        ease: motion.easing,
        times: [0, 0.74, 1],
        onComplete: () => {
          if (panelMagneticAnimationRef.current !== animation) return
          panelMagneticAnimationRef.current = null
          panel.style.removeProperty('translate')
          panel.removeAttribute('data-picodash-magnetic-motion')
        },
      },
    )
    panelMagneticAnimationRef.current = animation
  }, [moveMode, renderedMapped?.left, renderedMapped?.top])
  useEffect(() => cancelPanelMagneticMotion, [cancelPanelMagneticMotion])
  const moveOriginRect =
    geometry && moveMode && moveSession.current
      ? projectDashPanelRect(
          rectFromDashPanelPosition(
            {
              x: geometry.boundary.left + moveSession.current.startPosition.x,
              y: geometry.boundary.top + moveSession.current.startPosition.y,
            },
            geometry.size,
          ),
          geometry.boundary,
          geometry.minimumHeight,
        )
      : null
  const moveOriginMapped = moveOriginRect
    ? mapRectToContainingBlock(asideRef.current, moveOriginRect)
    : null
  const geometryStyle: CSSProperties | undefined =
    renderedRect && renderedMapped
      ? {
          position: 'absolute',
          left: `${moveOriginMapped?.left ?? renderedMapped.left}px`,
          top: `${moveOriginMapped?.top ?? renderedMapped.top}px`,
          ...(moveOriginMapped && renderedMapped
            ? {
                transform: `translate3d(${renderedMapped.left - moveOriginMapped.left}px, ${renderedMapped.top - moveOriginMapped.top}px, 0)`,
              }
            : {}),
          ...(durableLayout?.manualSize?.width !== undefined ||
          resizePreview?.axes.includes('width') ||
          renderedDockPosition === 'full-top' ||
          renderedDockPosition === 'full-bottom' ||
          (geometry && geometry.sizing.resolved.width > geometry.sizing.preferred.width + 0.5)
            ? { inlineSize: `${renderedRect.width}px` }
            : renderedRect.width > 0
              ? { maxInlineSize: `${renderedRect.width}px` }
              : {}),
          ...((!collapsed &&
            (durableLayout?.manualSize?.height !== undefined ||
              (height !== undefined && height !== 'auto') ||
              resizePreview?.axes.includes('height') ||
              (geometry &&
                geometry.sizing.resolved.height > geometry.sizing.preferred.height + 0.5))) ||
          renderedDockPosition === 'full-left' ||
          renderedDockPosition === 'full-right'
            ? { blockSize: `${renderedRect.height}px` }
            : renderedRect.height > 0
              ? { maxBlockSize: `${renderedRect.height}px` }
              : {}),
        }
      : undefined
  const dockedMinimizedStyle: CSSProperties | undefined = dockedMinimized
    ? {
        opacity: 0,
        transform: dockedMinimizePresentation.exitTransform,
      }
    : undefined
  const combinedStyle =
    resolvedStyle || geometryStyle || dockedMinimizedStyle
      ? { ...resolvedStyle, ...geometryStyle, ...dockedMinimizedStyle }
      : undefined
  useLayoutEffect(() => {
    const state = panelHeightTransitionRef.current
    const panel = asideRef.current
    if (state.kind !== 'pending' || !panel) return
    const targetHeight = panel.getBoundingClientRect().height
    const motion = resolveSharedPanelMotion(panel)
    if (
      motion === undefined ||
      panel.hidden ||
      panel.hasAttribute('data-picodash-dragging') ||
      panel.hasAttribute('data-picodash-resizing') ||
      Math.abs(state.fromHeight - targetHeight) < 0.5
    ) {
      panelHeightTransitionRef.current = { kind: 'idle', settledHeight: targetHeight }
      return
    }

    const blockSize = panel.style.getPropertyValue('block-size')
    const blockSizePriority = panel.style.getPropertyPriority('block-size')
    const maxBlockSize = panel.style.getPropertyValue('max-block-size')
    const maxBlockSizePriority = panel.style.getPropertyPriority('max-block-size')
    const transitionHeightLimit = `${Math.max(state.fromHeight, targetHeight)}px`
    panel.style.setProperty('max-block-size', transitionHeightLimit)
    let animation: ReturnType<typeof animate> | undefined
    const settle = () => {
      const current = panelHeightTransitionRef.current
      if (current.kind !== 'animating' || current.animation !== animation) return
      panel.removeAttribute('data-picodash-height-motion')
      if (current.blockSize)
        panel.style.setProperty('block-size', current.blockSize, current.blockSizePriority)
      else panel.style.removeProperty('block-size')
      if (current.maxBlockSize)
        panel.style.setProperty(
          'max-block-size',
          current.maxBlockSize,
          current.maxBlockSizePriority,
        )
      else panel.style.removeProperty('max-block-size')
      panelHeightTransitionRef.current = {
        kind: 'idle',
        settledHeight: current.targetHeight,
      }
      runtime.notifyElementResize(id)
    }
    panel.setAttribute('data-picodash-height-motion', 'true')
    animation = animate(
      panel,
      {
        blockSize: [`${state.fromHeight}px`, `${targetHeight}px`],
        // A geometry render during expansion must not reinstate the collapsed height cap.
        maxBlockSize: [transitionHeightLimit, transitionHeightLimit],
      },
      {
        duration: motion.duration / 1_000,
        ease: motion.easing,
      },
    )
    panelHeightTransitionRef.current = {
      kind: 'animating',
      animation,
      targetHeight,
      blockSize,
      blockSizePriority,
      maxBlockSize,
      maxBlockSizePriority,
    }
    // Mini's option callback runs per property. Restore only after both final styles commit.
    void animation.then(settle)
  }, [geometry, id, panelHeightTransitionRevision, runtime])
  const revealStyle: CSSProperties | undefined =
    dockedMinimizePresentation && renderedMapped && renderedRect
      ? {
          left: `${renderedMapped.left + renderedRect.width * dockedMinimizePresentation.revealAnchor.inline}px`,
          top: `${renderedMapped.top + renderedRect.height * dockedMinimizePresentation.revealAnchor.block}px`,
          transform: `translate3d(${-100 * dockedMinimizePresentation.revealAnchor.inline}%, ${-100 * dockedMinimizePresentation.revealAnchor.block}%, 0)`,
        }
      : undefined
  const dockPreviewRect =
    moveMode === 'pointer' && requestedPlacementMode === 'hybrid'
      ? dockIntent?.kind === 'available'
        ? dockIntent.rect
        : renderedRect
      : null
  const dockPreviewMapped = dockPreviewRect
    ? mapRectToContainingBlock(asideRef.current, dockPreviewRect)
    : null
  const dockPreviewBoundaryContact =
    dockIntent?.kind === 'available' && geometry
      ? resolveDashPanelBoundaryContact(dockIntent.rect, geometry.boundary).join(' ')
      : undefined
  const dockPreviewMotionTarget: PanelDockPreviewMotionTarget | null =
    dockPreviewRect &&
    dockPreviewMapped &&
    geometry &&
    geometry.size.width > 0 &&
    geometry.size.height > 0
      ? {
          opacity: dockIntent?.kind === 'available' ? 1 : 0,
          transform: `translate3d(${dockPreviewMapped.left}px, ${dockPreviewMapped.top}px, 0) scale(${dockPreviewRect.width / geometry.size.width}, ${dockPreviewRect.height / geometry.size.height})`,
        }
      : null
  const dockPreviewStyle: CSSProperties | undefined =
    dockPreviewMotionTarget && geometry
      ? {
          position: 'absolute',
          left: 0,
          top: 0,
          inlineSize: `${geometry.size.width}px`,
          blockSize: `${geometry.size.height}px`,
          opacity: dockPreviewMotionTarget.opacity,
          transform: dockPreviewMotionTarget.transform,
        }
      : undefined
  useLayoutEffect(() => {
    const preview = dockPreviewElementRef.current
    if (!preview || !dockPreviewMotionTarget) {
      dockPreviewAnimationRef.current?.cancel()
      dockPreviewAnimationRef.current = null
      dockPreviewMotionTargetRef.current = null
      dockPreviewReturnRef.current = null
      return
    }

    const previousTarget = dockPreviewMotionTargetRef.current
    dockPreviewMotionTargetRef.current = dockPreviewMotionTarget
    if (!previousTarget) return

    let from = previousTarget
    const previousAnimation = dockPreviewAnimationRef.current
    if (previousAnimation) {
      const computed = preview.ownerDocument.defaultView?.getComputedStyle(preview)
      if (computed) {
        from = {
          opacity: Number(computed.opacity),
          transform: computed.transform,
        }
      }
      previousAnimation.cancel()
      dockPreviewAnimationRef.current = null
    }

    const motion = resolveSharedPanelMotion(preview)
    const returning = dockPreviewMotionTarget.opacity === 0
    if (!returning) dockPreviewReturnRef.current = null
    if (
      !motion ||
      (returning && previousTarget.opacity === 0 && !previousAnimation) ||
      (from.opacity === dockPreviewMotionTarget.opacity &&
        from.transform === dockPreviewMotionTarget.transform)
    ) {
      dockPreviewReturnRef.current = null
      preview.removeAttribute('data-picodash-dock-preview-motion')
      return
    }

    // Retarget a moving destination without resetting the return/fade timeline each frame.
    const now = preview.ownerDocument.defaultView!.performance.now()
    if (returning) {
      dockPreviewReturnRef.current ??= { from, startedAt: now }
      from = dockPreviewReturnRef.current.from
    }
    const elapsed = returning ? now - dockPreviewReturnRef.current!.startedAt : 0
    preview.setAttribute('data-picodash-dock-preview-motion', 'true')
    let animation: ReturnType<typeof animate> | undefined
    animation = animate(
      preview,
      {
        opacity: [from.opacity, dockPreviewMotionTarget.opacity],
        transform: [from.transform, dockPreviewMotionTarget.transform],
      },
      {
        duration: motion.duration / 1_000,
        ease: motion.easing,
        onComplete: () => {
          if (dockPreviewAnimationRef.current !== animation) return
          dockPreviewAnimationRef.current = null
          dockPreviewReturnRef.current = null
          preview.removeAttribute('data-picodash-dock-preview-motion')
        },
      },
    )
    dockPreviewAnimationRef.current = animation
    if (returning) animation.time = Math.min(elapsed, motion.duration) / 1_000
  }, [dockPreviewMotionTarget?.opacity, dockPreviewMotionTarget?.transform])
  useEffect(
    () => () => {
      dockPreviewAnimationRef.current?.cancel()
      dockPreviewAnimationRef.current = null
      dockPreviewMotionTargetRef.current = null
      dockPreviewReturnRef.current = null
    },
    [],
  )
  const labelledProps = textualTitle
    ? {
        ...(ariaLabel === undefined && ariaLabelledBy === undefined
          ? { 'aria-labelledby': headingId }
          : {}),
        ...(ariaLabel === undefined ? {} : { 'aria-label': ariaLabel }),
        ...(ariaLabelledBy === undefined ? {} : { 'aria-labelledby': ariaLabelledBy }),
      }
    : { 'aria-label': ariaLabel }
  const collapseButtonRef = useRef<HTMLButtonElement | null>(null)
  const revealButtonRef = useRef<HTMLButtonElement | null>(null)
  const pendingCollapseFocus = useRef<'minimize' | 'reveal' | null>(null)
  const pendingRestoreFocus = useRef(false)
  useLayoutEffect(() => {
    if (!pendingRestoreFocus.current || durableLayout?.manualSize) return
    pendingRestoreFocus.current = false
    focusPanel(runtime, id)
  }, [durableLayout?.manualSize, id, runtime])
  useLayoutEffect(() => {
    if (pendingCollapseFocus.current === 'reveal' && dockedMinimized) {
      revealButtonRef.current?.focus()
      pendingCollapseFocus.current = null
      return
    }
    if (pendingCollapseFocus.current === 'minimize' && !collapsed) {
      collapseButtonRef.current?.focus()
      pendingCollapseFocus.current = null
    }
  }, [collapsed, dockedMinimized])

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
          onResize={resize === false ? undefined : () => setSizeEditorOpen(true)}
        >
          <PicodashThemeProvider<string> theme={theme} density={density}>
            {dockPreviewStyle ? (
              <div
                ref={dockPreviewElementRef}
                aria-hidden="true"
                data-picodash-panel-dock-preview
                data-picodash-dock-position={dockIntent?.position}
                data-picodash-boundary-contact={dockPreviewBoundaryContact || undefined}
                style={dockPreviewStyle}
              />
            ) : null}
            {dockedMinimizePresentation && revealStyle ? (
              <div
                data-picodash-panel-reveal
                data-picodash-boundary-contact={revealBoundaryContact || undefined}
                data-visible={dockedMinimized ? 'true' : 'false'}
                style={revealStyle}
                inert={!dockedMinimized || undefined}
                aria-hidden={!dockedMinimized || undefined}
              >
                <Button
                  ref={revealButtonRef}
                  aria-label={`Reveal panel ${panelName}`}
                  aria-expanded={false}
                  aria-controls={bodyId}
                  isDisabled={!dockedMinimized}
                  iconOnly
                  variant="ghost"
                  size="sm"
                  onPress={() => {
                    pendingCollapseFocus.current = 'minimize'
                    runtime.expand(id)
                  }}
                >
                  <DockArrowIcon
                    direction={
                      dockedMinimized
                        ? dockedMinimizePresentation.revealDirection
                        : dockedMinimizePresentation.minimizeDirection
                    }
                  />
                </Button>
              </div>
            ) : null}
            <aside
              {...asideProps}
              {...labelledProps}
              ref={setAsideElement}
              className={cn('picodash-dashpanel', className)}
              style={combinedStyle}
              data-picodash-panel
              data-picodash-manually-sized={durableLayout?.manualSize ? 'true' : undefined}
              data-picodash-resize-handles={resizeInteraction.handles}
              data-picodash-resizing={resizeInteraction.activeTarget ?? undefined}
              data-picodash-move-handle-mode={moveHandle}
              data-picodash-size-constrained={
                renderedSizing?.constraints.length ? 'true' : undefined
              }
              data-picodash-placement={
                moveMode
                  ? `${renderedPlacement.mode}-free-preview`
                  : `${effectivePlacement.mode}-${effectivePlacement.disposition.kind}`
              }
              data-visible={visible ? 'true' : 'false'}
              data-active={activeVisiblePanelId === id ? 'true' : undefined}
              data-picodash-magnetic={
                moveMode === 'pointer' && snapIntent?.kind !== 'free' ? snapIntent?.kind : undefined
              }
              data-picodash-dragging={moveMode ? 'true' : undefined}
              data-picodash-dock-intent={
                dockIntent?.kind === 'available' ? dockIntent.position : undefined
              }
              data-picodash-dock-position={renderedDockPosition}
              data-picodash-boundary-contact={renderedBoundaryContact || undefined}
              data-picodash-docked-minimized={dockedMinimized ? 'true' : undefined}
              hidden={!visible}
              inert={!visible || dockedMinimized || undefined}
              aria-hidden={!visible || dockedMinimized || undefined}
              onPointerOver={(event) => {
                asideProps.onPointerOver?.(event)
                interactions.hover('enter', event)
              }}
              onPointerOut={(event) => {
                asideProps.onPointerOut?.(event)
                interactions.hover('leave', event)
              }}
              onBlurCapture={(event) => {
                asideProps.onBlurCapture?.(event)
                interactions.focus('leave', event)
              }}
              onClickCapture={(event) => {
                asideProps.onClickCapture?.(event)
                interactions.pointer('click', event)
              }}
              onFocusCapture={(event) => {
                interactions.focus('enter', event)
                asideProps.onFocusCapture?.(event)
                runtime.activate(id)
                const related = event.relatedTarget
                if (
                  typeof Node !== 'undefined' &&
                  related instanceof Node &&
                  event.currentTarget.contains(related)
                )
                  return
                recordPanelInteraction(runtime, id, related)
              }}
              onPointerDownCapture={(event) => {
                interactions.pointer('down', event)
                asideProps.onPointerDownCapture?.(event)
                runtime.activate(id)
              }}
              onPointerMoveCapture={(event) => {
                asideProps.onPointerMoveCapture?.(event)
                interactions.pointer('move', event)
              }}
              onPointerUpCapture={(event) => {
                asideProps.onPointerUpCapture?.(event)
                interactions.pointer('up', event)
              }}
              onPointerCancelCapture={(event) => {
                asideProps.onPointerCancelCapture?.(event)
                interactions.pointer('cancel', event)
              }}
              onPointerMove={(event) => {
                asideProps.onPointerMove?.(event)
                onMovePointerMove(event)
              }}
              onPointerUp={(event) => {
                asideProps.onPointerUp?.(event)
                onMovePointerUp(event)
              }}
              onPointerCancel={(event) => {
                asideProps.onPointerCancel?.(event)
                onMovePointerCancel(event)
              }}
              onLostPointerCapture={(event) => {
                asideProps.onLostPointerCapture?.(event)
                const session = moveSession.current
                if (session?.mode === 'pointer' && session.pointerId === event.pointerId)
                  cancelMove('capture_lost')
              }}
              data-collapsed={collapsed ? 'true' : 'false'}
            >
              <div data-picodash-panel-surface>
                <DashHeader
                  data-picodash-panel-drag-surface
                  data-disabled={requestedPlacementMode === 'fixed' ? 'true' : undefined}
                  onPointerDown={onHeaderPointerDown}
                  slots={{
                    leading: currentCollapsible ? (
                      <Button
                        ref={collapseButtonRef}
                        aria-label={collapseLabel}
                        aria-expanded={!collapsed}
                        aria-controls={bodyId}
                        iconOnly
                        variant="ghost"
                        size="sm"
                        onPress={() => {
                          if (dockedMinimizePresentation) pendingCollapseFocus.current = 'reveal'
                          runtime.toggleCollapsed(id)
                        }}
                      >
                        {dockedMinimizePresentation ? (
                          <DockArrowIcon
                            direction={
                              dockedMinimized
                                ? dockedMinimizePresentation.revealDirection
                                : dockedMinimizePresentation.minimizeDirection
                            }
                          />
                        ) : (
                          <CollapseIcon collapsed={collapsed} />
                        )}
                      </Button>
                    ) : undefined,
                    title: (
                      <div data-picodash-panel-title-drag-surface>
                        <h2 id={headingId}>{title}</h2>
                        <Button
                          ref={registerMoveHandle}
                          data-picodash-panel-move-handle
                          aria-label={`Move panel ${panelName}`}
                          aria-pressed={moveMode !== null}
                          aria-describedby={moveInstructionsId}
                          isDisabled={requestedPlacementMode === 'fixed'}
                          variant="ghost"
                          onPointerDown={onMovePointerDown}
                          onPointerMoveCapture={onMovePointerMove}
                          onPointerUpCapture={onMovePointerUp}
                          onPointerCancelCapture={onMovePointerCancel}
                          onKeyDown={onMoveKeyDown}
                          data-visible-grip={moveHandle !== 'header' ? 'true' : undefined}
                          onBlur={() => {
                            if (moveSession.current?.mode === 'keyboard') cancelMove()
                          }}
                        >
                          {moveHandle !== 'header' ? (
                            <svg viewBox="0 0 16 16" aria-hidden="true">
                              <path
                                d="M5 3h1m4 0h1M5 8h1m4 0h1M5 13h1m4 0h1"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                              />
                            </svg>
                          ) : null}
                        </Button>
                      </div>
                    ),
                    actions:
                      durableLayout?.manualSize || renderActionMenu ? (
                        <>
                          {durableLayout?.manualSize ? (
                            <Tooltip>
                              <TooltipTrigger>
                                <Button
                                  aria-label="Restore preferred size"
                                  data-picodash-panel-restore-size
                                  iconOnly
                                  variant="ghost"
                                  size="sm"
                                  onPress={() => {
                                    pendingRestoreFocus.current = true
                                    const result = runtime.restorePreferredSize(id)
                                    if (result.status !== 'executed' || !result.transaction.ok)
                                      pendingRestoreFocus.current = false
                                  }}
                                >
                                  {/* Lucide square-dimensions (ISC); see THIRD_PARTY_NOTICES.md. */}
                                  <svg
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                    focusable="false"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <rect width="18" height="18" x="3" y="3" rx="2" />
                                    <path d="M12 7H7v5" />
                                    <path d="M12 17h5v-5" />
                                  </svg>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Restore preferred size</TooltipContent>
                            </Tooltip>
                          ) : null}
                          {renderActionMenu ? (
                            <ActionMenu label={`Actions for ${panelName}`}>
                              {actionMenuChildren}
                            </ActionMenu>
                          ) : null}
                        </>
                      ) : undefined,
                    trailing:
                      showCloseButton || renderedSizing?.constraints.length || resize !== false ? (
                        <div data-picodash-panel-actions>
                          {resize !== false ? (
                            <Tooltip>
                              <TooltipTrigger>
                                <Button
                                  aria-label={`Resize panel ${panelName}`}
                                  data-picodash-panel-resize-button
                                  iconOnly
                                  variant="ghost"
                                  size="sm"
                                  isDisabled={collapsed}
                                  onPress={() => setSizeEditorOpen(true)}
                                >
                                  <svg viewBox="0 0 16 16" aria-hidden="true">
                                    <path
                                      d="M3 7V3h4m2 10h4V9M3 3l4 4m6 6L9 9"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="1.5"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Resize panel</TooltipContent>
                            </Tooltip>
                          ) : null}
                          {renderedSizing?.constraints.length ? (
                            <span
                              data-picodash-panel-size-limit
                              role="img"
                              aria-label="Panel size is constrained"
                              title={renderedSizing.constraints
                                .map((reason) => `${reason.axis}: ${reason.code}`)
                                .join(', ')}
                            >
                              <svg viewBox="0 0 16 16" aria-hidden="true">
                                <path
                                  d="M3 2v12M13 2v12M5 8h6M7 6 5 8l2 2m2-4 2 2-2 2"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                />
                              </svg>
                            </span>
                          ) : null}
                          {showCloseButton ? (
                            <Button
                              aria-label={`Close panel ${panelName}`}
                              iconOnly
                              variant="ghost"
                              size="sm"
                              onPress={() => {
                                const wasVisible =
                                  runtime.getSnapshot().panels[id]?.visible ?? false
                                try {
                                  runtime.hide(id)
                                } finally {
                                  const isVisible =
                                    runtime.getSnapshot().panels[id]?.visible ?? false
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
                              <CloseIcon />
                            </Button>
                          ) : null}
                        </div>
                      ) : undefined,
                  }}
                />
                <div
                  id={bodyId}
                  data-picodash-panel-body
                  data-picodash-scroll-fade
                  hidden={collapsed && !dockedMinimized}
                  inert={collapsed || undefined}
                  aria-hidden={collapsed || undefined}
                >
                  <div data-picodash-panel-content>{children}</div>
                </div>
                {sizeEditorOpen ? (
                  <PanelSizeEditor
                    name={panelName}
                    onClose={() => {
                      setSizeEditorOpen(false)
                      asideRef.current
                        ?.querySelector<HTMLButtonElement>(
                          '[data-slot="dash-header-actions"] button',
                        )
                        ?.focus()
                    }}
                  />
                ) : null}
              </div>
              <div data-picodash-panel-resize-layer>
                {resizeInteraction.targets.map((target) => (
                  <button
                    key={target}
                    type="button"
                    data-picodash-panel-resize-target={target}
                    data-picodash-panel-resize-kind={target.length === 1 ? 'edge' : 'corner'}
                    aria-label={`Resize panel ${panelName} from ${target}`}
                    aria-pressed={resizeInteraction.activeTarget === target}
                    title={`Resize ${target}`}
                    onPointerDown={(event) => resizeInteraction.onPointerDown(target, event)}
                    onLostPointerCapture={resizeInteraction.onLostPointerCapture}
                    onBlur={() => {
                      if (resizeInteraction.activeTarget === target)
                        resizeInteraction.cancel('focus_left')
                    }}
                    onKeyDown={(event) => resizeInteraction.onKeyDown(target, event)}
                  >
                    <span data-picodash-panel-resize-segment="primary" aria-hidden="true" />
                    <span data-picodash-panel-resize-segment="secondary" aria-hidden="true" />
                  </button>
                ))}
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
        </DashPanelActionProvider>
      </DashPanelIdentityProvider>
    </DashPanelPolicyProvider>
  )
  return panelPortal ? createPortal(panelRoot, panelPortal) : panelRoot
})

export const DashPanel = forwardRef<HTMLElement, DashPanelProps<string>>(
  function DashPanel(props, ref) {
    const root = usePicodashRootNexus()
    return (
      <PicodashNexusEntityBoundary nexus={root.scope(props.id)} kind="dashPanel">
        <DashPanelImpl {...props} ref={ref} />
      </PicodashNexusEntityBoundary>
    )
  },
)

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
  const panelIdCounts = new Map<string, number>()
  for (const item of items)
    panelIdCounts.set(item.panelId, (panelIdCounts.get(item.panelId) ?? 0) + 1)
  const itemIds = new Set<string>()
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
        if (item.itemId !== undefined && !item.itemId.trim())
          throw new TypeError('DashPanelLauncher itemId must not be empty.')
        if ((panelIdCounts.get(item.panelId) ?? 0) > 1 && item.itemId === undefined)
          throw new TypeError(
            'DashPanelLauncher items with repeated panelId values require itemId.',
          )
        if (item.itemId !== undefined) {
          if (itemIds.has(item.itemId))
            throw new TypeError('DashPanelLauncher items require unique itemId values.')
          itemIds.add(item.itemId)
        }
        const itemKey = item.itemId === undefined ? `panel:${item.panelId}` : `item:${item.itemId}`
        return (
          <DashPanelTrigger
            key={itemKey}
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
