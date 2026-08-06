# Store target reference

Store is a typed state foundation for configurable React interfaces. This page describes the target
contracts for `@picodash/store`, `@picodash/store/react`, and the advanced integration entry; it does
not claim that the prototype currently exports every API shown here.

## Status

> Contract: Accepted target API
> Implementation: Partial
> Evidence: Store alpha is verified for consumer dogfooding; see the [conformance matrix](contract-conformance.md).

The verified alpha slice includes the accepted scope-ID mapping, canonical root/scoped views, the
stable empty interaction snapshot, built-in metadata commands, scope/root destruction,
subscriber-exception diagnostics, Provider/entity/relationship integration leases,
Provider-hosted React boundaries, fail-closed external adapters, Store-owned persistence, and weak
view lifecycle. The page remains Partial because populated binding interaction, persistence recovery
plans, documents, migrations, external-owned persistence, standalone DashList hosting, and broader
runtime inspection remain beta work.

## Package surfaces

| Surface                       | Contract | Implementation | Purpose                                                                                                                |
| ----------------------------- | -------- | -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `@picodash/store`             | Accepted | Partial        | Framework-independent Store implementation                                                                             |
| `@picodash/store/react`       | Accepted | Verified       | Contextual Store hooks/selectors plus explicit selector and equality helpers                                           |
| `@picodash/store/integration` | Accepted | Partial        | Provider/entity/relationship leases plus Provider-hosted React boundaries; standalone DashList hosting remains planned |

The root entry loads without React. React is an optional package peer and is required only when the
`/react` or `/integration` entry is imported. The core bundle does not import React-specific Zustand
entrypoints.

## Create a root Store

```ts
const store = createPicodashStore({
  storeId: 'application-controls',
  schemaVersion: 1,
  valueOwner: 'store',
  fields: {
    theme: { defaultValue: 'system' },
    density: { defaultValue: 1 },
  },
})
```

| API                     | Contract | Implementation | Notes                                                                                                                                                                                  |
| ----------------------- | -------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createPicodashStore()` | Accepted | Partial        | Core Store-owned configuration, scopes, and the manual synchronous external adapter are implemented and verified; external-owned persistence and document capabilities remain planned. |

Store construction is synchronous. Configuration that defines identity, schema, value authority,
persistence, or disclosure remains immutable for the root lifetime.

Every root has an automatically generated internal runtime identity. Public `storeId` is optional
only for an ephemeral Store. Persistence, export, import, and schema migration require it;
`storageKey` cannot substitute for it.

`schemaVersion` is a positive safe integer. It is optional for an ephemeral Store and required for
`initialEnvelope`, persistence, documents, or configured migrations.
It cannot be supplied without `storeId`; `storeId` alone is allowed but does not enable documents.

Public identity strings are case-sensitive, opaque, non-empty, trimmed, and control-character-free;
punctuation such as slashes, dots, and colons has no hierarchy semantics. Field keys also reject
`__proto__`, `prototype`, and `constructor`. `storageKey` is only a driver locator, not Store
identity.

### Store-owned configuration

```ts
type StoreOwnedConfig<Fields> = {
  storeId?: string
  schemaVersion?: number
  valueOwner: 'store'
  fields: Fields
  initialValues?: Partial<ValuesOf<Fields>>
  initialEnvelope?: PicodashEnvelopeInput
  validateValues?: ValuesValidator<ValuesOf<Fields>>
  adapter?: never
  persistence?: StoreOwnedPersistenceConfig<Fields>
  export?: ExportConfig<Fields>
  migrations?: SchemaMigrations
}
```

### External-owned configuration

```ts
type ExternalOwnedConfig<Fields> = {
  storeId?: string
  schemaVersion?: number
  valueOwner: 'external'
  fields: Fields
  adapter: PicodashValueAdapter<ValuesOf<Fields>>
  initialValues?: never
  initialEnvelope?: PicodashEnvelopeInput
  validateValues?: ValuesValidator<ValuesOf<Fields>>
  persistence?: ExternalOwnedPersistenceConfig
  export?: ExportConfig<Fields>
  migrations?: SchemaMigrations
}
```

> Contract: Accepted
> Implementation: Partial
> Notes: Capability-specific TypeScript variants make `storeId` and `schemaVersion` required
> whenever `initialEnvelope`, persistence, export, or migrations are configured.

`initialEnvelope` provides synchronous driver-free hydration for request-local server Stores. If a
driver is also configured, its record must be absent or match the envelope identity, revision, and
deterministic content fingerprint; disagreement throws during construction.

External-owned persistence, documents, and migrations are accepted beta contracts. The alpha
persistence capability is Store-owned and accepts only the Store-owned envelope branch defined
below.

## Field definitions and handles

Every field has a concrete JSON-compatible default. Optional parsing and validation are synchronous
and pure. The complete field set is immutable.

```ts
type PicodashJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly PicodashJsonValue[]
  | { readonly [key: string]: PicodashJsonValue }
```

```ts
const store = createPicodashStore({
  storeId: 'render-settings',
  schemaVersion: 1,
  valueOwner: 'store',
  fields: {
    exposure: {
      defaultValue: 1,
      parse: (input) => parseExposure(input),
      schema: z.number().min(0).max(10),
      validate: (value, context) => validateExposure(value, context.values),
    },
  },
})

const exposure = store.fields.exposure
```

```ts
type PicodashIssueInput = {
  message: string
  code?: `app:${string}`
  path?: readonly (string | number)[]
}

type PicodashParseResult<Candidate> =
  | { ok: true; candidate: Candidate }
  | {
      ok: false
      issues: readonly [PicodashIssueInput, ...PicodashIssueInput[]]
      repair?: Candidate
    }

type PicodashFieldValidator<Value, Values> = (
  value: Value,
  context: PicodashValidationContext<Values>,
) => readonly PicodashIssueInput[]
```

Parser and validator result objects use Picodash's `ok` and structured-issue conventions. Standard
Schema retains its own v1 result shape at the `schema` boundary.

| Behavior                    | Contract | Implementation | Notes                                                                     |
| --------------------------- | -------- | -------------- | ------------------------------------------------------------------------- |
| Stable typed field handles  | Accepted | Implemented    | Handles are nominally root-owned and enumerable by key only.              |
| Immutable field set         | Accepted | Implemented    | Runtime field registration is rejected.                                   |
| `parse` raw-input stage     | Accepted | Planned        | Typed result is exported; interactive execution belongs to a later phase. |
| Standard Schema `schema`    | Accepted | Implemented    | Canonicalizes and drives inferred output type.                            |
| Contextual `validate` stage | Accepted | Implemented    | Accepts or rejects; cannot transform.                                     |
| Synchronous pipeline        | Accepted | Implemented    | Promise-like results are rejected.                                        |
| Root ownership checks       | Accepted | Implemented    | Same-key handles from another root throw.                                 |

Interactive binding input uses `parse → schema → validate`. Programmatic values, defaults,
`initialValues`, adapter snapshots, persisted values, imports, and migration output use
`schema → validate` and never invoke the UI parser. Failures normalize into package-owned structured
issues and do not expose raw values or arbitrary causes by default.

Parser success returns one candidate. Failure returns a non-empty structured issue list and may
offer one repair candidate. Field `validate` returns a structured issue array; an empty array accepts
the canonical value. `validateValues` uses the same array rule with canonical absolute paths.
Callback exceptions normalize to stage-specific issues without their cause, while promise-like
results are contract violations. Context contains the immutable complete candidate, relevant field,
operation source, and scope attribution—not a mutable Store reference.

A parser may propose one repair for rejected binding input. After the remaining validation stages
accept that proposal, the failed transaction includes an opaque nominal `PicodashRepairPlan`.
`store.executeRepair(plan)` revalidates and commits it atomically. Plans are root-owned, single-use,
and become stale when the candidate state changes. Repairs are never automatic; a successful
interactive repair also clears the originating binding draft.

Root-level invariants use `validateValues(values, context)`. It receives the complete immutable
candidate after any interactive parsing and all schema canonicalization, returns structured issues
with canonical absolute paths, and cannot transform values. It runs during construction, writes,
hydration, import, validation of migration results, and resets.

Invalid defaults or `initialValues` throw as configuration errors. The target API has no
`allowUnset`; optional semantics use explicit JSON values such as `null` or a tagged union.

Field definitions do not carry slider ranges, formatting, component variants, layout hints, or a
generic presentation-compatibility contract. Binding leases record field usage and read/write mode;
the Dashlet or UI package owns whether its presentation can represent the canonical value. Existing
prototype presentation helpers are not target Store exports.

## Root and scoped Stores

```ts
const settings = store.scope('settings')
const basic = settings.scope('basic')

