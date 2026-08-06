'use client'

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react'

type NodeKind = 'dashlet' | 'group'
type DeclarationKind = NodeKind | 'custom'
type DeclarationOwner = 'list' | 'group' | 'dashlet'
type NodeIdFailureReason = 'not-string' | 'empty' | 'surrounding-whitespace' | 'control-character'
type NodeRegistrationFailureReason =
  | 'invalid-node-id'
  | 'duplicate-node-id'
  | 'missing-registration'
  | 'multiple-registrations'
  | 'id-mismatch'
  | 'kind-mismatch'
  | 'nested-node'

type Token = object

type DeclarationRecord = {
  readonly token: Token
  readonly kind: DeclarationKind
  readonly owner: DeclarationOwner
  readonly id: unknown
  active: boolean
  generation: number
}

type RegistrationRecord = {
  readonly token: Token
  readonly declaration: Token | null
  readonly kind: NodeKind
  readonly id: unknown
  active: boolean
  generation: number
}

type Failure = {
  readonly reason: NodeRegistrationFailureReason
  readonly id?: unknown
}

type NodeRegistry = {
  readonly declare: (
    token: Token,
    kind: DeclarationKind,
    owner: DeclarationOwner,
    id: unknown,
  ) => number
  readonly releaseDeclaration: (token: Token, generation: number) => void
  readonly register: (
    token: Token,
    declaration: Token | null,
    kind: NodeKind,
    id: unknown,
  ) => number
  readonly releaseRegistration: (token: Token, generation: number) => void
  readonly subscribe: (listener: () => void) => () => void
  readonly getRevision: () => number
  readonly getFailure: () => Failure | null
}

type DeclarationContextValue = {
  readonly token: Token
  readonly kind: DeclarationKind
  readonly owner: DeclarationOwner
  readonly id: unknown
}

const RegistryContext = createContext<NodeRegistry | null>(null)
const DeclarationContext = createContext<DeclarationContextValue | null>(null)
const DashletLeafContext = createContext(false)

function classifyNodeId(value: unknown): NodeIdFailureReason | undefined {
  if (typeof value !== 'string') return 'not-string'
  if (value.trim().length === 0) return 'empty'
  if (value !== value.trim()) return 'surrounding-whitespace'
  for (const character of value) {
    const code = character.codePointAt(0)!
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) return 'control-character'
  }
  return undefined
}

function firstFailure(
  declarations: Map<Token, DeclarationRecord>,
  registrations: Map<Token, RegistrationRecord>,
  runtimeFailures: Map<Token, Failure>,
): Failure | null {
  for (const failure of runtimeFailures.values()) return failure

  const activeDeclarations = [...declarations.values()].filter((declaration) => declaration.active)
  const activeRegistrations = [...registrations.values()].filter(
    (registration) => registration.active,
  )
  const seenIds = new Map<string, Token>()

  for (const declaration of activeDeclarations) {
    if (classifyNodeId(declaration.id)) return { reason: 'invalid-node-id', id: declaration.id }
    if (typeof declaration.id === 'string') {
      const previous = seenIds.get(declaration.id)
      if (previous && previous !== declaration.token)
        return { reason: 'duplicate-node-id', id: declaration.id }
      seenIds.set(declaration.id, declaration.token)
    }
  }

  const registrationsByDeclaration = new Map<Token, RegistrationRecord[]>()
  for (const registration of activeRegistrations) {
    if (classifyNodeId(registration.id)) return { reason: 'invalid-node-id', id: registration.id }
    if (registration.declaration === null) continue
    const list = registrationsByDeclaration.get(registration.declaration) ?? []
    list.push(registration)
    registrationsByDeclaration.set(registration.declaration, list)
  }

  for (const declaration of activeDeclarations) {
    const matches = registrationsByDeclaration.get(declaration.token) ?? []
    if (matches.length === 0) return { reason: 'missing-registration', id: declaration.id }
    if (matches.length > 1) return { reason: 'multiple-registrations', id: declaration.id }
    const [registration] = matches
    if (registration.id !== declaration.id) return { reason: 'id-mismatch', id: declaration.id }
    if (declaration.owner === 'group' && registration.kind !== 'dashlet')
      return { reason: 'kind-mismatch', id: declaration.id }
    if (declaration.kind !== 'custom' && declaration.kind !== registration.kind)
      return { reason: 'kind-mismatch', id: declaration.id }
  }

  const seenRegistrationIds = new Map<string, Token>()
  for (const registration of activeRegistrations) {
    if (typeof registration.id !== 'string') continue
    const previous = seenRegistrationIds.get(registration.id)
    if (previous && previous !== registration.token)
      return { reason: 'duplicate-node-id', id: registration.id }
    seenRegistrationIds.set(registration.id, registration.token)
  }

  return null
}

