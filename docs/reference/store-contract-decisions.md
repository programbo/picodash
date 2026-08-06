# Store contract decisions

This reference records the accepted target decisions for `@picodash/store` and its composition with
DashPanel and DashList. It is the searchable source for exact contract details. ADR 0002 explains
why the model exists; this page states what the model requires.

## Status

> Contract: Accepted
> Implementation: Prototype
> Evidence: The conformance matrix has not yet reconciled most decisions with implementation.

Unless a section says otherwise, names shown as method examples are target API names rather than a
claim that the prototype exports them.

## 1. Root Store and scope model

### 1.1 One root authority

A Picodash root Store owns one complete set of field contracts and canonical values. It may be used
at Provider level or deliberately shared at application level.

### 1.2 Scoped views are aliases

`root.scope('settings')` returns an immutable scoped view of the same root Store. A scoped view does
not contain or copy a separate value store.

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

Core value, scope, transaction, and diagnostic APIs are always available. Supplying both `storeId`
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

The same lexical rule applies to `storeId`, `providerId`, DashList node IDs, and binding aliases.
Field keys additionally reject `__proto__`, `prototype`, and `constructor` so field/value records
cannot become prototype-mutation channels. Punctuation remains opaque and legal. `storageKey` is a
driver locator rather than an entity ID, but must still be non-empty and control-character-free.

### 2.2 Public naming

DashPanel and DashList components expose `id`. Store state, methods, documents, transaction
metadata, and diagnostics use `scopeId`. The Store model does not expose separate `panelId` and
`listId` identities.

### 2.3 Provider IDs

`providerId` defaults to `default`. One root may have only one active Provider with a given
Provider ID. Two active default Providers sharing a root conflict. Providers using different root
Stores do not conflict merely because both use `default`.

Provider IDs identify runtime hosts and do not namespace scope IDs.

### 2.4 Runtime identity, Store IDs, and schema versions

Every root receives an internal runtime identity used for nominal ownership and live conflict
checks. It is never serialized.

Public `storeId` is optional for an ephemeral Store. It becomes required when persistence, export,
import, or schema migration is enabled. A `storageKey` is only a storage locator and cannot replace
logical Store identity. Documents and envelopes record `storeId`, never runtime identity or the
storage key.

Ephemeral Stores may omit `schemaVersion`. Persistence, export, import, or configured migrations
require a positive safe-integer application `schemaVersion`. A Panel-only Store that persists layout still
declares it because scope IDs and metadata semantics may evolve. Documents also record
Picodash-owned `formatVersion`; the two versions have different ownership.

Supplying `schemaVersion` without `storeId` is invalid because a version has no logical document
identity to qualify. Supplying `storeId` alone is allowed for an otherwise ephemeral Store but does
not enable documents.

### 2.5 Mount-lifetime identity

Provider root Store, Provider ID, resolved entity root, scope ID, item ID, group ID, and binding
alias are immutable for a mount lifetime. Intentional identity changes use keyed remounts.

## 3. Provider, entity, and relationship rules

### 3.1 Provider requires a root Store

`DashPanelProvider` receives an explicit root Store. Integrated `PicodashProvider` composes the same
boundary contract. Neither silently creates a Store, and both reject a scoped Store.

### 3.2 DashPanel requires a Provider

DashPanel resolves its Store through `DashPanelProvider` or integrated `PicodashProvider`. It does
not expose a public independent Store prop.

### 3.3 Standalone DashList resolution

For a standalone DashList:

- root Store plus `id` resolves that scope;
- scoped Store without `id` uses the Store's scope;
- scoped Store plus matching `id` is allowed but redundant;
- scoped Store plus conflicting `id` throws;
- root Store without `id` throws when there is no nearest scope to inherit.

Inside Store context, a `store` prop may be used only when it has the same root and its scope agrees
with `id`. A different root throws. Normal Provider composition omits the Store prop.

### 3.4 Nearest Store context

`usePicodashStore()` resolves the nearest Store context:

- Provider supplies its root;
- DashPanel supplies its scoped view;
- standalone DashList supplies its scoped view.

The hook throws when no Store context exists. Supplying a scope ID resolves that view from the
nearest root.

### 3.5 Provider is a hard boundary

Every `DashPanelProvider` or integrated `PicodashProvider` resets Store context to its supplied root
and clears inherited scope ancestry. No child-scope edge crosses a Provider boundary. A nested
Provider may introduce a different root or reuse the same root with a unique Provider ID and
disjoint active scopes.

Only a Provider establishes a new root boundary; component Store props cannot switch roots.

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
registers a parent-child edge. Resolving the same scope creates no edge. Manual `store.scope()` calls
never create relationships.

Edges exist only while their declarative boundaries hold active leases. Unmount or React effect
deactivation removes the edge but preserves scope state. One child may have only one active parent;
cycles and simultaneous parents throw. Mount tokens make registration safe under React Strict Mode.