settings.kind // 'scoped'
settings.scopeId // 'settings'
settings.root === store // true
```

| API                       | Contract | Implementation | Notes                                                             |
| ------------------------- | -------- | -------------- | ----------------------------------------------------------------- |
| `root.scope(scopeId)`     | Accepted | Verified       | Canonical weakly cached scoped view with exact invalid-ID errors. |
| `scoped.scope(scopeId)`   | Accepted | Verified       | Resolves through the same root.                                   |
| `scoped.root`             | Accepted | Verified       | Explicit access to the root Store.                                |
| `scoped.scopeId`          | Accepted | Verified       | Opaque exact scope identity.                                      |
| `root.kind`/`scoped.kind` | Accepted | Verified       | Root and scoped views expose their canonical kind values.         |

Scoped views expose the complete root values. They organize metadata and attribution; they do not
restrict field access.

Scope IDs use this exact contract-error mapping:

```ts
type InvalidScopeIdReason = 'not-string' | 'empty' | 'surrounding-whitespace' | 'control-character'
```

`PicodashContractError` uses code `invalid-scope-id` and context
`{ reason: InvalidScopeIdReason }`. Classification order is non-string, empty or whitespace-only,
leading/trailing whitespace, then C0/C1 control characters (`U+0000–001F`, `U+007F–009F`). The
rejected value is never exposed. Punctuation and internal spaces remain opaque and legal.

The scope/value/lifecycle additions to the two Store interfaces are:

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
types are identical on both interfaces. `scoped.fields` is
the same object as `scoped.root.fields`; `scoped.scope(id)` resolves through that root. A scoped
value write supplies `originScopeId: scoped.scopeId` to validation and external-adapter context but
still returns `changedScopeIds: []` for a value-only success.

A non-persistent configuration instantiates `RootStore<Fields, CoreTransactionResult>` and its
scoped views preserve that result type. A persistence-enabled configuration instantiates
`RootStore<Fields, PersistentTransactionResult>` and preserves that type through `.scope()` and
`.root`. Every safe value, metadata, and scope-destruction command returns the configuration's
`Result`; every matching `*OrThrow` command returns `Extract<Result, { readonly ok: true }>`. Root
`destroy()` remains `void` because it is lifecycle teardown rather than a transaction.

While referenced, a root and scope-ID pair resolves the same canonical scoped object. The root holds
views weakly, so a collected view may later be recreated. `ScopedStore` has no `release()`,
`dispose()`, reference-count, or view-level `destroy()` API. `destroyScope()` clears state without
invalidating its view; integration lease counts are independent of view reachability.

Both types expose `getState()` and `subscribe(listener)`. Listeners receive no state argument and
read the latest immutable snapshot with `getState()`. Teardown is idempotent. Root subscriptions
observe canonical values and all durable scope metadata; scoped subscriptions additionally observe
only that scope's interaction state and do not react to unrelated scope metadata.

Each affected surface notifies at most once after a complete commit; cross-surface listener order is
unspecified. Subscriber exceptions do not roll back state or prevent later listeners. They create a
bounded diagnostic without exposing the cause, while the transaction keeps its true commit result.

### Root snapshot

```ts
type RootSnapshot<Values> = {
  values: Readonly<Values>
  scopes: ReadonlyMap<string, DurableScopeMetadata>
}
```

### Scoped snapshot

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

The outer binding key is `itemId`; its nested key is binding alias. Item-shell interaction is keyed
only by `itemId`. `baseRevision` is a non-negative safe integer, and retained JSON is detached and
immutable. Registration alone creates no entry. Default-only entries and empty nested maps are
pruned. The empty interaction state is one frozen singleton containing two stable empty maps.

> Contract: Accepted
> Implementation: Partial
> Notes: Root and scoped snapshots are implemented with the stable empty interaction singleton;
> populated interaction state remains planned for beta with binding acquisition. The metadata record codec and scoped metadata
> commands are implemented. Adapter and
> persistence status live on their configured capability namespaces rather than every ephemeral root snapshot.

Both snapshot types contain immutable data only. Commands live on the stable root or scoped Store
API, outside `getState()` and selector results. Zustand is an implementation detail, not a public
state-and-actions contract.

Snapshot and unchanged nested references remain `Object.is`-stable until a relevant semantic
change. Scoped `values` is the same record reference as root `values`; `scope` remains `undefined`
until durable metadata exists, and the empty interaction snapshot is reused.

Creating a view, mounting an entity, registering a relationship, attributing a value write, or
editing a binding does not create durable scope metadata. Only a durable override, import, or
hydration creates a `scopes` entry.

`DurableScopeMetadata` contains Store-owned, validated, versioned JSON records for the built-in
`dashPanel` and `dashList` metadata domains. Store does not import either UI package; those packages
own their public behavior types and translate through the integration entry. The alpha Store has no
arbitrary metadata bag or runtime metadata-schema registration. Application-specific data belongs in
declared fields.

### Built-in metadata payload status

```ts
type DashListMetadataRecord = {
  rootOrder?: readonly string[]
  groupOrders: ReadonlyMap<string, readonly string[]>
  collapseOverrides: ReadonlyMap<string, boolean>
}

type DashPanelSnapPositionRecord =
  'top-left' | 'top' | 'top-right' | 'right' | 'bottom-right' | 'bottom' | 'bottom-left' | 'left'

type DashPanelDockPositionRecord =
  | 'top-left'
  | 'top-right'
  | 'bottom-right'
  | 'bottom-left'
  | 'full-left'
  | 'center-left'
  | 'full-right'
  | 'center-right'
  | 'full-top'
  | 'center-top'
  | 'full-bottom'
  | 'center-bottom'

type DashPanelPlacementRecord =
  | {
      mode: 'floating'
      disposition: { kind: 'free' } | { kind: 'snapped'; position: DashPanelSnapPositionRecord }
    }
  | {
      mode: 'fixed'
      disposition: { kind: 'docked'; position: DashPanelDockPositionRecord }
    }
  | {
      mode: 'hybrid'
      disposition:
        | { kind: 'free' }
        | { kind: 'snapped'; position: 'top' | 'bottom' }
        | { kind: 'docked'; position: DashPanelDockPositionRecord }
    }

type DashPanelLayoutRecord = {
  placement: DashPanelPlacementRecord
  preferredPosition: { x: number; y: number }
}

