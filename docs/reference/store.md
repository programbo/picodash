# Store target reference

Store is a typed state foundation for configurable React interfaces. This page describes the target
contracts for `@picodash/store`, `@picodash/store/react`, and the advanced integration entry; it does
not claim that the prototype currently exports every API shown here.

## Status

> Contract: Accepted target API
> Implementation: Prototype
> Evidence: See the [conformance matrix](contract-conformance.md).

## Package surfaces

| Surface                       | Contract | Implementation | Purpose                                     |
| ----------------------------- | -------- | -------------- | ------------------------------------------- |
| `@picodash/store`             | Accepted | Prototype      | Framework-independent Store implementation  |
| `@picodash/store/react`       | Accepted | Prototype      | Public React hooks and selectors            |
| `@picodash/store/integration` | Accepted | Planned        | Versioned context and declarative lease API |

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

| API                     | Contract | Implementation | Notes                                                |
| ----------------------- | -------- | -------------- | ---------------------------------------------------- |
| `createPicodashStore()` | Accepted | Prototype      | Target configuration differs from prototype details. |

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
> Implementation: Planned
> Notes: Capability-specific TypeScript variants make `storeId` and `schemaVersion` required
> whenever `initialEnvelope`, persistence, export, or migrations are configured.

`initialEnvelope` provides synchronous driver-free hydration for request-local server Stores. If a
driver is also configured, its record must be absent or match the envelope identity, revision, and
deterministic content fingerprint; disagreement throws during construction.

## Field definitions and handles

Every field has a concrete JSON-compatible default. Optional parsing and validation are synchronous
and pure. The complete field set is immutable.

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

| Behavior                    | Contract | Implementation | Notes                                             |
| --------------------------- | -------- | -------------- | ------------------------------------------------- |
| Stable typed field handles  | Accepted | Prototype      | Handles become nominally root-owned.              |
| Immutable field set         | Accepted | Planned        | Runtime field registration is rejected.           |
| `parse` raw-input stage     | Accepted | Prototype      | May produce a candidate value or explicit repair. |
| Standard Schema `schema`    | Accepted | Planned        | Canonicalizes and drives inferred output type.    |
| Contextual `validate` stage | Accepted | Prototype      | Accepts or rejects; cannot transform.             |
| Synchronous pipeline        | Accepted | Prototype      | Promise-like results are rejected.                |
| Root ownership checks       | Accepted | Prototype      | Same-key handles from another root throw.         |

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

| API                       | Contract | Implementation | Notes                                    |
| ------------------------- | -------- | -------------- | ---------------------------------------- |
| `root.scope(scopeId)`     | Accepted | Planned        | Returns a canonical live scoped view.    |
| `scoped.scope(scopeId)`   | Accepted | Planned        | Resolves through the same root.          |
| `scoped.root`             | Accepted | Planned        | Explicit access to the root Store.       |
| `scoped.scopeId`          | Accepted | Planned        | Opaque exact scope identity.             |
| `root.kind`/`scoped.kind` | Accepted | Planned        | Discriminates distinct Store interfaces. |

Scoped views expose the complete root values. They organize metadata and attribution; they do not
restrict field access.

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
type ScopedSnapshot<Values> = {
  values: Readonly<Values>
  scope: DurableScopeMetadata | undefined
  interaction: ScopeInteractionState
}
```

> Contract: Accepted
> Implementation: Planned
> Notes: Adapter and persistence status live on their configured capability namespaces rather than
> every ephemeral root snapshot.

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

type DurableScopeMetadata = {
  dashList?: DashListMetadataRecord
  dashPanel?: DashPanelLayoutRecord
}
```

| Record                    | Contract | Implementation | Notes                                             |
| ------------------------- | -------- | -------------- | ------------------------------------------------- |
| DashList order/collapse   | Accepted | Prototype      | Overrides only; containment remains declarative.  |
| DashPanel layout override | Draft    | Prototype      | Exact record waits for placement contract review. |

