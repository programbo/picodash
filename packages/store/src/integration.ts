import type { StandardSchemaV1 } from '@standard-schema/spec'
import type {
  CoreTransactionResult,
  PicodashJsonValue,
  PicodashParseResult,
  RootStore,
  ScopedStore,
} from './kernel/index.js'
import {
  classifyIdentity,
  registerRuntimeHandle,
  runtimeScopedViewFor,
  runtimeControllerFor,
  runtimeControllerForHandle,
  type EntityRecord,
  type HostRecord,
  type ProviderRecord,
  type RelationshipRecord,
  type RuntimeController,
} from './runtime-controller.js'
import { PicodashContractError } from './kernel/index.js'

export type StoreEntityKind = 'dashPanel' | 'dashList'

export type InvalidEntityOptionsReason =
  | 'not-object'
  | 'unknown-key'
  | 'accessor-property'
  | 'invalid-kind'
  | 'host-required'

export type EntityLeaseOptions =
  | { readonly kind: 'dashPanel'; readonly host: ProviderLease | EntityLease }
  | { readonly kind: 'dashList'; readonly host?: ProviderLease | EntityLease }

declare const providerLeaseBrand: unique symbol
declare const entityLeaseBrand: unique symbol
declare const relationshipLeaseBrand: unique symbol

export type ProviderLease = Readonly<{
  readonly [providerLeaseBrand]: 'ProviderLease'
  release(): void
}>

export type EntityLease = Readonly<{
  readonly [entityLeaseBrand]: 'EntityLease'
  release(): void
}>

export type RelationshipLease = Readonly<{
  readonly [relationshipLeaseBrand]: 'RelationshipLease'
  release(): void
}>

type FieldLike = {
  readonly defaultValue: PicodashJsonValue
  readonly schema?: StandardSchemaV1<unknown, PicodashJsonValue>
  readonly parse?: (input: unknown) => PicodashParseResult<PicodashJsonValue>
}

const invalidHandle = (
  role: 'host' | 'parent' | 'child',
  reason: 'foreign-root' | 'released' | 'wrong-kind',
): never => {
  throw new PicodashContractError('invalid-integration-handle', { role, reason })
}

function providerOptions(options: unknown): string {
  if (options === undefined) return 'default'
  if (!options || typeof options !== 'object' || Array.isArray(options))
    throw new PicodashContractError('invalid-provider-id', { reason: 'not-string' })
  let providerId: unknown
  try {
    const descriptors = Object.getOwnPropertyDescriptors(options)
    for (const key of Reflect.ownKeys(descriptors)) {
      if (key !== 'providerId')
        throw new PicodashContractError('invalid-provider-id', { reason: 'not-string' })
    }
    const descriptor = descriptors.providerId
    if (descriptor) {
      if (!('value' in descriptor))
        throw new PicodashContractError('invalid-provider-id', { reason: 'not-string' })
      providerId = descriptor.value
    }
  } catch (error) {
    if (error instanceof PicodashContractError) throw error
    throw new PicodashContractError('invalid-provider-id', { reason: 'not-string' })
  }
  const reason = classifyIdentity(providerId === undefined ? 'default' : providerId)
  if (reason) throw new PicodashContractError('invalid-provider-id', { reason })
  return (providerId ?? 'default') as string
}

function entityOptions(options: unknown): {
  kind: StoreEntityKind
  hostPresent: boolean
  host: unknown
} {
  if (!options || typeof options !== 'object' || Array.isArray(options))
    throw new PicodashContractError('invalid-entity-options', { reason: 'not-object' })
  let descriptors: Record<PropertyKey, PropertyDescriptor>
  try {
    descriptors = Object.getOwnPropertyDescriptors(options)
    for (const key of Reflect.ownKeys(descriptors))
      if (key !== 'kind' && key !== 'host')
        throw new PicodashContractError('invalid-entity-options', { reason: 'unknown-key' })
    for (const key of ['kind', 'host'] as const) {
      const descriptor = descriptors[key]
      if (descriptor && !('value' in descriptor))
        throw new PicodashContractError('invalid-entity-options', { reason: 'accessor-property' })
    }
  } catch (error) {
    if (error instanceof PicodashContractError) throw error
    throw new PicodashContractError('invalid-entity-options', { reason: 'not-object' })
  }
  const kind = descriptors.kind?.value
  if (kind !== 'dashPanel' && kind !== 'dashList')
    throw new PicodashContractError('invalid-entity-options', { reason: 'invalid-kind' })
  const hostPresent = descriptors.host !== undefined
  if (kind === 'dashPanel' && !hostPresent)
    throw new PicodashContractError('invalid-entity-options', { reason: 'host-required' })
  return { kind, hostPresent, host: descriptors.host?.value }
}