### 3.9 Public integration leases

`@picodash/store/integration` exposes the exact Provider, entity, and relationship acquisition
surface used by declarative UI products:

```ts
type StoreEntityKind = 'dashPanel' | 'dashList'

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
>(rootStore: RootStore<Fields, Result>, options?: { readonly providerId?: string }): ProviderLease

declare function acquireEntityLease<
  Fields extends Record<string, FieldLike>,
  Result extends CoreTransactionResult = CoreTransactionResult,
>(scopedStore: ScopedStore<Fields, Result>, options: EntityLeaseOptions): EntityLease

declare function acquireRelationshipLease(
  parentEntity: EntityLease,
  childEntity: EntityLease,
): RelationshipLease
```

The returned objects are frozen, opaque, nominal mount generations. Their only caller-visible
operation is `release()`, and callers never supply or reconstruct a lease ID. `providerId` defaults
to `default`; Provider acquisition accepts only a root Store, and entity acquisition accepts only a
scoped Store. A Provider-hosted root entity supplies its `ProviderLease`; a nested entity supplies
the nearest `EntityLease`. Only a standalone root DashList may omit `host`, in which case Store owns
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
and therefore cannot cross a nested Provider boundary even when both Providers share a root Store.
Several live relationship leases may represent the same ordered parent-child edge; the edge remains
active until its final generation releases. A child may have only one active parent. Same-scope
edges, cycles, cross-root edges, and cross-host edges are rejected.

The first successful `release()` is lifecycle teardown and later calls are idempotent no-ops.
Provider and entity release refuse while dependent leases remain active; callers tear down in the
order relationship, child entity, parent entity, then Provider. Binding lease acquisition remains a
later Store slice and is not part of this accepted alpha integration surface.

The integration contract errors and their complete safe contexts are:

| Code                           | Context                                                                                         |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| `invalid-provider-id`          | `{ reason: InvalidProviderIdReason }`                                                           |
| `duplicate-provider`           | `{ providerId: string }`                                                                        |
| `invalid-entity-options`       | `{ reason: InvalidEntityOptionsReason }`                                                        |
| `invalid-integration-handle`   | `{ role: 'host' \| 'parent' \| 'child', reason: 'foreign-root' \| 'released' \| 'wrong-kind' }` |
| `duplicate-entity`             | `{ scopeId: string, entityKind: StoreEntityKind }`                                              |
| `scope-host-conflict`          | `{ scopeId: string }`                                                                           |
| `invalid-relationship`         | `{ reason: 'same-scope' \| 'host-boundary' }`                                                   |
| `relationship-parent-conflict` | `{ childScopeId: string }`                                                                      |
| `relationship-cycle`           | `{ parentScopeId: string, childScopeId: string }`                                               |
| `lease-has-active-dependents`  | `{ leaseKind: 'provider' \| 'entity' }`                                                         |

`InvalidProviderIdReason` is the same lexical reason union as `InvalidScopeIdReason`. Context never
contains a Store, handle, root runtime identity, host generation, caller-supplied invalid value,
stack, or arbitrary cause.

### 3.10 Private runtime controller

One module-private `WeakMap` resolves a root Store to its runtime controller. The integration entry
uses that controller for host and relationship generations, and `destroyScope()` uses the same
controller for active descendant traversal. The controller is registered during Store creation and
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
by explicit ID or an explicit administrative selection. The Store validates the complete target set
before one atomic mutation.

A successful result has `changedFields: []` and sorted `changedScopeIds` containing only scopes whose
durable or interaction state changed. Destroying absent state succeeds with both changed arrays empty.
Option validation uses the exact mapping above; malformed root scope IDs throw `invalid-scope-id`
before lookup. Destruction neither releases leases nor changes relationship registration.

### 4.4 Root lifetime

The application owns the root Store lifetime. Provider unmount releases leases but never destroys
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

After successful destruction, every property access and method call on an existing `RootStore` or
`ScopedStore`, diagnostics namespace, or capability handle throws `use-after-destroy`. Previously
returned unsubscribe functions remain idempotent no-ops, and previously captured immutable snapshots
remain readable detached data. Existing field handles remain inspectable values, but no destroyed
Store can operate on them.

Implementation follows the dependency order integration leases, root lifecycle, then adapter and
persistence authority. This sequencing lets destruction inspect active lease generations before it
releases adapter subscriptions, persistence subscriptions, or persistence ownership; it does not add
or change any public alpha API.

### 4.5 Scope rename is deferred

The initial public API does not include `renameScope()`. Persisted renames use explicit schema
migration before entities become active. A future administrative rename must require inactive
source and target scopes, an empty target, atomic metadata movement, and no root-value changes.

## 5. Root and scoped state surfaces

### 5.1 Distinct Store types

