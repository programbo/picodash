'use client'

import {
  forwardRef,
  useId,
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
  PicodashOverlayProvider,
  PicodashThemeProvider,
} from '@picodash/ui'
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

export type DashPanelStyle = Omit<CSSProperties, 'inlineSize' | 'width'>

export interface DashPanelProviderProps<
  Fields extends PicodashFieldDefinitions = PicodashFieldDefinitions,
  CustomTheme extends string = never,
> {
  children: ReactNode
  store: RootStore<Fields>
  providerId?: string
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
      <PicodashThemeProvider<CustomTheme> theme={theme} density={density}>
        <PicodashOverlayProvider portalContainer={portalContainer} layerBase={layerBase}>
          {children}
        </PicodashOverlayProvider>
      </PicodashThemeProvider>
    </PicodashStoreProviderBoundary>
  )
}

function isTextTitle(value: ReactNode): boolean {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint')
    return true
  if (Array.isArray(value)) return value.every(isTextTitle)
  return false
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
  const scoped = root.scope(id)
  const headingId = `picodash-panel-heading-${useId()}`
  const textualTitle = isTextTitle(title)
  if (!textualTitle && (typeof ariaLabel !== 'string' || ariaLabel.trim() === ''))
    throw new TypeError('DashPanel non-text titles require an explicit aria-label.')

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
    <PicodashStoreEntityBoundary store={scoped} kind="dashPanel">
      <PicodashThemeProvider<string> theme={theme} density={density}>
        <aside
          {...asideProps}
          {...labelledProps}
          ref={ref}
          className={className ? `picodash-dashpanel ${className}` : 'picodash-dashpanel'}
          style={resolvedStyle}
          data-picodash-panel
        >
          <DashHeader slots={{ title: <h2 id={headingId}>{title}</h2> }} />
          <div data-picodash-panel-body>{children}</div>
        </aside>
      </PicodashThemeProvider>
    </PicodashStoreEntityBoundary>
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
