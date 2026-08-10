'use client'

import {
  Fragment,
  createElement,
  forwardRef,
  isValidElement,
  createContext,
  useContext,
  useEffect,
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
import { usePicodashStore, usePicodashStoreSelector } from '@picodash/store/react'
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
import {
  createDashListActionRegistry,
  DashListActionItems,
  DashListActionRegistryContext,
  DashListCollapseAllItem,
  DashListExpandAllItem,
  DashListResetListItem,
  DashListResetSubmenu,
  DashListResetValuesItem,
  useDashListActions,
  type DashListActionProps,
  type DashListActions,
  type DashListActionAvailability,
  type DashListActionController,
  type DashListActionExecutionResult,
  type DashListActionStoreResult,
} from './actions.js'
import {
  candidateOrder,
  createOrderingState,
  transitionOrdering,
  type OrderingNode,
  type OrderingState,
} from './ordering/index.ts'

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

export {
  DashListActionItems,
  DashListCollapseAllItem,
  DashListExpandAllItem,
  DashListResetListItem,
  DashListResetSubmenu,
  DashListResetValuesItem,
  useDashListActions,
}
export type {
  DashListActionAvailability,
  DashListActionController,
  DashListActionExecutionResult,
  DashListActionStoreResult,
  DashListActionProps,
  DashListActions,
}

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
    readonly reorderable?: boolean
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
  readonly collapsible?: boolean
  readonly defaultCollapsed?: boolean
  readonly reorderable?: boolean
  readonly pin?: 'start' | 'end'
  readonly disabled?: boolean
  readonly readOnly?: boolean
}