type DurableScopeMetadata = {
  dashList?: DashListMetadataRecord
  dashPanel?: DashPanelLayoutRecord
}
```

| Record                    | Contract | Implementation | Notes                                            |
| ------------------------- | -------- | -------------- | ------------------------------------------------ |
| DashList order/collapse   | Accepted | Partial        | Overrides only; containment remains declarative. |
| DashPanel layout override | Accepted | Partial        | Settled placement plus preferred free position.  |

Empty product records are omitted. The Store metadata codec validates complete records atomically,
detaches and freezes nested values, and translates maps through duplicate-checked entry arrays.
Focused evidence lives in [packages/store/tests/metadata.test.ts](../../packages/store/tests/metadata.test.ts).
`preferredPosition` contains finite CSS-pixel offsets from the effective boundary's top-left after
inset and before snap offset. Store validates the complete record atomically and does not import UI
package types.

A Panel record with an unknown position, invalid mode/disposition combination, or non-finite
coordinate enters the configured Store recovery path. A valid dock target that current Provider or
Panel policy disables remains durable and dormant; UI policy is not a Store codec error. Occupancy,
allocation, resolved size, enabled positions, projection, fallback layout, visibility, and other
Provider runtime never enter this record.

## Core diagnostics namespace

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

Every root and scoped Store has the readonly `diagnostics` property. Calling the namespace through
either surface reads and subscribes to the same root-wide diagnostic state, separately from
canonical value subscriptions. The namespace facade's object identity is not public; consumers do
not rely on `root.diagnostics === scoped.diagnostics`.

A future `inspectRuntime()` may return an immutable point-in-time view of Providers, entity leases,
bindings, and active relationships. It is not part of the alpha `PicodashDiagnostics` interface.
That future view defaults a scoped Store to its scope and requires an explicit option for a
root-wide view. Current diagnostics and future inspection omit canonical values, raw draft input,
arbitrary thrown causes, and thrown messages.

The diagnostic snapshot is a bounded map of current conditions keyed by stable identity, not an
unbounded event log. Repeated occurrences update the existing entry; recovery removes it.
Applications that need history subscribe and forward events to their own logger.

`SubscriberExceptionDiagnostic` is the exact named `subscriber_exception` specialization of
`PicodashDiagnostic`. Its map key is stable but opaque. `lastOccurrence` is a root-local monotonic
safe integer. Every thrown callback increments `count`, leaves the initiating commit and result
unchanged, and does not stop later callbacks. The diagnostic omits callback identity, thrown cause,
thrown message, stack, canonical values, and draft input. The current safe message is
`A Store subscriber threw.`; its wording may evolve without changing code, identity, or privacy. A
later dispatch for the same identity that completes without an exception removes it.
Diagnostics-subscriber failures are recorded after their current dispatch without recursively
notifying in that cycle.

`PicodashDiagnosticsState.current` uses the broad `PicodashDiagnostic` default. The core subscriber,
adapter-health, and persistence-failure conditions have exact named specializations in their owning
sections; persistence `lastError` uses its specialization. The generic shape represents future
capability diagnostics without requiring a closed union.

> Contract: Accepted
> Implementation: Partial
> Evidence: [diagnostics tests](../../packages/store/tests/diagnostics.test.ts) and [diagnostics type tests](../../packages/store/tests/diagnostics.types.test.ts) cover immutable snapshots, root-wide aggregation, recovery, privacy, reentrancy, and teardown.

## Optional capability namespaces

Ephemeral Stores expose only core values, scopes, transactions, and diagnostics. An identified Store
with both `storeId` and `schemaVersion` additionally exposes document import operations.
Configuration adds further typed capabilities instead of methods that fail with “not configured.”

```ts
const ephemeral = createPicodashStore({
  valueOwner: 'store',
  fields: {},
})

// TypeScript errors:
ephemeral.documents
ephemeral.persistence
```

```ts
const identified = createPicodashStore({
  storeId: 'settings',
  schemaVersion: 1,
  valueOwner: 'store',
  fields,
})

identified.documents.analyzeImport(document)

// TypeScript error until export policy is configured:
identified.documents.createExportPlan(...)
```

```ts
const durable = createPicodashStore({
  storeId: 'settings',
  schemaVersion: 1,
  valueOwner: 'store',
  fields,
  export: {
    documents: { defaultFieldPolicy: 'include' },
    fields: {},
  },
  persistence: {
    /* driver and policy */
  },
})

durable.documents.createExportPlan(...)
durable.persistence.flush()
```

> Contract: Accepted
> Implementation: Planned
> Notes: Export policy remains nested under `export: { documents, fields }`. Scoped views inherit
> enabled capabilities with scope-aware defaults.

## Value operations

```ts
const result = store.setValues({
  exposure: 1.5,
  quality: 'final',
})

if (!result.ok) {
  report(result.error.issues)
}
```

| API                                  | Contract | Implementation | Notes                                         |
| ------------------------------------ | -------- | -------------- | --------------------------------------------- |
| `setValue(field, value)`             | Accepted | Implemented    | Safe typed single-field transaction.          |
| `setValueOrThrow(field, value)`      | Accepted | Implemented    | Throws the corresponding transaction error.   |
| `setValues(values)`                  | Accepted | Implemented    | Safe typed partial-record atomic transaction. |
| `setValuesOrThrow(values)`           | Accepted | Implemented    | Throws the corresponding transaction error.   |
| `setInput(binding, input)`           | Accepted | Planned        | Interactive; records invalid binding input.   |
| `executeRepair(plan)`                | Accepted | Planned        | Single-use; revalidates a proposed repair.    |
| `resetValue(field)`                  | Accepted | Planned        | Safe reset to the validated baseline.         |
| `resetValueOrThrow(field)`           | Accepted | Planned        | Throws the corresponding transaction error.   |
| `resetRegisteredValues(opts)`        | Accepted | Planned        | Active scope values; optional descendants.    |
| `resetRegisteredValuesOrThrow(opts)` | Accepted | Planned        | Throws the corresponding transaction error.   |
| `discardInput(binding)`              | Accepted | Prototype      | Returns whether interaction state changed.    |

Scoped calls may write any root field and add `originScopeId` attribution. Operations that target
descendants deduplicate root fields before building one candidate snapshot.

Root writes omit `originScopeId`. Scoped writes pass the view's exact scope ID to field/root
validation and any external-adapter write context. Attribution never creates scope metadata or adds
the origin to `changedScopeIds`; all views observe the resulting canonical root value.

Unknown runtime batch keys return structured issues without mutation. Foreign field handles throw a
contract error. Empty and semantically unchanged batches succeed as no-ops without notification or
persistence work.

Programmatic setters do not alter binding interaction state. Their canonical changes may mark
existing drafts stale. `setInput` is safe-only: valid input commits and clears that binding's draft;
invalid input returns issues while recording its draft, touched state, and input issues.

`setInput` accepts JSON-compatible input. Retained drafts are cloned and frozen. Non-JSON editing
state remains component-local until the control can submit a JSON candidate.

Scoped `resetRegisteredValues` uses that view's scope and does not accept another `scopeId`. The root
signature requires `scopeId`. Both variants deduplicate shared fields before validating one complete
candidate transaction.

### Transaction result

```ts
type CoreTransactionResult =
  | {
      ok: true
      changedFields: readonly string[]
      changedScopeIds: readonly string[]
    }
  | {
      ok: false
      error: PicodashTransactionError
      repair?: PicodashRepairPlan
    }

type PersistentTransactionResult =
  | (Extract<CoreTransactionResult, { ok: true }> & {
      persistence: 'unchanged' | 'saved' | 'pending'
    })
  | Extract<CoreTransactionResult, { ok: false }>
