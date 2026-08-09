import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type {
  BindingInteractionState,
  PicodashField,
  PicodashFieldDefinitions,
  PicodashJsonValue,
  PicodashStaleInputOverwritePlan,
  ScopedStore,
  TransactionIssue,
} from '@picodash/store'
import {
  acquireBindingLease,
  type BindingHandle,
  type StoreBindingMode,
} from '@picodash/store/integration'
import { PicodashContractError } from '@picodash/store'

export type DashletBindingMode = StoreBindingMode
export type DashletFieldBinding<TValues extends object> = {
  [TKey in Extract<keyof TValues, string>]:
    | PicodashField<TValues, TKey>
    | { readonly field: PicodashField<TValues, TKey>; readonly mode?: DashletBindingMode }
}[Extract<keyof TValues, string>]
export type DashletFields<TValues extends object = Record<string, PicodashJsonValue>> = Readonly<
  Record<string, DashletFieldBinding<TValues>>
>

export interface DashletRenderContext {
  readonly id: string
  readonly disabled: boolean
  readonly readOnly: boolean
  readonly labelId: string
  readonly descriptionId?: string
  readonly issues: readonly TransactionIssue[]
  readonly issuesId?: string
}

export interface DashletBindingContext<TValue extends PicodashJsonValue> {
  readonly alias: string
  readonly field: PicodashField<Record<string, TValue>, string>
  readonly value: TValue
  readonly controlId: string
  readonly invalid: boolean
  readonly issues: readonly TransactionIssue[]
  readonly issuesId?: string
}

export interface DashletInputBindingContext<
  TValue extends PicodashJsonValue,
> extends DashletBindingContext<TValue> {
  readonly mode: 'input'
  readonly dirty: boolean
  readonly draftValue?: PicodashJsonValue
  readonly touched: boolean
  readonly stale: boolean
  setInput(candidate: PicodashJsonValue): void
  discardInput(): void
  resetValue(): void
}
export interface DashletDisplayBindingContext<
  TValue extends PicodashJsonValue,
> extends DashletBindingContext<TValue> {
  readonly mode: 'display'
}
export type DashletBindingContextFor<T> = T extends {
  readonly field: infer F
  readonly mode?: infer M
}
  ? M extends 'display'
    ? DashletDisplayBindingContext<FieldValue<F>>
    : DashletInputBindingContext<FieldValue<F>>
  : T extends PicodashField<infer _V, infer _K>
    ? DashletInputBindingContext<FieldValue<T>>
    : never
type FieldValue<T> =
  T extends PicodashField<infer V, infer K>
    ? K extends keyof V
      ? Extract<V[K], PicodashJsonValue>
      : PicodashJsonValue
    : PicodashJsonValue
export interface SingleFieldDashletRenderContext<
  TValue extends PicodashJsonValue,
  TMode extends DashletBindingMode = 'input',
> extends DashletRenderContext {
  readonly binding: TMode extends 'display'
    ? DashletDisplayBindingContext<TValue>
    : DashletInputBindingContext<TValue>
}
export interface CompoundDashletRenderContext<
  TValues extends object,
  TFields extends DashletFields<TValues>,
> extends DashletRenderContext {
  readonly bindings: {
    readonly [TAlias in keyof TFields]: DashletBindingContextFor<TFields[TAlias]>
  }
}

export type BindingDescriptor = {
  readonly alias: string
  readonly field: PicodashField<Record<string, PicodashJsonValue>, string>
  readonly mode: DashletBindingMode
}
export const DashListAnnouncementContext = createContext<(message: string) => void>(() => undefined)

function validBindingAlias(alias: string): boolean {
  if (!alias || alias.trim() !== alias) return false
  for (const character of alias) {
    const code = character.codePointAt(0)!
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) return false
  }
  return true
}