Empty product records are omitted. Serialized maps use duplicate-checked entry arrays. The
DashPanel record ownership and settled-only boundary are accepted, but its exact placement payload
cannot be frozen until the DashPanel placement review resolves the remaining modes, responsive
fallback, and resize questions.

## Core diagnostics namespace

```ts
store.diagnostics.getState()
store.diagnostics.subscribe(listener)
store.diagnostics.inspectRuntime(options?)

type PicodashDiagnosticsState = {
  current: ReadonlyMap<string, PicodashDiagnostic>
}
```

`getState()` returns current structured operational problems and `subscribe()` observes that state
separately from canonical value subscriptions. `inspectRuntime()` returns an immutable point-in-time
view of Providers, entity leases, bindings, and active relationships. Neither surface exposes
canonical values, raw draft input, or arbitrary exception causes. Scoped Stores default inspection
to their scope and require an explicit option for a root-wide view.

The diagnostic snapshot is a bounded map of current conditions keyed by stable identity, not an
unbounded event log. Repeated occurrences update the existing entry; recovery removes it.
Applications that need history subscribe and forward events to their own logger.

> Contract: Accepted
> Implementation: Planned

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
| `setValue(field, value)`             | Accepted | Prototype      | Safe typed single-field transaction.          |
| `setValueOrThrow(field, value)`      | Accepted | Planned        | Throws the corresponding transaction error.   |
| `setValues(values)`                  | Accepted | Prototype      | Safe typed partial-record atomic transaction. |
| `setValuesOrThrow(values)`           | Accepted | Planned        | Throws the corresponding transaction error.   |
| `setInput(binding, input)`           | Accepted | Prototype      | Interactive; records invalid binding input.   |
| `executeRepair(plan)`                | Accepted | Prototype      | Single-use; revalidates a proposed repair.    |
| `resetValue(field)`                  | Accepted | Prototype      | Safe reset to the validated baseline.         |
| `resetValueOrThrow(field)`           | Accepted | Planned        | Throws the corresponding transaction error.   |
| `resetRegisteredValues(opts)`        | Accepted | Planned        | Active scope values; optional descendants.    |
| `resetRegisteredValuesOrThrow(opts)` | Accepted | Planned        | Throws the corresponding transaction error.   |
| `discardInput(binding)`              | Accepted | Prototype      | Returns whether interaction state changed.    |

Scoped calls may write any root field and add `originScopeId` attribution. Operations that target
descendants deduplicate root fields before building one candidate snapshot.

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
> Implementation: Planned

## Structured issues and errors

```ts
type TransactionIssue = {
  code: PicodashIssueCode | `app:${string}`
  path: readonly (string | number)[]
  message: string
  fieldKey?: string
  scopeId?: string
  itemId?: string
  alias?: string
}

class PicodashTransactionError extends Error {
  readonly issues: readonly TransactionIssue[]
}

class PicodashContractError extends Error {
  readonly code: PicodashContractErrorCode
  readonly context: Readonly<Record<string, string>>
  readonly issues?: readonly TransactionIssue[]
}

class PicodashInitializationError extends Error {
  readonly code: PicodashInitializationErrorCode
  readonly issues: readonly TransactionIssue[]
}
```

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
infrastructure. Construction is all-or-nothing; no partially active Store is returned.

All opaque plans and handles use consistent ownership rules: wrong-root, wrong-kind, released, or
already-consumed objects throw a contract error; a valid object whose captured state changed returns
a safe `stale_plan` issue.

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
| `providerId` defaults to `default`   | Accepted | Planned        | Duplicate active ID on one root throws.       |
| One entity of each kind per scope    | Accepted | Planned        | One DashPanel and one DashList may coexist.   |
| One active host affinity per scope   | Accepted | Planned        | Provider/standalone host conflicts throw.     |
| Declarative parent-child edge        | Accepted | Planned        | Exists only while its boundary lease is live. |
| One active parent and no cycles      | Accepted | Planned        | Conflicting graph acquisition throws.         |
| Provider is a hard ancestry boundary | Accepted | Planned        | No relationship crosses the boundary.         |

