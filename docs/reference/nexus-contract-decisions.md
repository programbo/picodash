# Nexus contract decisions

This reference records the accepted target decisions for `@picodash/nexus` and its composition with
DashPanel and DashList. It is the searchable source for exact contract details. ADR 0002 explains
why the model exists; this page states what the model requires.

## Status

> Contract: Accepted
> Implementation: Prototype
> Evidence: The conformance matrix has not yet reconciled most decisions with implementation.

Unless a section says otherwise, names shown as method examples are target API names rather than a
claim that the prototype exports them.

## 1. Root Nexus and scope model

### 1.1 One root authority

A Picodash root Nexus owns one complete set of field contracts and canonical values. It may be used
at Provider level or deliberately shared at application level.

### 1.2 Scoped views are aliases

`root.scope('settings')` returns an immutable scoped view of the same root Nexus. A scoped view does
not contain or copy a separate value nexus.

Calling `settings.scope('other')` resolves the canonical `other` view through the root. It does not
mutate `settings` or create a relative child path.

### 1.3 Canonical view identity is weakly cached

While a scoped handle remains referenced, every `scope(id)` call for that root and ID returns the
same object. An unreferenced view may be garbage-collected and recreated later. Correctness uses the
pair `(rootStore, scopeId)`, never permanent JavaScript reference identity.

Scoped views have no public `release()`, `dispose()`, reference-count, or view-level `destroy()` API.
The root keeps only weak references to canonical views; correctness never depends on finalizer
timing. `destroyScope()` clears scope state without invalidating the live view or evicting it from
the weak cache. Provider, entity, relationship, and binding lease counts belong to the integration
runtime and are unrelated to scoped-view reachability.

### 1.4 Scopes do not restrict values

Every scoped view exposes the full root field set and canonical value record. A scoped view may
write any root field. Scope affects metadata, registration, management queries, and operation
attribution; it is not access control.

### 1.5 Runtime registries use nested maps

Scopes, nodes, bindings, and relationship indexes use immutable nested `ReadonlyMap` structures,
not composite string keys. Persisted documents encode maps as validated entry arrays and reject
duplicate keys.

### 1.6 Optional capabilities are namespaced and typed

Core value, scope, transaction, and diagnostic APIs are always available. Supplying both `nexusId`
and `schemaVersion` adds a typed `documents` namespace with import operations. Export configuration
adds export operations to that namespace. Persistence configuration adds a typed `persistence`
namespace. APIs that cannot work for a given configuration are absent from its TypeScript surface
rather than present only to return “not configured.” Scoped views inherit enabled root capabilities
with scope-aware operations.

## 2. Identity

### 2.1 Scope IDs

Scope IDs are opaque, case-sensitive strings. They reject empty or whitespace-only values,
leading/trailing whitespace, and control characters. Picodash does not normalize them or interpret
slashes, dots, or colons as hierarchy.

Invalid scope IDs throw `PicodashContractError` with code `invalid-scope-id` and this safe context:

```ts
type InvalidScopeIdReason = 'not-string' | 'empty' | 'surrounding-whitespace' | 'control-character'
```

The error context is exactly `{ reason: InvalidScopeIdReason }`.

Validation classifies a runtime non-string first, then empty or whitespace-only input, then leading
or trailing whitespace, then C0/C1 control characters (`U+0000–001F` and `U+007F–009F`). The error
context never contains the rejected value. Every root or scoped operation that accepts a scope ID
validates it before lookup, graph traversal, or mutation.

The same lexical rule applies to `nexusId`, `providerId`, DashList node IDs, and binding aliases.
Field keys additionally reject `__proto__`, `prototype`, and `constructor` so field/value records
cannot become prototype-mutation channels. Punctuation remains opaque and legal. `storageKey` is a
driver locator rather than an entity ID, but must still be non-empty and control-character-free.

### 2.2 Public naming

DashPanel and DashList components expose `id`. Nexus state, methods, documents, transaction
metadata, and diagnostics use `scopeId`. The Nexus model does not expose separate `panelId` and
`listId` identities.

### 2.3 Provider IDs

`providerId` defaults to `default`. One root may have only one active Provider with a given
Provider ID. Two active default Providers sharing a root conflict. Providers using different root
Nexuses do not conflict merely because both use `default`.

Provider IDs identify runtime hosts and do not namespace scope IDs.

### 2.4 Runtime identity, Nexus IDs, and schema versions

Every root receives an internal runtime identity used for nominal ownership and live conflict
checks. It is never serialized.

Public `nexusId` is optional for an ephemeral Nexus. It becomes required when persistence, export,
import, or schema migration is enabled. A `storageKey` is only a storage locator and cannot replace
logical Nexus identity. Documents and envelopes record `nexusId`, never runtime identity or the
storage key.

Ephemeral Nexuses may omit `schemaVersion`. Persistence, export, import, or configured migrations
require a positive safe-integer application `schemaVersion`. A Panel-only Nexus that persists layout still
declares it because scope IDs and metadata semantics may evolve. Documents also record
Picodash-owned `formatVersion`; the two versions have different ownership.

Supplying `schemaVersion` without `nexusId` is invalid because a version has no logical document
identity to qualify. Supplying `nexusId` alone is allowed for an otherwise ephemeral Nexus but does
not enable documents.

### 2.5 Mount-lifetime identity

Provider root Nexus, Provider ID, resolved entity root, scope ID, item ID, group ID, and binding
alias are immutable for a mount lifetime. Intentional identity changes use keyed remounts.

## 3. Provider, entity, and relationship rules

### 3.1 Provider requires a root Nexus

`DashPanelProvider` receives an explicit root Nexus. Integrated `PicodashProvider` composes the same
boundary contract. Neither silently creates a Nexus, and both reject a scoped Nexus.

### 3.2 DashPanel requires a Provider

DashPanel resolves its Nexus through `DashPanelProvider` or integrated `PicodashProvider`. It does
not expose a public independent Nexus prop.

### 3.3 Standalone DashList resolution

For a standalone DashList:

- root Nexus plus `id` resolves that scope;
- scoped Nexus without `id` uses the Nexus's scope;
- scoped Nexus plus matching `id` is allowed but redundant;
- scoped Nexus plus conflicting `id` throws;
- root Nexus without `id` throws when there is no nearest scope to inherit.

Inside Nexus context, a `nexus` prop may be used only when it has the same root and its scope agrees
with `id`. A different root throws. Normal Provider composition omits the Nexus prop.

### 3.4 Nearest Nexus context

`usePicodashNexus()` resolves the nearest Nexus context:

- Provider supplies its root;
- DashPanel supplies its scoped view;
- standalone DashList supplies its scoped view.

The hook throws when no Nexus context exists. Supplying a scope ID resolves that view from the
nearest root.

### 3.5 Provider is a hard boundary

Every `DashPanelProvider` or integrated `PicodashProvider` resets Nexus context to its supplied root
and clears inherited scope ancestry. No child-scope edge crosses a Provider boundary. A nested
Provider may introduce a different root or reuse the same root with a unique Provider ID and
disjoint active scopes.

Only a Provider establishes a new root boundary; component Nexus props cannot switch roots.

### 3.6 One entity of each kind per scope

A scope permits at most one active DashPanel and one active DashList. One Panel and its primary List
may share a scope. Duplicate active entities of the same kind throw.

### 3.7 One active host per scope

All active entities in a scope agree on one Provider host. A standalone DashList may temporarily
own a standalone host. One scope cannot be split concurrently across Providers or between a
Provider and standalone host. Host affinity releases after every entity unmounts; durable scope
state remains.

### 3.8 Declarative parent-child relationships

Any DashPanel or DashList that resolves to a different scope from the nearest scoped context
registers a parent-child edge. Resolving the same scope creates no edge. Manual `nexus.scope()` calls
never create relationships.

Edges exist only while their declarative boundaries hold active leases. Unmount or React effect
deactivation removes the edge but preserves scope state. One child may have only one active parent;
cycles and simultaneous parents throw. Mount tokens make registration safe under React Strict Mode.

### 3.9 Public integration leases

`@picodash/nexus/integration` exposes the exact Provider, entity, and relationship acquisition
surface used by declarative UI products:

```ts
type NexusEntityKind = 'dashPanel' | 'dashList'

type EntityLeaseOptions =
  | {
      readonly kind: 'dashPanel'
      readonly host: ProviderLease | EntityLease
    }
  | {
      readonly kind: 'dashList'
      readonly host?: ProviderLease | EntityLease
    }

type InvalidEntityOptionsReason =
  'not-object' | 'unknown-key' | 'accessor-property' | 'invalid-kind' | 'host-required'

declare const providerLeaseBrand: unique symbol
declare const entityLeaseBrand: unique symbol
declare const relationshipLeaseBrand: unique symbol

type ProviderLease = Readonly<{
  [providerLeaseBrand]: 'ProviderLease'
  release(): void
}>

type EntityLease = Readonly<{
  [entityLeaseBrand]: 'EntityLease'
  release(): void
}>

type RelationshipLease = Readonly<{
  [relationshipLeaseBrand]: 'RelationshipLease'
  release(): void
}>

declare function acquireProviderLease<
  Fields extends Record<string, FieldLike>,
  Result extends CoreTransactionResult = CoreTransactionResult,
>(rootStore: RootNexus<Fields, Result>, options?: { readonly providerId?: string }): ProviderLease

declare function acquireEntityLease<
  Fields extends Record<string, FieldLike>,
  Result extends CoreTransactionResult = CoreTransactionResult,
>(scopedStore: ScopedNexus<Fields, Result>, options: EntityLeaseOptions): EntityLease

declare function acquireRelationshipLease(
  parentEntity: EntityLease,
  childEntity: EntityLease,
): RelationshipLease
```

The returned objects are frozen, opaque, nominal mount generations. Their only caller-visible
operation is `release()`, and callers never supply or reconstruct a lease ID. `providerId` defaults
to `default`; Provider acquisition accepts only a root Nexus, and entity acquisition accepts only a
scoped Nexus. A Provider-hosted root entity supplies its `ProviderLease`; a nested entity supplies
the nearest `EntityLease`. Only a standalone root DashList may omit `host`, in which case Nexus owns
a private standalone-host generation. Every DashPanel must resolve transitively to a Provider
generation.

Entity options are validated as an exact own-key data record before any host handle is examined.
The deterministic validation order is non-null, non-array object; no unknown own string or symbol
key beyond `kind` and `host`; no accessor for either known key; exact `dashPanel | dashList` kind;
then the required presence of `host` for `dashPanel`. Failure throws `invalid-entity-options` with
exactly `{ reason: InvalidEntityOptionsReason }`. A present host is then validated as a handle, so an
invalid, foreign, released, or wrong-kind host remains `invalid-integration-handle`. No failure
context contains the rejected option, key, descriptor, or host.

Provider and entity handles carry their root and host generation privately. Relationship
acquisition derives both facts from its two handles, rejects a different root or host generation,
and therefore cannot cross a nested Provider boundary even when both Providers share a root Nexus.
Several live relationship leases may represent the same ordered parent-child edge; the edge remains
active until its final generation releases. A child may have only one active parent. Same-scope
edges, cycles, cross-root edges, and cross-host edges are rejected.

The first successful `release()` is lifecycle teardown and later calls are idempotent no-ops.
Provider and entity release refuse while dependent leases remain active; callers tear down in the
order relationship, child entity, parent entity, then Provider. Binding acquisition is a separate
Nexus integration lease and does not require an EntityLease or an active entity registration.

### 3.9.1 Binding acquisition lease (BIND-LEASE-1)

`@picodash/nexus/integration` exposes the minimal binding registration seam:

```ts
type NexusBindingMode = 'input' | 'display'

type AcquireBindingOptions<
  Fields extends Record<string, FieldLike>,
  Key extends keyof Fields & string,
> = {
  readonly itemId: string
  readonly field: PicodashField<ValuesOf<Fields>, Key>
  readonly alias?: string
  readonly mode: NexusBindingMode
}

type BindingHandle<
  Fields extends Record<string, FieldLike>,
  Key extends keyof Fields & string,
> = Readonly<{
  readonly scopeId: string
  readonly itemId: string
  readonly alias: string
  readonly field: PicodashField<ValuesOf<Fields>, Key>
  readonly mode: NexusBindingMode
  release(): void
}>

declare function acquireBindingLease<
  Fields extends Record<string, FieldLike>,
  Key extends keyof Fields & string,
  Result extends CoreTransactionResult = CoreTransactionResult,
>(
  scopedStore: ScopedNexus<Fields, Result>,
  options: AcquireBindingOptions<Fields, Key>,
): BindingHandle<Fields, Key>
```

Binding identity is `(scopeId, itemId, alias)`; an omitted alias defaults to `field.key`. Options
are validated as an exact non-array object in deterministic order: own keys, data descriptors,
lexical `itemId`, lexical explicit alias, exact mode, then same-root nominal field. Invalid options
throw `invalid-binding-options` with exactly `{ reason }`, where reason is one of
`not-object | unknown-key | accessor-property | invalid-item-id | invalid-alias | invalid-mode`.
Foreign fields throw `foreign-handle`; a live duplicate tuple throws `duplicate-binding` with
exactly `{ scopeId, itemId, alias }`.

Each tuple has one active generation. A released handle is idempotent; a later command validating
that handle classifies it as `released` when the tuple is absent and `superseded` when a newer
generation occupies the tuple. Binding handles are nominal, root-owned, immutable tokens exposing
only identity, field, mode, and `release()`. Binding leases participate in root destruction refusal.
Registration and release with no populated interaction state preserve snapshot references and send
no subscribers. Release clears only the binding's ephemeral interaction state and prunes an empty
item interaction record; canonical values and durable scope metadata remain unchanged. Future Nexus
commands receiving a bad handle throw `invalid-binding-handle` with exactly
`{ reason: 'foreign-root' | 'released' | 'superseded' | 'wrong-kind' }`.

The integration contract errors and their complete safe contexts are:

| Code                           | Context                                                                                         |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| `invalid-provider-id`          | `{ reason: InvalidProviderIdReason }`                                                           |
| `duplicate-provider`           | `{ providerId: string }`                                                                        |
| `invalid-entity-options`       | `{ reason: InvalidEntityOptionsReason }`                                                        |
| `invalid-integration-handle`   | `{ role: 'host' \| 'parent' \| 'child', reason: 'foreign-root' \| 'released' \| 'wrong-kind' }` |
| `duplicate-entity`             | `{ scopeId: string, entityKind: NexusEntityKind }`                                              |
| `scope-host-conflict`          | `{ scopeId: string }`                                                                           |
| `invalid-relationship`         | `{ reason: 'same-scope' \| 'host-boundary' }`                                                   |
| `relationship-parent-conflict` | `{ childScopeId: string }`                                                                      |
| `relationship-cycle`           | `{ parentScopeId: string, childScopeId: string }`                                               |
| `lease-has-active-dependents`  | `{ leaseKind: 'provider' \| 'entity' }`                                                         |
| `missing-nexus-context`        | `{ required: 'root-or-scoped' \| 'scoped' }`                                                    |

`InvalidProviderIdReason` is the same lexical reason union as `InvalidScopeIdReason`. Context never
contains a Nexus, handle, root runtime identity, host generation, caller-supplied invalid value,
stack, or arbitrary cause.

### 3.9.2 DashList node presence lease (DASHLIST-NODE-LEASE-1)

`@picodash/nexus/integration` exposes one narrow presence lease for DashList nodes that can own
durable metadata, including groups and unbound Dashlets:

```ts
type InvalidDashListNodeOptionsReason =
  'not-object' | 'unknown-key' | 'accessor-property' | 'invalid-node-id'

type AcquireDashListNodeOptions = {
  readonly nodeId: string
}

declare const dashListNodeLeaseBrand: unique symbol

type DashListNodeLease = Readonly<{
  readonly [dashListNodeLeaseBrand]: 'DashListNodeLease'
  release(): void
}>

declare function acquireDashListNodeLease<
  Fields extends Record<string, FieldLike>,
  Result extends CoreTransactionResult = CoreTransactionResult,
>(scopedStore: ScopedNexus<Fields, Result>, options: AcquireDashListNodeOptions): DashListNodeLease
```

Identity is `(scopeId, nodeId)`. Options are an exact own-key data record and are validated as
non-null non-array object, no unknown own string or symbol keys, data descriptor for `nodeId`, then
the ordinary lexical node-ID rule. Invalid records throw `invalid-dash-list-node-options` with
exactly `{ reason: InvalidDashListNodeOptionsReason }`. A live duplicate throws
`duplicate-dash-list-node` with exactly `{ scopeId, nodeId }`.

The lease carries no node kind, containment, entity dependency, registration query, or durable
state. DashList retains its private declaration agreement, kind, and containment validation and
acquires this Nexus lease only from the committed leaf-node effect. Release is idempotent and only
ends that presence generation. Acquisition and release notify no Nexus subscriber, create no scope
metadata, and never delete dormant metadata. A live node lease participates in root-destruction
refusal. Abandoned renders acquire nothing, and Strict Mode reacquisition reruns duplicate checks.

Active membership is private Nexus runtime input for prune freshness. It never appears in root or
scoped snapshots, diagnostics, persistence, documents, or a public query API.

### 3.10 Private runtime controller

One module-private `WeakMap` resolves a root Nexus to its runtime controller. The integration entry
uses that controller for host and relationship generations, and `destroyScope()` uses the same
controller for active descendant traversal. The controller is registered during Nexus creation and
is never exposed on a root, scoped view, snapshot, document, persisted envelope, or diagnostic.

## 4. Active lifecycle and destruction

### 4.1 Active means holding a committed lease

Abandoned renders never register. Effect deactivation releases entity, host, and relationship
leases. Reactivation reacquires them and reruns conflict checks. CSS hiding does not release a lease.

### 4.2 Scope state lifecycle

Creating a scoped handle does not create stored scope state. Scoped snapshots expose
`scope: DurableScopeMetadata | undefined`; built-in components resolve `undefined` against their declared
defaults until a durable override, import, or hydration creates metadata. Entity registration,
relationship leases, value attribution, and binding interaction alone never create a durable
scope record.

Unmount preserves durable metadata. Final binding unmount clears drafts, touched state, input
issues, focus, hover, active state, and stale-draft conflicts.

### 4.3 Destroying scope state

```ts
type InvalidDestroyOptionsReason =
  | 'not-object'
  | 'unknown-key'
  | 'accessor-property'
  | 'invalid-include-descendants'
  | 'invalid-discard-unpersisted'

type DestroyScopeOptions = {
  readonly includeDescendants?: boolean
}

root.destroyScope(scopeId, options) // preserves the root's configured Result
scoped.destroyScope(options) // preserves the same configured Result
```

Both destruction operations validate their options as an exact own-key data record. `undefined` is
accepted. A null, array, primitive, or function is `not-object`. Validation then checks, in order:
own string and symbol keys outside that operation's single allowed key as `unknown-key`; a known
accessor as `accessor-property` before reading it; and a present value of the wrong boolean form as
`invalid-include-descendants` for `destroyScope()` or `invalid-discard-unpersisted` for
`root.destroy()`. The latter accepts only literal `true` when present. Every failure throws
`invalid-destroy-options` with exactly `{ reason: InvalidDestroyOptionsReason }`; context contains
no rejected value, key, or property descriptor.

`destroyScope(id)` erases that scope's durable and ephemeral state without changing canonical
values or invalidating its ID or live handle. Active registrations, relationships, and other leases
remain and resolve their declarative defaults without writing a new durable record; a later durable
user operation may create one.

`includeDescendants: true` follows only edges active at the time of destruction. Omission targets
only the explicit scope. Historical dormant ancestry is never inferred. Dormant scopes are destroyed
by explicit ID or an explicit administrative selection. The Nexus validates the complete target set
before one atomic mutation.

A successful result has `changedFields: []` and sorted `changedScopeIds` containing only scopes whose
durable or interaction state changed. Destroying absent state succeeds with both changed arrays empty.
Option validation uses the exact mapping above; malformed root scope IDs throw `invalid-scope-id`
before lookup. Destruction neither releases leases nor changes relationship registration.

### 4.4 Root lifetime

The application owns the root Nexus lifetime. Provider unmount releases leases but never destroys
the supplied root.

```ts
type DestroyRootOptions = {
  readonly discardUnpersisted: true
}

root.destroy(options?: DestroyRootOptions): void
```

`root.destroy()` is final and is not a transaction. Refusal is atomic and follows this order:

1. options are validated by the exact `invalid-destroy-options` mapping above;
2. any Provider, entity, relationship, or binding lease throws `root-has-active-leases`;
3. unpersisted state without explicit discard throws `root-has-unpersisted-state`.

`discardUnpersisted` never bypasses live-lease refusal. On success, destruction releases adapter and
persistence subscriptions, persistence ownership, diagnostics listeners, cached snapshots, and weak
scope-view cache entries. Calling `destroy()` again throws `use-after-destroy`.

Destroying a root never deletes its persisted envelope and never resets live values first.
`discardUnpersisted` discards only the pending in-memory envelope during teardown; it does not erase
the last durable record. Persisted data removal uses the persistence capability's explicit erase
plan before destruction.

After successful destruction, every property access and method call on an existing `RootNexus` or
`ScopedNexus`, diagnostics namespace, or capability handle throws `use-after-destroy`. Previously
returned unsubscribe functions remain idempotent no-ops, and previously captured immutable snapshots
remain readable detached data. Existing field handles remain inspectable values, but no destroyed
Nexus can operate on them.

Implementation follows the dependency order integration leases, root lifecycle, then adapter and
persistence authority. This sequencing lets destruction inspect active lease generations before it
releases adapter subscriptions, persistence subscriptions, or persistence ownership; it does not add
or change any public alpha API.

### 4.5 Scope rename is deferred

The initial public API does not include `renameScope()`. Persisted renames use explicit schema
migration before entities become active. A future administrative rename must require inactive
source and target scopes, an empty target, atomic metadata movement, and no root-value changes.

## 5. Root and scoped state surfaces

### 5.1 Distinct Nexus types

Root and scoped Nexuses have distinct TypeScript interfaces and a discriminant. Both share field and
canonical value operations. Scoped Nexus exposes `scopeId` and an explicit `.root` reference.

The exact scope/value/lifecycle portion is:

```ts
type FieldLike = {
  readonly defaultValue: PicodashJsonValue
  readonly schema?: StandardSchemaV1<unknown, PicodashJsonValue>
  readonly parse?: (input: unknown) => PicodashParseResult<PicodashJsonValue>
}

interface RootNexus<
  Fields extends Record<string, FieldLike>,
  Result extends CoreTransactionResult = CoreTransactionResult,
> extends RootMetadataCommands<Result> {
  readonly kind: 'root'
  readonly diagnostics: PicodashDiagnostics
  readonly fields: PicodashFields<Fields>
  scope(scopeId: string): ScopedNexus<Fields, Result>
  getState(): RootNexusSnapshot<ValuesOf<Fields>>
  subscribe(listener: () => void): () => void
  setValue<K extends keyof Fields & string>(
    field: PicodashField<ValuesOf<Fields>, K>,
    value: ValuesOf<Fields>[K],
  ): Result
  setValueOrThrow<K extends keyof Fields & string>(
    field: PicodashField<ValuesOf<Fields>, K>,
    value: ValuesOf<Fields>[K],
  ): Extract<Result, { readonly ok: true }>
  setValues(values: Partial<ValuesOf<Fields>>): Result
  setValuesOrThrow(values: Partial<ValuesOf<Fields>>): Extract<Result, { readonly ok: true }>
  destroyScope(scopeId: string, options?: DestroyScopeOptions): Result
  destroy(options?: DestroyRootOptions): void
}

interface ScopedNexus<
  Fields extends Record<string, FieldLike>,
  Result extends CoreTransactionResult = CoreTransactionResult,
> extends ScopedMetadataCommands<Result> {
  readonly kind: 'scoped'
  readonly diagnostics: PicodashDiagnostics
  readonly root: RootNexus<Fields, Result>
  readonly scopeId: string
  readonly fields: PicodashFields<Fields>
  scope(scopeId: string): ScopedNexus<Fields, Result>
  getState(): ScopedNexusSnapshot<ValuesOf<Fields>>
  subscribe(listener: () => void): () => void
  setValue<K extends keyof Fields & string>(
    field: PicodashField<ValuesOf<Fields>, K>,
    value: ValuesOf<Fields>[K],
  ): Result
  setValueOrThrow<K extends keyof Fields & string>(
    field: PicodashField<ValuesOf<Fields>, K>,
    value: ValuesOf<Fields>[K],
  ): Extract<Result, { readonly ok: true }>
  setValues(values: Partial<ValuesOf<Fields>>): Result
  setValuesOrThrow(values: Partial<ValuesOf<Fields>>): Extract<Result, { readonly ok: true }>
  destroyScope(options?: DestroyScopeOptions): Result
}
```

`FieldLike` is a declaration helper rather than a package export. The value-operation parameter
types are identical on both interfaces. `scoped.fields` is the exact same object as
`scoped.root.fields`, and `scoped.scope(id)` resolves through that root. Scoped writes
pass `originScopeId: scoped.scopeId` to field/root validation and the external adapter context. The
scope is attribution only: a value-only success changes canonical root fields and leaves
`changedScopeIds` empty.

A non-persistent configuration instantiates `RootNexus<Fields, CoreTransactionResult>` and its
scoped views preserve that result type. A persistence-enabled configuration instantiates
`RootNexus<Fields, PersistentTransactionResult>` and preserves that type through `.scope()` and
`.root`. Every safe value, metadata, and scope-destruction command returns the configuration's
`Result`; every matching `*OrThrow` command returns `Extract<Result, { readonly ok: true }>`. Root
`destroy()` remains `void` because it is final lifecycle teardown rather than a transaction.

### 5.2 Root snapshot

`RootNexus.getState()` exposes canonical root values and durable scope metadata. It does not expose
binding drafts or Provider visual runtime. Capability-specific status belongs to the corresponding
typed namespace rather than appearing on every ephemeral root snapshot.

The accepted grouping is `{ values, scopes }`. Snapshot and unchanged nested references remain
`Object.is`-stable until a relevant semantic change. `scopes` contains only scopes with durable
metadata; creating a scoped view does not add an entry.

### 5.3 Scoped snapshot

`ScopedNexus.getState()` combines:

- the complete canonical root value record;
- that scope's durable metadata or `undefined`;
- that scope's ephemeral binding interaction state.

```ts
type StaleDraftConflict = {
  readonly kind: 'stale-draft'
  readonly baseRevision: number
  readonly baseValue: PicodashJsonValue
}

type BindingInteractionState = {
  readonly fieldKey: string
  readonly draft?: PicodashJsonValue
  readonly touched: boolean
  readonly inputIssues: readonly TransactionIssue[]
  readonly conflict?: StaleDraftConflict
}

type ItemInteractionState = {
  readonly focused: boolean
  readonly hovered: boolean
  readonly active: boolean
}

type ScopeInteractionState = {
  readonly bindings: ReadonlyMap<string, ReadonlyMap<string, BindingInteractionState>>
  readonly items: ReadonlyMap<string, ItemInteractionState>
}

type ScopedNexusSnapshot<Values extends object> = {
  readonly values: Readonly<Values>
  readonly scope: DurableScopeMetadata | undefined
  readonly interaction: ScopeInteractionState
}
```

The outer binding key is `itemId`; its nested key is binding alias. Item-shell focus, hover, and
active state is keyed only by `itemId`, so compound bindings do not duplicate it. `baseRevision` is
a non-negative safe integer and `baseValue` is detached immutable JSON. Registration alone creates
no interaction entry. Default-only entries and empty nested maps are pruned.

The accepted grouping is `{ values, scope, interaction }`. `values` is the same immutable record
reference exposed by the root. `scope` is `undefined` until durable metadata exists. The empty state
is one frozen singleton with two stable empty maps. Unchanged nested references retain structural
identity.

### 5.4 Subscription boundaries

Root subscribers receive canonical value changes and durable metadata changes in any scope. They do
not receive binding keystrokes, touched state, hover, or input issues.

Scoped subscribers receive canonical root value changes plus durable and interaction changes in
their own scope. Unrelated and descendant scope metadata does not notify them.

Aggregate descendant queries use explicit selectors or operations; they do not broaden scoped
snapshots.

Both Nexus types expose the framework-independent external-store contract:

```ts
nexus.getState()
nexus.subscribe(listener)
```

Listeners receive no state argument and read the latest immutable snapshot with `getState()`.
Subscription teardown is idempotent. Calling either method after root destruction throws.