```

The Store configuration determines the result type. A Store without persistence returns the core
result and has no persistence property. A persistence-enabled Store returns the persistent result.
For externally owned values, that result covers only Picodash metadata persistence; it does not
claim the host application persisted its values. Ongoing persistence errors and conflicts are read
from `store.persistence.getState()`.

Changed identity arrays are sorted and deterministic. Value-only operations leave
`changedScopeIds` empty; metadata-only operations leave `changedFields` empty.

> Contract: Accepted
> Implementation: Partial

## Structured issues and errors

```ts
type TransactionIssue = {
  code: PicodashIssueCode | `app:${string}`
  path: readonly (string | number)[]
  message: string
  reason?: string
  fieldKey?: string
  scopeId?: string
  itemId?: string
  alias?: string
}

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

class PicodashTransactionError extends Error {
  readonly issues: readonly TransactionIssue[]
}

class PicodashContractError extends Error {
  readonly code: PicodashContractErrorCode
  readonly context: Readonly<Record<string, string>>
  readonly issues?: readonly TransactionIssue[]
}

type PicodashInitializationError = {
  [Code in PicodashInitializationErrorCode]: Error & {
    readonly name: 'PicodashInitializationError'
    readonly code: Code
    readonly reason: PicodashInitializationErrorReasonByCode[Code]
    readonly issues: readonly TransactionIssue[]
  }
}[PicodashInitializationErrorCode]
```

For Store alpha, `PicodashContractErrorCode` includes `invalid-scope-id`,
`invalid-destroy-options`, `invalid-entity-options`, `root-has-active-leases`,
`root-has-unpersisted-state`, `use-after-destroy`, and the other exact integration and
persistence-ownership codes listed in their owning sections. `InvalidScopeIdReason` is declared
once in the scope-ID contract above. `invalid-destroy-options` has exactly
`{ reason: InvalidDestroyOptionsReason }` context.

Standard Schema contributes its guaranteed message and path. Picodash normalizes them and assigns a
stable stage code; validator-library-specific codes and original error objects do not cross the
public boundary. Application validators may provide an `app:*` code. Raw rejected values and
arbitrary exception causes remain excluded.

Paths are canonical and absolute within a logical operation model:

| Issue target    | Path prefix            |
| --------------- | ---------------------- |
| Field value     | `['values', fieldKey]` |
| Scope metadata  | `['scopes', scopeId]`  |
| Import document | `['document']`         |
| Whole operation | `[]`                   |

Standard Schema and field-validator paths are relative inputs that the Store prefixes. The
resulting path does not depend on whether a single-field, batch, scoped, or import API initiated the
operation.

| Failure class                        | Contract | Behavior                                |
| ------------------------------------ | -------- | --------------------------------------- |
| Parser/validator rejection           | Accepted | Safe result; no mutation                |
| Stale draft or unhealthy adapter     | Accepted | Safe result; no mutation                |
| Duplicate identity or root mismatch  | Accepted | Contract exception in every environment |
| Reentrant write or use-after-destroy | Accepted | Contract exception in every environment |
| Persistence failure/conflict         | Accepted | Safe live state plus structured status  |

`PicodashContractError` represents programmer and lifecycle violations and throws in every
environment. `PicodashTransactionError` represents expected candidate-data rejection and is returned
by safe operations or thrown by `*OrThrow`. Neither exposes arbitrary causes or raw values.

`PicodashInitializationError` reports invalid external startup data or unavailable synchronous
infrastructure. Its `code` and `reason` stay correlated through the mapped discriminated union.
Construction is package-internal; the public contract does not promise a class, public constructor,
or `instanceof` behavior. Construction is all-or-nothing; no partially active Store is returned.

All opaque plans and handles use consistent ownership rules: wrong-root, wrong-kind, released, or
already-consumed objects throw a contract error; a valid object whose captured state changed returns
a safe `stale_plan` issue.

`invalid_metadata` is a Store-owned `PicodashIssueCode`. Built-in metadata commands use it for safe
candidate rejection with canonical paths rooted at `['scopes', scopeId]`; they never include the
rejected value or codec cause. An invalid command target is instead an `invalid-scope-id` contract
error before metadata validation. That error's context is exactly
`{ reason: InvalidScopeIdReason }` and never contains the rejected ID.

## Bindings and interaction state

Binding interaction identity is `(scopeId, itemId, alias)`. Alias defaults to the field key and must
be explicit when one item binds the same field more than once.

Commands receive an opaque nominal `BindingHandle` issued by the active registration. It is owned
by one root Store and one registration generation, exposes read-only identity for reporting, and is
not serializable. Foreign, released, and superseded handles throw contract errors. Remounting the
same identity tuple issues a new generation.

| Capability                               | Contract | Implementation | Notes                                      |
| ---------------------------------------- | -------- | -------------- | ------------------------------------------ |
| Binding draft/input                      | Accepted | Prototype      | Moves to scope/item/alias identity.        |
| Touched and input issues                 | Accepted | Prototype      | Cleared on final binding unmount.          |
| Stale-draft detection                    | Accepted | Planned        | Records field base revision/value.         |
| `discardInput(binding)`                  | Accepted | Prototype      | Clears one draft immediately.              |
| `createStaleInputOverwritePlan(binding)` | Accepted | Planned        | Fingerprints draft and canonical revision. |
| `executeStaleInputOverwrite(plan)`       | Accepted | Planned        | Single-use; revalidates before commit.     |
| Generic rebase                           | Deferred | —              | Requires explicit field merge semantics.   |

Canonical field changes never silently delete dirty drafts. Unrelated bindings observe the new
canonical value; dirty bindings become stale. Confirmation UX belongs to the application.

## Runtime hosts, entities, and relationships

| Invariant                            | Contract | Implementation | Behavior                                      |
| ------------------------------------ | -------- | -------------- | --------------------------------------------- |
| `providerId` defaults to `default`   | Accepted | Verified       | Duplicate active ID on one root throws.       |
| One entity of each kind per scope    | Accepted | Verified       | One DashPanel and one DashList may coexist.   |
| One active host affinity per scope   | Accepted | Verified       | Provider/standalone host conflicts throw.     |
| Declarative parent-child edge        | Accepted | Verified       | Exists only while its boundary lease is live. |
| One active parent and no cycles      | Accepted | Verified       | Conflicting graph acquisition throws.         |
| Provider is a hard ancestry boundary | Accepted | Verified       | No relationship crosses the boundary.         |

Manual `scope()` calls never register entities or relationships. Runtime leases are acquired only
after committed declarative renders and release on lifecycle teardown. Durable scope metadata
survives lease release; host affinity ends when the final entity leaves the scope.

## Scoped metadata operations

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

| Additional API       | Contract | Implementation | Notes                                         |
| -------------------- | -------- | -------------- | --------------------------------------------- |
| `createPrunePlan()`  | Accepted | Planned        | Never infers obsolescence from mount absence. |
| `executePrunePlan()` | Accepted | Planned        | Explicit node selection or known inventory.   |
| `renameScope()`      | Deferred | —              | Use schema migration before activation.       |

Root reset commands require a `scopeId`; scoped reset commands target their own scope and cannot
accept another identity. `setDashPanelLayout` replaces the complete Panel record. Each order setter
replaces one container override; an empty order removes that override. Collapse setters store an
explicit override, while the matching removal command returns to the declaration. Removing absent
state and resetting an absent domain are successful no-ops. Empty product records and then empty
scope records are pruned.

Commands normalize and detach one complete metadata candidate. Invalid layout/order/identifier data
returns `invalid_metadata` without mutation. A metadata-only change returns `changedFields: []` and
the affected scope in sorted `changedScopeIds`; a no-op returns both arrays empty. Root and affected
scoped subscribers are each notified once after commit; unrelated scoped subscribers are not.

`destroyScope` clears durable metadata and ephemeral interaction but not canonical values,
registrations, relationships, or leases. Omitted `includeDescendants` targets only the explicit
scope; `true` traverses relationships active at operation time. The complete target set is validated
before mutation. Changed scope IDs include only targets whose state changed. Missing state is a
successful no-op. Option validation uses the exact mapping above. Active components return to
declarative defaults without persisting an empty record; a later durable operation may create one.

> Implementation: Verified for the alpha slice — [scope metadata and destruction tests](../../packages/store/tests/scope-metadata.test.ts) and [integration traversal tests](../../packages/store/tests/integration.test.ts).

Scoped prune-plan creation targets that view's DashList metadata; root creation requires `scopeId`.
Plans are opaque, root-owned, single-use, and fingerprint both stored metadata and active nodes.
Active nodes are never candidates. Execution removes only approved dormant node metadata and never
changes canonical values, bindings, or relationships.

DashList presents `resetRegisteredValues()` as `Reset values…` and `resetDashListMetadata()` as
`Reset list…`. These remain separate actions: the former resets current-List values and targeted
drafts, while the latter resets order and group-collapse overrides without changing values.

## External value adapter

```ts
type PicodashValueAdapter<Values> = {
  getSnapshot(): Readonly<Values>
  subscribe(listener: () => void): () => void
  setValues(completeValues: Readonly<Values>, context: AdapterWriteContext): void
}
```

```ts
type OperationSource = 'programmatic' | 'interactive' | 'repair' | 'reset' | 'import'