Manual `scope()` calls never register entities or relationships. Runtime leases are acquired only
after committed declarative renders and release on lifecycle teardown. Durable scope metadata
survives lease release; host affinity ends when the final entity leaves the scope.

## Scoped metadata operations

| API                               | Contract | Implementation | Notes                                         |
| --------------------------------- | -------- | -------------- | --------------------------------------------- |
| `resetDashListMetadata()`         | Accepted | Planned        | Removes order/collapse overrides.             |
| `resetDashPanelLayout()`          | Accepted | Planned        | Removes the layout override.                  |
| `destroyScope(options?)`          | Accepted | Planned        | Scoped Store targets its own scope.           |
| `destroyScope(scopeId, options?)` | Accepted | Planned        | Root Store requires an explicit scope.        |
| `createPrunePlan()`               | Accepted | Planned        | Never infers obsolescence from mount absence. |
| `executePrunePlan()`              | Accepted | Planned        | Explicit node selection or known inventory.   |
| `renameScope()`                   | Deferred | —              | Use schema migration before activation.       |

Root reset commands require a `scopeId`; scoped reset commands target their own scope and cannot
accept another identity. `includeDescendants` traverses only relationships active at operation time.
Durable ancestry is not stored. Active components return to declarative defaults after destruction
without persisting an empty record; a later durable operation may create one.