### 5.5 Snapshots contain data, not commands

`getState()` and selector snapshots contain immutable data only. Mutating commands and capability
operations live on the stable root or scoped Nexus API. Nexus consumers do not discover or invoke
actions through snapshot properties, and Zustand's state-and-actions convention is not part of the
public contract.

### 5.6 Product metadata without dependency cycles

`@picodash/nexus` owns the validated, versioned JSON record shapes for built-in `dashPanel` and
`dashList` durable scope metadata. It never imports either UI package. DashPanel and DashList own
their public prop and behavior types and translate to Nexus records through
`@picodash/nexus/integration`. Nexus snapshots expose the read-only records for inspection and
selectors, not as mutable authoring objects.

The DashList record shape is accepted as root-order override, group-order overrides, and node
collapse overrides. The DashPanel record is accepted as settled canonical placement plus finite
`preferredPosition` offsets from the effective boundary's top-left after inset and before snap
offset. The exact Nexus-owned record union is defined in the Nexus target reference; it uses
`center-left/right` rather than the prototype's `middle-left/right` and includes standalone
top/bottom dock positions.

DashList rail orientation may receive an active scoped Nexus override that takes precedence over a
declared DashList orientation. This allows Picodash to derive orientation from a Panel's current
dock without coupling DashList to DashPanel. `full/center-left` and `full/center-right` derive
`vertical`; `full/center-top` and `full/center-bottom` derive `horizontal`; corner, free, and snapped
dispositions derive no Picodash override. A corner therefore retains the next effective Nexus or
prop orientation.

The exact integration API is `acquireDashListOrientationOverrideLease(rootStore, options)`, whose
live lease exposes `update(orientation)` and idempotent `release()`. DashList observes the scoped
runtime channel through `getDashListOrientationOverride(scopedStore)` and
`subscribeDashListOrientationOverride(scopedStore, listener)`. One scope permits one live publisher;
applications have no general Nexus command for this override and use the public DashList prop.

Acquisition requires a concrete orientation but no already-active DashList. It creates no entity,
relationship, host affinity, durable scope, or metadata. Corner, free, and snapped dispositions
release rather than publish an empty override. The channel is excluded from root/scoped public
snapshots and their subscriptions. This active orientation is not part of the accepted durable
DashList metadata record and must not be persisted merely because a dock derived it.

Nexus validates this product record without importing DashPanel. Occupancy, dock allocation,
resolved size, enabled positions, responsive projection, and fallback geometry remain transient UI
runtime and never enter the record.

The alpha contract has no arbitrary namespaced metadata bag or runtime metadata-schema
registration. Application-specific state remains in declared root fields. Supporting another
durable product metadata kind requires an explicit Nexus contract extension rather than accepting
unvalidated JSON.

## 6. Fields and canonical values

### 6.1 Immutable field contracts

`createPicodashNexus()` fixes the complete root field definition set for the Nexus lifetime.
Components bind existing handles and never create root fields by mounting. Panel-only Nexuses may
declare no fields. Runtime schema mutation is not supported.

### 6.2 Nominal handle ownership

Every field handle carries internal root ownership. All scopes of that root accept it. Another root
rejects it even if the field key and value type match. Serialized documents use keys and resolve
them against the explicit target root.

Nexus also exports two type-only consumer views. `PicodashFieldOf<Value>` accepts a nominal field
whose selected value is assignable to `Value`; `PicodashExactFieldOf<Value>` accepts a nominal field
whose selected compound JSON domain is exactly `Value`. These views let generic consumers describe
their field requirements without inventing a whole-Nexus record or weakening the nominal handle.
They add no runtime properties or operations, do not expose the private ownership brand, and confer
no parsing, validation, repair, or mutation authority. Root and scoped field collections inferred
directly from `createPicodashNexus()` retain the exact type information needed by the exact view;
runtime handles remain frozen key-only objects.

### 6.3 Complete canonical record

Every field has a concrete default and one present canonical value. `undefined` is not a canonical
value; optional semantics use an explicit JSON value such as `null` or a tagged union.

### 6.4 Strict JSON data

Canonical values reject cycles, `undefined`, functions, symbols, non-finite numbers, class
instances, `Date`, `Map`, and `Set`. Accepted structured inputs are cloned and deep-frozen. Callers
cannot mutate Nexus state through retained references.

### 6.5 Semantic equality

No-op detection uses semantic JSON equality. Object property order is insignificant, array order is
significant, and negative zero normalizes to zero. Structurally equal writes produce no adapter
call, notification, transaction, or persistence write.

### 6.6 Defaults and initial values

Concrete defaults plus validated `initialValues` form the current baseline. Valid known values from
a persisted envelope overlay that baseline. Policy-omitted fields use the baseline. The alpha
decoder rejects invalid disclosed fields; beta quarantine recovery may use the baseline.
Parser-proposed repairs are never applied automatically during hydration. `initialValues` never
overwrite valid persisted values on each launch.

The complete baseline passes through each field's schema and validation pipeline during Nexus
creation. Invalid defaults or `initialValues` throw as configuration errors. Persisted data is an
external trust boundary and follows hydration recovery rules instead. The target contract does not
include `allowUnset`; optional values use explicit JSON such as `null` or a tagged union.

### 6.7 Field resolution pipeline

Field definitions separate three synchronous stages:

1. `parse` converts binding/UI input into a candidate value and may offer an explicit repair;
2. `schema` is a Standard Schema v1 contract that canonicalizes the candidate, may coerce or
   transform it, and determines the inferred output type;
3. `validate` performs application-domain checks against the canonical value and complete candidate
   Nexus context, but cannot transform the value.

Any stage may be omitted. Promise-like results are rejected as contract violations. Failures from
all stages normalize into package-owned structured issues.

The interactive `setInput` pipeline is `parse → schema → validate`. Programmatic value writes,
defaults, `initialValues`, adapter snapshots, persistence, imports, and migration output are already
value candidates and use `schema → validate`; they never invoke the UI parser. `setValue` and
`setValues` are typed to schema output values even though runtime schema checks remain mandatory.

Parser success returns one candidate; parser failure returns a non-empty structured issue list and
may include one repair candidate. Field `validate` returns a structured issue array, where an empty
array accepts the value. `validateValues` follows the same array contract but supplies canonical
absolute paths. Callback exceptions become stage-specific issues with the arbitrary cause omitted;
promise-like results are contract violations. Validation context contains the immutable complete
candidate, field identity where applicable, operation source, and scope attribution, never a mutable
Nexus reference.

A parser may attach one proposed canonical repair to rejected binding input. The Nexus validates the
proposal through `schema`, field validation, and root validation before returning an opaque nominal
`PicodashRepairPlan` on the transaction failure. Plans are root-owned, single-use, and fingerprint
the complete candidate state. `nexus.executeRepair(plan)` revalidates and commits atomically or
returns `stale_plan`; repairs are never automatic. Interactive repair also clears the originating
binding draft after a successful commit.

### 6.8 Presentation contracts are not Nexus field contracts

Nexus field definitions contain canonical default, schema, parsing, and validation behavior only.
They do not contain slider ranges, formatter choices, control variants, layout hints, or generic
presentation compatibility contracts. Binding leases record field usage and read/write mode for
management operations, but the Dashlet or UI package owns whether a particular presentation can
render and edit the canonical value. Prototype presentation-contract exports are not part of the
target Nexus API.

## 7. Transactions, validation, and reset

### 7.1 Whole-candidate validation

A multi-field write:

1. applies each field's Standard Schema canonicalization without mutation;
2. builds one complete candidate root snapshot;
3. evaluates field and cross-field validators against that candidate;
4. rejects the whole batch if any issue exists;
5. removes semantic no-ops after validation;
6. commits and notifies once.

Parsers, validators, migrations, redactors, and persistence callbacks are synchronous and pure.

The root configuration may define `validateValues(values, context)`. It runs once against the
complete immutable candidate after field parsing and schema canonicalization, returns zero or more
structured issues with canonical absolute paths, and never transforms values. It applies during
Nexus construction, writes, hydration, import, validation of migration results, and resets.
Field-level `validate` remains the home for checks naturally attributable to one field.

### 7.2 No arbitrary public transaction callback

The initial API does not expose `transaction(() => ...)`. Atomic behavior uses typed operation APIs
such as multi-field set, reset, import, reorder, and placement commands. Internal staging remains
unobservable.

### 7.3 Structured outcomes

Expected data rejection returns a Zod-like package-owned error with stable issue codes, paths, and
optional field/scope/item/binding identity. Raw input values and arbitrary exception causes are not
included by default.

Standard Schema issues contribute only their guaranteed message and normalized path. Picodash
assigns stable stage codes such as `parse_failed`, `schema_failed`, and `validation_failed`; it does
not expose validator-library-specific codes or original error objects. Application validators may
return a namespaced `app:*` code for programmatic recovery. Picodash attaches any known `fieldKey`,
`scopeId`, `itemId`, and binding `alias` context.

Issue paths are absolute within a stable logical operation model, regardless of which API initiated
the operation. Field paths begin `['values', fieldKey]`, scope metadata paths begin
`['scopes', scopeId]`, and import-document paths begin `['document']`. Standard Schema and field
validator paths are relative inputs that the Nexus prefixes. An empty path identifies the operation
as a whole. Convenience identity properties remain available even when their identity also appears
in the path.

Safe setters return a discriminated result. Explicit `*OrThrow` variants throw the same structured
transaction error. Contract violations remain separate exceptions.

`PicodashContractError` carries a stable code and safe identity context for programmer/lifecycle
violations such as invalid configuration, foreign handles, duplicate entities, illegal reentrancy,
and use after destruction. It throws in every environment. It never embeds arbitrary causes or raw
values. `PicodashTransactionError` is reserved for expected candidate-data rejection and is the
error returned by safe operations or thrown by `*OrThrow` variants.

`PicodashInitializationError` is the structured creation-time failure for an invalid initial
adapter projection, unavailable persistence driver, invalid envelope, or hydration-source conflict.
Its public alpha code/reason correlation is exact:

```ts
type AdapterInitializationFailureReason =
  'read_threw' | 'async_snapshot' | 'invalid_snapshot' | 'subscribe_threw' | 'invalid_teardown'

type PersistenceDriverUnavailableReason = 'read' | 'subscribe' | 'seed-write' | 'seed-verification'

type InvalidPersistenceEnvelopeReason =
  'syntax' | 'shape' | 'format' | 'identity' | 'schema' | 'authority' | 'values' | 'metadata'

type HydrationSourceConflictReason = 'revision' | 'content'

type SchemaMigrationFailureReason =
  | 'source-newer'
  | 'missing-step'
  | 'callback-threw'
  | 'async-result'
  | 'invalid-result'
  | 'wrong-version'
  | 'final-validation'

type PicodashInitializationErrorReasonByCode = {
  readonly 'adapter-initialization-failed': AdapterInitializationFailureReason
  readonly 'persistence-driver-unavailable': PersistenceDriverUnavailableReason
  readonly 'invalid-persistence-envelope': InvalidPersistenceEnvelopeReason
  readonly 'hydration-source-conflict': HydrationSourceConflictReason
  readonly 'schema-migration-failed': SchemaMigrationFailureReason
}

type PicodashInitializationErrorCode = keyof PicodashInitializationErrorReasonByCode

type PicodashInitializationError = {
  [Code in PicodashInitializationErrorCode]: Error & {
    readonly name: 'PicodashInitializationError'
    readonly code: Code
    readonly reason: PicodashInitializationErrorReasonByCode[Code]
    readonly issues: readonly TransactionIssue[]
  }
}[PicodashInitializationErrorCode]
```

Nexus construction is all-or-nothing and returns no partially active root. Invalid developer
configuration remains a contract error; invalid external startup data is an initialization error.
Initialization-error construction is package-internal; the public contract does not promise a
class, public constructor, or `instanceof` behavior. Migration failures expose only the exact safe
reason above; causes, callback messages, payloads, values, and raw metadata remain private.

Opaque plans and handles follow one rule across repairs, stale-input overwrite, pruning,
persistence, export, and import: wrong-root, wrong-kind, released, or already-consumed objects throw
a contract error; a valid plan whose captured state has changed returns a safe `stale_plan` issue.

Repair and stale-input-overwrite plans use the shared contract error taxonomy:

```ts
type InvalidBindingPlanContext = {
  readonly kind: 'repair' | 'stale-input-overwrite'
  readonly reason: 'foreign-root' | 'wrong-kind' | 'released' | 'consumed'
}
```

The `invalid-binding-plan` contract error exposes exactly that context. Plans are opaque,
root-owned, single-use values and expose no captured values, revisions, or fingerprints.

Successful results always report sorted `changedFields` and `changedScopeIds` arrays. A value-only
operation leaves the latter empty; a metadata-only operation leaves the former empty.
Persistence-enabled Nexuses additionally report
`persistence: 'unchanged' | 'saved' | 'pending'`; Nexuses without persistence omit that property
entirely. The result covers only Picodash-owned persistence and never claims that an external
application store durably saved its values. Ongoing errors and conflicts remain available through
the persistence capability state.

Malformed built-in metadata is expected candidate-data rejection with Nexus-owned issue code
`invalid_metadata`. It returns the failed member of the configuration-selected `Result`, uses a canonical path under
`['scopes', scopeId]`, and never exposes the rejected value or an arbitrary codec cause. A malformed
command target remains a contract error: an invalid root scope ID throws `invalid-scope-id` before
metadata validation.

### 7.4 Reentrancy

Application writes during validation, commit, or listener notification throw `reentrant-write`.
Subscribers schedule follow-up writes after the current stack. Synchronous notification caused by
the Nexus's own adapter write is treated as an internal echo, verified, and published once.

Every affected Nexus subscription is notified at most once after the complete commit; relative
ordering between root, scoped, capability, and diagnostic subscribers is not public. A subscriber
exception cannot roll back committed state or prevent remaining subscribers. It becomes a bounded
`subscriber_exception` diagnostic with its arbitrary cause omitted, while the initiating transaction
still reports its actual commit result.

### 7.5 Programmatic and interactive commands

Commands live on the stable Nexus API rather than inside snapshots:

```ts
nexus.setValue(field, value)
nexus.setValueOrThrow(field, value)
nexus.setValues(values)
nexus.setValuesOrThrow(values)
nexus.setInput(binding, input)
```