Root and scoped Stores have distinct TypeScript interfaces and a discriminant. Both share field and
canonical value operations. Scoped Store exposes `scopeId` and an explicit `.root` reference.

The exact scope/value/lifecycle portion is:

```ts
type FieldLike = {
  readonly defaultValue: PicodashJsonValue
  readonly schema?: StandardSchemaV1<unknown, PicodashJsonValue>
  readonly parse?: (input: unknown) => PicodashParseResult<PicodashJsonValue>
}

interface RootStore<
  Fields extends Record<string, FieldLike>,
  Result extends CoreTransactionResult = CoreTransactionResult,
> extends RootMetadataCommands<Result> {
  readonly kind: 'root'
  readonly diagnostics: PicodashDiagnostics
  readonly fields: PicodashFields<Fields>
  scope(scopeId: string): ScopedStore<Fields, Result>
  getState(): RootSnapshot<ValuesOf<Fields>>
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

interface ScopedStore<
  Fields extends Record<string, FieldLike>,
  Result extends CoreTransactionResult = CoreTransactionResult,
> extends ScopedMetadataCommands<Result> {
  readonly kind: 'scoped'
  readonly diagnostics: PicodashDiagnostics
  readonly root: RootStore<Fields, Result>
  readonly scopeId: string
  readonly fields: PicodashFields<Fields>
  scope(scopeId: string): ScopedStore<Fields, Result>
  getState(): ScopedSnapshot<ValuesOf<Fields>>
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

A non-persistent configuration instantiates `RootStore<Fields, CoreTransactionResult>` and its
scoped views preserve that result type. A persistence-enabled configuration instantiates
`RootStore<Fields, PersistentTransactionResult>` and preserves that type through `.scope()` and
`.root`. Every safe value, metadata, and scope-destruction command returns the configuration's
`Result`; every matching `*OrThrow` command returns `Extract<Result, { readonly ok: true }>`. Root
`destroy()` remains `void` because it is final lifecycle teardown rather than a transaction.

### 5.2 Root snapshot

`RootStore.getState()` exposes canonical root values and durable scope metadata. It does not expose
binding drafts or Provider visual runtime. Capability-specific status belongs to the corresponding
typed namespace rather than appearing on every ephemeral root snapshot.

The accepted grouping is `{ values, scopes }`. Snapshot and unchanged nested references remain
`Object.is`-stable until a relevant semantic change. `scopes` contains only scopes with durable
metadata; creating a scoped view does not add an entry.

### 5.3 Scoped snapshot

`ScopedStore.getState()` combines:

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

type ScopedSnapshot<Values extends object> = {
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

Both Store types expose the framework-independent external-store contract:

```ts
store.getState()
store.subscribe(listener)
```

Listeners receive no state argument and read the latest immutable snapshot with `getState()`.
Subscription teardown is idempotent. Calling either method after root destruction throws.

### 5.5 Snapshots contain data, not commands

`getState()` and selector snapshots contain immutable data only. Mutating commands and capability
operations live on the stable root or scoped Store API. Store consumers do not discover or invoke
actions through snapshot properties, and Zustand's state-and-actions convention is not part of the
public contract.

### 5.6 Product metadata without dependency cycles

`@picodash/store` owns the validated, versioned JSON record shapes for built-in `dashPanel` and
`dashList` durable scope metadata. It never imports either UI package. DashPanel and DashList own
their public prop and behavior types and translate to Store records through
`@picodash/store/integration`. Store snapshots expose the read-only records for inspection and
selectors, not as mutable authoring objects.

The DashList record shape is accepted as root-order override, group-order overrides, and node
collapse overrides. The DashPanel record is accepted as settled canonical placement plus finite
`preferredPosition` offsets from the effective boundary's top-left after inset and before snap
offset. The exact Store-owned record union is defined in the Store target reference; it uses
`center-left/right` rather than the prototype's `middle-left/right` and includes standalone
top/bottom dock positions.

DashList rail orientation may receive an active scoped Store override that takes precedence over a
declared DashList orientation. This allows Picodash to derive orientation from a Panel's current
dock without coupling DashList to DashPanel. `full/center-left` and `full/center-right` derive
`vertical`; `full/center-top` and `full/center-bottom` derive `horizontal`; corner, free, and snapped
dispositions derive no Picodash override. A corner therefore retains the next effective Store or
prop orientation.

The exact integration API is `acquireDashListOrientationOverrideLease(rootStore, options)`, whose
live lease exposes `update(orientation)` and idempotent `release()`. DashList observes the scoped
runtime channel through `getDashListOrientationOverride(scopedStore)` and
`subscribeDashListOrientationOverride(scopedStore, listener)`. One scope permits one live publisher;
applications have no general Store command for this override and use the public DashList prop.

Acquisition requires a concrete orientation but no already-active DashList. It creates no entity,
relationship, host affinity, durable scope, or metadata. Corner, free, and snapped dispositions
release rather than publish an empty override. The channel is excluded from root/scoped public
snapshots and their subscriptions. This active orientation is not part of the accepted durable
DashList metadata record and must not be persisted merely because a dock derived it.

Store validates this product record without importing DashPanel. Occupancy, dock allocation,
resolved size, enabled positions, responsive projection, and fallback geometry remain transient UI
runtime and never enter the record.

The alpha contract has no arbitrary namespaced metadata bag or runtime metadata-schema
registration. Application-specific state remains in declared root fields. Supporting another
durable product metadata kind requires an explicit Store contract extension rather than accepting
unvalidated JSON.

## 6. Fields and canonical values

### 6.1 Immutable field contracts

`createPicodashStore()` fixes the complete root field definition set for the Store lifetime.
Components bind existing handles and never create root fields by mounting. Panel-only Stores may
declare no fields. Runtime schema mutation is not supported.

### 6.2 Nominal handle ownership

Every field handle carries internal root ownership. All scopes of that root accept it. Another root
rejects it even if the field key and value type match. Serialized documents use keys and resolve
them against the explicit target root.

### 6.3 Complete canonical record

Every field has a concrete default and one present canonical value. `undefined` is not a canonical
value; optional semantics use an explicit JSON value such as `null` or a tagged union.

### 6.4 Strict JSON data

Canonical values reject cycles, `undefined`, functions, symbols, non-finite numbers, class
instances, `Date`, `Map`, and `Set`. Accepted structured inputs are cloned and deep-frozen. Callers
cannot mutate Store state through retained references.

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

The complete baseline passes through each field's schema and validation pipeline during Store
creation. Invalid defaults or `initialValues` throw as configuration errors. Persisted data is an
external trust boundary and follows hydration recovery rules instead. The target contract does not
include `allowUnset`; optional values use explicit JSON such as `null` or a tagged union.

### 6.7 Field resolution pipeline

Field definitions separate three synchronous stages:

1. `parse` converts binding/UI input into a candidate value and may offer an explicit repair;
2. `schema` is a Standard Schema v1 contract that canonicalizes the candidate, may coerce or
   transform it, and determines the inferred output type;
3. `validate` performs application-domain checks against the canonical value and complete candidate
   Store context, but cannot transform the value.

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
Store reference.

A parser may attach one proposed canonical repair to rejected binding input. The Store validates the
proposal through `schema`, field validation, and root validation before returning an opaque nominal
`PicodashRepairPlan` on the transaction failure. Plans are root-owned, single-use, and fingerprint
the complete candidate state. `store.executeRepair(plan)` revalidates and commits atomically or
returns `stale_plan`; repairs are never automatic. Interactive repair also clears the originating
binding draft after a successful commit.

### 6.8 Presentation contracts are not Store field contracts

Store field definitions contain canonical default, schema, parsing, and validation behavior only.
They do not contain slider ranges, formatter choices, control variants, layout hints, or generic
presentation compatibility contracts. Binding leases record field usage and read/write mode for
management operations, but the Dashlet or UI package owns whether a particular presentation can
render and edit the canonical value. Prototype presentation-contract exports are not part of the
target Store API.

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
Store construction, writes, hydration, import, validation of migration results, and resets.
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
validator paths are relative inputs that the Store prefixes. An empty path identifies the operation
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

type PicodashInitializationErrorReasonByCode = {
  readonly 'adapter-initialization-failed': AdapterInitializationFailureReason
  readonly 'persistence-driver-unavailable': PersistenceDriverUnavailableReason
  readonly 'invalid-persistence-envelope': InvalidPersistenceEnvelopeReason
  readonly 'hydration-source-conflict': HydrationSourceConflictReason
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

Store construction is all-or-nothing and returns no partially active root. Invalid developer
configuration remains a contract error; invalid external startup data is an initialization error.
Initialization-error construction is package-internal; the public contract does not promise a
class, public constructor, or `instanceof` behavior. Beta migration failures require a separately
frozen addition to the reason map rather than a broad string reason.

Opaque plans and handles follow one rule across repairs, stale-input overwrite, pruning,
persistence, export, and import: wrong-root, wrong-kind, released, or already-consumed objects throw
a contract error; a valid plan whose captured state has changed returns a safe `stale_plan` issue.

Successful results always report sorted `changedFields` and `changedScopeIds` arrays. A value-only
operation leaves the latter empty; a metadata-only operation leaves the former empty.
Persistence-enabled Stores additionally report
`persistence: 'unchanged' | 'saved' | 'pending'`; Stores without persistence omit that property
entirely. The result covers only Picodash-owned persistence and never claims that an external
application store durably saved its values. Ongoing errors and conflicts remain available through
the persistence capability state.

Malformed built-in metadata is expected candidate-data rejection with Store-owned issue code
`invalid_metadata`. It returns the failed member of the configuration-selected `Result`, uses a canonical path under
`['scopes', scopeId]`, and never exposes the rejected value or an arbitrary codec cause. A malformed
command target remains a contract error: an invalid root scope ID throws `invalid-scope-id` before
metadata validation.

### 7.4 Reentrancy

Application writes during validation, commit, or listener notification throw `reentrant-write`.
Subscribers schedule follow-up writes after the current stack. Synchronous notification caused by
the Store's own adapter write is treated as an internal echo, verified, and published once.

Every affected Store subscription is notified at most once after the complete commit; relative
ordering between root, scoped, capability, and diagnostic subscribers is not public. A subscriber
exception cannot roll back committed state or prevent remaining subscribers. It becomes a bounded
`subscriber_exception` diagnostic with its arbitrary cause omitted, while the initiating transaction
still reports its actual commit result.

### 7.5 Programmatic and interactive commands

Commands live on the stable Store API rather than inside snapshots:

```ts
store.setValue(field, value)
store.setValueOrThrow(field, value)
store.setValues(values)
store.setValuesOrThrow(values)
store.setInput(binding, input)
```

`setValue` accepts a nominal field handle plus a typed schema-output value. `setValues` accepts a
typed partial root record and commits one atomic transaction. Their safe variants return structured
results and their `OrThrow` variants throw the corresponding transaction error.

Root writes omit scope attribution. The same calls through a scoped Store pass that view's
`scopeId` as `originScopeId` to field/root validation and external-adapter write context. This does
not create metadata, restrict field access, or add the origin to `changedScopeIds`; every scoped
view continues to observe the one canonical root value record.

At runtime, unknown batch keys return structured candidate issues without mutation. A foreign field
handle is a contract error. An empty batch and a semantically unchanged batch succeed as no-ops and
do not notify or persist.

`setInput` is safe-only. Valid input commits and clears that binding's draft; invalid input returns
issues while recording its draft, touched state, and input issues. Programmatic setters do not
alter binding interaction state, although their canonical changes can make existing drafts stale.

`discardInput(binding)` returns `true` only when interaction state changed and otherwise returns
`false`; ownership and lifecycle misuse still throws a contract error.

Binding input must itself be JSON-compatible. The Store clones and freezes a retained draft. UI
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
store.resetValue(field)
store.resetValueOrThrow(field)
scoped.resetRegisteredValues({ includeDescendants? })
scoped.resetRegisteredValuesOrThrow({ includeDescendants? })
root.resetRegisteredValues({ scopeId, includeDescendants? })
root.resetRegisteredValuesOrThrow({ scopeId, includeDescendants? })
```