type AdapterWriteContext = {
  source: OperationSource
  originScopeId?: string
  targetScopeIds: readonly string[]
  changedFields: readonly string[]
}

type AdapterWriteFailureReason =
  'write_threw' | 'async_write' | 'not_visible' | 'invalid_snapshot' | 'mismatched_snapshot'

type AdapterUnhealthyIssue = TransactionIssue & {
  readonly code: 'adapter_unhealthy'
  readonly reason: 'blocked'
  readonly path: readonly []
  readonly scopeId?: string
}

type AdapterWriteFailedIssue = TransactionIssue & {
  readonly code: 'adapter_write_failed'
  readonly reason: AdapterWriteFailureReason
  readonly path: readonly []
  readonly scopeId?: string
}

type AdapterHealthReason =
  'read_threw' | 'async_snapshot' | 'invalid_snapshot' | AdapterWriteFailureReason

type AdapterHealthDiagnostic = PicodashDiagnostic<
  'adapter_unhealthy',
  { readonly kind: 'adapter' },
  'error'
> & { readonly reason: AdapterHealthReason }
```

`originScopeId` is present only for an attributed scoped command. `targetScopeIds` lists explicit
command targets, not every active scope observing a changed root field. `changedFields` is the final
sorted set after validation and semantic no-op removal.

> Contract: Accepted
> Implementation: Verified for the synchronous manual adapter slice — [adapter behavior tests](../../packages/store/tests/adapter.test.ts), [adapter type tests](../../packages/store/tests/adapter.types.test.ts), and [adapter fixture harness](../../packages/store/tests/support/external-adapter.ts).

The adapter snapshot is a complete projection of Picodash fields, not the host's whole application
state. The adapter is immutable and root-only. The API has no adapter `id`, boolean write result,
`previousValues` alias, or React-generated adapter. Convenience adapters for state libraries may
ship separately without changing Store authority.

`getSnapshot()` returns a complete immutable projection with stable reference identity until a
semantic change. `subscribe()` uses a no-argument listener and idempotent teardown. The adapter and
its callback identities remain stable for the root lifetime. Picodash clones validated data and
never retains mutable host references.

Activation is ordered `read and validate -> subscribe -> reread and validate`. If failure occurs
after subscription, Store calls the returned teardown exactly once before construction throws. A
malformed adapter object throws `PicodashContractError` code `invalid-configuration`. External
startup failure throws `PicodashInitializationError` code `adapter-initialization-failed`, with the
corresponding `AdapterInitializationFailureReason` on the error and one
`adapter_initialization_failed` issue at path `[]` carrying the same reason. It exposes no adapter,
snapshot, value, thrown cause, message, or stack. Construction is all-or-nothing.

Candidate validation and semantic no-op removal happen before adapter health is consulted. An
otherwise valid write attempted while unhealthy returns one `AdapterUnhealthyIssue`, does not call
the adapter, and does not increment the health diagnostic. An attempted adapter write that fails
returns one `AdapterWriteFailedIssue`.

After `setValues()` returns, Picodash synchronously reads the adapter again and requires the complete
projection to equal the validated candidate. A thrown write, delayed visibility, invalid snapshot,
or mismatched result commits no Picodash metadata, preserves the last safe projection, and marks the
adapter unhealthy. Adapter authors must provide an atomic write or throw before mutation because
Picodash cannot undo a partial host-store write.

An invalid later snapshot is rejected as a whole. Each actual read, snapshot, or write failure
increments the single root-local `AdapterHealthDiagnostic`; a blocked write does not. A later
complete valid snapshot clears it. The diagnostic and transaction issues omit adapter objects, raw
or canonical values, host identities, arbitrary thrown causes and messages, and stacks.

Synchronous adapter notifications caused by Store's own whole-record write are coalesced as an
internal echo. Store validates the post-write projection once and publishes at most one completed
Store notification. Metadata commands remain usable while adapter values are unhealthy because
they do not cross value authority. External-owned `initialEnvelope` data may contain Picodash
metadata but must not contain canonical values; that persistence branch is beta.

## Persistence

> Contract: Accepted
>
> Implementation: Verified for the Store-owned alpha slice — [persistence tests](../../packages/store/tests/persistence.test.ts), [persistence type tests](../../packages/store/tests/persistence.types.test.ts), and [memory persistence harness](../../packages/store/tests/support/memory-persistence.ts).

The alpha persistence capability is Store-owned: it persists the disclosed canonical value
projection and all durable Picodash scope metadata. External-owned metadata persistence,
conflict-resolution and erase plans, migrations, documents, quarantine recovery, and the built-in
Web Storage driver remain beta work.

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
share it. All methods are synchronous. Writes and removals are atomic or throw before visible
mutation. Optional subscriptions carry no payload and only signal that Store must reread and
validate. Alpha never calls `remove`. Driver failures are normalized without retaining causes,
messages, or stacks.

```ts
type StoreOwnedPersistenceConfig<Fields> = {
  storageKey: string
  driver: PicodashPersistenceDriver
  values: {
    defaultFieldPolicy: 'include' | 'omit'
    fields?: Partial<Record<keyof Fields, 'include' | 'omit'>>
  }
}