`setValue` accepts a nominal field handle plus a typed schema-output value. `setValues` accepts a
typed partial root record and commits one atomic transaction. Their safe variants return structured
results and their `OrThrow` variants throw the corresponding transaction error.

Root writes omit scope attribution. The same calls through a scoped Nexus pass that view's
`scopeId` as `originScopeId` to field/root validation and external-adapter write context. This does
not create metadata, restrict field access, or add the origin to `changedScopeIds`; every scoped
view continues to observe the one canonical root value record.

At runtime, unknown batch keys return structured candidate issues without mutation. A foreign field
handle is a contract error. An empty batch and a semantically unchanged batch succeed as no-ops and
do not notify or persist.

`setInput` is safe-only. Valid non-stale input commits and clears that binding's draft; invalid
non-stale input records its frozen raw JSON draft, touched state, and pipeline issues. Programmatic
setters do not alter binding interaction state, although their canonical changes can make existing
drafts stale. BIND-INTERACTION-CONTRACT-1 below freezes stale and repair transitions.

`discardInput(binding)` returns `true` only when interaction state changed and otherwise returns
`false`; ownership and lifecycle misuse still throws a contract error.

Binding input must itself be JSON-compatible. The Nexus clones and freezes a retained draft. UI
state that cannot be represented as JSON remains component-local and submits a JSON candidate only
when ready. This prevents arbitrary class instances, functions, or cyclic objects from entering
shared interaction snapshots.

### 7.6 Explicit reset domains

Reset operations remain separate:

- discard one binding's draft input;
- reset one root value;
- reset values actively registered in one scope, optionally including active descendants;
- reset DashList metadata;
- reset Panel layout;
- destroy scope state.

The value reset API is:

```ts
nexus.resetValue(field)
nexus.resetValueOrThrow(field)
scoped.resetRegisteredValues({ includeDescendants? })
scoped.resetRegisteredValuesOrThrow({ includeDescendants? })
root.resetRegisteredValues({ scopeId, includeDescendants? })
root.resetRegisteredValuesOrThrow({ scopeId, includeDescendants? })

type RegisteredValueResetInspection = {
  readonly registeredFields: readonly string[]
  readonly changedFields: readonly string[]
}

scoped.inspectRegisteredValueReset({ includeDescendants? }): RegisteredValueResetInspection
root.inspectRegisteredValueReset({ scopeId, includeDescendants? }): RegisteredValueResetInspection
```

`RESET-REGISTERED-1` fixes the aggregate reset option and error surface:

```ts
type InvalidResetOptionsReason =
  'not-object' | 'unknown-key' | 'accessor-property' | 'invalid-include-descendants'

type ResetRegisteredValuesOptions = {
  readonly includeDescendants?: boolean
}

type RootResetRegisteredValuesOptions = ResetRegisteredValuesOptions & {
  readonly scopeId: string
}
```

The scoped options argument may be omitted. The root options object is required. Both variants
validate an exact own-key data record before reading values: non-null non-array object, no unknown
own string or symbol keys, and data descriptors for every known key. Scoped options allow only
`includeDescendants`; root options allow only `scopeId` and `includeDescendants`. Malformed option
records throw `invalid-reset-options` with exactly `{ reason: InvalidResetOptionsReason }` and never
retain a rejected key, value, or descriptor. Structural option validation, including a present
`includeDescendants` boolean check, completes before root `scopeId` uses the ordinary
`invalid-scope-id` contract, including when it is missing. A present `includeDescendants` must be a
boolean; omission is `false`.

Registered membership is active-only and includes both input and display binding leases. The Nexus
snapshots the target scope plus the current active descendant graph at invocation time, sorts the
target scope IDs, and deduplicates their registered root fields before building one complete
candidate from configured defaults. Released bindings and relationships do not participate.

The aggregate command runs schema, field, and complete-record validation once with source `reset`
and never invokes parsers. Root calls omit `originScopeId`; scoped calls use the receiver scope.
Both pass the complete sorted selected scope set as adapter `targetScopeIds`. Successful results
preserve the configured `Result`, report only semantically changed fields, and keep
`changedScopeIds` empty because the command changes values rather than scope state. Empty or
already-default selections are no-ops without adapter writes, persistence writes, or
notifications. Rejection is atomic.

Nexus aggregate reset never discards binding interaction. Any dirty binding anywhere in the root
for a changed shared field becomes stale while retaining its draft. DashList separately composes
targeted draft discard after a successful reset; this keeps canonical reset and interaction
discard as distinct Nexus operations.

The generic root and scoped value-reset surfaces are:

```ts
interface RootValueCommands<Fields, Result> {
  resetValue<Key extends keyof Fields & string>(field: FieldHandle<Fields, Key>): Result
  resetValueOrThrow<Key extends keyof Fields & string>(
    field: FieldHandle<Fields, Key>,
  ): Extract<Result, { ok: true }>
}

interface ScopedValueCommands<Fields, Result> extends RootValueCommands<Fields, Result> {}
```

`resetValue` restores one field's configured default baseline after schema and complete-record
validation, never parser execution; it is not the initial, hydrated, or current value. The root has
no origin scope; scoped calls use the receiver scope. The reset source passed to validators and adapters is
`source: 'reset'`. A foreign field handle is a contract error. Candidate rejection is atomic.

Reset success preserves the configured Nexus `Result` (including persistence status), reports only
the changed field, and leaves `changedScopeIds` empty. A semantic no-op does not notify or write.
When the field changes, every dirty binding for that field becomes stale without discarding its
draft; persistence records the configured reset result.

Registered-value reset deduplicates root fields and validates one complete candidate. Scoped
signatures do not accept another scope ID; root signatures require one.

`inspectRegisteredValueReset` uses that exact active-binding and descendant selection but does not
construct or validate a candidate. It reports sorted registered fields and the sorted subset whose
current canonical values differ from the configured defaults. The returned record and both arrays
are deeply immutable. Inspection performs no writes, persistence, notifications, diagnostics, draft
reads, or Nexus metadata changes; it only applies the shared lifecycle and exact reset-option
validation. Its root/scoped option signatures match the corresponding aggregate reset command.

Scope-targeted metadata commands follow the same root/scoped targeting rule. The accepted authoring
surface is:

```ts
interface RootMetadataCommands<Result extends CoreTransactionResult = CoreTransactionResult> {
  setDashPanelLayout(scopeId: string, layout: DashPanelLayoutRecord): Result
  resetDashPanelLayout(scopeId: string): Result
  setDashListRootOrder(scopeId: string, order: readonly string[]): Result
  removeDashListRootOrder(scopeId: string): Result
  setDashListGroupOrder(scopeId: string, groupId: string, order: readonly string[]): Result
  removeDashListGroupOrder(scopeId: string, groupId: string): Result
  setDashListCollapseOverride(scopeId: string, nodeId: string, collapsed: boolean): Result
  removeDashListCollapseOverride(scopeId: string, nodeId: string): Result
  updateDashListCollapseOverrides(
    scopeId: string,
    updates: readonly (readonly [nodeId: string, collapsed: boolean | null])[],
  ): Result
  resetDashListMetadata(scopeId: string): Result
}

interface ScopedMetadataCommands<Result extends CoreTransactionResult = CoreTransactionResult> {
  setDashPanelLayout(layout: DashPanelLayoutRecord): Result
  resetDashPanelLayout(): Result
  setDashListRootOrder(order: readonly string[]): Result
  removeDashListRootOrder(): Result
  setDashListGroupOrder(groupId: string, order: readonly string[]): Result
  removeDashListGroupOrder(groupId: string): Result
  setDashListCollapseOverride(nodeId: string, collapsed: boolean): Result
  removeDashListCollapseOverride(nodeId: string): Result
  updateDashListCollapseOverrides(
    updates: readonly (readonly [nodeId: string, collapsed: boolean | null])[],
  ): Result
  resetDashListMetadata(): Result
}
```

`setDashPanelLayout` replaces the complete Panel layout record. Each order setter replaces one
container override, and an empty order is canonical removal. Collapse setters store an explicit
override because Nexus cannot infer the current declarative default; the caller removes the override
when it matches that default. Individual removal and whole-domain reset of absent state are
successful no-ops. Empty product records and then empty scope records are pruned.

All metadata commands normalize and detach one complete candidate through the Nexus-owned codec.
Malformed layout, order, group, or node data returns `invalid_metadata` without mutation. A semantic
metadata change returns `changedFields: []` and the affected scope in `changedScopeIds`; a no-op
returns both arrays empty. The root and affected scoped subscribers are each notified once after the
complete commit. Unrelated scoped subscribers are not notified.

`updateDashListCollapseOverrides` is the accepted batch form for DashList collapse actions. Its
readonly tuple array is validated in full before mutation; tuples are `[nodeId, collapsed]`, where a
boolean sets an explicit override and `null` removes one. Node IDs must be valid and unique within
the batch, and entries apply in order. The operation is one atomic metadata transaction that
preserves root/group orders and unrelated or dormant collapse overrides. Empty and semantic no-op
batches succeed without notification, while malformed tuples, IDs, values, or duplicates return
`invalid_metadata` without changing the prior snapshot. Empty product and scope records are pruned
through the normal metadata codec.

Destruction retains its separate signatures:

```ts
scoped.destroyScope()
scoped.destroyScope({ includeDescendants: true })
root.destroyScope(scopeId)
root.destroyScope(scopeId, { includeDescendants: true })
```

Reset commands remove product-owned overrides and return to current declarative defaults.
`destroyScope` erases all durable and ephemeral state for the explicit scope set without
invalidating handles or active registrations; active components return to declared defaults without
persisting an empty record. Descendants mean only currently active declarative relationships. Pruning remains
a separate plan-and-execute operation because obsolete-node selection is ambiguous.

Root and scoped resets use the normal candidate validation path. Resetting one field may fail a
cross-field rule. Panel/DashList built-in “Reset values” actions explicitly compose canonical reset
with discarding drafts in targeted bindings. Drafts in unrelated scopes remain and become stale when
their canonical field changes.

DashList's built-in `Reset list…` action maps only to `resetDashListMetadata()`: it removes root and
group order overrides plus group collapse overrides in that List scope. It never resets canonical
values or drafts. DashList exposes no combined `Reset all` action.

### 7.7 Shared root-field consequences

If several scopes bind the same root field, resetting it through one target scope changes the one
canonical value for every observer. Aggregate operations deduplicate root fields. Reset analysis
reports other bound scopes; it does not create local value copies.

## 8. Binding interaction

### 8.1 Binding-level identity

Interaction state is stored by scope, item ID, and binding alias. It is not shared merely because
two editors use the same root field.

Aliases default to the root field key. An explicit alias is required when one item binds the same
field more than once. Aliases are unique within an item and never receive generated numeric suffixes.

Draft and input commands receive an opaque nominal `BindingHandle`, not a structural tuple. The
active binding registration issues a handle owned by one root and one registration generation. It
exposes read-only scope, item, alias, and field identity for reporting, but is not serializable or
reconstructed from strings. Foreign, released, and superseded handles throw a contract error.
Remounting the same tuple creates a new generation so an old handle cannot mutate the new binding.

### 8.2 Stale drafts

A dirty binding records the canonical field revision/value from which editing began. A later
canonical change preserves the draft but marks it stale. Stale drafts cannot commit implicitly;
the binding must discard or explicitly overwrite after confirmation.

Stale-input overwrite plans are a distinct implemented and verified command slice, specified here
separately from the frozen input transition and repair behavior. Creation requires an active input
handle, a dirty stale draft, and no stored `inputIssues`:

```ts
declare const staleInputOverwritePlanBrand: unique symbol
type PicodashStaleInputOverwritePlan = {
  readonly [staleInputOverwritePlanBrand]: never
}

nexus.createStaleInputOverwritePlan<Key extends keyof Fields & string>(
  binding: BindingHandle<Fields, Key>,
): PicodashStaleInputOverwritePlan

nexus.executeStaleInputOverwrite(plan: PicodashStaleInputOverwritePlan): Result
```

The plan captures the exact binding generation and draft plus the current target-field revision and
value, but exposes none of those values. Any same-root root/scoped receiver may execute it; the
handle's scope controls attribution. An unrelated field change alone does not stale the plan.
Creation handle misuse is `invalid-binding-handle`. Creation state failure is the contract error
`invalid-stale-input-overwrite` with exactly `{ reason: 'not-stale' | 'invalid-draft' }`.

The state-failure contract error context is:

```ts
{
  reason: 'not-stale' | 'invalid-draft',
}
```

The first valid execution attempt consumes the plan, including stale-plan, validation, or authority
failure. Draft replacement/discard or a target revision change returns `stale_plan`; released or
replaced binding generations return the corresponding lifecycle contract error. Execution reruns
parse, schema, field, and root validation with `source: 'interactive'` and binding origin; it never
returns `stale_input` or a repair offer. Failure preserves stale interaction. Success coalesces the
canonical commit and origin cleanup, marks other dirty bindings for the field stale, and preserves
the configured Result/persistence. A semantic no-op clears origin and notifies only the target scope;
a changed commit notifies canonical observers once with cleanup visible.

```ts
nexus.createStaleInputOverwritePlan(binding)
nexus.executeStaleInputOverwrite(plan)
```

These commands remain `Accepted` / `Planned` and are specified separately from the frozen input
transition and repair behavior below.

Untouched bindings follow new canonical values immediately. Conflict state is ephemeral.

### 8.3 BIND-INTERACTION-CONTRACT-1

Root and scoped Nexuses expose the same generic-key interaction commands:

```ts
interface BindingInteractionCommands<
  Fields extends Record<string, FieldLike>,
  Result extends CoreTransactionResult = CoreTransactionResult,
> {
  setInput<Key extends keyof Fields & string>(
    binding: BindingHandle<Fields, Key>,
    input: PicodashJsonValue,
  ): Result
  discardInput<Key extends keyof Fields & string>(binding: BindingHandle<Fields, Key>): boolean
  executeRepair(plan: PicodashRepairPlan): Result
  createStaleInputOverwritePlan<Key extends keyof Fields & string>(
    binding: BindingHandle<Fields, Key>,
  ): PicodashStaleInputOverwritePlan
  executeStaleInputOverwrite(plan: PicodashStaleInputOverwritePlan): Result
}
```

