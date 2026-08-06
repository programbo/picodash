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
  createDeclarativeStandaloneIntegrationHost,
  type DeclarativeEntityToken,
  type DeclarativeIntegrationHost,
  type DeclarativeStandaloneIntegrationHost,
} from './declarative-integration.js'
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

export type PicodashStoreEntityBoundaryProps<
  Fields extends PicodashFieldDefinitions = PicodashFieldDefinitions,
  Result extends CoreTransactionResult = CoreTransactionResult,
> = Readonly<{
  readonly children: ReactNode
  readonly store: ScopedStore<Fields, Result>
}> &
  (
    | Readonly<{ readonly kind: 'dashPanel'; readonly allowStandalone?: never }>
    | Readonly<{ readonly kind: 'dashList'; readonly allowStandalone?: boolean }>
  )

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
>({
  children,
  store,
  kind,
  allowStandalone,
}: PicodashStoreEntityBoundaryProps<Fields, Result>): ReactElement {
  const parentContext = useContext(PicodashStoreContext)
  const standaloneOptIn = !parentContext && kind === 'dashList' && allowStandalone === true
  if (!parentContext && !standaloneOptIn) return missingStoreContext('root-or-scoped')
  const tokenRef = useRef<DeclarativeEntityToken | null>(null)
  if (tokenRef.current === null) tokenRef.current = createDeclarativeEntityToken()
  const token = tokenRef.current
  const standaloneHost = useMemo<DeclarativeStandaloneIntegrationHost | null>(
    () =>
      standaloneOptIn
        ? (createDeclarativeStandaloneIntegrationHost(
            store.root as unknown as RootStore<ContextFields, ContextResult>,
          ) as unknown as DeclarativeStandaloneIntegrationHost)
        : null,
    [standaloneOptIn, store.root],
  )
  const host = parentContext?.host ?? standaloneHost!
  const parentToken = parentContext ? parentContext.parentToken : token
  useEffect(() => {
    if (standaloneHost) {
      standaloneHost.mountRoot({
        token,
        store: store as unknown as ContextScopedStore,
        kind: 'dashList',
      })
      return () => standaloneHost.unmountRoot(token)
    }
    host.mountEntity({
      token,
      store: store as unknown as ContextScopedStore,
      kind,
      ...(parentToken === null ? {} : { parent: parentToken }),
    })
    return () => host.unmountEntity(token)
  }, [host, kind, parentToken, standaloneHost, store, token])
  const value = useMemo(
    () =>
      freezeStoreContext({
        root: (parentContext?.root ?? store.root) as unknown as ContextRootStore,
        store: store as unknown as ContextScopedStore,
        host,
        parentToken: token,
      }),
    [host, parentContext?.root, parentToken, standaloneHost, store, token],
  )
  return createElement(PicodashStoreContext.Provider, { value }, children)
}