type ExternalOwnedPersistenceConfig = {
  storageKey: string
  driver: PicodashPersistenceDriver
  values?: never
}
```

Store-owned mode requires an explicit value default and permits overrides only for declared fields.
Durable Picodash metadata is always included. Encryption belongs in a custom synchronous driver.
`ExternalOwnedPersistenceConfig` reserves the accepted beta branch; alpha rejects it.

```ts
persistence: {
  storageKey: 'picodash:application-controls',
  driver: applicationPersistenceDriver,
  values: {
    defaultFieldPolicy: 'include',
    fields: {
      apiToken: 'omit',
    },
  },
}
```

| API/status                                          | Contract | Implementation | Notes                                                                                                                          |
| --------------------------------------------------- | -------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Synchronous hydration                               | Accepted | Partial        | Alpha is all-or-nothing and has no async core; driver and driver-free initial-envelope paths are covered by persistence tests. |
| One versioned root envelope                         | Accepted | Partial        | Store-owned envelope encoding, deterministic decoding, field disclosure, and durable metadata are implemented.                 |
| `persistence.getState()`                            | Accepted | Partial        | Exact immutable discriminated state is implemented and covered by runtime/type tests.                                          |
| `persistence.subscribe(listener)`                   | Accepted | Partial        | Separate capability subscriptions are implemented and share diagnostics dispatch.                                              |
| `persistence.flush()`                               | Accepted | Partial        | Retries pending I/O and never resolves conflicts.                                                                              |
| `persistence.createConflictResolutionPlan(options)` | Accepted | Planned        | Accepted beta reload/overwrite/reconcile surface.                                                                              |
| `persistence.executeConflictResolution(plan)`       | Accepted | Planned        | Accepted beta plan execution.                                                                                                  |
| `persistence.createErasePlan()`                     | Accepted | Planned        | Accepted beta erase preview.                                                                                                   |
| `persistence.executeErase(plan, { confirm: true })` | Accepted | Planned        | Accepted beta confirmed erase.                                                                                                 |

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

A persistent root and every scoped view expose the same root-wide `PicodashPersistence` object by
exact identity. State and nested data are immutable. `durableRevision` is the last driver-confirmed
revision or `null`; `liveRevision` is the newest complete local envelope revision and begins at zero
without an envelope. The synchronous alpha path need not leave an observable `pending` state absent
an error or conflict, but the member reserves a complete envelope awaiting `flush()`.

`flush()` returns `unchanged` when no envelope is pending, `saved` only after writing and rereading
the newest pending envelope, and `pending` while an error or conflict remains. It never resolves or
overwrites a conflict. Capability listeners receive no argument, read with `getState()`, have
idempotent teardown, and are independent of root and scoped subscriptions.

```ts
root.persistence satisfies PicodashPersistence
scoped.persistence satisfies PicodashPersistence
root.persistence === scoped.persistence // true
```

### Version-one envelope

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

Alpha produces and accepts only the `store` branch; the `external` branch reserves the future
authority distinction. `revision` is a positive safe integer. `writerId` is an opaque, trimmed,
control-character-free root writer identity. A Store-owned envelope always has `values`, including
an empty record when policy omits all fields, and contains the complete disclosed projection.
Omitted fields hydrate from the current validated baseline. `scopes` contains every durable
metadata record as sorted, duplicate-free entry tuples; metadata maps retain their existing sorted,
duplicate-checked serialized tuple form.

The decoder requires exact keys, strict JSON-compatible data, matching Store identity and schema,
the accepted authority branch, known persisted field keys, and valid complete scope metadata. Alpha
rejects an incompatible envelope as a whole; it does not partially hydrate, quarantine, migrate, or
repair.

Serialization is deterministic: object keys are lexically sorted recursively, arrays preserve
order, metadata entries are sorted, finite numbers are required, and negative zero becomes zero.
Hydration-source comparison checks Store identity and revision separately. Its internal content
fingerprint covers normalized `schemaVersion`, `valueOwner`, `values`, and `scopes`; it excludes
`revision` and `writerId` and never appears in public state or diagnostics.

### Construction and hydration

Server Stores are request-local and may use `initialEnvelope` without a driver. The input is cloned
and never retained. Construction follows these exact cases:

- No driver record and no initial envelope uses the validated baseline and performs no write.
- An initial envelope without persistence hydrates synchronously and adds no persistence capability.
- A valid driver record hydrates before Store activation.
- Matching driver and initial envelopes hydrate once without writing.
- An empty driver plus an initial envelope writes and rereads a new local envelope with a fresh
  writer ID and revision `initial.revision + 1` before activation.
- Driver and initial disagreement in identity, revision, or content fails construction.
- Every read, subscription, seed-write, or verification failure is all-or-nothing and releases any
  acquired driver ownership before throwing.

Hydration uses current field schemas, field validators, and the root validator with source
`persistence`; it never invokes UI parsers. There is no partial metadata commit, implicit repair, or
baseline fallback for an invalid disclosed field.

Construction uses these exact `PicodashInitializationError` codes and reasons:

| Code                             | Reasons                                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------- |
| `persistence-driver-unavailable` | `read` \| `subscribe` \| `seed-write` \| `seed-verification`                                       |
| `invalid-persistence-envelope`   | `syntax` \| `shape` \| `format` \| `identity` \| `schema` \| `authority` \| `values` \| `metadata` |
| `hydration-source-conflict`      | `revision` \| `content`                                                                            |

The error and its issue data carry only the listed reason and canonical paths, never raw envelope
text, storage contents, values, or arbitrary driver causes.

### Writes, failures, and conflicts

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
or arbitrary cause. A durability failure never rolls back valid live state. Store retains the
newest complete normalized pending envelope, exposes the diagnostic above, and replaces obsolete
pending data after each later persistable commit. A rejected candidate changes neither live state
nor the pending envelope.

For a successful transaction, `persistence: 'unchanged'` means its persisted projection did not
change and performs no retry, including for semantic no-ops and omitted-field-only changes.
`persistence: 'saved'` requires exact post-write verification. `persistence: 'pending'` means the
live commit succeeded but its newest envelope remains undurable. An older pending condition that an
unchanged transaction did not affect is reported by capability state, not that transaction result.

Before every automatic write, Store rereads and compares the last confirmed revision, writer, and
content. A valid foreign envelope or removal enters `conflict` before any write. After a write,
Store rereads and accepts durability only on an exact canonical match. Synchronous notifications
caused by Store's write are coalesced into that verification cycle. Once conflicted, valid
transactions keep replacing the complete local pending envelope but perform no driver writes;
`flush()` also refuses to overwrite. Reload, overwrite, and reconcile are explicit beta plans.

Only one live root may own a `(driver.identity, storageKey)` pair in one JavaScript realm. A second
claim throws `PicodashContractError` code `persistence-identity-in-use` with exactly
`{ storageKey }`; context never contains the driver identity.

Any `hasPendingEnvelope: true` state makes root destruction throw `root-has-unpersisted-state`
unless `{ discardUnpersisted: true }` is supplied. Discard removes only the in-memory envelope.
Successful destruction unsubscribes the driver, releases persistence ownership, and never calls
`remove` or changes the durable envelope. Active integration leases remain the earlier destruction
refusal and cannot be bypassed by discard.

Beta adds external-owned metadata persistence, validated quarantine and replacement, schema
migrations, document integration, reload/overwrite/reconcile plans, explicit erase plans, and the
browser Web Storage seam. These additions preserve the alpha envelope and state signatures and do
not introduce automatic last-write-wins.

## Export

Export, import, and migration are accepted beta contracts and are not part of the alpha persistence
capability.

```ts
export: {
  documents: {
    defaultFieldPolicy: 'include',
  },
  fields: {
    apiToken: {
      default: 'redact',
      allowPromotion: 'with-confirmation',
    },
    internalKey: 'omit',
  },
}
```

`export.documents.defaultFieldPolicy` is required and accepts `include`, `redact`, or `omit`.
Per-field entries override that default to establish each field's immutable maximum. A field may
promote from `redact` only when its immutable policy explicitly allows confirmed promotion. Unknown
keys and promotion on another default fail Store construction.

Store document APIs exchange immutable JSON-compatible objects. `executeExport()` returns a
`PicodashDocument`; `analyzeImport()` accepts parsed unknown data. The core package does not own
filenames, downloads, clipboard access, MIME types, or JSON/YAML text parsing. Those concerns belong
to the consuming product or a future dedicated codec entry.

| API                                       | Contract | Implementation | Notes                                           |
| ----------------------------------------- | -------- | -------------- | ----------------------------------------------- |
| `documents.createExportPlan(options)`     | Accepted | Prototype      | Target plan becomes value-free and root-bound.  |
| `documents.executeExport(plan, options?)` | Accepted | Prototype      | Explicit one-use promotion confirmation.        |
| Scoped document export                    | Accepted | Prototype      | Active registered fields plus durable metadata. |

Hard-omitted fields leave no entry. Redacted fields use a structured marker. Per-call selection can
narrow but not exceed immutable disclosure policy. Dormant scopes infer no registered fields.

Export plans are opaque, root-owned, single-use, and fingerprint relevant values, metadata,
registrations, policy, and the scope graph. When a plan contains promoted redacted fields, execution
requires `{ confirmRedactedPromotion: true }`; otherwise that option is omitted. Changed input
returns `stale_plan`, and consent is never remembered.

Documents declare `kind: 'root' | 'scope'`. Root Store methods default to a full-root document and
may explicitly target a scope. Scoped Store methods always target their own scope and cannot accept
another identity.

Per-call field selection uses nominal field handles. Scoped export may include active descendants or
explicitly narrow fields, but cannot target another scope. Root export may explicitly target a
scope. Every selection remains bounded by immutable policy.

## Import

| API                                 | Contract | Implementation | Notes                                         |
| ----------------------------------- | -------- | -------------- | --------------------------------------------- |
| `documents.analyzeImport(document)` | Accepted | Prototype      | Produces target effects without mutation.     |
| `documents.executeImport(plan)`     | Accepted | Prototype      | Revalidates and commits atomically.           |
| `scopeMap`                          | Accepted | Planned        | Required for renamed descendants.             |
| `createMissingScopes`               | Accepted | Planned        | Explicit; creates state, never registrations. |
| Foreign Store permission            | Accepted | Planned        | Required when source Store identity differs.  |

```ts
documents.analyzeImport(document, {
  allowForeignStore: true,
  scopeMap: { oldAdvanced: 'advanced' },
  fieldMap: {
    oldExposure: store.fields.exposure,
    retiredField: 'ignore',
  },
  createMissingScopes: true,
})
```

Redacted and absent values leave target values unchanged. Unknown or incompatible fields block the
commit unless an explicit mapping resolves them.

Target fields in `fieldMap` are nominal handles, not unchecked strings. Automatic same-key mapping
applies only to known compatible fields. The explicit `ignore` sentinel, foreign-Store permission,
scope remapping, and missing-scope creation are all reported by analysis for confirmation.

Import analysis returns an opaque, root-owned, single-use plan that fingerprints the document and
relevant target state. Execution rechecks document kind, mappings, target revisions, policy, and the
complete candidate. Root documents import only at root; scope documents target an explicit root
scope or the current scoped view. Kind mismatches are not projected implicitly.

## Beta schema migration

```ts
migrations: {
  1: document => migrateVersion1To2(document),
  2: document => migrateVersion2To3(document),
}
```

> Contract: Accepted
> Implementation: Planned

Migration functions are synchronous, pure, and operate on cloned JSON. Hydration requires a complete
chain to the configured schema version and validates the final result before replacing persisted
state.

Each entry keyed by `N` must migrate the application payload from `N` to `N + 1`. The payload contains
permitted values and durable scope metadata, not Picodash format, Store identity, writer, or revision
headers. Skipped versions and mismatched returned versions fail. The same chain applies during
hydration and import; internal `formatVersion` migration remains Picodash-owned.

## Root destruction

```ts
type DestroyRootOptions = {
  readonly discardUnpersisted: true
}