The configured Nexus `Result` is preserved for every safe command (including persistence-enabled
variants). A binding handle determines scope and `(itemId, alias, fieldKey)` identity; any root or
scoped receiver from the same root may invoke the command. Receiver scope does not retarget the
binding, and a foreign, released, or superseded handle remains a contract error.

`setInput` and `discardInput` accept only an active binding handle whose `mode` is `'input'`. An
active display handle throws `invalid-binding-handle` with exactly `{ reason: 'wrong-kind' }`; it
creates no interaction state and invokes no parser, validator, callback, subscriber, or notification.

The Nexus-owned issue code `stale_input` is exact:

```ts
{
  code: 'stale_input',
  reason: 'canonical_changed',
  message: 'Binding input is stale and requires explicit overwrite confirmation.',
  path: ['values', fieldKey],
  fieldKey,
  scopeId,
  itemId,
  alias,
}
```

`fieldKey`, `scopeId`, `itemId`, and `alias` are present on every stale issue. Pipeline issues
(`parse_failed`, `schema_failed`, or `validation_failed`) precede `stale_input` in a returned
failure. Stored `inputIssues` contains only pipeline issues; `stale_input` is never stored there.

#### Input transition table

| Current interaction | Input / pipeline outcome                  | Interaction result                                                                                                  | Returned issues / repair                                                                                        |
| ------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Any                 | Non-JSON input                            | No interaction mutation                                                                                             | One identity-enriched `invalid_json` issue; no parser, schema, field/root callback, subscriber, or notification |
| None or clean       | Non-stale pipeline rejection              | Nexus frozen raw JSON draft, `touched: true`, and pipeline issues; capture current field revision/value as the base | Pipeline issues; parser failure may include a repair plan                                                       |
| Dirty, non-stale    | Non-stale pipeline rejection              | Replace the frozen raw JSON draft and pipeline issues; preserve the original base                                   | Pipeline issues; parser failure may include a repair plan                                                       |
| None or clean       | Accepted non-stale input                  | Commit the shared canonical pipeline and clear the binding interaction entry                                        | Configured successful `Result`                                                                                  |
| Dirty, non-stale    | Accepted non-stale input                  | Commit and clear the binding interaction entry                                                                      | Configured successful `Result`                                                                                  |
| Dirty, stale        | Any stale attempt                         | Replace the frozen raw JSON draft and pipeline feedback; preserve the original base/conflict; never commit          | Pipeline issues first, then `stale_input`; no repair plan                                                       |
| Dirty, stale        | Valid stale input                         | Preserve the original base/conflict and never commit                                                                | `stale_input` only; no repair plan                                                                              |
| Dirty, non-stale    | Authority rejection after valid candidate | Retain the valid dirty draft, touched state, original base, and non-stale conflict state                            | Configured failure; no interaction loss                                                                         |

Canonical changes mark a dirty binding stale without deleting its draft. A stale binding invalidates
any earlier repair plan with `stale_plan`; overwrite plans follow the explicit contract above. `discardInput` clears one
binding entry, prunes an empty item map and scope interaction record, and returns exactly `true` iff
that entry changed; absent/clean state returns exactly `false`.

Parser repair is offered only for a non-stale parser failure. Before a plan is returned, its proposal
passes schema, field validation, and root validation. A valid plan is opaque, root-owned, single-use;
`executeRepair` revalidates with validation source `repair`, commits through the shared pipeline,
and clears the originating interaction. Wrong-root/kind/released/consumed plans throw a contract
error; changed captured state returns `stale_plan`.

#### Evidence and privacy requirements

Conformance evidence must exercise root and scoped receivers, input/display mode rejection,
configured Result variants, every row of the transition table, callback/notification suppression,
repair freshness, pruning, and exact issue shape/order. Evidence must not include raw non-JSON input,
arbitrary callback causes, or other undisclosed values; identity fields are limited to the documented
field/scope/item/alias tuple.

## 9. DashList metadata

### 9.1 Stable node identity

Every DashList item and group that participates in durable metadata has an explicit, immutable ID.
React keys, position, and `useId()` are not durable identity. Items and groups share one node-ID
namespace within the scope.

### 9.2 Declarative containment

The active DashList/Group tree owns node containment. Persistence stores sibling order per
container, not parent membership. A node must release its old registration before reparenting.
Cross-container dragging is unsupported until an explicit contract changes declarative membership.

### 9.3 Order overrides

Before user reorder, nodes follow declaration order. Once customized, a container persists an order
override. New nodes append in declaration order without disturbing customized nodes. Returning
dormant nodes restore their prior persisted position where possible. Reset removes the override and
returns to current declaration order.

### 9.4 Collapse overrides

Registered-node collapse defaults remain declarative. User changes create durable overrides. Reset
removes an override. Obsolete overrides for nodes that no longer support collapse are ignored and
diagnosed. The Nexus metadata contract remains generic; DashList exposes collapse only on DashGroup
in its initial public UI contract.

### 9.5 Dormant metadata and pruning

Unmounted node order/collapse overrides remain until explicit pruning or scope destruction. Picodash
never assumes an unmounted node is obsolete, even when a DashList is active and conditionally
renders only part of its possible contents.

Pruning uses explicit remove/keep IDs or an application-provided authoritative `knownNodeIds`
inventory. A prune plan may list candidates but never deletes them automatically. Pruning does not
change canonical values.

`PRUNE-PLAN-1` fixes one review value and one executable plan surface:

```ts
type DashListPruneEffect =
  | 'root-order-entry'
  | 'group-order-owner'
  | 'group-order-entry'
  | 'collapse-override'

type DashListPruneCandidate = Readonly<{
  nodeId: string
  effects: readonly DashListPruneEffect[]
}>

type DashListPruneReview = Readonly<{
  kind: 'dash-list-prune-review'
  scopeId: string
  candidates: readonly DashListPruneCandidate[]
}>

type DashListPruneSelection =
  | { readonly mode: 'review' }
  | {
      readonly mode: 'explicit'
      readonly removeNodeIds: readonly string[]
      readonly keepNodeIds: readonly string[]
    }
  | { readonly mode: 'inventory'; readonly knownNodeIds: readonly string[] }

type RootDashListPruneOptions = DashListPruneSelection & { readonly scopeId: string }

declare const dashListPrunePlanBrand: unique symbol

type PicodashDashListPrunePlan = Readonly<{
  readonly [dashListPrunePlanBrand]: 'PicodashDashListPrunePlan'
  kind: 'dash-list-prune-plan'
  mode: 'explicit' | 'inventory'
  scopeId: string
  candidates: readonly DashListPruneCandidate[]
  removeNodeIds: readonly string[]
  keepNodeIds: readonly string[]
}>

root.createPrunePlan(options: RootDashListPruneOptions):
  | DashListPruneReview
  | PicodashDashListPrunePlan
scoped.createPrunePlan(options: DashListPruneSelection):
  | DashListPruneReview
  | PicodashDashListPrunePlan
root.executePrunePlan(plan: PicodashDashListPrunePlan): Result
scoped.executePrunePlan(plan: PicodashDashListPrunePlan): Result
```

The public declarations use overloads so literal `mode: 'review'` returns only
`DashListPruneReview`, while literal `explicit | inventory` returns only the executable plan.
Scoped operations always target that view. Root options require `scopeId`; after exact option
record validation it uses the ordinary `invalid-scope-id` mapping.

Candidates are the sorted union of IDs referenced by root order entries, group-order owners,
group-order entries, and collapse overrides, minus currently active node IDs. Each candidate lists
its applicable effects in the fixed order shown above. Review mode returns only that immutable
metadata-derived projection and creates no executable plan.

Explicit mode requires duplicate-free `removeNodeIds` and `keepNodeIds` that are disjoint and
exactly partition the current candidates. Inventory mode treats `knownNodeIds` as authoritative; it
must contain every active node and classifies dormant candidates as keep when known and remove when
absent. IDs and arrays are cloned, validated, sorted, and frozen.

Prune options are exact own-key data records. Invalid structures, modes, arrays, IDs, duplicates,
overlap, unknown candidates, incomplete explicit partitions, or inventories missing an active node
throw `invalid-prune-options` with exactly `{ reason }`, where reason is:

```ts
type InvalidPruneOptionsReason =
  | 'not-object'
  | 'unknown-key'
  | 'accessor-property'
  | 'invalid-mode'
  | 'invalid-node-ids'
  | 'duplicate-node-id'
  | 'overlapping-node-id'
  | 'unknown-candidate'
  | 'incomplete-candidate-partition'
  | 'missing-active-node'
```

Executable plans are opaque, root-owned, and single-use. Passing a forged, review, wrong-root, or
consumed value throws `invalid-prune-plan` with exactly
`{ reason: 'wrong-kind' | 'foreign-root' | 'consumed' }`. The first valid execution attempt consumes
the plan. It fingerprints only normalized target-scope DashList metadata plus sorted active node
membership; changes to either return one safe `stale_plan` issue with path `[]` and message
`Prune plan is stale.` Unrelated values, bindings, relationships, and other scopes do not stale it.

Execution removes every selected ID from root and group order arrays, deletes its owned group-order
record, removes its collapse override, and prunes empty records. The `group-order-owner` effect makes
loss of a removed group's saved child order explicit during review. Execution never changes values,
drafts, bindings, relationships, active leases, or another scope. A changed execution reports
`changedFields: []` and only the target in `changedScopeIds`; an empty removal succeeds as a no-op.
Persistence and root/target notification use the existing atomic metadata pipeline.

## 10. Panel metadata and Provider runtime

### 10.1 Durable layout override

Panel layout persistence is an optional override of current declared defaults. A completed move,
snap, or dock writes the override. Preview and cancelled interactions write nothing. Reset removes
the override. A compatible override wins over later default changes. An unknown position, invalid
mode/disposition combination, or non-finite coordinate rejects the alpha envelope; beta recovery may
quarantine that complete Panel record and use the current default. A valid record whose target is
disabled by current Provider or Panel policy remains durable and dormant; UI policy does not make
Nexus data invalid.

### 10.2 Durable boundary

Persisted Panel metadata contains canonical placement, disposition, and a finite
`preferredPosition`. Coordinates are CSS-pixel offsets from the effective boundary's top-left after
inset and before snap offset. Layout belongs to the scope, not to `providerId`. Remounting under
another Provider reuses compatible layout and projects it into current geometry; separate
host-specific layouts use separate scope IDs.

### 10.3 Transient Panel runtime

Visibility, activation, z-order, focus, drag previews, hover, menus, portal ownership, and resolved
boundaries are not persisted. Provider owns host coordination; component-local state owns
high-frequency visuals.

### 10.4 Declarative removal

Imperative Panel `deregister` is a retired legacy concept. Close changes transient visibility.
Permanent removal notifies the application, which unmounts the DashPanel. Entity and relationship
leases release only through lifecycle teardown.

## 11. External application adapters

### 11.1 Immutable root adapter

External-owned mode requires exactly one root adapter supplied during Nexus creation. Scoped views
cannot attach or replace it. The adapter remains immutable for the root lifetime; switching host
stores requires a new root.

### 11.2 Synchronous local authority

The adapter exposes a synchronous projected snapshot, synchronous subscription, and synchronous
atomic whole-record write. It projects exactly Picodash-defined fields rather than the host's whole
state. Promise-based and remote authority is unsupported.

`getSnapshot()` returns one complete immutable projection and keeps its reference stable until a
semantic value change. `subscribe()` uses a no-argument listener and returns idempotent teardown.
Adapter object and callback identities remain stable for the root lifetime. Picodash clones and
validates every projection and never retains mutable host references.

The adapter has no prototype `id`, boolean write result, `previousValues` alias, or React-generated
adapter surface. Its write-failure reason union is exact:

```ts
type AdapterWriteFailureReason =
  'write_threw' | 'async_write' | 'not_visible' | 'invalid_snapshot' | 'mismatched_snapshot'
```

Candidate validation and semantic no-op removal happen before adapter health is consulted. An
otherwise valid write attempted while unhealthy returns one `adapter_unhealthy` transaction issue
with reason `blocked`, path `[]`, and the attributed `scopeId` when present. It does not invoke the
adapter or increment the health diagnostic. An attempted adapter write that fails returns one
`adapter_write_failed` issue with its `AdapterWriteFailureReason`, path `[]`, and the optional safe
`scopeId`.

### 11.3 Strict initialization

The initial projected snapshot must be complete and valid. Missing or invalid values prevent Nexus
activation. Picodash does not silently seed or repair an externally owned store; adapter code may
perform explicit initialization before returning its snapshot.

Adapter activation is ordered `read and validate -> subscribe -> reread and validate`. Failure
after subscription calls the returned teardown exactly once before construction throws. A malformed
adapter object is `invalid-configuration`. External startup failures throw
`PicodashInitializationError` with code `adapter-initialization-failed`, one
`adapter_initialization_failed` issue at path `[]`, and the exact
`AdapterInitializationFailureReason` declared by the correlated initialization map in Section 7.3.

### 11.4 Later invalid snapshots

An invalid later snapshot is rejected as a whole. Picodash retains the last valid values, marks the
adapter unhealthy, emits structured diagnostics, and blocks Picodash-originated writes until a
complete valid snapshot arrives. Picodash never repairs the host store implicitly.

Adapter health has one root-local diagnostic identity and exact specialization:

```ts
type AdapterHealthReason =
  'read_threw' | 'async_snapshot' | 'invalid_snapshot' | AdapterWriteFailureReason

type AdapterHealthDiagnostic = PicodashDiagnostic<
  'adapter_unhealthy',
  { readonly kind: 'adapter' },
  'error'
> & { readonly reason: AdapterHealthReason }
```

Each actual read, snapshot, or write failure increments that one aggregate. Blocked writes do not.
A later complete valid snapshot clears it. The diagnostic and transaction issue omit adapter
objects, raw or canonical values, arbitrary thrown causes and messages, stacks, and host-specific
identities.

### 11.5 Cross-authority atomicity boundary

Operations that change host-owned values and Picodash metadata validate everything first, write one
atomic adapter value batch, then perform a prevalidated no-fail metadata commit. Picodash subscribers
observe the completed operation once. Host subscribers may observe their value batch before
Picodash metadata because universal atomic observation across independent authorities is impossible.

