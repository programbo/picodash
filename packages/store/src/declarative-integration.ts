import type { StandardSchemaV1 } from '@standard-schema/spec'
import type {
  CoreTransactionResult,
  PicodashJsonValue,
  PicodashParseResult,
  RootStore,
  ScopedStore,
} from './kernel/index.js'
import {
  acquireEntityLease,
  acquireProviderLease,
  acquireRelationshipLease,
  type EntityLease,
  type EntityLeaseOptions,
  type ProviderLease,
  type RelationshipLease,
  type StoreEntityKind,
} from './integration-leases.js'

type FieldLike = {
  readonly defaultValue: PicodashJsonValue
  readonly schema?: StandardSchemaV1<unknown, PicodashJsonValue>
  readonly parse?: (input: unknown) => PicodashParseResult<PicodashJsonValue>
}

export type DeclarativeEntityToken = Readonly<{}>

export type DeclarativeEntityMount<
  Fields extends Record<string, FieldLike> = Record<string, FieldLike>,
  Result extends CoreTransactionResult = CoreTransactionResult,
> = {
  readonly token: DeclarativeEntityToken
  readonly store: ScopedStore<Fields, Result>
  readonly kind: StoreEntityKind
  readonly parent?: DeclarativeEntityToken
}

export interface DeclarativeIntegrationHost<
  Fields extends Record<string, FieldLike> = Record<string, FieldLike>,
  Result extends CoreTransactionResult = CoreTransactionResult,
> {
  mountProvider(): void
  unmountProvider(): void
  mountEntity(input: DeclarativeEntityMount<Fields, Result>): void
  unmountEntity(token: DeclarativeEntityToken): void
}

type ActiveEntity = {
  readonly declaration: DeclarativeEntityMount
  readonly lease: EntityLease
  readonly relationship?: RelationshipLease
}

const isObjectToken = (token: DeclarativeEntityToken): token is object =>
  token !== null && typeof token === 'object'

const depthOf = (
  token: DeclarativeEntityToken,
  declarations: ReadonlyMap<DeclarativeEntityToken, DeclarativeEntityMount>,
): number => {
  let depth = 0
  let current = declarations.get(token)?.parent
  const seen = new Set<DeclarativeEntityToken>()
  while (current && !seen.has(current)) {
    seen.add(current)
    depth += 1
    current = declarations.get(current)?.parent
  }
  return depth
}

export function createDeclarativeEntityToken(): DeclarativeEntityToken {
  return Object.freeze({})
}

export function createDeclarativeIntegrationHost<
  Fields extends Record<string, FieldLike>,
  Result extends CoreTransactionResult,
>(
  rootStore: RootStore<Fields, Result>,
  providerId?: string,
): DeclarativeIntegrationHost<Fields, Result> {
  const declarations = new Map<DeclarativeEntityToken, DeclarativeEntityMount<Fields, Result>>()
  const active = new Map<DeclarativeEntityToken, ActiveEntity>()
  let provider: ProviderLease | undefined

  const releaseActive = (token: DeclarativeEntityToken): void => {
    const entry = active.get(token)
    if (!entry) return
    entry.relationship?.release()
    entry.lease.release()
    active.delete(token)
  }

  const rollback = (attempt: readonly DeclarativeEntityToken[]): void => {
    for (const token of [...attempt].reverse()) releaseActive(token)
  }

  const canActivate = (declaration: DeclarativeEntityMount): boolean => {
    if (active.has(declaration.token)) return false
    if (declaration.parent) {
      if (!declarations.has(declaration.parent)) return false
      return active.has(declaration.parent)
    }
    return provider !== undefined
  }

  const activate = (declaration: DeclarativeEntityMount): ActiveEntity => {
    const parent = declaration.parent ? active.get(declaration.parent) : undefined
    const host = parent?.lease ?? provider
    let lease: EntityLease
    if (host) {
      const options: EntityLeaseOptions =
        declaration.kind === 'dashPanel' ? { kind: 'dashPanel', host } : { kind: 'dashList', host }
      lease = acquireEntityLease(
        declaration.store as ScopedStore<Record<string, FieldLike>, CoreTransactionResult>,
        options,
      )
    } else {
      throw new Error('Declarative entity activation requires an active Provider or parent.')
    }
    let relationship: RelationshipLease | undefined
    try {
      if (parent && parent.declaration.store.scopeId !== declaration.store.scopeId)
        relationship = acquireRelationshipLease(parent.lease, lease)
      return { declaration, lease, relationship }
    } catch (error) {
      relationship?.release()
      lease.release()
      throw error
    }
  }

  const activateReady = (): void => {
    const attempt: DeclarativeEntityToken[] = []
    try {
      let progress = true
      while (progress) {
        progress = false
        for (const declaration of declarations.values()) {
          if (!canActivate(declaration)) continue
          const entry = activate(declaration)
          active.set(declaration.token, entry)
          attempt.push(declaration.token)
          progress = true
        }
      }
    } catch (error) {
      rollback(attempt)
      throw error
    }
  }

  const host: DeclarativeIntegrationHost<Fields, Result> = {
    mountProvider() {
      if (provider) return
      const nextProvider = acquireProviderLease(
        rootStore,
        providerId === undefined ? undefined : { providerId },
      )
      provider = nextProvider
      try {
        activateReady()
      } catch (error) {
        provider = undefined
        nextProvider.release()
        throw error
      }
    },

    unmountProvider() {
      const tokens = [...active.keys()].sort(
        (left, right) => depthOf(right, declarations) - depthOf(left, declarations),
      )
      for (const token of tokens) releaseActive(token)
      provider?.release()
      provider = undefined
      declarations.clear()
    },

    mountEntity(input) {
      if (!isObjectToken(input.token))
        throw new TypeError('Declarative entity tokens must be objects.')
      if (declarations.has(input.token))
        throw new Error('Declarative entity token is already mounted.')
      declarations.set(input.token, input)
      if (provider && (!input.parent || active.has(input.parent))) {
        try {
          activateReady()
        } catch (error) {
          declarations.delete(input.token)
          throw error
        }
      }
    },

    unmountEntity(token) {
      if (!isObjectToken(token) || (!declarations.has(token) && !active.has(token))) return
      const subtree = new Set<DeclarativeEntityToken>([token])
      let changed = true
      while (changed) {
        changed = false
        for (const declaration of declarations.values()) {
          if (
            declaration.parent &&
            subtree.has(declaration.parent) &&
            !subtree.has(declaration.token)
          ) {
            subtree.add(declaration.token)
            changed = true
          }
        }
      }
      const tokens = [...subtree].sort(
        (left, right) => depthOf(right, declarations) - depthOf(left, declarations),
      )
      for (const entry of tokens) releaseActive(entry)
      for (const entry of subtree) declarations.delete(entry)
    },
  }
  return host
}