root.destroy(options?: DestroyRootOptions): void
```

> Contract: Accepted
> Implementation: Partial

> Implementation evidence: [root lifecycle tests](../../packages/store/tests/root-lifecycle.test.ts), [kernel type tests](../../packages/store/tests/kernel.types.test.ts), [integration tests](../../packages/store/tests/integration.test.ts), and [package artifact checks](../../packages/store/tests/package-artifacts.mjs).

Destruction is final and non-transactional. Refusal is atomic and ordered:

1. options are validated by the exact `invalid-destroy-options` mapping above;
2. any Provider, entity, relationship, or binding lease throws `root-has-active-leases`;
3. unpersisted state without explicit discard throws `root-has-unpersisted-state`.

Provider unmount never destroys an application-supplied root. On success, root destruction releases
adapter and persistence subscriptions, persistence ownership, diagnostics listeners, cached
snapshots, and weak view-cache entries. It never deletes the durable envelope or resets values.
`discardUnpersisted` discards only a pending in-memory envelope and never bypasses live-lease
refusal. Persisted-data removal remains an explicit beta erase-plan operation.

Implementation follows the dependency order integration leases, root lifecycle, then adapter and
persistence authority. Store inspects live generations before releasing adapter subscriptions,
persistence subscriptions, or persistence ownership. This sequencing changes no public alpha API.

After success, every property access and method call on an existing root/scoped Store, diagnostics
namespace, or capability handle throws `use-after-destroy`; calling `destroy()` again does likewise.
Previously returned unsubscribe functions remain idempotent no-ops. Previously captured immutable
snapshots remain readable detached data. Field handles remain inspectable, but no destroyed Store
can use them.

## Declarative integration surface

`@picodash/store/integration` is a supported low-level entry for DashPanel, DashList, and authors of
another declarative UI product. Ordinary applications use the root and React entries instead.

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
operation is `release()`; callers never supply or reconstruct a lease ID. `providerId` defaults to
`default`. Provider acquisition accepts only a root Store, and entity acquisition accepts only a
scoped Store. A Provider-hosted root entity supplies its `ProviderLease`; a nested entity supplies
the nearest `EntityLease`. Only a standalone root DashList may omit `host`, in which case Store owns
a private standalone-host generation. Every DashPanel resolves transitively to a Provider
generation.

Entity options are validated as an exact own-key data record before any host handle is examined.
The deterministic validation order is non-null, non-array object; no unknown own string or symbol
key beyond `kind` and `host`; no accessor for either known key; exact `dashPanel | dashList` kind;
then the required presence of `host` for `dashPanel`. Failure throws `invalid-entity-options` with
exactly `{ reason: InvalidEntityOptionsReason }`. A present host is then validated as a handle, so an
invalid, foreign, released, or wrong-kind host remains `invalid-integration-handle`. No failure
context contains the rejected option, key, descriptor, or host.

Provider and entity handles privately carry root and host generations. Relationship acquisition
derives both from its handles and rejects a different root or host generation, so an edge cannot
cross a nested Provider boundary even when both Providers share a root. Multiple live relationship
leases may represent the same ordered edge; it remains active through the last generation. A child
has at most one active parent. Same-scope edges, cycles, cross-root edges, and cross-host edges are
rejected.

The first successful `release()` tears down that lifecycle generation; later calls are idempotent
no-ops. Provider and entity release refuse while dependent leases remain. Teardown order is
relationship, child entity, parent entity, then Provider. Abandoned renders acquire nothing, and
Strict Mode reacquisition reruns all identity and graph checks. Binding acquisition and its
`BindingHandle` remain a later Store slice, not part of the alpha integration surface.

The exact integration errors and complete safe contexts are:

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
| `missing-store-context`        | `{ required: 'root-or-scoped' \| 'scoped' }`                                                    |

`InvalidProviderIdReason` is the same lexical union as `InvalidScopeIdReason`. Error context never
contains a Store, handle, root runtime identity, host generation, rejected caller value, stack, or
arbitrary cause.

One module-private `WeakMap` resolves a root Store to its runtime controller. The integration entry
uses it for host and relationship generations, and `destroyScope()` uses the same controller for
active descendant traversal. It never appears on a root, scoped view, snapshot, document, persisted
envelope, or diagnostic.

> Contract: Accepted
> Implementation: Partial — [integration runtime tests](../../packages/store/tests/integration.test.ts), [declarative integration tests](../../packages/store/tests/declarative-integration.test.ts), [integration React tests](../../packages/store/tests/integration-react.test.tsx), [integration type tests](../../packages/store/tests/integration.types.test.ts), and [package artifact checks](../../packages/store/tests/package-artifacts.mjs). Provider-hosted React boundaries are implemented; standalone DashList hosting remains planned.

### Active DashList orientation override

> Contract: Accepted
> Implementation: Planned

`@picodash/store/integration` exposes one narrow runtime channel for Picodash to coordinate a
settled Panel dock with a DashList rail without coupling either UI package to the other:

```ts
type DashListOrientationOverride = 'horizontal' | 'vertical'