export function createNodeRegistry(): NodeRegistry {
  const declarations = new Map<Token, DeclarationRecord>()
  const registrations = new Map<Token, RegistrationRecord>()
  const runtimeFailures = new Map<Token, Failure>()
  const listeners = new Set<() => void>()
  let revision = 0

  const notify = (): void => {
    revision += 1
    for (const listener of listeners) listener()
  }

  return {
    declare(token, kind, owner, id) {
      const current = declarations.get(token)
      const generation = (current?.generation ?? 0) + 1
      declarations.set(token, {
        token,
        kind,
        owner,
        id,
        active: true,
        generation,
      })
      notify()
      return generation
    },
    releaseDeclaration(token, generation) {
      const current = declarations.get(token)
      if (!current || !current.active || current.generation !== generation) return
      current.active = false
      notify()
    },
    register(token, declaration, kind, id) {
      const current = registrations.get(token)
      const generation = (current?.generation ?? 0) + 1
      registrations.set(token, {
        token,
        declaration,
        kind,
        id,
        active: true,
        generation,
      })
      if (declaration === null) runtimeFailures.set(token, { reason: 'nested-node', id })
      else runtimeFailures.delete(token)
      notify()
      return generation
    },
    releaseRegistration(token, generation) {
      const current = registrations.get(token)
      if (!current || !current.active || current.generation !== generation) return
      current.active = false
      runtimeFailures.delete(token)
      notify()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getRevision() {
      return revision
    },
    getFailure() {
      return firstFailure(declarations, registrations, runtimeFailures)
    },
  }
}

export function DashListNodeRegistryProvider({
  registry,
  children,
}: {
  readonly registry: NodeRegistry
  readonly children?: ReactNode
}) {
  return (
    <RegistryContext.Provider value={registry}>
      <DeclarationContext.Provider value={null}>
        <DashletLeafContext.Provider value={false}>{children}</DashletLeafContext.Provider>
      </DeclarationContext.Provider>
    </RegistryContext.Provider>
  )
}

export function DashListNodeDeclarationBoundary({
  id,
  kind,
  owner,
  children,
}: {
  readonly id: unknown
  readonly kind: DeclarationKind
  readonly owner: DeclarationOwner
  readonly children?: ReactNode
}) {
  const registry = useContext(RegistryContext)
  const tokenRef = useRef<Token | null>(null)
  if (tokenRef.current === null) tokenRef.current = {}
  const token = tokenRef.current

  useEffect(() => {
    if (!registry) return
    const generation = registry.declare(token, kind, owner, id)
    return () => registry.releaseDeclaration(token, generation)
  }, [id, kind, owner, registry, token])

  return (
    <DeclarationContext.Provider value={{ token, kind, owner, id }}>
      {children}
    </DeclarationContext.Provider>
  )
}

export function DashListNodeLeafBoundary({
  id,
  kind,
  children,
}: {
  readonly id: unknown
  readonly kind: NodeKind
  readonly children?: ReactNode
}) {
  useCommittedDashListNode(kind, id)
  return (
    <DashletLeafContext.Provider value={kind === 'dashlet'}>{children}</DashletLeafContext.Provider>
  )
}

export function useCommittedDashListNode(kind: NodeKind, id: unknown): void {
  const registry = useContext(RegistryContext)
  const declaration = useContext(DeclarationContext)
  const nestedDashlet = useContext(DashletLeafContext)
  const tokenRef = useRef<Token | null>(null)
  if (tokenRef.current === null) tokenRef.current = {}
  const token = tokenRef.current

  useEffect(() => {
    if (!registry) return
    const generation = registry.register(
      token,
      nestedDashlet ? null : (declaration?.token ?? null),
      kind,
      id,
    )
    return () => registry.releaseRegistration(token, generation)
  }, [declaration?.token, id, kind, nestedDashlet, registry, token])
}

export function DashListNodeValidation({ children }: { readonly children?: ReactNode }) {
  const registry = useContext(RegistryContext)
  const revision = useSyncExternalStore(
    registry?.subscribe ?? (() => () => undefined),
    registry?.getRevision ?? (() => 0),
    () => 0,
  )
  void revision
  const failure = registry?.getFailure() ?? null
  if (failure)
    throw new TypeError(
      `DashList node registration failed: ${failure.reason}${
        failure.id === undefined ? '' : ` (${JSON.stringify(failure.id)})`
      }`,
    )
  return children
}
