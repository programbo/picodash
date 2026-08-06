'use client'

import {
  forwardRef,
  useId,
  useEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactNode,
} from 'react'
import type { PicodashFieldDefinitions, RootStore } from '@picodash/store'
import {
  PicodashStoreEntityBoundary,
  PicodashStoreProviderBoundary,
} from '@picodash/store/integration'
import { usePicodashRootStore } from '@picodash/store/react'
import {
  ActionMenu,
  ActionMenuItem,
  ActionMenuSeparator,
  ActionSubmenu,
  DashHeader,
  Button,
  PicodashOverlayProvider,
  PicodashThemeProvider,
} from '@picodash/ui'
import type { PanelRuntimeRegistration } from './runtime/panel-runtime.ts'
import {
  DashPanelPolicyBoundary,
  DashPanelPolicyProvider,
} from './runtime/panel-policy-context.tsx'
import { DashPanelProviderPolicyProvider } from './runtime/provider-policy-context.tsx'
import type { DashPanelBoundary, DashPanelBoundaryInset } from './geometry/boundary.ts'
import {
  DashPanelRuntimeProvider,
  useDashPanelRuntime,
  useDashPanelRuntimeState,
} from './runtime/panel-runtime-context.tsx'
import type {
  ActionMenuConfirmation,
  ActionMenuItemProps,
  ActionMenuItemVariant,
  ActionMenuProps,
  ActionMenuSeparatorProps,
  ActionSubmenuProps,
  DashHeaderProps,
  DashHeaderSlots,
  PicodashDensity,
  PicodashThemeOption,
} from '@picodash/ui'
import type { DashPanelDockPosition } from './placement/placement.ts'

export type {
  DashPanelDefaultLayout,
  DashPanelDockPosition,
  DashPanelPlacement,
  DashPanelPlacementOptions,
  DashPanelPresentation,
  DashPanelSnapPosition,
} from './placement/placement.ts'

export type { DashPanelBoundary, DashPanelBoundaryInset } from './geometry/boundary.ts'

export type DashPanelStyle = Omit<CSSProperties, 'inlineSize' | 'width'>

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
  'children' | 'id' | 'style' | 'title'
> {
  id: string
  title: ReactNode
  children?: ReactNode
  style?: DashPanelStyle
  width?: CSSProperties['width']
  boundary?: DashPanelBoundary | null
  boundaryInset?: DashPanelBoundaryInset
  dockPositions?: readonly DashPanelDockPosition[]
  defaultCollapsed?: boolean
  collapsible?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  theme?: PicodashThemeOption<CustomTheme>
  density?: PicodashDensity
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

function assertPanelStyle(style: DashPanelStyle | undefined): void {
  if (!style) return
  if (Object.prototype.hasOwnProperty.call(style, 'width'))
    throw new TypeError('DashPanel style.width is reserved; use the width prop instead.')
  if (Object.prototype.hasOwnProperty.call(style, 'inlineSize'))
    throw new TypeError('DashPanel style.inlineSize is reserved; use the width prop instead.')
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
    defaultCollapsed,
    collapsible,
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
  const runtimeState = useDashPanelRuntimeState(id)
  const scoped = root.scope(id)
  const headingId = `picodash-panel-heading-${useId()}`
  const bodyId = `picodash-panel-body-${useId()}`
  const textualTitle = isTextTitle(title)
  if (!textualTitle && (typeof ariaLabel !== 'string' || ariaLabel.trim() === ''))
    throw new TypeError('DashPanel non-text titles require an explicit aria-label.')

  const generation = useRef<{
    readonly scopeId: string
    readonly defaultCollapsed: boolean
    readonly collapsible: boolean
  } | null>(null)
  if (generation.current === null || generation.current.scopeId !== id) {
    const initialCollapsed = defaultCollapsed ?? false
    const initialCollapsible = collapsible ?? true
    if (initialCollapsed && !initialCollapsible)
      throw new TypeError('A non-collapsible Panel cannot start collapsed.')
    generation.current = {
      scopeId: id,
      defaultCollapsed: initialCollapsed,
      collapsible: initialCollapsible,
    }
  }
  const initial = generation.current
  const registration = useRef<PanelRuntimeRegistration | null>(null)
  useEffect(() => {
    const current = generation.current
    if (current === null || current.scopeId !== id) return
    const next = runtime.acquire({
      scopeId: id,
      defaultCollapsed: current.defaultCollapsed,
      collapsible: current.collapsible,
      onCollapsedChange,
    })
    registration.current = next
    return () => {
      next.release()
      if (registration.current === next) registration.current = null
    }
  }, [id, runtime])
  useEffect(() => {
    registration.current?.update({ collapsible, onCollapsedChange })
  }, [collapsible, onCollapsedChange])

  const collapsed = runtimeState?.collapsed ?? initial.defaultCollapsed
  const currentCollapsible = runtimeState?.collapsible ?? initial.collapsible
  const panelName = textualTitle ? textTitle(title) : ariaLabel!
  const collapseLabel = `${collapsed ? 'Expand' : 'Collapse'} panel ${panelName}`

  const resolvedStyle = panelStyle(style, width)
  const labelledProps = textualTitle
    ? {
        ...(ariaLabel === undefined && ariaLabelledBy === undefined
          ? { 'aria-labelledby': headingId }
          : {}),
        ...(ariaLabel === undefined ? {} : { 'aria-label': ariaLabel }),
        ...(ariaLabelledBy === undefined ? {} : { 'aria-labelledby': ariaLabelledBy }),
      }
    : { 'aria-label': ariaLabel }

  return (
    <DashPanelPolicyProvider
      boundary={boundary}
      boundaryInset={boundaryInset}
      dockPositions={dockPositions}
    >
      <PicodashStoreEntityBoundary store={scoped} kind="dashPanel">
        <PicodashThemeProvider<string> theme={theme} density={density}>
          <aside
            {...asideProps}
            {...labelledProps}
            ref={ref}
            className={className ? `picodash-dashpanel ${className}` : 'picodash-dashpanel'}
            style={resolvedStyle}
            data-picodash-panel
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
          </aside>
        </PicodashThemeProvider>
      </PicodashStoreEntityBoundary>
    </DashPanelPolicyProvider>
  )
})

export const DashPanel = DashPanelImpl

export { ActionMenu, ActionMenuItem, ActionMenuSeparator, ActionSubmenu, DashHeader }

export type {
  ActionMenuConfirmation,
  ActionMenuItemProps,
  ActionMenuItemVariant,
  ActionMenuProps,
  ActionMenuSeparatorProps,
  ActionSubmenuProps,
  DashHeaderProps,
  DashHeaderSlots,
}