`resetValue` restores one field's validated baseline. Registered-value reset deduplicates root
fields and validates one complete candidate. Scoped signatures do not accept another scope ID;
root signatures require one.

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
  resetDashListMetadata(): Result
}
```

`setDashPanelLayout` replaces the complete Panel layout record. Each order setter replaces one
container override, and an empty order is canonical removal. Collapse setters store an explicit
override because Store cannot infer the current declarative default; the caller removes the override
when it matches that default. Individual removal and whole-domain reset of absent state are
successful no-ops. Empty product records and then empty scope records are pruned.

All metadata commands normalize and detach one complete candidate through the Store-owned codec.
Malformed layout, order, group, or node data returns `invalid_metadata` without mutation. A semantic
metadata change returns `changedFields: []` and the affected scope in `changedScopeIds`; a no-op
returns both arrays empty. The root and affected scoped subscribers are each notified once after the
complete commit. Unrelated scoped subscribers are not notified.

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

The alpha recovery API is:

```ts
store.discardInput(binding)
store.createStaleInputOverwritePlan(binding)
store.executeStaleInputOverwrite(plan)
```

The overwrite plan is opaque, root-owned, single-use, and fingerprints both the draft and current
field revision. Execution re-runs the complete validation pipeline and rejects the plan if the
draft or canonical value changed. Confirmation UX belongs to the application. Generic rebase is
deferred until a field can declare explicit merge semantics; Picodash does not treat replaying an
old absolute draft as a safe rebase.

Untouched bindings follow new canonical values immediately. Conflict state is ephemeral.

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
diagnosed. The Store metadata contract remains generic; DashList exposes collapse only on DashGroup
in its initial public UI contract.

### 9.5 Dormant metadata and pruning

Unmounted node order/collapse overrides remain until explicit pruning or scope destruction. Picodash
never assumes an unmounted node is obsolete, even when a DashList is active and conditionally
renders only part of its possible contents.

Pruning uses explicit remove/keep IDs or an application-provided authoritative `knownNodeIds`
inventory. A prune plan may list candidates but never deletes them automatically. Pruning does not
change canonical values.

Scoped views expose `createPrunePlan(options)` for their own DashList metadata. Root Stores require
`scopeId` in the options. Plans are opaque, root-owned, single-use, and fingerprint stored metadata
plus the active node registry. Active nodes are never candidates. `executePrunePlan(plan)` rejects a
stale plan and removes only the approved dormant node metadata; it never changes fields, bindings,
or scope relationships.

## 10. Panel metadata and Provider runtime

### 10.1 Durable layout override

Panel layout persistence is an optional override of current declared defaults. A completed move,
snap, or dock writes the override. Preview and cancelled interactions write nothing. Reset removes
the override. A compatible override wins over later default changes. An unknown position, invalid
mode/disposition combination, or non-finite coordinate rejects the alpha envelope; beta recovery may
quarantine that complete Panel record and use the current default. A valid record whose target is
disabled by current Provider or Panel policy remains durable and dormant; UI policy does not make
Store data invalid.

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

External-owned mode requires exactly one root adapter supplied during Store creation. Scoped views
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

The initial projected snapshot must be complete and valid. Missing or invalid values prevent Store
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

Synchronous adapter notifications caused by Store's own whole-record write are coalesced as an
internal echo. Store validates the post-write projection once and publishes at most one completed
Store notification. Metadata commands remain usable while adapter values are unhealthy because
they do not cross value authority.

An `initialEnvelope` in external-owned mode may contain Picodash metadata but must not contain values.
The adapter remains the sole value authority.

## 12. Persistence

### 12.1 Alpha authority boundary

The alpha capability implements Store-owned persistence only. It persists the disclosed canonical
value projection plus all durable Picodash scope metadata. External-owned metadata persistence,
conflict-resolution plans, erase plans, migrations, documents, quarantine recovery, and a built-in
Web Storage driver remain beta work. This boundary does not weaken the rule that `valueOwner` is an
immutable discriminant or permit external values to enter a future Store envelope.

### 12.2 Synchronous driver

Core persistence is synchronous. Hydration completes before a persisted Store becomes usable.
IndexedDB, remote storage, and asynchronous durability remain outside core Store authority.

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
mutation. `subscribe` carries no payload and only signals that Store must reread and validate. Alpha
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
  readonly kind: 'picodash-store-envelope'
  readonly formatVersion: 1
  readonly storeId: string
  readonly schemaVersion: number
  readonly revision: number
  readonly writerId: string
  readonly scopes: readonly (readonly [scopeId: string, metadata: SerializedDurableScopeMetadata])[]
}

type PicodashEnvelopeInput =
  | (PicodashEnvelopeHeader & {
      readonly valueOwner: 'store'
      readonly values: Readonly<Record<string, PicodashJsonValue>>
    })
  | (PicodashEnvelopeHeader & {
      readonly valueOwner: 'external'
      readonly values?: never
    })
```