function controllerForRoot(root: object): RuntimeController {
  const controller = runtimeControllerFor(root)
  if (!controller) invalidHandle('host', 'wrong-kind')
  return controller!
}

function resolveHost(
  controller: RuntimeController,
  value: unknown,
  role: 'host' | 'parent' | 'child',
): HostRecord {
  if (!value || typeof value !== 'object') return invalidHandle(role, 'wrong-kind')
  const owner = runtimeControllerForHandle(value)
  if (owner && owner !== controller) return invalidHandle(role, 'foreign-root')
  if (!owner) return invalidHandle(role, 'wrong-kind')
  const record = controller.handles.get(value)
  if (!record) return invalidHandle(role, 'wrong-kind')
  if (!record.active) return invalidHandle(role, 'released')
  if (record.kind === 'provider') return record.host
  return record.host
}

export function acquireProviderLease<
  Fields extends Record<string, FieldLike>,
  Result extends CoreTransactionResult = CoreTransactionResult,
>(rootStore: RootStore<Fields, Result>, options?: { readonly providerId?: string }): ProviderLease {
  const controller = controllerForRoot(rootStore as object)
  const providerId = providerOptions(options)
  if (controller.providers.has(providerId))
    throw new PicodashContractError('duplicate-provider', { providerId })
  const token = Object.freeze({})
  const host = { token, providerId, standalone: false } as HostRecord
  const record: ProviderRecord = {
    kind: 'provider',
    root: rootStore as object,
    host,
    providerId,
    lease: undefined as unknown as object,
    active: true,
    entities: new Set<EntityRecord>(),
  }
  const lease = Object.freeze({
    release: () => {
      if (!record.active) return
      if (record.entities.size > 0)
        throw new PicodashContractError('lease-has-active-dependents', { leaseKind: 'provider' })
      record.active = false
      controller.providers.delete(providerId)
    },
  }) as ProviderLease
  record.lease = lease
  controller.providers.set(providerId, record)
  controller.handles.set(lease, record)
  registerRuntimeHandle(lease, controller)
  return lease
}

export function acquireEntityLease<
  Fields extends Record<string, FieldLike>,
  Result extends CoreTransactionResult = CoreTransactionResult,
