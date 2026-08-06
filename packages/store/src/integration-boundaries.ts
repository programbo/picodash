import {
  createElement,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactElement,
  type ReactNode,
} from 'react'
import type {
  CoreTransactionResult,
  PicodashFieldDefinitions,
  RootStore,
  ScopedStore,
} from './kernel/index.js'
import {
  createDeclarativeEntityToken,
  createDeclarativeIntegrationHost,
  type DeclarativeEntityToken,
  type DeclarativeIntegrationHost,
} from './declarative-integration.js'
import type { StoreEntityKind } from './integration-leases.js'
import {
  freezeStoreContext,
  missingStoreContext,
  PicodashStoreContext,
  type ContextFields,
  type ContextResult,
  type ContextRootStore,
  type ContextScopedStore,
} from './store-context.js'

export interface PicodashStoreProviderBoundaryProps<
  Fields extends PicodashFieldDefinitions = PicodashFieldDefinitions,
  Result extends CoreTransactionResult = CoreTransactionResult,
> {
  readonly children: ReactNode
  readonly store: RootStore<Fields, Result>
  readonly providerId?: string
}

export interface PicodashStoreEntityBoundaryProps<
  Fields extends PicodashFieldDefinitions = PicodashFieldDefinitions,
  Result extends CoreTransactionResult = CoreTransactionResult,
> {
  readonly children: ReactNode
  readonly store: ScopedStore<Fields, Result>
  readonly kind: StoreEntityKind
}

export function PicodashStoreProviderBoundary<
  Fields extends PicodashFieldDefinitions = PicodashFieldDefinitions,
  Result extends CoreTransactionResult = CoreTransactionResult,
>({
  children,
  store,
  providerId,
}: PicodashStoreProviderBoundaryProps<Fields, Result>): ReactElement {
  const host = useMemo(
    () => createDeclarativeIntegrationHost(store, providerId),
    [providerId, store],
  )
  useEffect(() => {
    host.mountProvider()
    return () => host.unmountProvider()
  }, [host])
  const value = useMemo(
    () =>
      freezeStoreContext({
        root: store as unknown as ContextRootStore,
        store: store as unknown as ContextRootStore,
        host: host as unknown as DeclarativeIntegrationHost<ContextFields, ContextResult>,
        parentToken: null,
      }),
    [host, store],
  )
  return createElement(PicodashStoreContext.Provider, { value }, children)
}

export function PicodashStoreEntityBoundary<
  Fields extends PicodashFieldDefinitions = PicodashFieldDefinitions,
  Result extends CoreTransactionResult = CoreTransactionResult,
>({ children, store, kind }: PicodashStoreEntityBoundaryProps<Fields, Result>): ReactElement {
  const parentContext = useContext(PicodashStoreContext)
  if (!parentContext) return missingStoreContext('root-or-scoped')
  const tokenRef = useRef<DeclarativeEntityToken | null>(null)
  if (tokenRef.current === null) tokenRef.current = createDeclarativeEntityToken()
  const token = tokenRef.current
  const { host, parentToken } = parentContext
  useEffect(() => {
    host.mountEntity({
      token,
      store: store as unknown as ContextScopedStore,
      kind,
      ...(parentToken === null ? {} : { parent: parentToken }),
    })
    return () => host.unmountEntity(token)
  }, [host, kind, parentToken, store, token])
  const value = useMemo(
    () =>
      freezeStoreContext({
        root: store.root as unknown as ContextRootStore,
        store: store as unknown as ContextScopedStore,
        host,
        parentToken: token,
      }),
    [host, store, token],
  )
  return createElement(PicodashStoreContext.Provider, { value }, children)
}
