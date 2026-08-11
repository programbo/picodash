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
  RootNexus,
  ScopedNexus,
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
  freezeNexusContext,
  missingNexusContext,
  PicodashNexusContext,
  type ContextFields,
  type ContextResult,
  type ContextRootNexus,
  type ContextScopedNexus,
} from './nexus-context.js'

export interface PicodashNexusProviderBoundaryProps<
  Fields extends PicodashFieldDefinitions = PicodashFieldDefinitions,
  Result extends CoreTransactionResult = CoreTransactionResult,
> {
  readonly children: ReactNode
  readonly nexus: RootNexus<Fields, Result>
  readonly providerId?: string
}

export type PicodashNexusEntityBoundaryProps<
  Fields extends PicodashFieldDefinitions = PicodashFieldDefinitions,
  Result extends CoreTransactionResult = CoreTransactionResult,
> = Readonly<{
  readonly children: ReactNode
  readonly nexus: ScopedNexus<Fields, Result>
}> &
  (
    | Readonly<{ readonly kind: 'dashPanel'; readonly allowStandalone?: never }>
    | Readonly<{ readonly kind: 'dashList'; readonly allowStandalone?: boolean }>
  )

export function PicodashNexusProviderBoundary<
  Fields extends PicodashFieldDefinitions = PicodashFieldDefinitions,
  Result extends CoreTransactionResult = CoreTransactionResult,
>({
  children,
  nexus,
  providerId,
}: PicodashNexusProviderBoundaryProps<Fields, Result>): ReactElement {
  const host = useMemo(
    () => createDeclarativeIntegrationHost(nexus, providerId),
    [providerId, nexus],
  )
  useEffect(() => {
    host.mountProvider()
    return () => host.unmountProvider()
  }, [host])
  const value = useMemo(
    () =>
      freezeNexusContext({
        root: nexus as unknown as ContextRootNexus,
        nexus: nexus as unknown as ContextRootNexus,
        host: host as unknown as DeclarativeIntegrationHost<ContextFields, ContextResult>,
        parentToken: null,
      }),
    [host, nexus],
  )
  return createElement(PicodashNexusContext.Provider, { value }, children)
}

export function PicodashNexusEntityBoundary<
  Fields extends PicodashFieldDefinitions = PicodashFieldDefinitions,
  Result extends CoreTransactionResult = CoreTransactionResult,
>({
  children,
  nexus,
  kind,
  allowStandalone,
}: PicodashNexusEntityBoundaryProps<Fields, Result>): ReactElement {
  const parentContext = useContext(PicodashNexusContext)
  const standaloneOptIn = !parentContext && kind === 'dashList' && allowStandalone === true
  if (!parentContext && !standaloneOptIn) return missingNexusContext('root-or-scoped')
  const tokenRef = useRef<DeclarativeEntityToken | null>(null)
  if (tokenRef.current === null) tokenRef.current = createDeclarativeEntityToken()
  const token = tokenRef.current
  const standaloneHost = useMemo<DeclarativeStandaloneIntegrationHost | null>(
    () =>
      standaloneOptIn
        ? (createDeclarativeStandaloneIntegrationHost(
            nexus.root as unknown as RootNexus<ContextFields, ContextResult>,
          ) as unknown as DeclarativeStandaloneIntegrationHost)
        : null,
    [standaloneOptIn, nexus.root],
  )
  const host = parentContext?.host ?? standaloneHost!
  const parentToken = parentContext ? parentContext.parentToken : token
  useEffect(() => {
    if (standaloneHost) {
      standaloneHost.mountRoot({
        token,
        nexus: nexus as unknown as ContextScopedNexus,
        kind: 'dashList',
      })
      return () => standaloneHost.unmountRoot(token)
    }
    host.mountEntity({
      token,
      nexus: nexus as unknown as ContextScopedNexus,
      kind,
      ...(parentToken === null ? {} : { parent: parentToken }),
    })
    return () => host.unmountEntity(token)
  }, [host, kind, parentToken, standaloneHost, nexus, token])
  const value = useMemo(
    () =>
      freezeNexusContext({
        root: (parentContext?.root ?? nexus.root) as unknown as ContextRootNexus,
        nexus: nexus as unknown as ContextScopedNexus,
        host,
        parentToken: token,
      }),
    [host, parentContext?.root, parentToken, standaloneHost, nexus, token],
  )
  return createElement(PicodashNexusContext.Provider, { value }, children)
}