>(scopedStore: ScopedStore<Fields, Result>, options: EntityLeaseOptions): EntityLease {
  const parsed = entityOptions(options)
  const scopedRecord = runtimeScopedViewFor(scopedStore as object)
  if (!scopedRecord) invalidHandle('host', 'wrong-kind')
  const controller = scopedRecord!.controller
  const scopeId = scopedRecord!.scopeId
  let host: HostRecord
  let hostParent: EntityRecord | undefined
  if (parsed.hostPresent) {
    host = resolveHost(controller, parsed.host, 'host')
    const hostRecord = controller.handles.get(parsed.host as object)
    if (hostRecord?.kind === 'entity') hostParent = hostRecord
  } else {
    const standalone = Object.freeze({ token: Object.freeze({}), standalone: true }) as HostRecord
    host = standalone
  }
  const existing = [...controller.entities].find(
    (entity) => entity.active && entity.scopeId === scopeId && entity.entityKind === parsed.kind,
  )
  if (existing)
    throw new PicodashContractError('duplicate-entity', {
      scopeId,
      entityKind: parsed.kind,
    })
  const conflicting = [...controller.entities].find(
    (entity) => entity.active && entity.scopeId === scopeId && entity.host.token !== host.token,
  )
  if (conflicting)
    throw new PicodashContractError('scope-host-conflict', { scopeId: scopedStore.scopeId })
  const record: EntityRecord = {
    kind: 'entity',
    root: controller.root,
    scopeId,
    entityKind: parsed.kind,
    host,
    lease: undefined as unknown as object,
    active: true,
    hostParent,
    hostDependents: new Set<EntityRecord>(),
  }
  const lease = Object.freeze({
    release: () => {
      if (!record.active) return
      if (
        record.hostDependents.size > 0 ||
        [...controller.relationships].some(
          (relationship) =>
            relationship.active &&
            (relationship.parent === record || relationship.child === record),
        )
      )
        throw new PicodashContractError('lease-has-active-dependents', { leaseKind: 'entity' })
      record.active = false
      if (record.hostParent) record.hostParent.hostDependents.delete(record)
      controller.entities.delete(record)
      const provider = [...controller.providers.values()].find(
        (entry) => entry.host.token === host.token,
      )
      provider?.entities.delete(record)
    },
  }) as EntityLease
  record.lease = lease
  controller.entities.add(record)
  if (hostParent) hostParent.hostDependents.add(record)
  controller.handles.set(lease, record)
  registerRuntimeHandle(lease, controller)
  const provider = [...controller.providers.values()].find(
    (entry) => entry.host.token === host.token,
  )
  provider?.entities.add(record)
  return lease
}

export function acquireRelationshipLease(
  parentEntity: EntityLease,
  childEntity: EntityLease,
): RelationshipLease {
  const parent = parentEntity as object
  const child = childEntity as object
  const parentController = runtimeControllerForHandle(parent)
  const childController = runtimeControllerForHandle(child)
  if (!parentController) invalidHandle('parent', 'wrong-kind')
  const parentCandidate = parentController!.handles.get(parent)
  if (!parentCandidate || parentCandidate.kind !== 'entity') invalidHandle('parent', 'wrong-kind')
  const parentRecord = parentCandidate as EntityRecord
  if (!parentRecord.active) invalidHandle('parent', 'released')
  if (!childController) invalidHandle('child', 'wrong-kind')
  if (childController !== parentController) invalidHandle('child', 'foreign-root')
  const childCandidate = parentController!.handles.get(child)
  if (!childCandidate || childCandidate.kind !== 'entity') invalidHandle('child', 'wrong-kind')
  const childRecord = childCandidate as EntityRecord
  if (!childRecord.active) invalidHandle('child', 'released')
  if (parentRecord.scopeId === childRecord.scopeId)
    throw new PicodashContractError('invalid-relationship', { reason: 'same-scope' })
  if (parentRecord.host.token !== childRecord.host.token)
    throw new PicodashContractError('invalid-relationship', { reason: 'host-boundary' })
  const edgeCheck = parentController!.acquireScopeEdge(parentRecord.scopeId, childRecord.scopeId)
  if (edgeCheck === 'conflict')
    throw new PicodashContractError('relationship-parent-conflict', {
      childScopeId: childRecord.scopeId,
    })
  if (edgeCheck === 'cycle')
    throw new PicodashContractError('relationship-cycle', {
      parentScopeId: parentRecord.scopeId,
      childScopeId: childRecord.scopeId,
    })
  const record: RelationshipRecord = {
    parent: parentRecord,
    child: childRecord,
    parentScopeId: parentRecord.scopeId,
    childScopeId: childRecord.scopeId,
    active: true,
  }
  parentController!.relationships.add(record)
  const lease = Object.freeze({
    release: () => {
      if (!record.active) return
      record.active = false
      parentController!.relationships.delete(record)
      parentController!.releaseScopeEdge(record.parentScopeId, record.childScopeId)
    },
  }) as RelationshipLease
  parentController!.relationshipHandles.set(lease, record)
  registerRuntimeHandle(lease, parentController!)
  return lease
}