interface DashListOrientationOverrideLease {
  readonly scopeId: string
  readonly orientation: DashListOrientationOverride
  update(orientation: DashListOrientationOverride): void
  release(): void
}

declare function acquireDashListOrientationOverrideLease(
  rootStore: RootStore,
  options: {
    scopeId: string
    orientation: DashListOrientationOverride
  },
): DashListOrientationOverrideLease

declare function getDashListOrientationOverride(
  scopedStore: ScopedStore,
): DashListOrientationOverride | undefined

declare function subscribeDashListOrientationOverride(
  scopedStore: ScopedStore,
  listener: () => void,
): () => void
```

The API has these rules:

- It exists only on the integration entry. Ordinary applications use the public
  `DashList.orientation` prop; the initial Store API has no application command for setting this
  override and therefore no precedence problem between competing application and Picodash writers.
- Picodash acquires the lease only after its declarative integration commits and only while it has a
  concrete derived orientation. `full/center-left` and `full/center-right` derive `vertical`;
  `full/center-top` and `full/center-bottom` derive `horizontal`. Corner, free, and snapped
  dispositions hold no lease, so the declared DashList orientation or its default applies.
- One root may hold at most one live orientation-override lease for a scope. A duplicate acquisition
  throws a contract error even when both leases propose the same value.
- `update()` changes a live lease atomically. An unchanged value is a no-op without notification.
  Updating a released, foreign, or superseded lease throws a contract error.
- `release()` is idempotent. Its first call clears the active override and notifies that scope's
  channel once. The DashList then resolves its declared orientation or default.
- Acquisition validates root ownership and scope-ID syntax but does not require an already active
  DashList. This removes React effect-order dependence when integrated Panel and List descendants
  commit. The lease creates no Provider, entity, relationship, host affinity, binding, durable
  scope, or metadata record. Like every live integration lease, it prevents root destruction until
  release.
- `getDashListOrientationOverride()` and `subscribeDashListOrientationOverride()` form an
  external-store channel scoped to exactly one view. The listener receives no state argument and
  reads the latest value with the getter. Subscription teardown is idempotent.
- The runtime value is absent from `RootStore.getState()` and `ScopedStore.getState()`. It does not
  notify canonical-value, durable-metadata, or binding-interaction subscribers. DashList composes
  the getter and subscription internally; the foundational public component exposes no Store hook
  for this implementation channel.
- The value never enters `DashListMetadataRecord`, persistence, export, import, or migration. A
  future durable user orientation preference requires a separate product contract.

`DashListOrientationOverride` and DashList's public `DashListOrientation` are intentionally
structurally compatible literal unions. Store defines its integration type without importing the
DashList package.

## React boundaries and hooks

The integration entry exposes two Provider-hosted React boundaries. They supply immutable context
during render but acquire and release Store leases only from committed effects:

```ts
interface PicodashStoreProviderBoundaryProps<
  Fields extends PicodashFieldDefinitions = PicodashFieldDefinitions,
  Result extends CoreTransactionResult = CoreTransactionResult,
> {
  children: ReactNode
  store: RootStore<Fields, Result>
  providerId?: string
}

interface PicodashStoreEntityBoundaryProps<
  Fields extends PicodashFieldDefinitions = PicodashFieldDefinitions,
  Result extends CoreTransactionResult = CoreTransactionResult,
> {
  children: ReactNode
  store: ScopedStore<Fields, Result>
  kind: StoreEntityKind
}
```

`PicodashStoreProviderBoundary` resets inherited root and scope ancestry. An entity boundary requires
the nearest Provider-hosted integration context, supplies its scoped Store during render, and
declares its entity only after commit. Standalone DashList hosting is intentionally excluded from
this slice. Missing context throws `missing-store-context` with exactly `{ required: 'root-or-scoped' }`
or `{ required: 'scoped' }`.

## React hooks

```ts
usePicodashStore()                    // RootStore | ScopedStore
usePicodashStore('settings')          // ScopedStore
usePicodashRootStore()                // RootStore
usePicodashScope()                    // ScopedStore or throws

usePicodashStoreSelector(store, selector, equalityFn?)
usePicodashRootSelector(selector, equalityFn?)
usePicodashScopeSelector(selector, equalityFn?)
```

| API                             | Contract | Implementation | Notes                                                                   |
| ------------------------------- | -------- | -------------- | ----------------------------------------------------------------------- |
| Contextual Store hooks          | Accepted | Verified       | Nearest root/scoped context semantics and exact missing-context errors. |
| Explicit Store selector         | Accepted | Verified       | Root or scoped Store; server/client snapshots use `getState()`.         |
| Root/scope contextual selectors | Accepted | Verified       | Root/scope selector context and equality delegation.                    |
| Optional equality function      | Accepted | Verified       | Defaults to `Object.is`; equal selections retain their reference.       |
| `shallowEqual`                  | Accepted | Verified       | One-level records and arrays/tuples only.                               |

Contextual hooks throw when their required boundary is absent. Passing a scope ID to
`usePicodashStore` resolves a view from the nearest root without creating metadata or registering a
relationship. The explicit selector works without context. Selectors are pure, may run repeatedly,
and receive immutable data snapshots only. Server and client hooks use the same synchronous Store
snapshot contract.

## Trust boundary

A scoped Store is not a capability-limited Store. Any code with a root or scoped Store is trusted
to access every root field. Use separate roots and application-controlled adapters for untrusted or
separately permissioned plugins.

## Prototype reconciliation

The current package remains useful evidence, but these prototype surfaces do not define the target:

| Prototype surface                           | Target disposition                                      |
| ------------------------------------------- | ------------------------------------------------------- |
| Actions returned inside `getState()`        | Move to stable root/scoped Store APIs.                  |
| Per-Panel `panelId`/`scopeId` Store options | Replace with root identity plus canonical scoped views. |
| Standard Schema passed through `validate`   | Move to the dedicated `schema` stage.                   |
| `allowUnset` and unset field outputs        | Replace with explicit JSON optional values.             |
| Presentation compatibility exports          | Move presentation ownership to DashList/Dashlets.       |
| `PicodashPanel*` document functions/types   | Replace with the typed `documents` capability.          |
| Filename, MIME, and JSON/YAML codec helpers | Move to consuming products or a dedicated codec entry.  |
| Public item/order implementation helpers    | Move behind Store integration or DashList ownership.    |
| Standalone diagnostic channel construction  | Replace with the root `diagnostics` namespace.          |
| Hook-generated React state/reducer adapters | Defer; keep the manual adapter contract authoritative.  |
| Imperative registration and deregistration  | Replace with committed declarative leases.              |

Clean pre-v1 removal is preferred over compatibility aliases unless a later decision explicitly
requires them.

## Related documents

- [Store contract decisions](store-contract-decisions.md)
- [ADR 0002](../adr/0002-provider-level-store-and-scoped-views.md)
- [Documentation status](document-status.md)
- [Roadmap](../ROADMAP.md)