export function normalizeBindingDescriptors(
  field: PicodashField<Record<string, PicodashJsonValue>, string> | undefined,
  fields: DashletFields | undefined,
): readonly BindingDescriptor[] {
  if (field && fields) throw new TypeError('Dashlet field and fields are mutually exclusive.')
  if (fields) {
    const entries = Object.entries(fields)
    if (!entries.length) throw new TypeError('Dashlet fields must contain at least one binding.')
    return entries.map(([alias, descriptor]) => {
      if (!validBindingAlias(alias))
        throw new TypeError(
          'Dashlet binding aliases must be non-empty, trimmed, and control-character-free.',
        )
      const value =
        descriptor && typeof descriptor === 'object' && 'field' in descriptor
          ? (descriptor as {
              readonly field: BindingDescriptor['field']
              readonly mode?: DashletBindingMode
            })
          : { field: descriptor as BindingDescriptor['field'] }
      return { alias, field: value.field, mode: value.mode ?? 'input' }
    })
  }
  return field ? [{ alias: field.key, field, mode: 'input' }] : []
}

function issueKey(issue: TransactionIssue): string {
  return JSON.stringify([
    issue.code,
    issue.path,
    issue.message,
    issue.reason,
    issue.scopeId,
    issue.itemId,
    issue.fieldKey,
    issue.alias,
  ])
}
export function dedupeIssues(issues: readonly TransactionIssue[]): readonly TransactionIssue[] {
  const seen = new Set<string>()
  return Object.freeze(
    issues.filter((issue) => {
      const key = issueKey(issue)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }),
  )
}

export function issuesForDashlet(
  issues: readonly TransactionIssue[],
  scopeId: string,
  itemId: string,
): readonly TransactionIssue[] {
  return Object.freeze(
    issues.filter(
      (issue) =>
        (issue.scopeId === undefined || issue.scopeId === scopeId) &&
        (issue.itemId === undefined || issue.itemId === itemId),
    ),
  )
}

type Runtime = {
  readonly descriptor: BindingDescriptor
  readonly handle?: BindingHandle<PicodashFieldDefinitions, string>
}

export type StaleOverwriteController = {
  readonly eligible: boolean
  readonly openPlan: () => PicodashStaleInputOverwritePlan | undefined
  readonly executePlan: (plan: PicodashStaleInputOverwritePlan) => void
}

function sameDescriptors(
  left: readonly BindingDescriptor[],
  right: readonly BindingDescriptor[],
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (descriptor, index) =>
        descriptor.alias === right[index]?.alias &&
        descriptor.mode === right[index]?.mode &&
        descriptor.field === right[index]?.field,
    )
  )
}

function assertBindingDescriptorsOwned(
  store: ScopedStore<PicodashFieldDefinitions>,
  descriptors: readonly BindingDescriptor[],
): void {
  for (const descriptor of descriptors) {
    try {
      const key = Object.getOwnPropertyDescriptor(descriptor.field, 'key')
      if (
        !key ||
        !('value' in key) ||
        typeof key.value !== 'string' ||
        (store.fields as Record<string, unknown>)[key.value] !== descriptor.field
      )
        throw new PicodashContractError('foreign-handle')
    } catch (error) {
      if (error instanceof PicodashContractError) throw error
      throw new PicodashContractError('foreign-handle')
    }
  }
}

function issuesFromResult(
  result: ReturnType<ScopedStore<PicodashFieldDefinitions>['setInput']>,
): readonly TransactionIssue[] {
  return result.ok ? [] : result.error.issues
}

function issueFromOverwriteError(
  error: unknown,
  fieldKey: string,
  itemId: string,
  alias: string,
): TransactionIssue {
  if (error instanceof PicodashContractError && error.issues?.length) {
    const issue = error.issues[0]!
    return Object.freeze({
      ...issue,
      fieldKey: issue.fieldKey ?? fieldKey,
      itemId: issue.itemId ?? itemId,
      alias: issue.alias ?? alias,
    })
  }
  const message =
    error instanceof PicodashContractError
      ? error.context.reason === 'consumed'
        ? 'Overwrite confirmation has already been used. Confirm again.'
        : error.context.reason === 'released'
          ? 'Overwrite confirmation is no longer available. Confirm again.'
          : 'The stale value changed before confirmation. Confirm again.'
      : 'The stale value could not be overwritten. Confirm again.'
  return Object.freeze({
    code: 'stale_plan',
    path: Object.freeze([]),
    message,
    fieldKey,
    itemId,
    alias,
  })
}