Alpha produces and accepts only the `store` branch; the `external` branch reserves the exact future
authority distinction. `revision` is a positive safe integer. `writerId` is an opaque, trimmed,
control-character-free root writer identity. The `values` property is always present in a
Store-owned envelope, including as an empty record when policy omits every field, and contains the
complete disclosed projection. Missing omitted fields hydrate from the current validated baseline.
`scopes` contains every durable metadata record as sorted, duplicate-free entry tuples; metadata
maps use their existing sorted, duplicate-checked serialized entry arrays.

The decoder requires exact keys, strict JSON-compatible data, matching Store identity, matching
application schema, the accepted authority branch, known persisted field keys, and valid complete
scope metadata. Alpha rejects the whole envelope for unknown or incompatible input rather than
partially hydrating or quarantining it. Migration and granular recovery remain beta work.

Serialization is deterministic: records use lexically sorted keys recursively, arrays preserve
order, metadata entries are already sorted, finite numbers are required, and negative zero becomes
zero. Hydration-source comparison checks Store identity and revision separately. Its deterministic
content fingerprint covers normalized `schemaVersion`, `valueOwner`, `values`, and `scopes`, and
excludes `revision` and `writerId`. The fingerprint is internal and never enters public state or
diagnostics.

### 12.5 Construction and hydration

