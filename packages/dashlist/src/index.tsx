'use client'

import {
  Fragment,
  createElement,
  forwardRef,
  isValidElement,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ReactElement,
  type MutableRefObject,
  type ReactNode,
} from 'react'
import type {
  PicodashField,
  PicodashFieldDefinitions,
  PicodashJsonValue,
  RootStore,
  ScopedStore,
} from '@picodash/store'
import { PicodashContractError } from '@picodash/store'
import { PicodashStoreEntityBoundary } from '@picodash/store/integration'
import { usePicodashStore } from '@picodash/store/react'
import {
  ActionMenu,
  ActionMenuItem,
  ActionMenuSeparator,
  ActionSubmenu,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogTitle,
  AlertDialogTrigger,
  DashHeader,
  PicodashThemeProvider,
  type PicodashDensity,
  type PicodashThemeOption,
} from '@picodash/ui'
import {
  createNodeRegistry,
  DashListNodeDeclarationBoundary,
  DashListNodeLeafBoundary,
  DashListNodeRegistryProvider,
  DashListNodeValidation,
} from './node-registration.js'
import {
  normalizeBindingDescriptors,
  useDashletBindings,
  type DashletBindingMode,
  type DashletFields,
  type DashletRenderContext,
  type SingleFieldDashletRenderContext,
  type CompoundDashletRenderContext,
  type DashletInputBindingContext,
  type StaleOverwriteController,
} from './bindings.js'
import { DashListAnnouncementContext } from './bindings.js'

export type {
  DashletBindingMode,
  DashletFieldBinding,
  DashletFields,
  DashletRenderContext,
  SingleFieldDashletRenderContext,
  CompoundDashletRenderContext,
  DashletBindingContext,
  DashletInputBindingContext,
  DashletDisplayBindingContext,
  DashletBindingContextFor,
} from './bindings.js'