export function useDashletBindings(
  store: ScopedStore<PicodashFieldDefinitions>,
  itemId: string,
  descriptors: readonly BindingDescriptor[],
  disabled: boolean,
  readOnly: boolean,
  controlId: string,
  issuesId: string,
): {
  readonly bindings: Record<string, DashletBindingContext<PicodashJsonValue>>
  readonly issues: readonly TransactionIssue[]
  readonly staleOverwrite: Record<string, StaleOverwriteController>
} {
  const storeSnapshot = useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.getState(),
    () => store.getState(),
  )
  const runtimes = useRef<Runtime[]>([])
  const initialDescriptors = useRef<readonly BindingDescriptor[] | null>(null)
  if (initialDescriptors.current === null) initialDescriptors.current = descriptors
  else if (!sameDescriptors(initialDescriptors.current, descriptors))
    throw new TypeError(
      'Dashlet binding descriptors are immutable while mounted; use a keyed remount.',
    )
  const stableDescriptors = initialDescriptors.current
  assertBindingDescriptorsOwned(store, stableDescriptors)
  const [commandIssues, setCommandIssues] = useState<readonly TransactionIssue[]>([])
  const previousValues = useRef(storeSnapshot.values)
  useEffect(() => {
    if (previousValues.current !== storeSnapshot.values) setCommandIssues([])
    previousValues.current = storeSnapshot.values
  }, [storeSnapshot.values])
  const policy = useRef({ disabled, readOnly })
  policy.current = { disabled, readOnly }
  const publishAnnouncement = useContext(DashListAnnouncementContext)
  useEffect(() => {
    const acquired: Runtime[] = []
    try {
      for (const descriptor of stableDescriptors) {
        const handle = acquireBindingLease(store as ScopedStore<PicodashFieldDefinitions>, {
          itemId,
          field: descriptor.field as never,
          alias: descriptor.alias,
          mode: descriptor.mode,
        })
        acquired.push({ descriptor, handle })
      }
      runtimes.current = acquired
    } catch (error) {
      for (const runtime of acquired) runtime.handle?.release()
      throw error
    }
    return () => {
      for (const runtime of acquired.slice().reverse()) runtime.handle?.release()
      if (runtimes.current === acquired) runtimes.current = []
    }
  }, [store, itemId, stableDescriptors])

  const result = useMemo(() => {
    const state = storeSnapshot
    const interaction = state.interaction.bindings.get(itemId)
    const bindings: Record<string, DashletBindingContext<PicodashJsonValue>> = Object.create(null)
    const staleOverwrite: Record<string, StaleOverwriteController> = Object.create(null)
    const allIssues = issuesForDashlet(
      dedupeIssues(
        stableDescriptors
          .flatMap((descriptor) => interaction?.get(descriptor.alias)?.inputIssues ?? [])
          .concat(commandIssues),
      ),
      store.scopeId,
      itemId,
    )
    const owners = new Map<string, string>()
    const common: TransactionIssue[] = []
    for (const issue of allIssues) {
      let candidates = stableDescriptors.filter((descriptor) => issue.alias === descriptor.alias)
      if (!candidates.length && issue.fieldKey)
        candidates = stableDescriptors.filter(
          (descriptor) => descriptor.field.key === issue.fieldKey,
        )
      if (!candidates.length && issue.path[0] === 'values' && typeof issue.path[1] === 'string')
        candidates = stableDescriptors.filter(
          (descriptor) => descriptor.field.key === issue.path[1],
        )
      if (candidates.length === 1) owners.set(issueKey(issue), candidates[0]!.alias)
      else common.push(issue)
    }
    for (const [descriptorIndex, descriptor] of stableDescriptors.entries()) {
      const key = descriptor.alias
      const bindingState = interaction?.get(key) as BindingInteractionState | undefined
      const ownIssues = allIssues.filter((issue) => owners.get(issueKey(issue)) === key)
      const value = (state.values as Record<string, PicodashJsonValue>)[descriptor.field.key]
      const base: DashletBindingContext<PicodashJsonValue> = {
        alias: key,
        field: descriptor.field,
        value,
        controlId: `${controlId}-${descriptorIndex}`,
        invalid: ownIssues.length > 0,
        issues: ownIssues,
        ...(ownIssues.length ? { issuesId: `${issuesId}-${descriptorIndex}` } : {}),
      }
      if (descriptor.mode === 'display')
        bindings[key] = {
          ...base,
          mode: 'display',
        } as DashletDisplayBindingContext<PicodashJsonValue>
      else {
        const input: DashletInputBindingContext<PicodashJsonValue> = {
          ...base,
          mode: 'input',
          dirty: bindingState?.draft !== undefined,
          ...(bindingState?.draft === undefined ? {} : { draftValue: bindingState.draft }),
          touched: bindingState?.touched ?? false,
          stale: bindingState?.conflict !== undefined,
          setInput: (candidate) => {
            if (policy.current.disabled || policy.current.readOnly) return
            const runtime = runtimes.current.find((entry) => entry.descriptor.alias === key)
            if (!runtime?.handle) return
            const nextIssues = issuesForDashlet(
              issuesFromResult(store.setInput(runtime.handle, candidate)),
              store.scopeId,
              itemId,
            )
            setCommandIssues(nextIssues)
            publishAnnouncement(
              nextIssues
                .filter(
                  (issue) => !allIssues.some((current) => issueKey(current) === issueKey(issue)),
                )
                .map((issue) => issue.message)
                .join('. '),
            )
          },
          discardInput: () => {
            if (policy.current.disabled) return
            const runtime = runtimes.current.find((entry) => entry.descriptor.alias === key)
            if (!runtime?.handle) return
            store.discardInput(runtime.handle)
            setCommandIssues([])
            publishAnnouncement('')
          },
          resetValue: () => {
            if (policy.current.disabled || policy.current.readOnly) return
            const nextIssues = issuesForDashlet(
              issuesFromResult(store.resetValue(descriptor.field)),
              store.scopeId,
              itemId,
            )
            setCommandIssues(nextIssues)
            publishAnnouncement(
              nextIssues
                .filter(
                  (issue) => !allIssues.some((current) => issueKey(current) === issueKey(issue)),
                )
                .map((issue) => issue.message)
                .join('. '),
            )
          },
        }
        bindings[key] = input
        staleOverwrite[key] = {
          eligible: (bindingState?.inputIssues.length ?? 0) === 0,
          openPlan: () => {
            if (policy.current.disabled || policy.current.readOnly) return undefined
            const runtime = runtimes.current.find((entry) => entry.descriptor.alias === key)
            if (!runtime?.handle) return undefined
            try {
              return store.createStaleInputOverwritePlan(runtime.handle)
            } catch (error) {
              const issue = issueFromOverwriteError(error, descriptor.field.key, itemId, key)
              setCommandIssues([issue])
              publishAnnouncement(issue.message)
              return undefined
            }
          },
          executePlan: (plan) => {
            if (policy.current.disabled || policy.current.readOnly) return
            let result: ReturnType<ScopedStore<PicodashFieldDefinitions>['setInput']>
            try {
              result = store.executeStaleInputOverwrite(plan)
            } catch (error) {
              const issue = issueFromOverwriteError(error, descriptor.field.key, itemId, key)
              setCommandIssues([issue])
              publishAnnouncement(issue.message)
              return
            }
            const nextIssues = issuesForDashlet(issuesFromResult(result), store.scopeId, itemId)
            setCommandIssues(nextIssues)
            publishAnnouncement(nextIssues.map((issue) => issue.message).join('. '))
          },
        }
      }
    }
    const issues = dedupeIssues(common)
    return { bindings, issues, staleOverwrite }
  }, [
    commandIssues,
    controlId,
    issuesId,
    itemId,
    publishAnnouncement,
    stableDescriptors,
    store,
    storeSnapshot,
  ])
  return result
}