Scoped prune-plan creation targets that view's DashList metadata; root creation requires `scopeId`.
Plans are opaque, root-owned, single-use, and fingerprint both stored metadata and active nodes.
Active nodes are never candidates. Execution removes only approved dormant node metadata and never
changes canonical values, bindings, or relationships.

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
```

`originScopeId` is present only for an attributed scoped command. `targetScopeIds` lists explicit
command targets, not every active scope observing a changed root field. `changedFields` is the final
sorted set after validation and semantic no-op removal.

> Contract: Accepted
> Implementation: Prototype
> Notes: The prototype adapter contract must be reconciled with scope attribution and fail-closed
> health behavior.

The adapter snapshot is a complete projection of Picodash fields, not the host's whole application
state. The adapter is immutable and root-only. An invalid later snapshot leaves Picodash on the last
valid snapshot and blocks Picodash writes until the adapter becomes healthy.

`getSnapshot()` returns a complete immutable projection with stable reference identity until a
semantic change. `subscribe()` uses a no-argument listener and idempotent teardown. The adapter and
its callback identities remain stable for the root lifetime. Picodash clones validated data and
never retains mutable host references. The core contract is intentionally manual; convenience
adapters for particular state libraries can ship separately without changing Store authority.

After `setValues()` returns, Picodash synchronously reads the adapter again and requires the complete
projection to equal the validated candidate. A thrown write, delayed visibility, invalid snapshot,
or mismatched result returns a safe adapter-write failure, commits no Picodash metadata, and marks
the adapter unhealthy. Adapter authors must provide an atomic write or throw before mutation because
Picodash cannot undo a partial host-store write. External-owned `initialEnvelope` data may contain
Picodash metadata but must not contain canonical values.

## Persistence

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
share it. Drivers operate synchronously on the deterministic serialized envelope. Writes and
removals must be atomic or throw before visible mutation. Optional subscriptions signal possible
foreign changes; Picodash re-reads and validates rather than trusting an event payload. Driver
exceptions normalize to package-owned persistence diagnostics without exposing arbitrary causes.

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
External-owned mode rejects value policy and persists only Picodash metadata. Durable Picodash
metadata is always included. Encryption belongs in a custom synchronous driver.

```ts
persistence: {
  storageKey: 'picodash:application-controls',
  driver: webStorageDriver(localStorage),
  values: {
    defaultFieldPolicy: 'include',
    fields: {
      apiToken: 'omit',
    },
  },
}
```

| API/status                                          | Contract | Implementation | Notes                                       |
| --------------------------------------------------- | -------- | -------------- | ------------------------------------------- |
| Synchronous hydration                               | Accepted | Prototype      | No async core hydration.                    |
| One versioned root envelope                         | Accepted | Planned        | Values included only in Store mode.         |
| `persistence.getState()`                            | Accepted | Planned        | Immutable revision and operational status.  |
| `persistence.subscribe(listener)`                   | Accepted | Planned        | Separate from value subscriptions.          |
| `persistence.flush()`                               | Accepted | Planned        | Retries pending I/O; never conflicts.       |
| `persistence.createConflictResolutionPlan(options)` | Accepted | Planned        | Reload, overwrite, or reconcile.            |
| `persistence.executeConflictResolution(plan)`       | Accepted | Planned        | Rechecks revision and plan fingerprint.     |
| `persistence.createErasePlan()`                     | Accepted | Planned        | Previews Picodash-owned data removal.       |
| `persistence.executeErase(plan, { confirm: true })` | Accepted | Planned        | Rechecks, resets, and removes the envelope. |

```ts
type PicodashPersistenceState = {
  status: 'clean' | 'pending' | 'error' | 'conflict'
  durableRevision: number | null
  liveRevision: number
  hasPendingEnvelope: boolean
  lastError?: PicodashDiagnostic
  conflict?: PicodashPersistenceConflict
}
```

State never exposes serialized envelopes or omitted values. An error retains a pending envelope;
conflict data contains safe revision and writer metadata for both sides. Confirmed durability
returns the state to `clean`.

Persistence uses deterministic serialization, revision/writer detection, and no silent
last-write-wins. A write failure leaves valid live state in memory and retains the latest complete
pending envelope. Reload adopts a validated persisted envelope; overwrite writes the latest valid
live state as a new revision; reconcile requires an application-provided complete candidate derived
from cloned local and persisted states.

Two live roots cannot own the same driver identity and `storageKey` in one realm. After a foreign
revision conflict, valid live transactions continue and replace the local pending envelope, report
`persistence: 'pending'`, and never overwrite storage until explicit resolution.

Erase is an explicit dangerous operation. Store-owned mode resets values to the validated baseline
and clears Picodash metadata and interaction state; external-owned mode leaves host values untouched.
Execution refuses unresolved conflicts, removes the persisted envelope, and leaves active
registrations on declarative defaults without creating a durable record. A later mutation may
persist a new envelope.

## Export

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

## Schema migration

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

| API                                          | Contract | Implementation | Notes                                      |
| -------------------------------------------- | -------- | -------------- | ------------------------------------------ |
| `root.destroy()`                             | Accepted | Planned        | Refuses any active lease or unsaved state. |
| `root.destroy({ discardUnpersisted: true })` | Accepted | Planned        | Explicitly destructive escape hatch.       |

Provider unmount never destroys an application-supplied root. All handles reject use after root
destruction. Root destruction never deletes the durable envelope. `discardUnpersisted` discards only
a pending in-memory write and never bypasses live-lease refusal; persisted-data removal uses the
explicit persistence erase plan first.

## Declarative integration surface

`@picodash/store/integration` is a supported low-level entry for DashPanel, DashList, and authors of
another declarative UI product. Ordinary applications use the root and React entries instead.

```ts
acquireProviderLease(...)
acquireEntityLease(...)
acquireRelationshipLease(...)
acquireBindingLease(...) // returns a BindingHandle
```

The entry also owns the shared Store boundary protocol consumed by the UI packages. Acquisition
happens only after a render commits. Leases have a unique generation and idempotent `release()`;
release is lifecycle teardown, not an application deregistration command. Abandoned renders acquire
nothing, and Strict Mode reacquisition reruns identity and graph checks.

> Contract: Accepted
> Implementation: Planned

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

| API                             | Contract | Implementation | Notes                                    |
| ------------------------------- | -------- | -------------- | ---------------------------------------- |
| Contextual Store hooks          | Accepted | Planned        | Nearest root/scoped context semantics.   |
| Explicit Store selector         | Accepted | Prototype      | Retained and generalized.                |
| Root/scope contextual selectors | Accepted | Planned        | Avoid union-state selector inference.    |
| Optional equality function      | Accepted | Planned        | Defaults to `Object.is`.                 |
| `shallowEqual`                  | Accepted | Planned        | Opt-in helper; no default deep equality. |

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