Server Stores are request-local and may receive `initialEnvelope` without a driver. The input is
cloned and never retained by reference. Construction follows these exact cases:

- no driver record and no initial envelope uses the validated baseline and performs no write;
- an initial envelope without persistence hydrates synchronously but adds no persistence capability;
- a valid driver record hydrates before Store activation;
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
or arbitrary cause. A write failure never rolls back valid live state. Store retains the newest
complete normalized envelope, exposes the diagnostic above, and replaces obsolete pending data after
each later persistable commit. Rejected candidate transactions do not alter it.

For a successful transaction, `persistence: 'unchanged'` means its persisted projection did not
change; it performs no retry, including for semantic no-ops and omitted-field-only changes.
`persistence: 'saved'` requires exact post-write verification. `persistence: 'pending'` means the
live commit succeeded but its newest complete envelope remains undurable. Existing capability state,
not the transaction result, reports an older pending condition unaffected by an `unchanged`
transaction.

Before each automatic write, Store rereads and compares the last confirmed revision, writer, and
content. A valid foreign envelope or foreign removal enters `conflict` before any write. After each
write, Store rereads and accepts durability only when the canonical envelope matches exactly.
Synchronous notifications caused by Store's own write are coalesced into that verification cycle.
Once conflicted, later valid transactions keep replacing the complete local pending envelope but
perform no driver writes; `flush()` also refuses to overwrite. Reload, overwrite, and reconcile are
explicit beta recovery plans rather than alpha shortcuts.