type DashletBaseProps = RegisteredNodeNativeProps & {
  readonly id: string
  readonly label?: ReactNode
  readonly 'aria-label'?: string
  readonly description?: ReactNode
  readonly layout?: 'inline' | 'block' | 'full'
  readonly disabled?: boolean
  readonly readOnly?: boolean
  readonly pin?: 'start' | 'end'
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

function declarationIdentity(declaration: ReactElement, fallback: string): string {
  const value = (declaration.props as { readonly id?: unknown }).id
  return typeof value === 'string' ? value : fallback
}

type OrderingCoordinator = { readonly active: MutableRefObject<boolean> }
type OrderingController = {
  readonly coordinator: OrderingCoordinator
  readonly ordering: OrderingState['ordering']
  readonly candidate: readonly string[]
  readonly session: OrderingState['session']
  readonly canHandle: (id: string) => boolean
  readonly start: (id: string) => void
  readonly move: (direction: 'up' | 'down' | 'home' | 'end') => void
  readonly commit: () => void
  readonly cancel: () => void
  readonly blur: (id: string) => void
  readonly pointerDown: (id: string, event: PointerLike) => void
  readonly pointerMove: (event: PointerLike) => void
  readonly pointerUp: (event: { readonly pointerId?: number }) => void
  readonly pointerCancel: (event: { readonly pointerId?: number }) => void
}

type PointerLike = {
  readonly pointerId?: number
  readonly clientY?: number
  readonly setPointerCapture?: (pointerId: number) => void
  readonly releasePointerCapture?: (pointerId: number) => void
}

const DashListOrderingContext = createContext<OrderingController | null>(null)
const DashListOrderingCoordinatorContext = createContext<OrderingCoordinator | null>(null)

function safeOrderingState(input: Parameters<typeof createOrderingState>[0]): OrderingState {
  try {
    return createOrderingState(input)
  } catch {
    // Declaration validation belongs to the committed node registry. Keep the
    // ordering slice dormant for malformed declarations so it cannot mask the
    // registry's contract error.
    return createOrderingState({ declarations: [], reorderable: input.reorderable })
  }
}

function useOrderingController({
  store,
  declarations,
  durableOrder,
  reorderable,
  groupId,
  visible,
  announce,
}: {
  readonly store: ScopedStore<PicodashFieldDefinitions>
  readonly declarations: readonly OrderingNode[]
  readonly durableOrder: readonly string[] | undefined
  readonly reorderable: boolean
  readonly groupId?: string
  readonly visible?: boolean
  readonly announce?: (message: string) => void
}): OrderingController {
  const contextPublish = useContext(DashListAnnouncementContext)
  const publish = announce ?? contextPublish
  const inheritedCoordinator = useContext(DashListOrderingCoordinatorContext)
  const coordinatorRef = useRef<OrderingCoordinator | null>(null)
  if (coordinatorRef.current === null)
    coordinatorRef.current = inheritedCoordinator ?? { active: { current: false } }
  const coordinator = coordinatorRef.current
  const input = useMemo(
    () => ({
      declarations: declarations.map((node) => ({
        ...node,
        visible: visible === false ? false : node.visible,
      })),
      durableOrder,
      reorderable,
    }),
    [declarations, durableOrder, reorderable, visible],
  )
  const inputRef = useRef(input)
  inputRef.current = input
  const [state, setState] = useState<OrderingState>(() => safeOrderingState(input))
  const reconciled = useMemo(() => {
    try {
      return transitionOrdering(state, { type: 'reconcile', input })
    } catch {
      return { state: safeOrderingState(input), effect: { kind: 'none' as const } }
    }
  }, [state, input])
  const effectiveState = reconciled.state
  useEffect(() => {
    if (reconciled.effect.kind === 'stale-cancel') {
      coordinator.active.current = false
      publish('Reorder cancelled because the List changed.')
    }
    if (
      effectiveState.ordering.fingerprint !== state.ordering.fingerprint ||
      effectiveState.session !== state.session
    )
      setState(effectiveState)
  }, [coordinator, effectiveState, publish, reconciled.effect, state])

  const stateRef = useRef(effectiveState)
  stateRef.current = effectiveState
  const pointerRef = useRef<{
    readonly id: string
    readonly pointerId?: number
    readonly clientY?: number
    readonly releasePointerCapture?: (pointerId: number) => void
  } | null>(null)
  const releasePointerCapture = (): void => {
    const pointer = pointerRef.current
    if (pointer?.pointerId !== undefined) pointer.releasePointerCapture?.(pointer.pointerId)
  }
  const dispatch = (event: Parameters<typeof transitionOrdering>[1]): void => {
    const previous = stateRef.current
    const previousCandidateIndex =
      event.type === 'move' && previous.session
        ? candidateOrder(previous).indexOf(previous.session.nodeId)
        : -1
    const transition = transitionOrdering(previous, event)
    if (transition.state !== stateRef.current) {
      stateRef.current = transition.state
      setState(transition.state)
    }
    if (event.type === 'start' && transition.state.session) {
      coordinator.active.current = true
      publish(`Picked up ${event.nodeId}. Use arrow keys to move, then Space to commit.`)
    }
    if (event.type === 'move' && stateRef.current.session) {
      const current = stateRef.current.session
      const candidateIndex = current.candidateOrder.indexOf(current.nodeId)
      if (candidateIndex === previousCandidateIndex) {
        publish(
          `${current.nodeId} is already at the ${event.direction === 'up' || event.direction === 'home' ? 'start' : 'end'} boundary.`,
        )
      } else {
        publish(`Moved ${current.nodeId}.`)
      }
    }
    if (event.type === 'cancel') {
      coordinator.active.current = false
      publish('Reorder cancelled.')
    }
    if (event.type === 'commit') {
      coordinator.active.current = false
      if (transition.effect.kind === 'write-order') {
        const result = groupId
          ? store.setDashListGroupOrder(groupId, transition.effect.order)
          : store.setDashListRootOrder(transition.effect.order)
        if (!result.ok) {
          const reset = safeOrderingState(inputRef.current)
          stateRef.current = reset
          setState(reset)
          publish('Reorder was rejected.')
        } else publish(`Committed ${transition.state.ordering.order.join(', ')} order.`)
      }
    }
    if (event.type === 'reset') {
      coordinator.active.current = false
      if (transition.effect.kind === 'remove-order') {
        if (groupId) store.removeDashListGroupOrder(groupId)
        else store.removeDashListRootOrder()
      }
    }
  }
  const start = (id: string) => {
    if (coordinator.active.current && !stateRef.current.session) return
    dispatch({ type: 'start', nodeId: id })
  }
  const pointerDown = (id: string, event: PointerLike) => {
    if (pointerRef.current && pointerRef.current.pointerId !== event.pointerId) return
    start(id)
    if (stateRef.current.session) {
      if (event.pointerId !== undefined) event.setPointerCapture?.(event.pointerId)
      pointerRef.current = {
        id,
        pointerId: event.pointerId,
        clientY: event.clientY,
        releasePointerCapture: event.releasePointerCapture,
      }
    }
  }
  const pointerMove = (event: PointerLike) => {
    const pointer = pointerRef.current
    if (
      !pointer ||
      !stateRef.current.session ||
      (pointer.pointerId !== undefined && pointer.pointerId !== event.pointerId)
    )
      return
    if (pointer.clientY === undefined || event.clientY === undefined) return
    const delta = event.clientY - pointer.clientY
    if (Math.abs(delta) < 2) return
    pointerRef.current = { ...pointer, clientY: event.clientY }
    dispatch({ type: 'move', direction: delta < 0 ? 'up' : 'down' })
  }
  const pointerUp = (event: { readonly pointerId?: number }) => {
    const pointer = pointerRef.current
    if (!pointer || (pointer.pointerId !== undefined && pointer.pointerId !== event.pointerId))
      return
    releasePointerCapture()
    pointerRef.current = null
    dispatch({ type: 'commit' })
  }
  const pointerCancel = (event: { readonly pointerId?: number }) => {
    const pointer = pointerRef.current
    if (!pointer || (pointer.pointerId !== undefined && pointer.pointerId !== event.pointerId))
      return
    releasePointerCapture()
    pointerRef.current = null
    dispatch({ type: 'cancel' })
  }
  const cancel = () => {
    if (pointerRef.current) releasePointerCapture()
    pointerRef.current = null
    dispatch({ type: 'cancel' })
  }
  const commit = () => {
    if (pointerRef.current) releasePointerCapture()
    pointerRef.current = null
    dispatch({ type: 'commit' })
  }
  useEffect(
    () => () => {
      if (!stateRef.current.session) return
      releasePointerCapture()
      pointerRef.current = null
      coordinator.active.current = false
    },
    [coordinator],
  )
  return {
    coordinator,
    ordering: effectiveState.ordering,
    candidate: candidateOrder(effectiveState),
    session: effectiveState.session,
    canHandle: (id) => {
      const node = effectiveState.ordering.declarations.find((item) => item.id === id)
      return Boolean(
        effectiveState.ordering.reorderable &&
        node?.visible !== false &&
        node &&
        effectiveState.ordering.visibleBands[
          node.pin === 'start' ? 'start' : node.pin === 'end' ? 'end' : 'automatic'
        ].length > 1,
      )
    },
    start,
    move: (direction) => dispatch({ type: 'move', direction }),
    commit,
    cancel,
    blur: (id) => {
      if (pointerRef.current || stateRef.current.session?.nodeId !== id) return
      cancel()
    },
    pointerDown,
    pointerMove,
    pointerUp,
    pointerCancel,
  }
}

function useOrderingHandle(id: string, label: string): ReactElement | null {
  const controller = useContext(DashListOrderingContext)
  if (!controller || !controller.canHandle(id)) return null
  return createElement(
    'button',
    {
      type: 'button',
      'aria-label': `Reorder ${label}`,
      'data-picodash-reorder-handle': id,
      onKeyDown: (event: { key: string; preventDefault?: () => void }) => {
        if (event.key === 'Escape') {
          event.preventDefault?.()
          controller.cancel()
        } else if (event.key === 'ArrowUp') {
          event.preventDefault?.()
          controller.move('up')
        } else if (event.key === 'ArrowDown') {
          event.preventDefault?.()
          controller.move('down')
        } else if (event.key === 'Home') {
          event.preventDefault?.()
          controller.move('home')
        } else if (event.key === 'End') {
          event.preventDefault?.()
          controller.move('end')
        } else if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault?.()
          if (controller.session) controller.commit()
          else controller.start(id)
        }
      },
      onBlur: () => controller.blur(id),
      onPointerDown: (event: {
        pointerId?: number
        clientY?: number
        preventDefault?: () => void
        setPointerCapture?: (pointerId: number) => void
        releasePointerCapture?: (pointerId: number) => void
        currentTarget?: {
          setPointerCapture?: (pointerId: number) => void
          releasePointerCapture?: (pointerId: number) => void
        }
      }) => {
        event.preventDefault?.()
        controller.pointerDown(id, {
          pointerId: event.pointerId,
          clientY: event.clientY,
          setPointerCapture:
            event.setPointerCapture ??
            event.currentTarget?.setPointerCapture?.bind(event.currentTarget),
          releasePointerCapture:
            event.releasePointerCapture ??
            event.currentTarget?.releasePointerCapture?.bind(event.currentTarget),
        })
      },
      onPointerMove: controller.pointerMove,
      onPointerUp: controller.pointerUp,
      onPointerCancel: controller.pointerCancel,
    },
    '↕',
  )
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
      pin,
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
    const descriptors = useMemo(() => {
      if (fields !== undefined && mode !== undefined)
        throw new TypeError('Compound Dashlet bindings do not accept a top-level mode.')
      if (field === undefined && fields === undefined && mode !== undefined)
        throw new TypeError('Unbound Dashlets do not accept a binding mode.')
      return normalizeBindingDescriptors(field as never, fields as never).map((descriptor) => {
        const resolvedMode = field !== undefined && mode !== undefined ? mode : descriptor.mode
        if (resolvedMode !== 'input' && resolvedMode !== 'display')
          throw new TypeError('Dashlet binding mode must be input or display.')
        return { ...descriptor, mode: resolvedMode }
      })
    }, [field, fields, mode])
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
    const reorderHandle = useOrderingHandle(id, String(label ?? id))
    void pin
    const inputBindings = Object.values(bindingRuntime.bindings).filter(
      (binding): binding is DashletInputBindingContext<PicodashJsonValue> =>
        'mode' in binding && binding.mode === 'input',
    )
    const actionRegistry = useContext(DashListActionRegistryContext)
    const resetBindings = useMemo(
      () =>
        Object.values(bindingRuntime.bindings).map((binding) => ({
          key: `${id}:${binding.alias}`,
          discardInput: () => {
            if ('mode' in binding && binding.mode === 'input')
              bindingRuntime.discardInputs[binding.alias]?.()
          },
          dirty:
            'mode' in binding && binding.mode === 'input'
              ? (binding as DashletInputBindingContext<PicodashJsonValue>).dirty
              : false,
        })),
      [bindingRuntime.bindings, bindingRuntime.discardInputs],
    )
    useEffect(
      () => actionRegistry?.registerBindings(id, resetBindings),
      [actionRegistry, id, resetBindings],
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
            {reorderHandle}
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
                  {binding.stale && bindingRuntime.staleOverwrite[binding.alias]?.eligible ? (
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
  {
    id,
    label,
    'aria-label': ariaLabel,
    children,
    className,
    collapsible = true,
    defaultCollapsed = false,
    reorderable,
    pin,
    disabled = false,
    readOnly,
    ...props
  },
  ref,
) {
  requireAccessibleLabel(label, ariaLabel, 'DashGroup')
  const declarations = useMemo(() => flattenDeclarations(children, 'group'), [children])
  const labelId = `picodash-dashgroup-label-${useId()}`
  const contentId = `picodash-dashgroup-content-${useId()}`
  const disclosureRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const scopedStore = usePicodashStore() as ScopedStore<PicodashFieldDefinitions>
  const actionRegistry = useContext(DashListActionRegistryContext)
  const collapseOverride = usePicodashStoreSelector(scopedStore, (state) =>
    state.scope?.dashList?.collapseOverrides.get(id),
  )
  const collapsed = collapsible ? (collapseOverride ?? defaultCollapsed) : false
  const labelText =
    ariaLabel ?? (typeof label === 'string' || typeof label === 'number' ? String(label) : 'group')
  const disclosureLabel = `${collapsed ? 'Expand' : 'Collapse'} group ${labelText}`

  useEffect(
    () =>
      actionRegistry?.registerGroup({
        id,
        collapsible,
        defaultCollapsed,
      }),
    [actionRegistry, collapsible, defaultCollapsed, id],
  )

  void readOnly

  const parentOrdering = useContext(DashListOrderingContext)
  const groupOrderingDeclarations = useMemo(
    () =>
      declarations.map((declaration) => ({
        id: String((declaration.props as { readonly id?: unknown }).id),
        pin: (declaration.props as { readonly pin?: 'start' | 'end' }).pin,
        visible: !collapsed,
      })),
    [collapsed, declarations],
  )
  const groupOrder = usePicodashStoreSelector(scopedStore, (state) =>
    state.scope?.dashList?.groupOrders.get(id),
  )
  const childOrdering = useOrderingController({
    store: scopedStore,
    declarations: groupOrderingDeclarations,
    durableOrder: groupOrder,
    reorderable: reorderable ?? parentOrdering?.ordering.reorderable ?? true,
    groupId: id,
  })
  const groupReorderHandle = useOrderingHandle(id, labelText)
  void disabled
  void pin
  const declarationById = useMemo(
    () =>
      new Map(
        declarations.map((declaration) => [
          String((declaration.props as { readonly id?: unknown }).id),
          declaration,
        ]),
      ),
    [declarations],
  )
  const orderedDeclarations = childOrdering.candidate.length
    ? childOrdering.candidate
        .map((nodeId) => declarationById.get(nodeId))
        .filter((declaration): declaration is ReactElement => declaration !== undefined)
    : declarations

  const toggleCollapsed = () => {
    if (!collapsible) return
    const nextCollapsed = !collapsed
    if (
      nextCollapsed &&
      contentRef.current &&
      typeof document !== 'undefined' &&
      document.activeElement &&
      contentRef.current.contains(document.activeElement)
    ) {
      // Move focus while descendants are still interactive; the Store update below synchronously
      // causes the content to become inert and hidden.
      disclosureRef.current?.focus()
    }
    if (nextCollapsed === defaultCollapsed) scopedStore.removeDashListCollapseOverride(id)
    else scopedStore.setDashListCollapseOverride(id, nextCollapsed)
  }

  return (
    <DashListNodeLeafBoundary id={id} kind="group">
      <div
        {...props}
        ref={ref}
        role="listitem"
        className={classNames('picodash-dashlist-item picodash-dashlist-group-item', className)}
        data-picodash-dashgroup={id}
        data-collapsed={collapsed ? 'true' : 'false'}
      >
        <div
          role="group"
          aria-label={ariaLabel}
          aria-labelledby={isTextLabel(label) ? labelId : undefined}
          data-picodash-dashgroup
        >
          <DashHeader
            slots={{
              leading: collapsible ? (
                <>
                  <button
                    ref={disclosureRef}
                    aria-label={disclosureLabel}
                    aria-expanded={!collapsed}
                    aria-controls={contentId}
                    type="button"
                    onClick={toggleCollapsed}
                  >
                    {collapsed ? '+' : '−'}
                  </button>
                  {groupReorderHandle}
                </>
              ) : (
                groupReorderHandle
              ),
              title: (
                <div id={labelId} data-picodash-dashgroup-label>
                  {label}
                </div>
              ),
            }}
          />
          <div
            ref={contentRef}
            id={contentId}
            role="list"
            data-picodash-dashgroup-list
            data-collapsed={collapsed ? 'true' : 'false'}
            aria-hidden={collapsed || undefined}
            hidden={collapsed || undefined}
            inert={collapsed || undefined}
          >
            <DashListOrderingContext.Provider value={childOrdering}>
              {orderedDeclarations.map((declaration, index) =>
                createElement(
                  Fragment,
                  {
                    key: declaration.key ?? declarationIdentity(declaration, `${id}-${index}`),
                  },
                  wrapDeclaration(declaration, 'group', `${id}-${index}`),
                ),
              )}
            </DashListOrderingContext.Provider>
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
    reorderable = true,
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
  const declarations = useMemo(() => flattenDeclarations(children, 'list'), [children])
  const [announcement, setAnnouncement] = useState('')
  const orderingDeclarations = useMemo(
    () =>
      declarations.map((declaration) => ({
        id: String((declaration.props as { readonly id?: unknown }).id),
        pin: (declaration.props as { readonly pin?: 'start' | 'end' }).pin,
        visible: true,
      })),
    [declarations],
  )
  const registryRef = useRef<ReturnType<typeof createNodeRegistry> | undefined>(undefined)
  if (registryRef.current === undefined) registryRef.current = createNodeRegistry()
  const registry = registryRef.current
  const actionRegistryRef = useRef<ReturnType<typeof createDashListActionRegistry> | undefined>(
    undefined,
  )
  if (actionRegistryRef.current === undefined)
    actionRegistryRef.current = createDashListActionRegistry(resolved.store, resolved.scopeId)
  const actionRegistry = actionRegistryRef.current
  useEffect(() => {
    actionRegistry.activate()
    return () => actionRegistry.dispose()
  }, [actionRegistry])
  const rootOrder = usePicodashStoreSelector(
    resolved.store,
    (state) => state.scope?.dashList?.rootOrder,
  )
  const rootOrdering = useOrderingController({
    store: resolved.store,
    declarations: orderingDeclarations,
    durableOrder: rootOrder,
    reorderable,
    announce: setAnnouncement,
  })
  const declarationById = useMemo(
    () =>
      new Map(
        declarations.map((declaration) => [
          String((declaration.props as { readonly id?: unknown }).id),
          declaration,
        ]),
      ),
    [declarations],
  )
  const orderedDeclarations = rootOrdering.candidate.length
    ? rootOrdering.candidate
        .map((nodeId) => declarationById.get(nodeId))
        .filter((declaration): declaration is ReactElement => declaration !== undefined)
    : declarations
  const headingIdToken = useId()
  const headingId = title === undefined ? undefined : `picodash-dashlist-heading-${headingIdToken}`
  const statusId = `picodash-dashlist-status-${useId()}`
  const listName =
    ariaLabelledBy ?? (ariaLabel === undefined && title !== undefined ? headingId : undefined)
  return (
    <PicodashThemeProvider theme={theme} density={density}>
      <PicodashStoreEntityBoundary
        store={resolved.store}
        kind="dashList"
        allowStandalone={resolved.standalone}
      >
        <DashListAnnouncementContext.Provider value={setAnnouncement}>
          <DashListOrderingCoordinatorContext.Provider value={rootOrdering.coordinator}>
            <DashListOrderingContext.Provider value={rootOrdering}>
              <DashListActionRegistryContext.Provider value={actionRegistry}>
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
                          slots={{
                            title: createElement(`h${headingLevel}`, { id: headingId }, title),
                          }}
                        />
                      ) : null}
                      <div
                        role="list"
                        aria-label={ariaLabel}
                        aria-labelledby={listName}
                        data-picodash-dashlist-list
                      >
                        {orderedDeclarations.map((declaration, index) =>
                          createElement(
                            Fragment,
                            {
                              key:
                                declaration.key ??
                                declarationIdentity(declaration, `${resolved.scopeId}-${index}`),
                            },
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
              </DashListActionRegistryContext.Provider>
            </DashListOrderingContext.Provider>
          </DashListOrderingCoordinatorContext.Provider>
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