export type {
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

type AnyStore<Fields extends PicodashFieldDefinitions = PicodashFieldDefinitions> =
  | RootStore<Fields>
  | ScopedStore<Fields>

type NeutralDivProps = Omit<
  ComponentPropsWithRef<'div'>,
  'children' | 'id' | 'title' | 'role' | 'tabIndex' | 'aria-label' | 'aria-labelledby'
>

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

type HeadingProps =
  | { readonly title?: undefined; readonly headingLevel?: never }
  | { readonly title: ReactNode; readonly headingLevel: HeadingLevel }

export type DashListProps<
  Fields extends PicodashFieldDefinitions = PicodashFieldDefinitions,
  CustomTheme extends string = never,
> = NeutralDivProps &
  HeadingProps & {
    readonly children?: ReactNode
    readonly theme?: PicodashThemeOption<CustomTheme>
    readonly density?: PicodashDensity
    readonly 'aria-label'?: string
    readonly 'aria-labelledby'?: string
  } & (
    | { readonly store: RootStore<Fields>; readonly id: string }
    | { readonly store: ScopedStore<Fields>; readonly id?: string }
    | { readonly store?: undefined; readonly id?: string }
  )

type RegisteredNodeNativeProps = Omit<
  ComponentPropsWithRef<'div'>,
  | 'aria-describedby'
  | 'aria-errormessage'
  | 'aria-invalid'
  | 'aria-label'
  | 'aria-labelledby'
  | 'children'
  | 'id'
  | 'role'
  | 'tabIndex'
  | 'title'
>

export type DashGroupProps = RegisteredNodeNativeProps & {
  readonly id: string
  readonly label: ReactNode
  readonly 'aria-label'?: string
  readonly children?: ReactNode
}

type DashletBaseProps = RegisteredNodeNativeProps & {
  readonly id: string
  readonly label?: ReactNode
  readonly 'aria-label'?: string
  readonly description?: ReactNode
  readonly layout?: 'inline' | 'block' | 'full'
  readonly disabled?: boolean
  readonly readOnly?: boolean
}
export type DashletProps<
  TValues extends object = Record<string, PicodashJsonValue>,
  TKey extends Extract<keyof TValues, string> = Extract<keyof TValues, string>,
  TMode extends DashletBindingMode = 'input',
> =
  | (DashletBaseProps & {
      readonly field?: never
      readonly fields?: never
      readonly mode?: never
      readonly children?: ReactNode | ((context: DashletRenderContext) => ReactNode)
    })
  | (DashletBaseProps & {
      readonly field: PicodashField<TValues, TKey>
      readonly fields?: never
      readonly mode?: TMode
      readonly children?:
        | ReactNode
        | ((
            context: SingleFieldDashletRenderContext<TValues[TKey] & PicodashJsonValue, TMode>,
          ) => ReactNode)
    })

export type CompoundDashletProps<
  TValues extends object,
  TFields extends DashletFields<TValues>,
> = DashletBaseProps & {
  readonly field?: never
  readonly fields: TFields
  readonly mode?: never
  readonly children?:
    | ReactNode
    | ((context: CompoundDashletRenderContext<TValues, TFields>) => ReactNode)
}

const declarationMarker = Symbol('picodash.dashlist.declaration')
const listMarker = Symbol('picodash.dashlist.list')
const groupMarker = Symbol('picodash.dashlist.group')
const dashletMarker = Symbol('picodash.dashlist.dashlet')

type DeclarationKind = 'group' | 'dashlet' | 'custom'

function declarationKind(element: ReactElement): DeclarationKind | null {
  const type = element.type as { readonly [declarationMarker]?: string } | string
  if (typeof type === 'string') return null
  if (type[declarationMarker] === 'group') return 'group'
  if (type[declarationMarker] === 'dashlet') return 'dashlet'
  if (type[declarationMarker] === 'list') return null
  // Custom declarations are accepted by the public grammar. Their committed
  // registration and forwarded ID are validated by the later integration cut.
  return 'custom'
}

function flattenDeclarations(children: ReactNode, owner: 'list' | 'group'): ReactElement[] {
  const result: ReactElement[] = []
  const visit = (child: ReactNode): void => {
    if (child === null || child === undefined || typeof child === 'boolean') return
    if (Array.isArray(child)) {
      child.forEach(visit)
      return
    }
    if (!isValidElement(child))
      throw new TypeError(
        `Dash${owner === 'list' ? 'List' : 'Group'} children must be Dashlet or DashGroup declarations.`,
      )
    if (child.type === Fragment) {
      visit((child.props as { readonly children?: ReactNode }).children)
      return
    }
    const kind = declarationKind(child)
    if (kind === null)
      throw new TypeError(
        `Dash${owner === 'list' ? 'List' : 'Group'} children cannot be DOM elements or text wrappers.`,
      )
    if (owner === 'group' && kind === 'group')
      throw new TypeError('DashGroup cannot contain another DashGroup.')
    result.push(child)
  }
  visit(children)
  return result
}

function wrapDeclaration(
  declaration: ReactElement,
  owner: 'list' | 'group',
  key: string,
): ReactElement {
  const kind = declarationKind(declaration)
  if (kind === null) throw new TypeError('DashList declaration cannot be a nested DashList.')
  const id = (declaration.props as { readonly id?: unknown }).id
  return createElement(DashListNodeDeclarationBoundary, { key, id, kind, owner }, declaration)
}

function isTextLabel(value: ReactNode): boolean {
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'number' || typeof value === 'bigint') return true
  if (Array.isArray(value)) return value.length > 0 && value.every(isTextLabel)
  return false
}

function requireAccessibleLabel(
  label: ReactNode,
  ariaLabel: string | undefined,
  component: 'DashGroup' | 'Dashlet',
): void {
  if (isTextLabel(label)) return
  if (typeof ariaLabel === 'string' && ariaLabel.trim().length > 0) return
  throw new TypeError(`${component} non-text labels require an explicit aria-label.`)
}

function useOptionalStore<Fields extends PicodashFieldDefinitions>(): AnyStore<Fields> | null {
  try {
    return usePicodashStore() as AnyStore<Fields>
  } catch (error) {
    if (error instanceof PicodashContractError && error.code === 'missing-store-context')
      return null
    throw error
  }
}

function resolveStore<Fields extends PicodashFieldDefinitions>(
  explicitStore: AnyStore<Fields> | undefined,
  contextStore: AnyStore<Fields> | null,
  id: string | undefined,
): { readonly store: ScopedStore<Fields>; readonly standalone: boolean; readonly scopeId: string } {
  const suppliedRoot = explicitStore?.kind === 'root' ? explicitStore : explicitStore?.root
  const contextRoot = contextStore?.kind === 'root' ? contextStore : contextStore?.root
  if (explicitStore && contextRoot && suppliedRoot !== contextRoot)
    throw new TypeError('DashList store does not agree with the nearest Store context.')

  const source = explicitStore ?? contextStore
  if (!source)
    throw new PicodashContractError('missing-store-context', { required: 'root-or-scoped' })
  if (source.kind === 'root') {
    if (id === undefined) throw new TypeError('DashList requires id when resolving a root Store.')
    return { store: source.scope(id), standalone: contextStore === null, scopeId: id }
  }
  if (explicitStore?.kind === 'scoped' && id !== undefined && id !== source.scopeId)
    throw new TypeError('DashList scoped Store and id must name the same scope.')
  if (!explicitStore && id !== undefined && id !== source.scopeId)
    return { store: source.root.scope(id), standalone: contextStore === null, scopeId: id }
  return { store: source, standalone: contextStore === null, scopeId: source.scopeId }
}