After `adapter.setValues()` returns, Picodash synchronously re-reads `getSnapshot()` and requires the
complete projected record to equal the validated candidate. A thrown write, missing synchronous
visibility, invalid snapshot, or different result returns a safe adapter-write failure, commits no
Picodash metadata, preserves the last safe Picodash snapshot, and marks the adapter unhealthy.
Adapter authors therefore guarantee an atomic write or a throw before host mutation; Picodash cannot
repair a host adapter that mutates partially before throwing.

Synchronous adapter notifications caused by Nexus's own whole-record write are coalesced as an
internal echo. Nexus validates the post-write projection once and publishes at most one completed
Nexus notification. Metadata commands remain usable while adapter values are unhealthy because
they do not cross value authority.

An `initialEnvelope` in external-owned mode may contain Picodash metadata but must not contain values.
The adapter remains the sole value authority.

## 12. Persistence

### 12.1 Alpha authority boundary

The alpha capability implements Nexus-owned persistence only. It persists the disclosed canonical
value projection plus all durable Picodash scope metadata. External-owned metadata persistence,
conflict-resolution plans, erase plans, migrations, documents, quarantine recovery, and a built-in
Web Storage driver remain beta work. This boundary does not weaken the rule that `valueOwner` is an
immutable discriminant or permit external values to enter a future Nexus envelope.

### 12.2 Synchronous driver

Core persistence is synchronous. Hydration completes before a persisted Nexus becomes usable.
IndexedDB, remote storage, and asynchronous durability remain outside core Nexus authority.

```ts
type PicodashPersistenceDriver = {
  readonly identity: object
  read(storageKey: string): string | null
  write(storageKey: string, envelope: string): void
  remove(storageKey: string): void
  subscribe?(storageKey: string, listener: () => void): () => void
}
```

`identity` is a stable nominal token for the underlying backend; wrappers around the same backend
share it. All methods are synchronous. `write` and `remove` are atomic or throw before visible
mutation. `subscribe` carries no payload and only signals that Nexus must reread and validate. Alpha
never calls `remove`. Driver exceptions are normalized without retaining their cause, message, or
stack.

### 12.3 Capability and state

A persistent root and every scoped view expose the same root-wide capability. Its object identity is
stable and exact across those surfaces.

```ts
type PersistenceWriteStatus = 'unchanged' | 'saved' | 'pending'

interface PicodashPersistence {
  getState(): PicodashPersistenceState
  subscribe(listener: () => void): () => void
  flush(): PersistenceWriteStatus
}

type PicodashPersistenceState =
  | {
      readonly status: 'clean'
      readonly durableRevision: number | null
      readonly liveRevision: number
      readonly hasPendingEnvelope: false
      readonly lastError?: never
      readonly conflict?: never
    }
  | {
      readonly status: 'pending'
      readonly durableRevision: number | null
      readonly liveRevision: number
      readonly hasPendingEnvelope: true
      readonly lastError?: never
      readonly conflict?: never
    }
  | {
      readonly status: 'error'
      readonly durableRevision: number | null
      readonly liveRevision: number
      readonly hasPendingEnvelope: true
      readonly lastError: PicodashPersistenceDiagnostic
      readonly conflict?: never
    }
  | {
      readonly status: 'conflict'
      readonly durableRevision: number | null
      readonly liveRevision: number
      readonly hasPendingEnvelope: true
      readonly lastError?: never
      readonly conflict: PicodashPersistenceConflict
    }
```

All state and nested data are immutable. `durableRevision` is the last revision confirmed from the
configured driver, or `null` when none exists. `liveRevision` is the revision of the newest complete
local envelope and begins at zero without an envelope. The synchronous alpha path does not need to
leave an observable `pending` state without an error or conflict, but the accepted state member is
reserved for a complete envelope awaiting `flush()`.

`flush()` returns `unchanged` when no envelope is pending, `saved` only after writing and rereading
the latest pending envelope, and `pending` when an error or conflict remains. It never resolves or
overwrites a conflict. Capability listeners receive no argument, use `getState()`, have idempotent
teardown, and are independent of root value and scoped subscriptions.

### 12.4 Version-one envelope

`initialEnvelope` is a structured object, not serialized text:

```ts
type PicodashEnvelopeHeader = {
  readonly kind: 'picodash-nexus-envelope'
  readonly formatVersion: 1
  readonly nexusId: string
  readonly schemaVersion: number
  readonly revision: number
  readonly writerId: string
  readonly scopes: readonly (readonly [scopeId: string, metadata: SerializedDurableScopeMetadata])[]
}

type PicodashEnvelopeInput =
  | (PicodashEnvelopeHeader & {
      readonly valueOwner: 'nexus'
      readonly values: Readonly<Record<string, PicodashJsonValue>>
    })
  | (PicodashEnvelopeHeader & {
      readonly valueOwner: 'external'
      readonly values?: never
    })
```

Alpha produces and accepts only the `nexus` branch; the `external` branch reserves the exact future
authority distinction. `revision` is a positive safe integer. `writerId` is an opaque, trimmed,
control-character-free root writer identity. The `values` property is always present in a
Nexus-owned envelope, including as an empty record when policy omits every field, and contains the
complete disclosed projection. Missing omitted fields hydrate from the current validated baseline.
`scopes` contains every durable metadata record as sorted, duplicate-free entry tuples; metadata
maps use their existing sorted, duplicate-checked serialized entry arrays.

The decoder requires exact keys, strict JSON-compatible data, matching Nexus identity, matching
application schema, the accepted authority branch, known persisted field keys, and valid complete
scope metadata. Alpha rejects the whole envelope for unknown or incompatible input rather than
partially hydrating or quarantining it. Migration and granular recovery remain beta work.

Serialization is deterministic: records use lexically sorted keys recursively, arrays preserve
order, metadata entries are already sorted, finite numbers are required, and negative zero becomes
zero. Hydration-source comparison checks Nexus identity and revision separately. Its deterministic
content fingerprint covers normalized `schemaVersion`, `valueOwner`, `values`, and `scopes`, and
excludes `revision` and `writerId`. The fingerprint is internal and never enters public state or
diagnostics.

### 12.5 Construction and hydration

Server Nexuses are request-local and may receive `initialEnvelope` without a driver. The input is
cloned and never retained by reference. Construction follows these exact cases:

- no driver record and no initial envelope uses the validated baseline and performs no write;
- an initial envelope without persistence hydrates synchronously but adds no persistence capability;
- a valid driver record hydrates before Nexus activation;
- matching driver and initial envelopes hydrate once without writing;
- an empty driver plus an initial envelope writes and rereads a new local envelope with a fresh
  writer ID and revision `initial.revision + 1` before activation;
- driver and initial disagreement in identity, revision, or content fails construction;
- every read, subscription, seed-write, or verification failure is all-or-nothing and releases any
  acquired driver ownership before throwing.

Hydration uses the current field schemas, field validators, and root validator with validation source
`persistence`; it never invokes UI parsers. There is no implicit repair, default fallback for an
invalid disclosed field, or partial metadata commit.

Construction failures use these exact codes and safe reasons:

| Code                             | Reasons                                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------- |
| `persistence-driver-unavailable` | `read` \| `subscribe` \| `seed-write` \| `seed-verification`                                       |
| `invalid-persistence-envelope`   | `syntax` \| `shape` \| `format` \| `identity` \| `schema` \| `authority` \| `values` \| `metadata` |
| `hydration-source-conflict`      | `revision` \| `content`                                                                            |

They are `PicodashInitializationError` codes. Their issue data and error properties contain only the
listed reason and canonical paths, never raw envelope text, values, storage contents, or arbitrary
driver causes.

### 12.6 Persistence writes, failures, and conflicts

```ts
type PicodashPersistenceConflict = {
  readonly reason: 'foreign-envelope' | 'foreign-removal'
  readonly localRevision: number
  readonly localWriterId: string
  readonly durableRevision: number | null
  readonly durableWriterId: string | null
}

type PersistenceFailureReason =
  'read-failed' | 'write-failed' | 'write-verification-failed' | 'invalid-later-envelope'

type PicodashPersistenceDiagnostic = PicodashDiagnostic<
  'persistence_failure',
  { readonly kind: 'persistence' },
  'error'
> & { readonly reason: PersistenceFailureReason }
```

Conflict data is frozen and contains no values, envelope, fingerprint, driver identity, storage key,
or arbitrary cause. A write failure never rolls back valid live state. Nexus retains the newest
complete normalized envelope, exposes the diagnostic above, and replaces obsolete pending data after
each later persistable commit. Rejected candidate transactions do not alter it.

For a successful transaction, `persistence: 'unchanged'` means its persisted projection did not
change; it performs no retry, including for semantic no-ops and omitted-field-only changes.
`persistence: 'saved'` requires exact post-write verification. `persistence: 'pending'` means the
live commit succeeded but its newest complete envelope remains undurable. Existing capability state,
not the transaction result, reports an older pending condition unaffected by an `unchanged`
transaction.

Before each automatic write, Nexus rereads and compares the last confirmed revision, writer, and
content. A valid foreign envelope or foreign removal enters `conflict` before any write. After each
write, Nexus rereads and accepts durability only when the canonical envelope matches exactly.
Synchronous notifications caused by Nexus's own write are coalesced into that verification cycle.
Once conflicted, later valid transactions keep replacing the complete local pending envelope but
perform no driver writes; `flush()` also refuses to overwrite. Reload, overwrite, and reconcile are
explicit beta recovery plans rather than alpha shortcuts.

Only one live root may own a `(driver.identity, storageKey)` pair in one JavaScript realm. A second
claim throws `PicodashContractError` code `persistence-identity-in-use` with exactly
`{ storageKey }`. The context never contains the driver identity.

### 12.7 Persistence field policy

Export and persistence disclosure policies are separate. Nexus-owned persistence supports field
`include` or `omit`; redacted placeholders are not restorable values. Encryption belongs in a custom
synchronous driver.

Nexus-owned persistence configuration requires an explicit `values.defaultFieldPolicy`; there is no
implicit disclosure default. Per-field overrides may name only declared fields. Durable Picodash
metadata is always included. External-owned persistence and its no-values configuration remain beta.

### 12.8 Destruction and beta recovery

Any `hasPendingEnvelope: true` state makes root destruction throw `root-has-unpersisted-state`
unless `{ discardUnpersisted: true }` is supplied. Discard removes only the in-memory envelope.
Successful destruction unsubscribes the driver, releases `(driver.identity, storageKey)` ownership,
and never calls `remove` or changes the durable envelope. Integration leases remain the earlier
destruction refusal and cannot be bypassed by discard.

Beta adds external-owned metadata persistence; validated quarantine and replacement; schema
migrations; document integration; reload, overwrite, and reconcile plans; explicit erase plans; and
the browser Web Storage seam. Those additions must preserve the alpha envelope and state signatures
and may not introduce automatic last-write-wins.

### 12.9 Conflict resolution and explicit erase

The Nexus-owned beta capability adds opaque conflict-resolution and erase plans:

```ts
type PersistenceConflictResolutionOptions =
  | { readonly mode: 'reload' }
  | { readonly mode: 'overwrite' }
  | { readonly mode: 'reconcile'; readonly onOverlap: 'local' | 'durable' }

type PicodashPersistenceConflictResolutionPlan = Readonly<{
  readonly kind: 'persistence-conflict-resolution-plan'
  readonly mode: PersistenceConflictResolutionOptions['mode']
}>

type PicodashPersistenceErasePlan = Readonly<{
  readonly kind: 'persistence-erase-plan'
  readonly hasDurableEnvelope: boolean
  readonly discardsPendingEnvelope: boolean
}>

type PersistenceEraseResult =
  | Readonly<{ ok: true; erased: boolean; discardedPendingEnvelope: boolean }>
  | Readonly<{ ok: false; error: PicodashTransactionError }>
```

Both plan types are nominal, root-owned, and single-use. `reload` accepts the currently observed
durable projection: persisted fields and complete scope records replace their live counterparts,
while policy-omitted fields remain live. `overwrite` retains the complete local pending projection.
`reconcile` performs a deterministic three-way merge against the last driver-confirmed projection:
one changed side wins, equal changes coalesce, and differing two-sided changes use the required
`onOverlap`. Persisted fields merge individually; each complete scope record, including quarantined
raw metadata, is one merge unit. For foreign removal, the durable side is the validated field
baseline plus empty scope metadata. The complete reconciled value candidate validates before I/O.

Exact option errors are:

```ts
type InvalidPersistenceConflictOptionsReason =
  'not-object' | 'unknown-key' | 'accessor-property' | 'invalid-mode' | 'invalid-overlap'

type InvalidPersistenceEraseOptionsReason =
  'not-object' | 'unknown-key' | 'accessor-property' | 'confirmation-required'
```

`invalid-persistence-conflict-options` and `invalid-persistence-erase-options` expose only
`{ reason }`. Creating a conflict plan while not conflicted throws
`invalid-persistence-conflict-resolution` with `{ reason: 'not-conflicted' }`.
`invalid-persistence-plan` exposes exactly
`{ kind: 'conflict-resolution' | 'erase', reason: 'wrong-kind' | 'foreign-root' | 'consumed' }`.
The first otherwise-valid execution consumes a plan, including stale, validation, or driver failure.

Freshness covers the conflict generation and last confirmed base, the exact observed durable record
or absence, the current local persisted projection, quarantined raw records, and—for erase—whether
pending data will be discarded. Policy-omitted values, drafts, interaction, leases, and unrelated
diagnostics do not stale a plan. Changed captured state returns exactly
`{ code: 'stale_plan', path: [], message: 'Persistence plan is stale.' }`.

Execution rereads the exact durable target before action. `reload` writes nothing. `overwrite` and a
nontrivial `reconcile` write revision `max(local, observed durable, last confirmed) + 1`, reread, and
require exact content, revision, and writer equality before any live reload/reconcile commit. A
failed write, verification, or candidate validation changes no live Nexus state. Nexus-write echoes
are coalesced. Successful reload/overwrite/reconcile ends clean with no pending envelope; only live
value/scope changes notify root/scoped subscribers once, and existing dirty bindings become stale.

`createErasePlan()` captures whether a durable envelope exists and whether pending state will be
discarded. `executeErase(plan, { confirm: true })` rereads the captured target, calls `remove()` once,
rereads and requires `null`, then clears conflict/error/pending state. It never resets live values or
scope metadata and performs no compensating write. Success is clean with `durableRevision: null`, no
pending envelope, and retained `liveRevision` for the next monotonic write. A failed erase retains
the prior state. `PersistenceFailureReason` additionally includes `remove-failed` and
`remove-verification-failed`; safe transaction issues use `persistence_resolution_failed` or
`persistence_erase_failed`, path `[]`, and fixed messages. No public value exposes envelope contents,
fingerprints, storage keys, driver identities, quarantine contents, arbitrary causes, or stacks.