Only one live root may own a `(driver.identity, storageKey)` pair in one JavaScript realm. A second
claim throws `PicodashContractError` code `persistence-identity-in-use` with exactly
`{ storageKey }`. The context never contains the driver identity.

### 12.7 Persistence field policy

Export and persistence disclosure policies are separate. Store-owned persistence supports field
`include` or `omit`; redacted placeholders are not restorable values. Encryption belongs in a custom
synchronous driver.

Store-owned persistence configuration requires an explicit `values.defaultFieldPolicy`; there is no
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
live Store state. Picodash validates the final result before committing. Failed migration preserves
the raw old envelope and commits nothing partial.

Each entry at key `N` migrates the application payload from schema version `N` to `N + 1`; skipping
versions or returning a different version is an error. The payload contains permitted values and
durable scope metadata but not Picodash format, Store identity, writer, or revision headers. The same
chain applies to persistence hydration and imported documents. Picodash-owned format migrations are
internal and separate from application schema migrations.

## 14. Export and import

### 14.1 Centralized policy

Export configuration lives under `export`, including document defaults and per-field policy. Field
definitions do not embed disclosure behavior.

`export.documents.defaultFieldPolicy` is required and is one of `include`, `redact`, or `omit`.
Per-field entries override that document default to establish each field's immutable maximum.
Promotion is legal only for a field whose configured
default is `redact` and whose immutable policy explicitly permits confirmed promotion. Unknown
field keys fail Store construction.

Store document APIs operate on immutable JSON-compatible document objects. `executeExport()` returns
that object and `analyzeImport()` accepts parsed unknown data. Core Store does not own filenames,
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

Documents declare `kind: 'root' | 'scope'`. Root Store document methods default to a full-root
document and may explicitly target a scope. Scoped Store document methods always target their own
scope and do not accept another `scopeId`. Root documents include permitted root values and all
durable scope metadata; scope documents use the scoped projection above.

### 14.5 Document identity and target

Documents record source Store ID, source scope, format version, schema version, and serialized field
entries. Import is invoked against an explicit target Store/scope. A foreign Store ID requires
explicit permission and warning. Target contracts validate all values; unknown or incompatible
fields prevent atomic commit unless an explicit mapping resolves them.

### 14.6 Descendant mapping

The document root scope maps to the target invocation scope. Matching descendant IDs may map
automatically. Renamed descendants require an explicit `scopeMap`. Missing scopes fail unless
`createMissingScopes` is explicit. Imported metadata may create dormant scope state but never mounts
entities or registers relationships.

Import analysis options use `allowForeignStore`, `scopeMap`, `fieldMap`, and
`createMissingScopes`. `fieldMap` maps a serialized source key to a nominal target-root field handle
or the explicit sentinel `ignore`; unchecked target strings are not accepted. Automatic same-key
mapping applies only to known compatible fields. Ignoring, creating missing state, and accepting a
foreign Store identity are all surfaced in the plan for application confirmation.

`analyzeImport()` produces an opaque root-owned, single-use plan that fingerprints the input
document and relevant target state. `executeImport()` accepts only a plan for the same root and
revalidates its document kind, mappings, target revisions, policy, and candidate transaction.
Root-document imports target a root; scope-document imports target an explicit root scope or the
current scoped view. Kind mismatches fail rather than inferring a projection.

## 15. React API and selectors

### 15.1 Contextual Store hooks

The target contextual API distinguishes possible results:

```ts
usePicodashStore() // RootStore | ScopedStore
usePicodashStore('settings') // ScopedStore
usePicodashRootStore() // RootStore
usePicodashScope() // nearest ScopedStore or throws
```

Contextual hooks throw a contract error when their required boundary is absent.
`usePicodashStore(scopeId)` resolves a view from the nearest root but does not create scope state,
register an entity, or add a relationship. Only declarative product boundaries acquire leases.

### 15.2 Selector hooks

Selectors receive the relevant Store snapshot and return the selected or derived value:

```ts
usePicodashStoreSelector(store, selector, equalityFn?)
usePicodashRootSelector(selector, equalityFn?)
usePicodashScopeSelector(selector, equalityFn?)
```