function immutableIdentity<Fields extends PicodashFieldDefinitions>(
  identityRef: MutableRefObject<{
    readonly store: AnyStore<Fields>
    readonly scopeId: string
  } | null>,
  store: AnyStore<Fields>,
  scopeId: string,
): void {
  if (identityRef.current === null) {
    identityRef.current = { store, scopeId }
    return
  }
  if (identityRef.current.store !== store || identityRef.current.scopeId !== scopeId)
    throw new TypeError('DashList Store and id are immutable while mounted.')
}

function classNames(base: string, className: string | undefined): string {
  return className ? `${base} ${className}` : base
}

function StaleInputConfirmation({
  disabled,
  readOnly,
  controller,
}: {
  readonly disabled: boolean
  readonly readOnly: boolean
  readonly controller: StaleOverwriteController
}) {
  const [plan, setPlan] = useState<Parameters<StaleOverwriteController['executePlan']>[0] | null>(
    null,
  )
  const triggerRef = useRef<HTMLButtonElement>(null)
  const open = plan !== null
  const openPlan = () => {
    if (disabled || readOnly) return
    const next = controller.openPlan()
    if (next) setPlan(next)
  }
  return (
    <>
      <button ref={triggerRef} type="button" disabled={disabled || readOnly} onClick={openPlan}>
        Overwrite value…
      </button>
      {plan ? (
        <AlertDialog
          isOpen={open}
          onOpenChange={(next) => {
            if (!next) {
              setPlan(null)
              if (typeof requestAnimationFrame === 'function')
                requestAnimationFrame(() => triggerRef.current?.focus())
            }
          }}
        >
          <AlertDialogTrigger aria-label="Stale value confirmation" style={{ display: 'none' }} />
          <AlertDialogOverlay>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Overwrite the current value?</AlertDialogTitle>
                <AlertDialogDescription>
                  The application changed this value while you had draft changes. Overwriting keeps
                  your draft and replaces the current canonical value.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onPress={() => setPlan(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  isDisabled={disabled || readOnly}
                  onPress={() => {
                    const currentPlan = plan
                    setPlan(null)
                    controller.executePlan(currentPlan)
                  }}
                >
                  Overwrite value
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialogOverlay>
        </AlertDialog>
      ) : null}
    </>
  )
}

const DashletImpl = forwardRef<HTMLDivElement, DashletProps<any> | CompoundDashletProps<any, any>>(
  function Dashlet(props: any, ref) {
    const {
      id,
      label,
      'aria-label': ariaLabel,
      description,
      layout = 'inline',
      disabled = false,
      readOnly = false,
      field,
      fields,
      mode,
      children,
      className,
      ...nativeProps
    } = props
    requireAccessibleLabel(label, ariaLabel, 'Dashlet')
    const labelId = `picodash-dashlet-label-${useId()}`
    const descriptionIdToken = useId()
    const descriptionId =
      description === undefined ? undefined : `picodash-dashlet-description-${descriptionIdToken}`
    const controlId = `picodash-dashlet-control-${useId()}`
    const commonIssuesId = `${labelId}-issues`
    const bindingIssuesId = `${labelId}-binding-issues`
    const bindingStore = useOptionalStore<PicodashFieldDefinitions>()
    const descriptors = useMemo(
      () =>
        normalizeBindingDescriptors(field as never, fields as never).map((descriptor) => ({
          ...descriptor,
          mode: field && mode ? mode : descriptor.mode,
        })),
      [field, fields, mode],
    )
    const bindingRuntime = useDashletBindings(
      bindingStore as ScopedStore<PicodashFieldDefinitions>,
      id,
      descriptors,
      disabled,
      readOnly,
      controlId,
      bindingIssuesId,
    )
    const renderContext: any = {
      id,
      disabled,
      readOnly,
      labelId,
      ...(descriptionId ? { descriptionId } : {}),
      issues: bindingRuntime.issues,
      ...(bindingRuntime.issues.length ? { issuesId: commonIssuesId } : {}),
    }
    if (descriptors.length === 1)
      renderContext.binding = bindingRuntime.bindings[descriptors[0]!.alias]
    else if (descriptors.length > 1) renderContext.bindings = bindingRuntime.bindings
    const renderedChildren =
      typeof children === 'function' ? children(renderContext as never) : children
    const inputBindings = Object.values(bindingRuntime.bindings).filter(
      (binding): binding is DashletInputBindingContext<PicodashJsonValue> =>
        'mode' in binding && binding.mode === 'input',
    )
    return (
      <DashListNodeLeafBoundary id={id} kind="dashlet">
        <div
          {...nativeProps}
          ref={ref}
          id={undefined}
          role="listitem"
          className={classNames('picodash-dashlist-item', className)}
          data-picodash-dashlet={id}
        >
          <div
            role="group"
            tabIndex={-1}
            aria-label={ariaLabel}
            aria-labelledby={isTextLabel(label) ? labelId : undefined}
            aria-describedby={descriptionId}
            aria-invalid={bindingRuntime.issues.length ? true : undefined}
            aria-errormessage={bindingRuntime.issues.length ? commonIssuesId : undefined}
            data-layout={layout}
            data-read-only={readOnly ? 'true' : 'false'}
            data-picodash-dashlet-shell
          >
            {label !== undefined ? (
              <span id={labelId} data-picodash-dashlet-label>
                {label}
              </span>
            ) : null}
            <div data-picodash-dashlet-content>{renderedChildren}</div>
            {description !== undefined ? (
              <div id={descriptionId} data-picodash-dashlet-description>
                {description}
              </div>
            ) : null}
            {Object.values(bindingRuntime.bindings).map((binding) =>
              binding.issuesId ? (
                <div
                  key={binding.alias}
                  id={binding.issuesId}
                  data-picodash-dashlet-binding-issues={binding.alias}
                >
                  {binding.issues.map((issue, issueIndex) => (
                    <div key={`${issue.code}-${issue.reason ?? ''}-${issueIndex}`}>
                      {issue.message}
                    </div>
                  ))}
                </div>
              ) : null,
            )}
            {inputBindings.map((binding) =>
              binding.dirty ? (
                <div key={`${binding.alias}-actions`} data-picodash-dashlet-actions>
                  <button type="button" disabled={disabled} onClick={() => binding.discardInput()}>
                    Discard changes
                  </button>
                  {binding.stale ? (
                    <StaleInputConfirmation
                      disabled={disabled}
                      readOnly={readOnly}
                      controller={bindingRuntime.staleOverwrite[binding.alias]!}
                    />
                  ) : null}
                </div>
              ) : null,
            )}
            {bindingRuntime.issues.length ? (
              <div id={commonIssuesId} data-picodash-dashlet-issues>
                {bindingRuntime.issues.map((issue, issueIndex) => (
                  <div key={`${issue.code}-${issue.reason ?? ''}-${issueIndex}`}>
                    {issue.message}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </DashListNodeLeafBoundary>
    )
  },
)

const DashGroupImpl = forwardRef<HTMLDivElement, DashGroupProps>(function DashGroup(
  { id, label, 'aria-label': ariaLabel, children, className, ...props },
  ref,
) {
  requireAccessibleLabel(label, ariaLabel, 'DashGroup')
  const declarations = flattenDeclarations(children, 'group')
  const labelId = `picodash-dashgroup-label-${useId()}`
  return (
    <DashListNodeLeafBoundary id={id} kind="group">
      <div
        {...props}
        ref={ref}
        role="listitem"
        className={classNames('picodash-dashlist-item picodash-dashlist-group-item', className)}
        data-picodash-dashgroup={id}
      >
        <div
          role="group"
          aria-label={ariaLabel}
          aria-labelledby={isTextLabel(label) ? labelId : undefined}
          data-picodash-dashgroup
        >
          <div id={labelId} data-picodash-dashgroup-label>
            {label}
          </div>
          <div role="list" data-picodash-dashgroup-list>
            {declarations.map((declaration, index) =>
              createElement(
                Fragment,
                { key: declaration.key ?? `${id}-${index}` },
                wrapDeclaration(declaration, 'group', `${id}-${index}`),
              ),
            )}
          </div>
        </div>
      </div>
    </DashListNodeLeafBoundary>
  )
})

const DashListImpl = forwardRef<HTMLDivElement, DashListProps>(function DashList(
  {
    id,
    store: explicitStore,
    title,
    headingLevel,
    children,
    theme,
    density,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    className,
    ...props
  },
  ref,
) {
  if (title === undefined && headingLevel !== undefined)
    throw new TypeError('DashList headingLevel requires title.')
  if (title !== undefined && headingLevel === undefined)
    throw new TypeError('DashList title requires headingLevel.')
  if (
    headingLevel !== undefined &&
    (!Number.isInteger(headingLevel) || headingLevel < 1 || headingLevel > 6)
  )
    throw new TypeError('DashList headingLevel must be an integer from 1 through 6.')
  const contextStore = useOptionalStore<PicodashFieldDefinitions>()
  const resolved = resolveStore(explicitStore, contextStore, id)
  const identityRef = useRef<{
    readonly store: AnyStore<PicodashFieldDefinitions>
    readonly scopeId: string
  } | null>(null)
  immutableIdentity(identityRef, resolved.store, resolved.scopeId)
  const declarations = flattenDeclarations(children, 'list')
  const registryRef = useRef<ReturnType<typeof createNodeRegistry> | undefined>(undefined)
  if (registryRef.current === undefined) registryRef.current = createNodeRegistry()
  const registry = registryRef.current
  const headingIdToken = useId()
  const headingId = title === undefined ? undefined : `picodash-dashlist-heading-${headingIdToken}`
  const statusId = `picodash-dashlist-status-${useId()}`
  const [announcement, setAnnouncement] = useState('')
  const listName = ariaLabelledBy ?? (title === undefined ? undefined : headingId)
  return (
    <PicodashThemeProvider theme={theme} density={density}>
      <PicodashStoreEntityBoundary
        store={resolved.store}
        kind="dashList"
        allowStandalone={resolved.standalone}
      >
        <DashListAnnouncementContext.Provider value={setAnnouncement}>
          <DashListNodeRegistryProvider registry={registry}>
            <DashListNodeValidation>
              <div
                {...props}
                ref={ref}
                className={classNames('picodash-dashlist', className)}
                data-picodash-dashlist
              >
                {title !== undefined ? (
                  <DashHeader
                    slots={{ title: createElement(`h${headingLevel}`, { id: headingId }, title) }}
                  />
                ) : null}
                <div
                  role="list"
                  aria-label={ariaLabel}
                  aria-labelledby={listName}
                  data-picodash-dashlist-list
                >
                  {declarations.map((declaration, index) =>
                    createElement(
                      Fragment,
                      { key: declaration.key ?? `${resolved.scopeId}-${index}` },
                      wrapDeclaration(declaration, 'list', `${resolved.scopeId}-${index}`),
                    ),
                  )}
                </div>
                <div id={statusId} role="status" aria-live="polite" aria-atomic="true">
                  {announcement}
                </div>
              </div>
            </DashListNodeValidation>
          </DashListNodeRegistryProvider>
        </DashListAnnouncementContext.Provider>
      </PicodashStoreEntityBoundary>
    </PicodashThemeProvider>
  )
})

export const DashList = DashListImpl as unknown as <
  Fields extends PicodashFieldDefinitions = PicodashFieldDefinitions,
  CustomTheme extends string = never,
>(
  props: DashListProps<Fields, CustomTheme>,
) => ReactElement | null
export const DashGroup = DashGroupImpl as typeof DashGroupImpl
export const Dashlet = DashletImpl as unknown as <
  TValues extends object = Record<string, PicodashJsonValue>,
  TKey extends Extract<keyof TValues, string> = Extract<keyof TValues, string>,
  TMode extends DashletBindingMode = 'input',
  TFields extends DashletFields<TValues> = DashletFields<TValues>,
>(
  props: DashletProps<TValues, TKey, TMode> | CompoundDashletProps<TValues, TFields>,
) => ReactElement | null

Object.assign(DashList, { [declarationMarker]: 'list', [listMarker]: true })
Object.assign(DashGroup, { [declarationMarker]: 'group', [groupMarker]: true })
Object.assign(Dashlet, { [declarationMarker]: 'dashlet', [dashletMarker]: true })

export { ActionMenu, ActionMenuItem, ActionMenuSeparator, ActionSubmenu, DashHeader }