### 12.10 External-owned metadata persistence

External-owned persistence uses the same root-wide persistence capability, controller, conflict
plans, erase plans, revisions, backend identity claim, and lifecycle rules as Nexus-owned
persistence. Its exact configuration is:

```ts
type ExternalOwnedPersistenceConfig = Readonly<{
  storageKey: string
  driver: PicodashPersistenceDriver
  values?: never
}>
```

An own `values` property is invalid even when `undefined` or exposed through an accessor, and
validation does not read it. An identified external Nexus requires both `nexusId` and
`schemaVersion` and may configure persistence, migrations, an external `initialEnvelope`, and
document export. Other external configurations expose none of those capabilities. Persistent
external roots and scopes return `PersistentTransactionResult`; value-only changes report
`persistence: 'unchanged'` and perform no persistence I/O.

The external version-one envelope has the common header, `valueOwner: 'external'`, and `scopes`,
with no own `values` property. An external envelope with `values` fails with reason `values`; an
authority mismatch uses reason `authority`. Its fingerprint is the normalized
`{ schemaVersion, valueOwner: 'external', scopes }` projection.

Construction activates the external adapter before persistence and releases both subscriptions and
ownership claims if later initialization fails. Hydration changes only scopes and quarantined raw
scope records. Migration receives `values: {}` and must return it empty. Adapter notifications and
value-only commands neither touch the driver nor advance persistence revisions. Metadata remains
persistable while the adapter is unhealthy. A combined operation writes the validated adapter batch
first, commits prevalidated metadata, then attempts durability; durability cannot roll back the
external authority.

Reload, overwrite, reconcile, quarantine replacement, and erase operate on complete metadata units
only, report no changed fields, and never call `adapter.setValues()`. Persistence plans observe
metadata, quarantine, and durable state but ignore adapter values and health. The existing
controller is generalized with an authority strategy; a second controller or an empty Nexus-owned
value policy is not conforming.

### 12.11 Built-in Web Storage driver

The browser helper is isolated to `@picodash/nexus/web-storage`; the root entry remains browser-free
and compatible with `lib: ["es2023"]`:

```ts
export interface PicodashWebStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type PicodashWebStorageSource = 'local' | 'session' | PicodashWebStorage

export function createWebStoragePersistenceDriver(
  source: PicodashWebStorageSource,
): PicodashPersistenceDriver
```

There is no default. Import and construction do not mutate storage. Named browser storage is first
resolved by the real `read()`; unavailable storage throws a fixed cause-free error that construction
normalizes to `persistence-driver-unavailable` reason `read`. Supplied structural storage works
without `window`. There is no sentinel probe or availability flag.

Wrappers for the same exact Storage object in one realm share identity, including named and supplied
references to the current realm's local/session object. Native `storage` subscriptions signal only
for that backend and the configured key or a `null` clear event. Same-document events are not
synthesized. Arbitrary supplied backends have no subscription unless they are the current realm's
local/session Storage. Teardown is idempotent.

The driver forwards strings without parsing or serialization. Malformed text, write/quota, seed,
verification, and removal failures retain the existing safe Nexus classifications. Defaults,
availability helpers, custom event targets, key builders, synthetic notifications, codecs,
encryption, async storage, and automatic cross-tab merge are deferred.

## 13. Beta hydration recovery and migration

These accepted beta contracts extend the strict, all-or-nothing alpha decoder in Section 12. Alpha
does not ignore unknown fields, quarantine metadata, or run application migrations.

### 13.1 Current definitions are authoritative

Known persisted fields validate against current definitions. Missing fields use the current
baseline. Unknown fields are ignored, diagnosed, and removed on a later successful write. Renames
are never inferred.

### 13.2 Validation granularity

Unsupported envelope format rejects the whole envelope. Within a supported format, invalid scope
metadata may be quarantined/defaulted independently while valid scopes restore. Raw invalid records
remain available for recovery until deliberate replacement.

### 13.3 Explicit schema migrations

Schema migrations are synchronous pure functions registered by source version. Hydration requires a
complete chain to the current schema version. Each step receives cloned JSON data and cannot access
live Nexus state. Picodash validates the final result before committing. Failed migration preserves
the raw old envelope and commits nothing partial.

Each entry at key `N` migrates the application payload from schema version `N` to `N + 1`; skipping
versions or returning a different version is an error. The payload contains permitted values and
durable scope metadata but not Picodash format, Nexus identity, writer, or revision headers. The same
chain applies to persistence hydration and imported documents. Picodash-owned format migrations are
internal and separate from application schema migrations.

The public migration contract is exact:

```ts
type PicodashSchemaMigrationPayload = Readonly<{
  readonly schemaVersion: number
  readonly values: Readonly<Record<string, PicodashJsonValue>>
  readonly scopes: readonly (readonly [scopeId: string, metadata: PicodashJsonValue])[]
}>

type PicodashSchemaMigration = (
  payload: PicodashSchemaMigrationPayload,
) => PicodashSchemaMigrationPayload

type SchemaMigrations = Readonly<Record<number, PicodashSchemaMigration>>
```

`migrations[N]` receives a detached, deeply frozen strict-JSON payload at version `N` and must
synchronously return an exact strict-JSON payload at `N + 1`. The value projection may be partial or
empty so the same runner can later serve scoped documents. Scope entries contain raw serialized
records. Envelope format, Nexus identity, value authority, revision, and writer headers never enter
callbacks.

Migration configuration rejects accessors, symbols, invalid numeric keys, non-functions, and keys
greater than or equal to the configured `schemaVersion` as `invalid-configuration`. Hydration fails
with `schema-migration-failed` for exactly `source-newer`, `missing-step`, `callback-threw`,
`async-result`, `invalid-result`, `wrong-version`, or `final-validation`. Processing order is envelope
shape/header/identity/authority, hydration-source comparison in original canonical form, the entire
migration chain, current-field projection and complete value validation, independent scope decode
or quarantine, then one commit before activation. Any migration or value failure commits nothing.

### 13.4 Quarantine and deliberate replacement

Identified Nexuses expose one root-wide recovery capability, shared by root and scoped views:

```ts
type PicodashQuarantinedScopeMetadata = Readonly<{
  readonly scopeId: string
  readonly raw: PicodashJsonValue
}>

type PicodashMetadataRecoveryState = Readonly<{
  readonly quarantinedScopes: ReadonlyMap<string, PicodashQuarantinedScopeMetadata>
}>

interface PicodashMetadataRecovery<Result> {
  getState(): PicodashMetadataRecoveryState
  subscribe(listener: () => void): () => void
  replaceScope(scopeId: string, replacement: SerializedDurableScopeMetadata | null): Result
}
```

Quarantine retains a detached immutable raw JSON record. `null` deliberately discards it and restores
current defaults. A valid complete replacement atomically removes quarantine and sets or prunes the
scope record. Invalid replacement returns `invalid_metadata` at `['scopes', scopeId]` and preserves
quarantine. Replacing a scope that is not quarantined throws `invalid-quarantine-replacement` with
exactly `{ reason: 'not-quarantined' }`.

Ordinary durable metadata commands against a quarantined scope return one `quarantined_metadata`
issue and mutate nothing. Later persistence envelopes merge each quarantined raw record unchanged
and include it in the content fingerprint until successful replacement.

Quarantine emits a warning diagnostic `metadata_quarantined` with identity
`{ kind: 'scope-metadata', scopeId }` and no raw record. Ignored persisted fields emit warning
`unknown_persisted_fields` with identity `{ kind: 'schema' }` and only `unknownFieldCount`; field
names remain private. The first diagnostic recovers only after successful replacement. The second
recovers after the next verified write emits the current projection.

## 14. Export and import

### 14.1 Centralized policy

Export configuration lives under `export`, including document defaults and per-field policy. Field
definitions do not embed disclosure behavior.

`export.documents.defaultFieldPolicy` is required and is one of `include`, `redact`, or `omit`.
Per-field entries override that document default to establish each field's immutable maximum.
Promotion is legal only for a field whose configured
default is `redact` and whose immutable policy explicitly permits confirmed promotion. Unknown
field keys fail Nexus construction.

Nexus document APIs operate on immutable JSON-compatible document objects. `executeExport()` returns
that object and `analyzeImport()` accepts parsed unknown data. Core Nexus does not own filenames,
browser downloads, clipboard behavior, MIME types, or JSON/YAML text parsing. A consuming product or
future dedicated codec entry may add those concerns without changing document validation or policy.

### 14.2 Maximum disclosure

Per-call export options may narrow the immutable policy but cannot promote hard-omitted fields.
Omitted fields leave no entry or named omission marker. Redacted entries contain a structured
`{ status: 'redacted' }` marker and import leaves their target value unchanged.

### 14.3 Confirmed redaction promotion

A field may opt into promotion from redacted to included with confirmation. Export first creates a
value-free plan describing the exact sensitive fields. Built-in UI uses the dangerous-operation
modal. Confirmation is single-use, never remembered, and becomes stale when relevant state changes.
Programmatic promotion remains equally explicit. This is a guardrail, not an authorization boundary.

All export plans are opaque, root-owned, single-use, and fingerprint the relevant values, metadata,
registrations, policy, and scope graph. Execution uses
`documents.executeExport(plan, { confirmRedactedPromotion: true })` only when the plan lists promoted
fields; otherwise the confirmation option is omitted. A changed fingerprint returns `stale_plan`.
There is no reusable authorization object or remembered consent.

### 14.4 Scoped export projection

A scoped export includes selected scope durable metadata, optionally active descendants, and
deduplicated current root values for actively registered fields. It excludes drafts, Provider
runtime, and relationship history.

Registered-field membership is active-only. A dormant scope export contains metadata but infers no
root values; callers may explicitly select fields through nominal handles, still subject to
disclosure policy.

Per-call field selection uses nominal target-root field handles rather than unchecked strings.
Scoped options may include active descendants and may narrow the field set; they cannot name another
root or scope. Root options may explicitly select a scope. Every selection remains bounded by the
immutable export policy.

Documents declare `kind: 'root' | 'scope'`. Root Nexus document methods default to a full-root
document and may explicitly target a scope. Scoped Nexus document methods always target their own
scope and do not accept another `scopeId`. Root documents include permitted root values and all
durable scope metadata; scope documents use the scoped projection above.

### 14.5 Document identity and target

Documents record source Nexus ID, source scope, format version, schema version, and serialized field
entries. Import is invoked against an explicit target Nexus/scope. A foreign Nexus ID requires
explicit permission and warning. Target contracts validate all values; unknown or incompatible
fields prevent atomic commit unless an explicit mapping resolves them.

### 14.6 Descendant mapping

The document root scope maps to the target invocation scope. Matching descendant IDs may map
automatically. Renamed descendants require an explicit `scopeMap`. Missing scopes fail unless
`createMissingScopes` is explicit. Imported metadata may create dormant scope state but never mounts
entities or registers relationships.

Import analysis options use `allowForeignNexus`, `scopeMap`, `fieldMap`, and
`createMissingScopes`. `fieldMap` maps a serialized source key to a nominal target-root field handle
or the explicit sentinel `ignore`; unchecked target strings are not accepted. Automatic same-key
mapping applies only to known compatible fields. Ignoring, creating missing state, and accepting a
foreign Nexus identity are all surfaced in the plan for application confirmation.

`analyzeImport()` produces an opaque root-owned, single-use plan that fingerprints the input
document and relevant target state. `executeImport()` accepts only a plan for the same root and
revalidates its document kind, mappings, target revisions, policy, and candidate transaction.
Root-document imports target a root; scope-document imports target an explicit root scope or the
current scoped view. Kind mismatches fail rather than inferring a projection.

### 14.7 Version-one document and plan contract

The beta core uses one exact, deterministic strict-JSON union:

```ts
type PicodashDocumentFieldEntry = readonly [
  fieldKey: string,
  entry:
    | Readonly<{ readonly status: 'included'; readonly value: PicodashJsonValue }>
    | Readonly<{ readonly status: 'redacted' }>,
]

type PicodashRootDocument = Readonly<{
  readonly formatVersion: 1
  readonly kind: 'root'
  readonly nexusId: string
  readonly schemaVersion: number
  readonly fields: readonly PicodashDocumentFieldEntry[]
  readonly scopes: readonly (readonly [string, SerializedDurableScopeMetadata])[]
}>

type PicodashScopeDocument = Readonly<{
  readonly formatVersion: 1
  readonly kind: 'scope'
  readonly nexusId: string
  readonly schemaVersion: number
  readonly scopeId: string
  readonly fields: readonly PicodashDocumentFieldEntry[]
  readonly scopes: readonly (readonly [string, SerializedDurableScopeMetadata])[]
}>

type PicodashDocument = PicodashRootDocument | PicodashScopeDocument
```

Objects require exact own enumerable data properties; arrays are strict, entry keys are lexically
sorted and duplicate-free, and all output is detached and deeply immutable. Root documents omit
`scopeId`; scope documents require it. Import is overlay-only: included fields replace mapped target
values, redacted and absent fields leave values unchanged, present scope records replace complete
mapped target records, and absent scope records do not delete or reset target state. Root replacement,
deletion markers, selective scope ignore, and value-bearing document diffs are deferred.

Export options are exact records with optional `scopeId` on a root receiver,
`includeDescendants: boolean`, `fields` as a duplicate-free array of same-root nominal handles, and
`promoteFields` as a duplicate-free subset of selected same-root handles. A scoped receiver cannot
accept `scopeId`. When `fields` is absent, full-root export selects every root field, while scoped
export selects active input/display binding fields across the captured target set. Explicit fields
are the exact selection independent of registration. Descendants follow only active relationship
edges. Full-root export includes every durable non-quarantined scope and needs no graph or binding
freshness. Quarantined raw records are not exportable documents.

Import analysis options are exact records with optional `allowForeignNexus: boolean`,
`createMissingScopes: boolean`, `fieldMap` from source keys to same-target-root nominal handles or
`'ignore'`, `scopeMap` from source IDs to valid target IDs, and root-only `targetScopeId` for a scope
document. A scoped receiver targets itself and cannot accept `targetScopeId`. Mapping records use own
enumerable data properties, forbid duplicate target fields/scopes, and apply only after strict decode,
redacted-entry removal, and the complete schema-migration chain. Same-key compatible fields and
matching descendant IDs map automatically when no explicit entry overrides them.