Equality defaults to `Object.is`. `shallowEqual` is an opt-in export for small object, array, or
tuple projections. Custom equality remains optional. Deep equality is not provided as a default.

Selectors are pure, may run more than once, and receive immutable data snapshots only. The explicit
`usePicodashStoreSelector(store, ...)` works without context. Root and scope contextual selectors
throw when their required context is unavailable. Server and client selection use the same
synchronous Store snapshot; hydration consistency is the application's Store-construction
responsibility described above.

### 15.3 Package ownership

`@picodash/store` is framework-independent. `@picodash/store/react` owns public hooks and selectors.
`@picodash/store/integration` is the versioned low-level composition surface used by DashPanel and
DashList for context and lifecycle leases. It is supported for authors integrating another
declarative UI product, but ordinary applications do not need it. The UI packages use compatible
Store and React peer dependencies; global context bridges do not conceal duplicate or incompatible
packages.

The package root must load without React and must not import React-specific Zustand entrypoints.
React is an optional peer for installing the core package and becomes a runtime requirement only
when `/react` or `/integration` is imported. Artifact tests enforce this split.

The integration entry exposes the shared Store boundary protocol and the exact Provider, entity,
and relationship acquisition functions in Section 3.9. Acquisition occurs only after a declarative
render commits. Every lease is one nominal generation with idempotent `release()`; release is
lifecycle teardown, not a domain-level deregistration command. Abandoned renders acquire nothing,
and React Strict Mode reacquisition reruns all identity and graph checks. Binding acquisition and
its generation-owned `BindingHandle` remain a later Store slice.

The low-level context Provider is not an initial public product. `DashPanelProvider`, integrated
`PicodashProvider`, and standalone DashList establish public context boundaries; application code
outside them uses explicit Store selectors.

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

Every root and scoped Store has a readonly `diagnostics: PicodashDiagnostics` property. Calling the
namespace through either surface reads and subscribes to the same root-wide diagnostic state,
independently of value subscriptions. The identity of the namespace facade itself is not public;
consumers do not rely on `root.diagnostics === scoped.diagnostics`.

A future `inspectRuntime()` may return an immutable point-in-time structural view of Providers,
entity leases, bindings, and active relationships. That future inspection defaults a scoped Store
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
later callbacks. The current safe message is `A Store subscriber threw.`; its wording may evolve
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

Store-issued adapter writes carry immutable Store-generated metadata:

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

All Dashlets and components within one root Store are trusted application code. A scoped Store grants
access to the entire root value set. Export and persistence policy do not prevent direct in-process
access. Untrusted plugins use a separate root/Provider and an application-controlled bridge.

### 16.4 DOM identity

DOM IDs are derived only at the rendering edge from a React hydration-stable host namespace plus
encoded scope/item/binding/field identity. Raw IDs are not concatenated, persisted, exported, or
used as Store keys. `storeId` is not exposed in markup.

## 17. Configuration immutability

The following remain immutable for a root lifetime:

- Store ID and schema version;
- field contracts and initial baseline;
- value owner and adapter;
- persistence driver and key;
- export and persistence field policies.

Diagnostics listeners may attach and detach. Changing authority, schema, identity, or serialization
policy requires a new root Store.

## 18. Deferred and non-goals

The accepted contract intentionally defers:

- a public runtime scope-rename API;
- generic stale-draft rebase without field-defined merge semantics;
- an arbitrary public transaction callback;
- a public context-only Store Provider;
- runtime registration of arbitrary durable metadata kinds;
- UI presentation compatibility contracts on Store fields;
- automatic pruning based only on currently mounted nodes;
- automatic cross-tab merge or collaboration;
- async parsers, validators, adapters, or core persistence;
- scope-based authorization or untrusted-plugin sandboxing;
- cross-container DashList dragging that changes declarative membership.

## 19. Alpha decision and evidence boundary

Store alpha requires the scope-ID error mapping, exact root/scoped views and write attribution,
empty and populated interaction snapshots, complete built-in metadata commands, the Provider/entity/
relationship integration leases, the root-wide diagnostics namespace, fail-closed adapter health,
the Store-owned persistence capability, scope and root destruction, bounded subscriber-exception
diagnostics, and weak canonical views without a public release or reference-count API. These are
launch contracts rather than beta ergonomics.

The signatures and semantics above are frozen for alpha even where exhaustive evidence continues
during consumer dogfooding. Beta may continue broader generated relationship-graph traversal,
stale-draft conflict permutations, persistence conflict/recovery combinations, and the complete
`inspectRuntime()` diagnostic projection. Documents, pruning, overwrite/repair plans, migrations,
and advanced recovery keep their existing roadmap ownership. Continuing evidence does not permit a
partial mutation, silent conflict overwrite, private cross-package bypass, or implementation-status
advance without linked conformance evidence.