A scope exists for analysis when it has durable or quarantined state or an active entity, binding,
DashList node, or relationship endpoint. Merely creating a scoped Nexus handle does not establish
existence. `createMissingScopes: true` allows only valid imported metadata to create dormant durable
state; it never creates runtime leases or ancestry. Invalid imported metadata rejects the complete
analysis rather than entering hydration quarantine.

Plans expose value-free review data only:

```ts
type PicodashExportPlan = Readonly<{
  readonly kind: 'export-plan'
  readonly documentKind: 'root' | 'scope'
  readonly scopeId?: string
  readonly fieldKeys: readonly string[]
  readonly promotedFieldKeys: readonly string[]
  readonly scopeIds: readonly string[]
}>

type PicodashImportPlan = Readonly<{
  readonly kind: 'import-plan'
  readonly documentKind: 'root' | 'scope'
  readonly targetScopeId?: string
  readonly changedFields: readonly string[]
  readonly changedScopeIds: readonly string[]
  readonly ignoredFields: readonly string[]
  readonly createdScopes: readonly string[]
  readonly fieldRemaps: readonly (readonly [string, string])[]
  readonly scopeRemaps: readonly (readonly [string, string])[]
  readonly foreignNexus: boolean
}>
```

Both are nominal, opaque, root-owned, and single-use. Plan misuse throws `invalid-document-plan` with
exactly `{ kind: 'export' | 'import', reason: 'wrong-kind' | 'foreign-root' | 'foreign-target' |
'consumed' }`. Malformed exact options throw `invalid-document-options` with only operation
`'export' | 'export-execution' | 'import-analysis'` and reason `not-object`, `unknown-key`,
`accessor-property`, `invalid-target`, `invalid-fields`, `duplicate-field`, `invalid-promotion`,
`invalid-mapping`, `duplicate-target`, `invalid-boolean`, `confirmation-required`, or
`unexpected-confirmation`.

`executeExport()` returns `{ ok: true, document }` or a transaction error. Promotion confirmation is
accepted only as exact `{ confirmRedactedPromotion: true }` when the plan lists promoted fields.
`analyzeImport()` returns `{ ok: true, plan }` or a transaction error; review followed by
`executeImport(plan)` is the confirmation sequence and needs no generic confirm flag. Structurally
valid execution consumes the plan before stale, validation, adapter, or persistence failure;
malformed execution options do not consume it.

Document failures use `invalid_document` with reason `shape`, `format`, `kind`, `identity`, `schema`,
`fields`, `scopes`, or `metadata`, plus `foreign_nexus`, `unknown_field`, `incompatible_field`,
`missing_scope`, `schema_migration_failed`, configured validation issues, and `stale_plan`. Export
staleness says `Export plan is stale.`; import says `Import plan is stale.` Both use path `[]`.
Import-migration failure is a live transaction issue and never reuses initialization exceptions.

Export freshness includes selected included/promoted values and metadata, plus active binding and
descendant membership only when they determine a scoped projection. Import freshness includes the
normalized migrated input, complete target values because root validation observes them, mapped
metadata/quarantine, and scope-existence facts. Drafts, interaction, unrelated state/graph edges,
diagnostics, persistence status, revisions, fingerprints, raw documents, and field values never enter
plans or errors.

Import validates the complete overlay with source `import`, never calls UI parsers, marks affected
dirty bindings stale, and commits one value batch plus prevalidated metadata through the configured
adapter/persistence boundary. It produces at most one persistence-envelope attempt and no partial
mutation.

## 15. React API and selectors

### 15.1 Contextual Nexus hooks

> Contract status: Revised 2026-08-06

The target contextual API distinguishes possible results:

```ts
usePicodashNexus() // RootNexus | ScopedNexus
usePicodashNexus('settings') // ScopedNexus
usePicodashRootNexus() // RootNexus
usePicodashScope() // nearest ScopedNexus or throws
```

Contextual hooks throw `missing-nexus-context` with exactly `{ required: 'root-or-scoped' }` when
no Provider-hosted Nexus boundary exists, or `{ required: 'scoped' }` when a scoped boundary is
required but the nearest boundary supplies only a root. `usePicodashNexus(scopeId)` resolves a view from
the nearest root but does not create scope state, register an entity, or add a relationship.
Only declarative product boundaries acquire leases.

The Nexus integration entry's entity boundary requires a scoped Nexus and uses this discriminated
configuration:

```ts
type PicodashNexusEntityBoundaryProps = Readonly<{
  children: ReactNode
  nexus: ScopedNexus
}> &
  ({ kind: 'dashPanel'; allowStandalone?: never } | { kind: 'dashList'; allowStandalone?: boolean })
```

Inherited context always wins: `allowStandalone` is ignored when a boundary is rendered under a
Provider or another entity boundary, and the nearest host and parent token are retained. Without
context, omission or `false` preserves the exact `missing-nexus-context` `{ required:
'root-or-scoped' }` error. Only literal `allowStandalone: true` on a rootless DashList creates a
private standalone integration host. Nexus constructs that host without acquiring a lease, provides
frozen root/scoped context synchronously, then mounts one root DashList and queued descendants in a
committed effect. The host is package-private and never re-exported. Root activation is atomic:
failures roll back relationships and entities deepest-first while leaving child declarations
retryable. Cleanup is idempotent and releases relationships before entities. A DashPanel child
directly under a standalone DashList host fails `invalid-integration-handle` with
`{ role: 'host', reason: 'wrong-kind' }`; a nested Provider resets ancestry normally.

### 15.2 Selector hooks

Selectors receive the relevant Nexus snapshot and return the selected or derived value:

```ts
usePicodashNexusSelector(nexus, selector, equalityFn?)
usePicodashRootSelector(selector, equalityFn?)
usePicodashScopeSelector(selector, equalityFn?)
```

Equality defaults to `Object.is`. `shallowEqual` is an opt-in export for small object, array, or
tuple projections. Custom equality remains optional. Deep equality is not provided as a default.

Selectors are pure, may run more than once, and receive immutable data snapshots only. The explicit
`usePicodashNexusSelector(nexus, ...)` works without context. Root and scope contextual selectors
throw when their required context is unavailable. Server and client selection use the same
synchronous Nexus snapshot; hydration consistency is the application's Nexus-construction
responsibility described above.

### 15.3 Package ownership

`@picodash/nexus` is framework-independent. `@picodash/nexus/react` owns public hooks and selectors.
`@picodash/nexus/integration` is the versioned low-level composition surface used by DashPanel and
DashList for context, Provider-hosted and opted-in standalone React boundaries, and lifecycle
leases. The boundaries are low-level composition tools; ordinary applications do not need them.
The UI packages use compatible
Nexus and React peer dependencies; global context bridges do not conceal duplicate or incompatible
packages.

The package root must load without React and must not import React-specific Zustand entrypoints.
React is an optional peer for installing the core package and becomes a runtime requirement only
when `/react` or `/integration` is imported. Artifact tests enforce this split.

The integration entry exposes the shared Nexus boundary protocol and the exact Provider, entity,
relationship, and binding acquisition functions in Section 3.9. Acquisition occurs only after a
declarative render commits, except that binding acquisition is an explicit scoped Nexus seam and
does not require an active entity. Every lease is one nominal generation with idempotent
`release()`; release is lifecycle teardown, not a domain-level deregistration command. Abandoned
renders acquire nothing, and React Strict Mode reacquisition reruns all identity and graph checks.

The Nexus package does not add an application-facing global Provider or duplicate-package bridge.
DashPanel, integrated Picodash, and standalone DashList remain the product-owned public context
boundaries; the Nexus boundaries exist only as the low-level composition seam for their Provider and
standalone hosts.

## 16. Diagnostics and trust

### 16.1 Contract versus operational failure

Duplicate entities, identity disagreement, cross-root handles, host conflicts, illegal reentrancy,
and use-after-destroy throw in every environment.

Persistence failures/conflicts and later invalid adapter snapshots preserve the last safe state and
publish structured status/diagnostics. Diagnostic codes are stable; human messages may evolve.

Diagnostics use an always-present core namespace:

```ts
export interface PicodashDiagnostics {
  getState(): PicodashDiagnosticsState
  subscribe(listener: () => void): () => void
}

type PicodashDiagnostic<
  Code extends string = string,
  Identity extends object = object,
  Severity extends 'error' | 'warning' = 'error' | 'warning',
> = {
  readonly code: Code
  readonly severity: Severity
  readonly message: string
  readonly identity: Identity
  readonly count: number
  readonly lastOccurrence: number
}

type PicodashDiagnosticsState = {
  readonly current: ReadonlyMap<string, PicodashDiagnostic>
}

type SubscriberExceptionIdentity = {
  readonly kind: 'subscriber'
  readonly surface: 'root' | 'scope' | 'diagnostics' | 'capability'
  readonly scopeId?: string
  readonly capability?: string
}

type SubscriberExceptionDiagnostic = PicodashDiagnostic<
  'subscriber_exception',
  SubscriberExceptionIdentity,
  'error'
>
```

Every root and scoped Nexus has a readonly `diagnostics: PicodashDiagnostics` property. Calling the
namespace through either surface reads and subscribes to the same root-wide diagnostic state,
independently of value subscriptions. The identity of the namespace facade itself is not public;
consumers do not rely on `root.diagnostics === scoped.diagnostics`.

A future `inspectRuntime()` may return an immutable point-in-time structural view of Providers,
entity leases, bindings, and active relationships. That future inspection defaults a scoped Nexus
to its own scope and requires an explicit root-wide option; it is not part of the alpha diagnostics
interface above. Neither current diagnostics nor future inspection exposes canonical values, raw
draft input, or arbitrary exception causes.

Diagnostic state is a bounded current-condition map keyed by stable diagnostic identity, not an
event log. Repeated occurrences update count and last-occurrence metadata on the same entry; recovery
removes the active condition. Applications that need history subscribe and forward diagnostics to
their own logging system.

`subscriber_exception` is aggregated by the identity above; diagnostic map keys remain opaque.
`lastOccurrence` is a root-local monotonically increasing safe integer rather than wall-clock time.
Each thrown callback increments `count`, does not roll back committed state, and does not prevent
later callbacks. The current safe message is `A Nexus subscriber threw.`; its wording may evolve
without changing code, identity, or privacy. The diagnostic contains no callback identity, thrown
cause, thrown message, stack, raw draft, or canonical value. A later dispatch for the same identity that completes without an
exception removes the condition. A diagnostics-subscriber exception is recorded only after its
current dispatch finishes and never recursively dispatches during that cycle.

`PicodashDiagnosticsState.current` uses the broad `PicodashDiagnostic` default.
`SubscriberExceptionDiagnostic`, `AdapterHealthDiagnostic`, and
`PicodashPersistenceDiagnostic` are exact named specializations for their owning conditions;
persistence `lastError` uses the persistence specialization. The common generic shape represents
future capability diagnostics without requiring a closed union.

### 16.2 Transaction context

Nexus-issued adapter writes carry immutable Nexus-generated metadata:

- operation source;
- optional origin scope;
- target scopes resolved before mutation;
- final changed fields after validation and no-op removal.

`targetScopeIds` describes command targets, not every scope that reactively observes a changed root
field.

The adapter operation-source union is `programmatic`, `interactive`, `repair`, `reset`, and
`import`. Metadata-only operations never call the value adapter. Changed-field and target-scope
arrays are sorted deterministically.

### 16.3 Trusted in-process code

All Dashlets and components within one root Nexus are trusted application code. A scoped Nexus grants
access to the entire root value set. Export and persistence policy do not prevent direct in-process
access. Untrusted plugins use a separate root/Provider and an application-controlled bridge.

### 16.4 DOM identity

DOM IDs are derived only at the rendering edge from a React hydration-stable host namespace plus
encoded scope/item/binding/field identity. Raw IDs are not concatenated, persisted, exported, or
used as Nexus keys. `nexusId` is not exposed in markup.

## 17. Configuration immutability

The following remain immutable for a root lifetime:

- Nexus ID and schema version;
- field contracts and initial baseline;
- value owner and adapter;
- persistence driver and key;
- export and persistence field policies.

Diagnostics listeners may attach and detach. Changing authority, schema, identity, or serialization
policy requires a new root Nexus.

## 18. Deferred and non-goals

The accepted contract intentionally defers:

- a public runtime scope-rename API;
- generic stale-draft rebase without field-defined merge semantics;
- an arbitrary public transaction callback;
- a public context-only Nexus Provider;
- runtime registration of arbitrary durable metadata kinds;
- populated binding and item interaction snapshots before input-command support;
- UI presentation compatibility contracts on Nexus fields;
- automatic pruning based only on currently mounted nodes;
- automatic cross-tab merge or collaboration;
- async parsers, validators, adapters, or core persistence;
- scope-based authorization or untrusted-plugin sandboxing;
- cross-container DashList dragging that changes declarative membership.

## 19. Alpha decision and evidence boundary

Nexus alpha requires the scope-ID error mapping, exact root/scoped views and write attribution, the
stable empty interaction snapshot, complete built-in metadata commands, the Provider/entity/
relationship integration leases, the root-wide diagnostics namespace, fail-closed adapter health,
the Nexus-owned persistence capability, scope and root destruction, bounded subscriber-exception
diagnostics, and weak canonical views without a public release or reference-count API. These are
launch contracts rather than beta ergonomics.

Binding acquisition is now frozen by BIND-LEASE-1 as the prerequisite for populated interaction
state. Acquisition and empty-state cleanup evidence remains Partial until input commands populate
interaction snapshots; this does not permit a private population path or weaken any value,
metadata, lease, persistence, or destruction invariant.

The signatures and semantics above are frozen for alpha even where exhaustive evidence continues
during consumer dogfooding. Beta may continue broader generated relationship-graph traversal,
stale-draft conflict permutations, persistence conflict/recovery combinations, and the complete
`inspectRuntime()` diagnostic projection. Documents, pruning, overwrite/repair plans, migrations,
and advanced recovery keep their existing roadmap ownership. Continuing evidence does not permit a
partial mutation, silent conflict overwrite, private cross-package bypass, or implementation-status
advance without linked conformance evidence.
