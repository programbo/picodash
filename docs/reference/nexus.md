# Nexus target reference

Nexus is a typed state foundation for configurable React interfaces. This page describes the target
contracts for `@picodash/nexus`, `@picodash/nexus/react`, and the advanced integration entry; it does
not claim that the prototype currently exports every API shown here.

## Status

> Contract: Accepted target API
> Implementation: Partial
> Evidence: Nexus beta is verified for consumer dogfooding; see the [conformance matrix](contract-conformance.md).

The verified beta slice adds populated binding interaction, conflict and erase recovery, document
import/export, schema migration, metadata quarantine recovery, external-owned metadata persistence,
the optional Web Storage driver, reset/prune plans, and consumer/browser proof to the alpha
foundation. This target page remains Partial because broader runtime inspection and later
capability and product-owned UX contracts remain intentionally unfinished.

## Package surfaces

| Surface                       | Contract | Implementation | Purpose                                                                                                    |
| ----------------------------- | -------- | -------------- | ---------------------------------------------------------------------------------------------------------- |
| `@picodash/nexus`             | Accepted | Partial        | Framework-independent Nexus implementation                                                                 |
| `@picodash/nexus/react`       | Accepted | Verified       | Contextual Nexus hooks/selectors plus explicit selector and equality helpers                               |
| `@picodash/nexus/integration` | Accepted | Partial        | Provider/entity/relationship leases plus Provider-hosted and opted-in standalone DashList React boundaries |

The root entry loads without React. React is an optional package peer and is required only when the
`/react` or `/integration` entry is imported. The core bundle does not import React-specific Zustand
entrypoints.

## Create a root Nexus

```ts
const nexus = createPicodashNexus({
  nexusId: 'application-controls',
  schemaVersion: 1,
  valueOwner: 'nexus',
  fields: {
    theme: { defaultValue: 'system' },
    density: { defaultValue: 1 },
  },
})
```

| API                     | Contract | Implementation | Notes                                                                                                                                                                                   |
| ----------------------- | -------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createPicodashNexus()` | Accepted | Partial        | The beta configuration, scopes, manual synchronous adapter, persistence, migration, recovery, and document capabilities are implemented and verified; later target capabilities remain. |

Nexus construction is synchronous. Configuration that defines identity, schema, value authority,
persistence, or disclosure remains immutable for the root lifetime.

Every root has an automatically generated internal runtime identity. Public `nexusId` is optional
only for an ephemeral Nexus. Persistence, export, import, and schema migration require it;
`storageKey` cannot substitute for it.

`schemaVersion` is a positive safe integer. It is optional for an ephemeral Nexus and required for
`initialEnvelope`, persistence, documents, or configured migrations.
It cannot be supplied without `nexusId`; `nexusId` alone is allowed but does not enable documents.

Public identity strings are case-sensitive, opaque, non-empty, trimmed, and control-character-free;
punctuation such as slashes, dots, and colons has no hierarchy semantics. Field keys also reject
`__proto__`, `prototype`, and `constructor`. `storageKey` is only a driver locator, not Nexus
identity.

### Nexus-owned configuration

```ts
type NexusOwnedConfig<Fields> = {
  nexusId?: string
  schemaVersion?: number
  valueOwner: 'nexus'
  fields: Fields
  initialValues?: Partial<ValuesOf<Fields>>
  initialEnvelope?: PicodashEnvelopeInput
  validateValues?: ValuesValidator<ValuesOf<Fields>>
  adapter?: never
  persistence?: NexusOwnedPersistenceConfig<Fields>
  export?: ExportConfig<Fields>
  migrations?: SchemaMigrations
}
```

### External-owned configuration

```ts
type ExternalOwnedConfig<Fields> = {
  nexusId?: string
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
> Notes: Capability-specific TypeScript variants make `nexusId` and `schemaVersion` required
> whenever `initialEnvelope`, persistence, export, or migrations are configured.

`initialEnvelope` provides synchronous driver-free hydration for request-local server Nexuses. If a
driver is also configured, its record must be absent or match the envelope identity, revision, and
deterministic content fingerprint; disagreement throws during construction.

External-owned metadata persistence, documents, and migrations are verified beta capabilities.
Nexus-owned and external-owned envelope branches are defined below.

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
const nexus = createPicodashNexus({
  nexusId: 'render-settings',
  schemaVersion: 1,
  valueOwner: 'nexus',
  fields: {
    exposure: {
      defaultValue: 1,
      parse: (input) => parseExposure(input),
      schema: z.number().min(0).max(10),
      validate: (value, context) => validateExposure(value, context.values),
    },
  },
})

const exposure = nexus.fields.exposure
```

Consumer components may constrain a field by its selected value without knowing the Nexus's full
field record:

```ts
type NumericField = PicodashFieldOf<number>
type NumericRangeField = PicodashExactFieldOf<{
  readonly start: number
  readonly end: number
}>
```

`PicodashFieldOf<Value>` accepts a nominal Nexus field whose value is assignable to `Value`.
`PicodashExactFieldOf<Value>` is for compound contracts that must not accept additional, missing, or
narrower members. Both are type-only consumer views: they preserve Nexus ownership and add no
runtime properties, validation, parsing, or mutation authority. Runtime field handles remain frozen
objects containing only their enumerable `key`.

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

| Behavior                    | Contract | Implementation | Notes                                                             |
| --------------------------- | -------- | -------------- | ----------------------------------------------------------------- |
| Stable typed field handles  | Accepted | Implemented    | Nominal key-only handles include assignable and exact type views. |
| Immutable field set         | Accepted | Implemented    | Runtime field registration is rejected.                           |
| `parse` raw-input stage     | Accepted | Verified       | Binding input executes the typed parse/schema/validate pipeline.  |
| Standard Schema `schema`    | Accepted | Implemented    | Canonicalizes and drives inferred output type.                    |
| Contextual `validate` stage | Accepted | Implemented    | Accepts or rejects; cannot transform.                             |
| Synchronous pipeline        | Accepted | Implemented    | Promise-like results are rejected.                                |
| Root ownership checks       | Accepted | Implemented    | Same-key handles from another root throw.                         |

Interactive binding input uses `parse → schema → validate`. Programmatic values, defaults,
`initialValues`, adapter snapshots, persisted values, imports, and migration output use
`schema → validate` and never invoke the UI parser. Failures normalize into package-owned structured
issues and do not expose raw values or arbitrary causes by default.

Parser success returns one candidate. Failure returns a non-empty structured issue list and may
offer one repair candidate. Field `validate` returns a structured issue array; an empty array accepts
the canonical value. `validateValues` uses the same array rule with canonical absolute paths.
Callback exceptions normalize to stage-specific issues without their cause, while promise-like
results are contract violations. Context contains the immutable complete candidate, relevant field,
operation source, and scope attribution—not a mutable Nexus reference.

A parser may propose one repair for rejected binding input. After the remaining validation stages
accept that proposal, the failed transaction includes an opaque nominal `PicodashRepairPlan`.
`nexus.executeRepair(plan)` revalidates and commits it atomically. Plans are root-owned, single-use,
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
prototype presentation helpers are not target Nexus exports.

## Root and scoped Nexuses

```ts
const settings = nexus.scope('settings')
const basic = settings.scope('basic')

settings.kind // 'scoped'
settings.scopeId // 'settings'
settings.root === nexus // true
```

| API                       | Contract | Implementation | Notes                                                             |
| ------------------------- | -------- | -------------- | ----------------------------------------------------------------- |
| `root.scope(scopeId)`     | Accepted | Verified       | Canonical weakly cached scoped view with exact invalid-ID errors. |
| `scoped.scope(scopeId)`   | Accepted | Verified       | Resolves through the same root.                                   |
| `scoped.root`             | Accepted | Verified       | Explicit access to the root Nexus.                                |
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

The scope/value/lifecycle additions to the two Nexus interfaces are:

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
types are identical on both interfaces. `scoped.fields` is
the same object as `scoped.root.fields`; `scoped.scope(id)` resolves through that root. A scoped
value write supplies `originScopeId: scoped.scopeId` to validation and external-adapter context but
still returns `changedScopeIds: []` for a value-only success.

A non-persistent configuration instantiates `RootNexus<Fields, CoreTransactionResult>` and its
scoped views preserve that result type. A persistence-enabled configuration instantiates
`RootNexus<Fields, PersistentTransactionResult>` and preserves that type through `.scope()` and
`.root`. Every safe value, metadata, and scope-destruction command returns the configuration's
`Result`; every matching `*OrThrow` command returns `Extract<Result, { readonly ok: true }>`. Root
`destroy()` remains `void` because it is lifecycle teardown rather than a transaction.

While referenced, a root and scope-ID pair resolves the same canonical scoped object. The root holds
views weakly, so a collected view may later be recreated. `ScopedNexus` has no `release()`,
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
type RootNexusSnapshot<Values> = {
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

type ScopedNexusSnapshot<Values extends object> = {
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
> Implementation: Verified for the beta interaction slice
> Notes: Root and scoped snapshots include populated binding interaction, input commands, stale
> conflict plans, lease cleanup, and the stable empty interaction singleton. The metadata record codec and scoped metadata
> commands are implemented. Adapter and
> persistence status live on their configured capability namespaces rather than every ephemeral root snapshot.

Both snapshot types contain immutable data only. Commands live on the stable root or scoped Nexus
API, outside `getState()` and selector results. Zustand is an implementation detail, not a public
state-and-actions contract.

Snapshot and unchanged nested references remain `Object.is`-stable until a relevant semantic
change. Scoped `values` is the same record reference as root `values`; `scope` remains `undefined`
until durable metadata exists, and the empty interaction snapshot is reused.

Creating a view, mounting an entity, registering a relationship, attributing a value write, or
editing a binding does not create durable scope metadata. Only a durable override, import, or
hydration creates a `scopes` entry.

`DurableScopeMetadata` contains Nexus-owned, validated, versioned JSON records for the built-in
`dashPanel` and `dashList` metadata domains. Nexus does not import either UI package; those packages
own their public behavior types and translate through the integration entry. The alpha Nexus has no
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

Empty product records are omitted. The Nexus metadata codec validates complete records atomically,
detaches and freezes nested values, and translates maps through duplicate-checked entry arrays.
Focused evidence lives in [packages/nexus/tests/metadata.test.ts](../../packages/nexus/tests/metadata.test.ts).
`preferredPosition` contains finite CSS-pixel offsets from the effective boundary's top-left after
inset and before snap offset. Nexus validates the complete record atomically and does not import UI
package types.

A Panel record with an unknown position, invalid mode/disposition combination, or non-finite
coordinate enters the configured Nexus recovery path. A valid dock target that current Provider or
Panel policy disables remains durable and dormant; UI policy is not a Nexus codec error. Occupancy,
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

Every root and scoped Nexus has the readonly `diagnostics` property. Calling the namespace through
either surface reads and subscribes to the same root-wide diagnostic state, separately from
canonical value subscriptions. The namespace facade's object identity is not public; consumers do
not rely on `root.diagnostics === scoped.diagnostics`.

A future `inspectRuntime()` may return an immutable point-in-time view of Providers, entity leases,
bindings, and active relationships. It is not part of the alpha `PicodashDiagnostics` interface.
That future view defaults a scoped Nexus to its scope and requires an explicit option for a
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
`A Nexus subscriber threw.`; its wording may evolve without changing code, identity, or privacy. A
later dispatch for the same identity that completes without an exception removes it.
Diagnostics-subscriber failures are recorded after their current dispatch without recursively
notifying in that cycle.

`PicodashDiagnosticsState.current` uses the broad `PicodashDiagnostic` default. The core subscriber,
adapter-health, and persistence-failure conditions have exact named specializations in their owning
sections; persistence `lastError` uses its specialization. The generic shape represents future
capability diagnostics without requiring a closed union.

> Contract: Accepted
> Implementation: Partial
> Evidence: [diagnostics tests](../../packages/nexus/tests/diagnostics.test.ts) and [diagnostics type tests](../../packages/nexus/tests/diagnostics.types.test.ts) cover immutable snapshots, root-wide aggregation, recovery, privacy, reentrancy, and teardown.

## Optional capability namespaces

Ephemeral Nexuses expose only core values, scopes, transactions, and diagnostics. An identified Nexus
with both `nexusId` and `schemaVersion` additionally exposes document import operations.
Configuration adds further typed capabilities instead of methods that fail with “not configured.”

```ts
const ephemeral = createPicodashNexus({
  valueOwner: 'nexus',
  fields: {},
})

// TypeScript errors:
ephemeral.documents
ephemeral.persistence
```

```ts
const identified = createPicodashNexus({
  nexusId: 'settings',
  schemaVersion: 1,
  valueOwner: 'nexus',
  fields,
})

identified.documents.analyzeImport(document)

// TypeScript error until export policy is configured:
identified.documents.createExportPlan(...)
```

```ts
const durable = createPicodashNexus({
  nexusId: 'settings',
  schemaVersion: 1,
  valueOwner: 'nexus',
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
> Implementation: Verified for the beta capability set
> Notes: Export policy remains nested under `export: { documents, fields }`. Scoped views inherit
> enabled capabilities with scope-aware defaults. Future named capability families remain later work.

## Value operations

```ts
const result = nexus.setValues({
  exposure: 1.5,
  quality: 'final',
})

if (!result.ok) {
  report(result.error.issues)
}
```

| API                                  | Contract | Implementation | Notes                                                                                        |
| ------------------------------------ | -------- | -------------- | -------------------------------------------------------------------------------------------- |
| `setValue(field, value)`             | Accepted | Implemented    | Safe typed single-field transaction.                                                         |
| `setValueOrThrow(field, value)`      | Accepted | Implemented    | Throws the corresponding transaction error.                                                  |
| `setValues(values)`                  | Accepted | Implemented    | Safe typed partial-record atomic transaction.                                                |
| `setValuesOrThrow(values)`           | Accepted | Implemented    | Throws the corresponding transaction error.                                                  |
| `setInput(binding, input)`           | Accepted | Implemented    | BIND-INTERACTION-CONTRACT-1 generic-key interaction command.                                 |
| `executeRepair(plan)`                | Accepted | Implemented    | Single-use plan with validation source `repair`; BIND-INTERACTION-CONTRACT-1.                |
| `resetValue(field)`                  | Accepted | Implemented    | Safe reset to the configured default baseline; preserves the configured `Result`.            |
| `resetValueOrThrow(field)`           | Accepted | Implemented    | Throws the corresponding transaction error; successful calls return the configured `Result`. |
| `resetRegisteredValues(opts)`        | Accepted | Implemented    | Active scope values; optional descendants; covered by the registered-reset runtime matrix.   |
| `resetRegisteredValuesOrThrow(opts)` | Accepted | Implemented    | Throws the corresponding transaction error; preserves configured Result typing.              |
| `inspectRegisteredValueReset(opts)`  | Accepted | Implemented    | Read-only availability for the same active registrations and descendant target.              |
| `discardInput(binding)`              | Accepted | Implemented    | Clears one interaction entry and returns exact boolean.                                      |

The generic root and scoped reset methods are:

```ts
resetValue<Key extends keyof Fields & string>(field: FieldHandle<Fields, Key>): Result
resetValueOrThrow<Key extends keyof Fields & string>(
  field: FieldHandle<Fields, Key>,
): Extract<Result, { ok: true }>
```

Aggregate registered reset uses these exact public option types and methods:

```ts
type InvalidResetOptionsReason =
  | 'not-object'
  | 'unknown-key'
  | 'accessor-property'
  | 'invalid-include-descendants'

type ResetRegisteredValuesOptions = {
  readonly includeDescendants?: boolean
}

type RootResetRegisteredValuesOptions = ResetRegisteredValuesOptions & {
  readonly scopeId: string
}

root.resetRegisteredValues(options: RootResetRegisteredValuesOptions): Result
root.resetRegisteredValuesOrThrow(
  options: RootResetRegisteredValuesOptions,
): Extract<Result, { ok: true }>
scoped.resetRegisteredValues(options?: ResetRegisteredValuesOptions): Result
scoped.resetRegisteredValuesOrThrow(
  options?: ResetRegisteredValuesOptions,
): Extract<Result, { ok: true }>

type RegisteredValueResetInspection = {
  readonly registeredFields: readonly string[]
  readonly changedFields: readonly string[]
}

root.inspectRegisteredValueReset(
  options: RootResetRegisteredValuesOptions,
): RegisteredValueResetInspection
scoped.inspectRegisteredValueReset(
  options?: ResetRegisteredValuesOptions,
): RegisteredValueResetInspection
```

Options are exact own-key data records. The root object is required and accepts only `scopeId` and
`includeDescendants`; scoped options may be omitted and accept only `includeDescendants`.
Non-objects, unknown own string or symbol keys, and accessors are rejected before values are read.
Those failures and a non-boolean descendant option throw `invalid-reset-options` with exactly
`{ reason: InvalidResetOptionsReason }`. Structural option validation, including a present
`includeDescendants` boolean check, completes before root scope identity uses the ordinary
`invalid-scope-id` mapping, including a missing `scopeId`.

Both input and display binding leases establish active registered-field membership. The command
snapshots the selected scope and, when requested, its active descendants; sorts the target IDs;
deduplicates shared root fields; and validates one complete configured-default candidate with
source `reset`, never through a parser. A root call has no `originScopeId`; a scoped call uses its
receiver scope. Adapter `targetScopeIds` contains the complete sorted selected scope set.

Successful aggregate reset preserves the configured `Result`, reports only changed fields, and
keeps `changedScopeIds` empty. Empty and already-default selections perform no write or
notification, and rejection is atomic. The Nexus does not discard drafts: dirty bindings anywhere
on a changed shared field retain their input and become stale. DashList composes targeted draft
discard separately after successful canonical reset.

`inspectRegisteredValueReset` uses the same active binding registry, descendant graph, field
deduplication, configured default baseline, and current canonical values as the matching reset
command. It returns a deeply immutable record with sorted `registeredFields` and sorted
`changedFields`; it performs no candidate validation, notification, persistence, diagnostic
publication, draft access, or canonical mutation beyond the shared reset-option and lifecycle checks.

Scoped calls may write any root field and add `originScopeId` attribution. Operations that target
descendants deduplicate root fields before building one candidate snapshot.

Root writes omit `originScopeId`. Scoped writes pass the view's exact scope ID to field/root
validation and any external-adapter write context. Attribution never creates scope metadata or adds
the origin to `changedScopeIds`; all views observe the resulting canonical root value.

Unknown runtime batch keys return structured issues without mutation. Foreign field handles throw a
contract error. Empty and semantically unchanged batches succeed as no-ops without notification or
persistence work.

Programmatic setters do not alter binding interaction state. Their canonical changes may mark
existing drafts stale. `setInput` is safe-only: valid non-stale input commits and clears that
binding's draft; invalid non-stale input records a frozen raw JSON draft, touched state, and pipeline
issues. Root and scoped receivers use the binding handle's scope and identity, and any receiver from
the same root may invoke the command. The configured Nexus `Result` is preserved.

`setInput` accepts JSON-compatible input. Non-JSON input returns one identity-enriched `invalid_json`
issue and is a zero-interaction, zero-callback, zero-notification short-circuit. Retained drafts are
cloned and frozen. Non-JSON editing state remains component-local until the control can submit a JSON
candidate.

`resetValue(field)` and `resetValueOrThrow(field)` target the field's configured default baseline,
after schema and complete-record validation (never the parser); the baseline is not the initial,
hydrated, or current value. Root calls have no origin scope. Scoped calls use the receiver scope
for validation and adapter attribution. The adapter source is `reset`. Foreign handles throw a
contract error, and candidate rejection is atomic. Successful calls preserve the configured Nexus
`Result`, report only
the changed field with `changedScopeIds: []`, and persist the configured reset result. A semantic
no-op performs no notification or write. When changed, dirty bindings for that field become stale
without discarding drafts.

### BIND-INTERACTION-CONTRACT-1: frozen interaction behavior

The generic-key command surface is:

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

The Nexus-owned `stale_input` issue is exact:

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

`setInput` and `discardInput` accept only active binding handles with `mode: 'input'`. Passing an
active display handle throws `invalid-binding-handle` with exactly `{ reason: 'wrong-kind' }`; it
creates no interaction state and invokes no parser, validator, callback, subscriber, or notification.

Pipeline issues precede `stale_input` in returned failures. Stored `inputIssues` excludes
`stale_input`; it contains only parser/schema/field/root pipeline issues. A stale attempt replaces
the raw frozen draft and pipeline feedback while preserving the original base/conflict and never
committing. A valid stale attempt returns `stale_input` only. An authority rejection retains a valid
dirty non-stale draft. Canonical changes mark dirty bindings stale and invalidate earlier repair plans
with `stale_plan`.

| Current interaction           | Input / outcome     | Required transition                                                                                                                                                                         |
| ----------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Any                           | Non-JSON            | Identity-enriched `invalid_json`; no interaction, callback, subscriber, or notification                                                                                                     |
| None/clean or dirty non-stale | Pipeline rejection  | Replace raw frozen JSON draft and pipeline issues; first rejection captures current field revision/value as base; later rejection preserves original base; parser failure may return repair |
| None/clean or dirty non-stale | Accepted input      | Commit shared pipeline and clear interaction                                                                                                                                                |
| Dirty stale                   | Any attempt         | Replace draft and pipeline feedback; preserve base/conflict; never commit; append/return `stale_input`; no repair                                                                           |
| Dirty stale                   | Valid input         | Return `stale_input` only; preserve base/conflict; no repair                                                                                                                                |
| Dirty non-stale               | Authority rejection | Retain valid dirty draft, touched state, base, and non-stale state                                                                                                                          |

`discardInput(binding)` clears exactly one entry, prunes empty item/scope interaction maps, and
returns `true` iff that entry changed, otherwise exactly `false`. Parser repair exists only for
non-stale parser failure: the proposal is checked by schema, field, and root validation before an
opaque root-owned single-use plan is returned. `executeRepair(plan)` revalidates with validation
source `repair`, commits through the shared pipeline, and clears the originating interaction.
Wrong-root/kind, released, or consumed plans throw contract errors; changed captured state returns
`stale_plan`.

Stale-input overwrite is an implemented and verified command. Creation requires an active input
handle with a dirty stale draft and no `inputIssues`; handle misuse throws `invalid-binding-handle`.
`createStaleInputOverwritePlan<Key>(binding)` captures the exact binding generation/draft and the
current target-field revision/value without exposing them. Any same-root root or scoped receiver may
execute it; the handle scope controls attribution, and an unrelated field change alone does not
stale the plan. Creation state failure throws `invalid-stale-input-overwrite` with exactly
`{ reason: 'not-stale' | 'invalid-draft' }`.

The first valid execution attempt consumes the plan, including stale-plan, validation, or authority
failure. Draft replacement/discard or target revision change returns `stale_plan`; released or
replaced generations are lifecycle errors. Execution reruns parse → schema → field → root with
validation and adapter source `interactive` plus binding origin. It never returns `stale_input` or a
repair offer. Failure preserves stale interaction. Success coalesces commit and origin cleanup,
marks other dirty bindings for the field stale, and preserves configured `Result`/persistence.
Semantic no-op clears origin and notifies only the target scope; changed commit notifies canonical
observers once with cleanup visible.

Conformance evidence must cover root/scoped receivers, input/display mode rejection, configured
Result preservation, all transition rows, callback/notification suppression, exact issue shape/order,
repair and overwrite plan freshness/consumption, reset baseline/no-op/atomicity, notification
coalescing, and pruning. It must exclude raw non-JSON input, arbitrary callback causes, captured
plan values/revisions/fingerprints, and other undisclosed values.

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

The Nexus configuration determines the result type. A Nexus without persistence returns the core
result and has no persistence property. A persistence-enabled Nexus returns the persistent result.
For externally owned values, that result covers only Picodash metadata persistence; it does not
claim the host application persisted its values. Ongoing persistence errors and conflicts are read
from `nexus.persistence.getState()`.

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

For Nexus alpha, `PicodashContractErrorCode` includes `invalid-scope-id`,
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

Standard Schema and field-validator paths are relative inputs that the Nexus prefixes. The
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
or `instanceof` behavior. Construction is all-or-nothing; no partially active Nexus is returned.

All opaque plans and handles use consistent ownership rules: wrong-root, wrong-kind, released, or
already-consumed objects throw a contract error; a valid object whose captured state changed returns
a safe `stale_plan` issue.

`invalid_metadata` is a Nexus-owned `PicodashIssueCode`. Built-in metadata commands use it for safe
candidate rejection with canonical paths rooted at `['scopes', scopeId]`; they never include the
rejected value or codec cause. An invalid command target is instead an `invalid-scope-id` contract
error before metadata validation. That error's context is exactly
`{ reason: InvalidScopeIdReason }` and never contains the rejected ID.

## Bindings and interaction state

Binding interaction identity is `(scopeId, itemId, alias)`. Alias defaults to the field key and must
be explicit when one item binds the same field more than once.

The integration entry exports `acquireBindingLease(scopedStore, options)`, where options require
`itemId`, a root-owned nominal `field`, and explicit `mode: 'input' | 'display'`; `alias` defaults
to `field.key`. The returned `BindingHandle` exposes read-only `scopeId`, `itemId`, `alias`,
`field`, `mode`, and idempotent `release()`. Binding acquisition does not require an EntityLease.
Options are validated as an exact data record before field ownership or duplicate lookup. Failures
use `invalid-binding-options` with one of `not-object`, `unknown-key`, `accessor-property`,
`invalid-item-id`, `invalid-alias`, or `invalid-mode`; foreign fields use `foreign-handle`, and a
live duplicate tuple uses `duplicate-binding` with `{ scopeId, itemId, alias }`.

Commands receive an opaque nominal `BindingHandle` issued by the active registration. It is owned
by one root Nexus and one registration generation, exposes read-only identity for reporting, and is
not serializable. Foreign, released, and superseded handles throw contract errors. Remounting the
same identity tuple issues a new generation.

| Capability                               | Contract | Implementation | Notes                                                                                    |
| ---------------------------------------- | -------- | -------------- | ---------------------------------------------------------------------------------------- |
| Binding draft/input                      | Accepted | Verified       | Moves to scope/item/alias identity.                                                      |
| Touched and input issues                 | Accepted | Verified       | Cleared on final binding unmount.                                                        |
| Stale-draft detection                    | Accepted | Verified       | Records field base revision/value.                                                       |
| `discardInput(binding)`                  | Accepted | Verified       | Clears one draft immediately.                                                            |
| `createStaleInputOverwritePlan(binding)` | Accepted | Verified       | Opaque root-owned single-use plan; active stale input only, no exposed values/revisions. |
| `executeStaleInputOverwrite(plan)`       | Accepted | Verified       | Same-root receiver; interactive revalidation, stale-plan fencing, and coalesced cleanup. |
| Generic rebase                           | Deferred | —              | Requires explicit field merge semantics.                                                 |

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

| Additional API       | Contract | Implementation | Notes                                                                                     |
| -------------------- | -------- | -------------- | ----------------------------------------------------------------------------------------- |
| `createPrunePlan()`  | Accepted | Partial        | Nexus review and executable plans are implemented; DashList dogfood remains pending.      |
| `executePrunePlan()` | Accepted | Partial        | Explicit node selection or known inventory; Nexus lifecycle/plan evidence is implemented. |
| `renameScope()`      | Deferred | —              | Use schema migration before activation.                                                   |

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

`updateDashListCollapseOverrides` validates the complete readonly tuple array before applying any
entry. Each node ID may occur once; a boolean stores an explicit collapse override and `null`
removes it. Entries apply in array order, while root order, group orders, unrelated collapse
overrides, and dormant node metadata remain unchanged. The whole batch is one metadata transaction:
malformed IDs, tuple shapes, value types, or duplicate IDs return `invalid_metadata` without
mutation, and an empty or semantic no-op batch succeeds without notification. Empty DashList and
scope records are normalized away exactly like the individual metadata commands.

`destroyScope` clears durable metadata and ephemeral interaction but not canonical values,
registrations, relationships, or leases. Omitted `includeDescendants` targets only the explicit
scope; `true` traverses relationships active at operation time. The complete target set is validated
before mutation. Changed scope IDs include only targets whose state changed. Missing state is a
successful no-op. Option validation uses the exact mapping above. Active components return to
declarative defaults without persisting an empty record; a later durable operation may create one.

> Implementation: Verified for the alpha slice — [scope metadata and destruction tests](../../packages/nexus/tests/scope-metadata.test.ts) and [integration traversal tests](../../packages/nexus/tests/integration.test.ts).

Scoped prune-plan creation targets that view's DashList metadata; root creation requires `scopeId`.
`DASHLIST-NODE-LEASE-1` supplies active presence through committed, release-only
`acquireDashListNodeLease(scopedStore, { nodeId })` handles from `@picodash/nexus/integration`.
Identity is `(scopeId, nodeId)`; duplicate active identities throw `duplicate-dash-list-node`.
Exact option failures throw `invalid-dash-list-node-options`. The lease has no kind, containment,
entity dependency, query API, snapshot state, or persistence representation.

`createPrunePlan()` supports three exact modes: `review`; `explicit` with duplicate-free,
disjoint `removeNodeIds` and `keepNodeIds` that exactly partition current candidates; and
`inventory` with authoritative `knownNodeIds` that must include every active node. Root options
also require `scopeId`; scoped operations infer their scope. Review returns an immutable
`DashListPruneReview`; classified modes return an opaque `PicodashDashListPrunePlan`.

Candidates are metadata-referenced IDs from root order, group-order owners and entries, and collapse
overrides, excluding active nodes. Candidate effects identify
`root-order-entry | group-order-owner | group-order-entry | collapse-override`, making deletion of a
removed group's saved child order explicit. Invalid exact records, modes, ID arrays, partitions, or
inventories throw `invalid-prune-options` with only a safe reason.

Executable plans are root-owned and single-use. Misuse throws `invalid-prune-plan` with only
`wrong-kind | foreign-root | consumed`. Target DashList metadata or active-membership changes return
the safe `stale_plan` issue; unrelated values, bindings, relationships, and other scopes do not.
Execution removes only the classified metadata references and prunes empty records. It never changes
canonical values, drafts, bindings, relationships, active leases, or another scope.

DashList presents `resetRegisteredValues()` as `Reset values…` and `resetDashListMetadata()` as
`Reset list…`. These remain separate actions: the former composes canonical registered-value reset
with targeted draft discard after success, while the latter resets order and group-collapse
overrides without changing values.

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
> Implementation: Verified for the synchronous manual adapter slice — [adapter behavior tests](../../packages/nexus/tests/adapter.test.ts), [adapter type tests](../../packages/nexus/tests/adapter.types.test.ts), and [adapter fixture harness](../../packages/nexus/tests/support/external-adapter.ts).

The adapter snapshot is a complete projection of Picodash fields, not the host's whole application
state. The adapter is immutable and root-only. The API has no adapter `id`, boolean write result,
`previousValues` alias, or React-generated adapter. Convenience adapters for state libraries may
ship separately without changing Nexus authority.

`getSnapshot()` returns a complete immutable projection with stable reference identity until a
semantic change. `subscribe()` uses a no-argument listener and idempotent teardown. The adapter and
its callback identities remain stable for the root lifetime. Picodash clones validated data and
never retains mutable host references.

Activation is ordered `read and validate -> subscribe -> reread and validate`. If failure occurs
after subscription, Nexus calls the returned teardown exactly once before construction throws. A
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

Synchronous adapter notifications caused by Nexus's own whole-record write are coalesced as an
internal echo. Nexus validates the post-write projection once and publishes at most one completed
Nexus notification. Metadata commands remain usable while adapter values are unhealthy because
they do not cross value authority. External-owned `initialEnvelope` data may contain Picodash
metadata but must not contain canonical values.

## Persistence

> Contract: Accepted
>
> Implementation: Verified for the beta slice — [Nexus-owned persistence tests](../../packages/nexus/tests/persistence.test.ts), [external-owned integration tests](../../packages/nexus/tests/external-persistence.test.ts), [external persistence controller tests](../../packages/nexus/tests/external-persistence-controller.test.ts), [persistence type tests](../../packages/nexus/tests/persistence.types.test.ts), [adapter/configuration type tests](../../packages/nexus/tests/adapter.types.test.ts), [Web Storage tests](../../packages/nexus/tests/web-storage.test.ts), [Web Storage type tests](../../packages/nexus/tests/web-storage.types.test.ts), and [memory persistence harness](../../packages/nexus/tests/support/memory-persistence.ts).

The Nexus-owned persistence capability persists the disclosed canonical value projection and all
durable Picodash scope metadata. External-owned persistence stores metadata only. Conflict and erase
plans, migration/quarantine recovery, document integration, and the optional Web Storage driver are
verified in the beta slice.

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
mutation. Optional subscriptions carry no payload and only signal that Nexus must reread and
validate. Automatic persistence never calls `remove`; only a confirmed erase plan may do so. Driver failures are normalized without retaining causes,
messages, or stacks.

```ts
type NexusOwnedPersistenceConfig<Fields> = {
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

Nexus-owned mode requires an explicit value default and permits overrides only for declared fields.
Durable Picodash metadata is always included. Encryption belongs in a custom synchronous driver.
`ExternalOwnedPersistenceConfig` enables metadata-only persistence without changing value authority.

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

| API/status                                          | Contract | Implementation | Notes                                                                                                            |
| --------------------------------------------------- | -------- | -------------- | ---------------------------------------------------------------------------------------------------------------- |
| Synchronous hydration                               | Accepted | Verified       | Nexus-owned/external-owned driver and driver-free initial-envelope paths are covered.                            |
| One versioned root envelope                         | Accepted | Verified       | Deterministic authority-specific encoding, disclosure, durable metadata, migration, and quarantine are covered.  |
| `persistence.getState()`                            | Accepted | Verified       | Exact immutable discriminated state is covered by runtime and type tests.                                        |
| `persistence.subscribe(listener)`                   | Accepted | Verified       | Capability subscriptions and shared diagnostics dispatch are covered.                                            |
| `persistence.flush()`                               | Accepted | Verified       | Pending retry and conflict refusal behavior are covered.                                                         |
| `persistence.createConflictResolutionPlan(options)` | Accepted | Verified       | Nominal, root-owned, single-use reload/overwrite/reconcile plans with exact option and freshness checks.         |
| `persistence.executeConflictResolution(plan)`       | Accepted | Verified       | Deterministic merge, reread/write/verification fencing, atomic live commit, and safe failure issues are covered. |
| `persistence.createErasePlan()`                     | Accepted | Verified       | Captures the exact durable target and pending-discard decision for a single-use erase plan.                      |
| `persistence.executeErase(plan, { confirm: true })` | Accepted | Verified       | Confirmed remove plus null verification clears persistence state without changing live values or metadata.       |

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

Alpha produces and accepts only the `nexus` branch; the `external` branch reserves the future
authority distinction. `revision` is a positive safe integer. `writerId` is an opaque, trimmed,
control-character-free root writer identity. A Nexus-owned envelope always has `values`, including
an empty record when policy omits all fields, and contains the complete disclosed projection.
Omitted fields hydrate from the current validated baseline. `scopes` contains every durable
metadata record as sorted, duplicate-free entry tuples; metadata maps retain their existing sorted,
duplicate-checked serialized tuple form.

The decoder requires exact keys, strict JSON-compatible data, matching Nexus identity and schema,
the accepted authority branch, known persisted field keys, and valid complete scope metadata. Alpha
rejects an incompatible envelope as a whole; it does not partially hydrate, quarantine, migrate, or
repair.

Serialization is deterministic: object keys are lexically sorted recursively, arrays preserve
order, metadata entries are sorted, finite numbers are required, and negative zero becomes zero.
Hydration-source comparison checks Nexus identity and revision separately. Its internal content
fingerprint covers normalized `schemaVersion`, `valueOwner`, `values`, and `scopes`; it excludes
`revision` and `writerId` and never appears in public state or diagnostics.

### Construction and hydration

Server Nexuses are request-local and may use `initialEnvelope` without a driver. The input is cloned
and never retained. Construction follows these exact cases:

- No driver record and no initial envelope uses the validated baseline and performs no write.
- An initial envelope without persistence hydrates synchronously and adds no persistence capability.
- A valid driver record hydrates before Nexus activation.
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
or arbitrary cause. A durability failure never rolls back valid live state. Nexus retains the
newest complete normalized pending envelope, exposes the diagnostic above, and replaces obsolete
pending data after each later persistable commit. A rejected candidate changes neither live state
nor the pending envelope.

For a successful transaction, `persistence: 'unchanged'` means its persisted projection did not
change and performs no retry, including for semantic no-ops and omitted-field-only changes.
`persistence: 'saved'` requires exact post-write verification. `persistence: 'pending'` means the
live commit succeeded but its newest envelope remains undurable. An older pending condition that an
unchanged transaction did not affect is reported by capability state, not that transaction result.

Before every automatic write, Nexus rereads and compares the last confirmed revision, writer, and
content. A valid foreign envelope or removal enters `conflict` before any write. After a write,
Nexus rereads and accepts durability only on an exact canonical match. Synchronous notifications
caused by Nexus's write are coalesced into that verification cycle. Once conflicted, valid
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
browser Web Storage seam. These additions preserve the original envelope and state signatures and
do not introduce automatic last-write-wins.

### Beta conflict recovery and erase

```ts
type PersistenceConflictResolutionOptions =
  | { readonly mode: 'reload' }
  | { readonly mode: 'overwrite' }
  | { readonly mode: 'reconcile'; readonly onOverlap: 'local' | 'durable' }

interface PicodashPersistence {
  createConflictResolutionPlan(
    options: PersistenceConflictResolutionOptions,
  ): PicodashPersistenceConflictResolutionPlan
  executeConflictResolution(
    plan: PicodashPersistenceConflictResolutionPlan,
  ): PersistentTransactionResult
  createErasePlan(): PicodashPersistenceErasePlan
  executeErase(
    plan: PicodashPersistenceErasePlan,
    options: { readonly confirm: true },
  ): PersistenceEraseResult
}
```

> Contract: Accepted
> Implementation: Verified — [persistence tests](../../packages/nexus/tests/persistence.test.ts) and [persistence type tests](../../packages/nexus/tests/persistence.types.test.ts).

`reload` accepts the currently observed durable persisted fields and complete scope records while
leaving policy-omitted fields live. `overwrite` writes the complete local pending projection.
`reconcile` three-way merges against the last confirmed projection: a one-sided change wins, equal
changes coalesce, and differing two-sided changes use the required `onOverlap`. Fields merge
individually; a complete scope record, including quarantined raw metadata, is one merge unit. A
foreign removal supplies baseline persisted fields and empty durable scope metadata as its side.

Plans are nominal, root-owned, single-use, and consumed on the first otherwise-valid execution,
including stale, validation, or driver failure. Their freshness includes the conflict/base, exact
durable observation, current persisted projection, and quarantined records; erase also fingerprints
whether pending data will be discarded. A changed fingerprint returns `stale_plan` with message
`Persistence plan is stale.` Policy-omitted fields, drafts, interaction, leases, and unrelated
diagnostics do not stale plans.

Exact malformed-option reasons are `not-object`, `unknown-key`, `accessor-property`, `invalid-mode`,
and `invalid-overlap` for conflict options, and `not-object`, `unknown-key`, `accessor-property`, and
`confirmation-required` for erase confirmation. Plan misuse reports only kind plus
`wrong-kind`, `foreign-root`, or `consumed`; creating a conflict plan outside conflict reports
`not-conflicted`.

Conflict execution rereads the captured durable target. Reload writes nothing; overwrite and
nontrivial reconcile write a monotonic revision and require exact reread verification before any
live reload/reconcile commit. Candidate, write, or verification failure leaves live state unchanged
and conflicted. Success ends clean with no pending envelope and publishes at most one final Nexus and
capability transition.

Confirmed erase rereads the captured target, removes it once, requires a `null` reread, and only then
clears conflict/error/pending state. It deliberately discards the in-memory pending envelope but
never resets live values or scope metadata. Removal failure retains prior state and uses only safe
`remove-failed` or `remove-verification-failed` diagnostics.

### External-owned metadata persistence

> Contract: Accepted
> Implementation: Verified — [external-owned integration tests](../../packages/nexus/tests/external-persistence.test.ts), [controller tests](../../packages/nexus/tests/external-persistence-controller.test.ts), and [configuration type tests](../../packages/nexus/tests/adapter.types.test.ts).

An identified external-owned Nexus may persist Picodash scope metadata while its adapter remains the
sole value authority. Its configuration has only `storageKey` and `driver`; any own `values`
property is invalid. External envelopes use `valueOwner: 'external'`, contain scopes, and omit
`values`. Value-only commands report unchanged durability and perform no driver I/O.

The root and every scope share the existing persistence capability. Hydration, conflicts,
reload/overwrite/reconcile, quarantine replacement, and erase operate on metadata only and never
recover adapter values. Migration receives an empty value record and must return it empty. Adapter
health does not block metadata persistence, and persistence recovery never writes the adapter.

### Web Storage driver

> Contract: Accepted
> Implementation: Verified — [Web Storage tests](../../packages/nexus/tests/web-storage.test.ts), [Web Storage type tests](../../packages/nexus/tests/web-storage.types.test.ts), and [package artifact checks](../../packages/nexus/tests/package-artifacts.mjs).

`@picodash/nexus/web-storage` exports `createWebStoragePersistenceDriver(source)`, where callers
explicitly choose `'local'`, `'session'`, or a supplied structural `PicodashWebStorage`. The root
Nexus entry does not reference browser globals.

Creating the helper performs no probe or mutation. Named storage is resolved on first use and fails
safely when unavailable. Wrappers for the same current-realm Storage object share identity. Native
storage events notify only for the selected backend and matching key or a `null` clear event;
same-document events are not synthesized. Supplied non-browser backends work during SSR and have no
implicit subscription. Strings pass through unchanged under the Nexus's existing persistence error
and verification rules.

## Export

Export and import are verified beta document capabilities, separate from persistence.

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
keys and promotion on another default fail Nexus construction.

Nexus document APIs exchange immutable JSON-compatible objects. `executeExport()` returns a
`PicodashDocument`; `analyzeImport()` accepts parsed unknown data. The core package does not own
filenames, downloads, clipboard access, MIME types, or JSON/YAML text parsing. Those concerns belong
to the consuming product or a future dedicated codec entry.

| API                                       | Contract | Implementation | Notes                                                        |
| ----------------------------------------- | -------- | -------------- | ------------------------------------------------------------ |
| `documents.createExportPlan(options)`     | Accepted | Verified       | Target plan is value-free, root-bound, and freshness-fenced. |
| `documents.executeExport(plan, options?)` | Accepted | Verified       | Explicit single-use disclosure promotion confirmation.       |
| Scoped document export                    | Accepted | Verified       | Active registered fields, descendants, and durable metadata. |

Hard-omitted fields leave no entry. Redacted fields use a structured marker. Per-call selection can
narrow but not exceed immutable disclosure policy. Dormant scopes infer no registered fields.

Export plans are opaque, root-owned, single-use, and fingerprint relevant values, metadata,
registrations, policy, and the scope graph. When a plan contains promoted redacted fields, execution
requires `{ confirmRedactedPromotion: true }`; otherwise that option is omitted. Changed input
returns `stale_plan`, and consent is never remembered.

Documents declare `kind: 'root' | 'scope'`. Root Nexus methods default to a full-root document and
may explicitly target a scope. Scoped Nexus methods always target their own scope and cannot accept
another identity.

Per-call field selection uses nominal field handles. Scoped export may include active descendants or
explicitly narrow fields, but cannot target another scope. Root export may explicitly target a
scope. Every selection remains bounded by immutable policy.

## Import

| API                                 | Contract | Implementation | Notes                                                            |
| ----------------------------------- | -------- | -------------- | ---------------------------------------------------------------- |
| `documents.analyzeImport(document)` | Accepted | Verified       | Produces value-free target effects without mutation.             |
| `documents.executeImport(plan)`     | Accepted | Verified       | Revalidates and commits once across value/persistence authority. |
| `scopeMap`                          | Accepted | Verified       | Explicitly maps renamed descendants.                             |
| `createMissingScopes`               | Accepted | Verified       | Creates durable state, never registrations.                      |
| Foreign Nexus permission            | Accepted | Verified       | Required when source Nexus identity differs.                     |

```ts
documents.analyzeImport(document, {
  allowForeignNexus: true,
  scopeMap: { oldAdvanced: 'advanced' },
  fieldMap: {
    oldExposure: nexus.fields.exposure,
    retiredField: 'ignore',
  },
  createMissingScopes: true,
})
```

Redacted and absent values leave target values unchanged. Unknown or incompatible fields block the
commit unless an explicit mapping resolves them.

Target fields in `fieldMap` are nominal handles, not unchecked strings. Automatic same-key mapping
applies only to known compatible fields. The explicit `ignore` sentinel, foreign-Nexus permission,
scope remapping, and missing-scope creation are all reported by analysis for confirmation.

Import analysis returns an opaque, root-owned, single-use plan that fingerprints the document and
relevant target state. Execution rechecks document kind, mappings, target revisions, policy, and the
complete candidate. Root documents import only at root; scope documents target an explicit root
scope or the current scoped view. Kind mismatches are not projected implicitly.

### Version-one document contract

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
```

> Contract: Accepted
> Implementation: Verified — [document policy/codec tests](../../packages/nexus/tests/documents.test.ts), [Nexus integration tests](../../packages/nexus/tests/documents-integration.test.ts), [document type tests](../../packages/nexus/tests/documents.types.test.ts), [package artifact checks](../../packages/nexus/tests/package-artifacts.mjs), and the [Contract Lab browser/Bridge journey](../../apps/lab/tests/contract-lab.spec.ts).

Documents require exact strict-JSON shapes, sorted duplicate-free entries, and immutable detached
output. Import is overlay-only: included fields and present scope records replace mapped targets;
redacted, absent, and absent-scope entries leave target state unchanged. Imported metadata must be
valid; document import does not create hydration quarantine.

Root export defaults to all fields and durable scopes. Scoped export infers active input/display
binding fields and may follow active descendants. Explicit same-root nominal field handles replace
inference. Per-call policy can narrow disclosure; configured redacted promotion requires one-use
confirmation. Quarantined raw records are not exportable.

Import mapping runs after strict decode, redacted-entry removal, and schema migration. Field maps use
same-root nominal handles or `ignore`; scope maps use valid target IDs and reject duplicate targets.
A target scope exists only through durable/quarantined state or active runtime registrations/edges,
not from a scoped handle alone. Explicit `createMissingScopes` creates valid dormant metadata only.

Export/import plans expose sorted identities and effect classifications but no values, documents,
revisions, fingerprints, quarantine contents, or causes. They are nominal, root-owned, single-use,
and consumed on the first structurally valid execution attempt. Misuse reports only plan kind and
`wrong-kind`, `foreign-root`, `foreign-target`, or `consumed`. Stale execution returns the exact
messages `Export plan is stale.` or `Import plan is stale.`

Import validates one complete overlay with source `import`, never calls UI parsers, marks affected
drafts stale, and crosses adapter/persistence authority once without partial mutation. Core Nexus
owns object policy and execution only; filenames, text codecs, downloads, uploads, clipboard, and
dialogs remain consumer concerns.

## Beta schema migration

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

migrations: {
  1: document => migrateVersion1To2(document),
  2: document => migrateVersion2To3(document),
}
```

> Contract: Accepted
> Implementation: Verified for the beta slice — [migration/recovery tests](../../packages/nexus/tests/migration-recovery.test.ts), [document integration tests](../../packages/nexus/tests/documents-integration.test.ts), and the [Contract Lab browser/Bridge journey](../../apps/lab/tests/contract-lab.spec.ts).

Migration functions are synchronous, pure, and operate on cloned JSON. Hydration requires a complete
chain to the configured schema version and validates the final result before replacing persisted
state.

Each entry keyed by `N` must migrate the application payload from `N` to `N + 1`. The payload contains
permitted values and durable scope metadata, not Picodash format, Nexus identity, writer, or revision
headers. Skipped versions and mismatched returned versions fail. The same chain applies during
hydration and import; internal `formatVersion` migration remains Picodash-owned.

Each callback receives a detached, deeply frozen strict-JSON payload and must return an exact payload
at `N + 1`. Migration configuration rejects accessors, symbols, invalid numeric keys, non-functions,
and keys at or beyond the configured schema version. Initialization failure uses
`schema-migration-failed` with exactly `source-newer`, `missing-step`, `callback-threw`,
`async-result`, `invalid-result`, `wrong-version`, or `final-validation`; it never exposes callback
messages or payload data.

Hydration validates identity and authority and compares driver/initial sources before migration. It
then runs the complete chain, projects current fields while diagnosing ignored unknown fields,
validates the complete value candidate, independently decodes or quarantines each scope, and commits
once. Any migration or value failure commits nothing.

## Beta metadata quarantine and recovery

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

root.metadataRecovery satisfies PicodashMetadataRecovery<CoreTransactionResult>
root.metadataRecovery === root.scope('advanced').metadataRecovery
```

> Contract: Accepted
> Implementation: Verified for the beta slice — [migration/recovery tests](../../packages/nexus/tests/migration-recovery.test.ts), [external persistence tests](../../packages/nexus/tests/external-persistence.test.ts), [document integration tests](../../packages/nexus/tests/documents-integration.test.ts), and the [Contract Lab browser/Bridge journey](../../apps/lab/tests/contract-lab.spec.ts).

An invalid complete scope record is retained as detached immutable JSON while that scope uses current
defaults. Until deliberate replacement, ordinary durable metadata commands for the scope return
`quarantined_metadata` and mutate nothing. A valid replacement atomically installs the complete
record; `null` explicitly discards the raw record and restores defaults. Invalid replacement returns
`invalid_metadata` at `['scopes', scopeId]`. Replacing an unquarantined scope throws
`invalid-quarantine-replacement` with `{ reason: 'not-quarantined' }`.

Persistence re-emits quarantined raw records unchanged and includes them in conflict fingerprints.
Diagnostics reveal only the scope identity for `metadata_quarantined`, or `unknownFieldCount` for
`unknown_persisted_fields`; raw metadata and unknown field names remain private.

## Root destruction

```ts
type DestroyRootOptions = {
  readonly discardUnpersisted: true
}

root.destroy(options?: DestroyRootOptions): void
```

> Contract: Accepted
> Implementation: Partial

> Implementation evidence: [root lifecycle tests](../../packages/nexus/tests/root-lifecycle.test.ts), [kernel type tests](../../packages/nexus/tests/kernel.types.test.ts), [integration tests](../../packages/nexus/tests/integration.test.ts), and [package artifact checks](../../packages/nexus/tests/package-artifacts.mjs).

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
persistence authority. Nexus inspects live generations before releasing adapter subscriptions,
persistence subscriptions, or persistence ownership. This sequencing changes no public alpha API.

After success, every property access and method call on an existing root/scoped Nexus, diagnostics
namespace, or capability handle throws `use-after-destroy`; calling `destroy()` again does likewise.
Previously returned unsubscribe functions remain idempotent no-ops. Previously captured immutable
snapshots remain readable detached data. Field handles remain inspectable, but no destroyed Nexus
can use them.

## Declarative integration surface

`@picodash/nexus/integration` is a supported low-level entry for DashPanel, DashList, and authors of
another declarative UI product. Ordinary applications use the root and React entries instead.

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
operation is `release()`; callers never supply or reconstruct a lease ID. `providerId` defaults to
`default`. Provider acquisition accepts only a root Nexus, and entity acquisition accepts only a
scoped Nexus. A Provider-hosted root entity supplies its `ProviderLease`; a nested entity supplies
the nearest `EntityLease`. Only a standalone root DashList may omit `host`, in which case Nexus owns
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
Strict Mode reacquisition reruns all identity and graph checks. Binding leases are independent
scoped registrations and participate in root-destruction refusal.

The exact integration errors and complete safe contexts are:

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

`InvalidProviderIdReason` is the same lexical union as `InvalidScopeIdReason`. Error context never
contains a Nexus, handle, root runtime identity, host generation, rejected caller value, stack, or
arbitrary cause.

One module-private `WeakMap` resolves a root Nexus to its runtime controller. The integration entry
uses it for host and relationship generations, and `destroyScope()` uses the same controller for
active descendant traversal. It never appears on a root, scoped view, snapshot, document, persisted
envelope, or diagnostic.

> Contract: Accepted
> Implementation: Partial — [integration runtime tests](../../packages/nexus/tests/integration.test.ts), [declarative integration tests](../../packages/nexus/tests/declarative-integration.test.ts), [integration React tests](../../packages/nexus/tests/integration-react.test.tsx), [integration type tests](../../packages/nexus/tests/integration.types.test.ts), and [package artifact checks](../../packages/nexus/tests/package-artifacts.mjs). Provider-hosted and opted-in standalone DashList boundaries are implemented; broader runtime inspection remains planned.

### Active DashList orientation override

> Contract: Accepted
> Implementation: Planned

`@picodash/nexus/integration` exposes one narrow runtime channel for Picodash to coordinate a
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
  rootStore: RootNexus,
  options: {
    scopeId: string
    orientation: DashListOrientationOverride
  },
): DashListOrientationOverrideLease

declare function getDashListOrientationOverride(
  scopedStore: ScopedNexus,
): DashListOrientationOverride | undefined

declare function subscribeDashListOrientationOverride(
  scopedStore: ScopedNexus,
  listener: () => void,
): () => void
```

The API has these rules:

- It exists only on the integration entry. Ordinary applications use the public
  `DashList.orientation` prop; the initial Nexus API has no application command for setting this
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
- The runtime value is absent from `RootNexus.getState()` and `ScopedNexus.getState()`. It does not
  notify canonical-value, durable-metadata, or binding-interaction subscribers. DashList composes
  the getter and subscription internally; the foundational public component exposes no Nexus hook
  for this implementation channel.
- The value never enters `DashListMetadataRecord`, persistence, export, import, or migration. A
  future durable user orientation preference requires a separate product contract.

`DashListOrientationOverride` and DashList's public `DashListOrientation` are intentionally
structurally compatible literal unions. Nexus defines its integration type without importing the
DashList package.

## React boundaries and hooks

The integration entry exposes a Provider boundary and one entity boundary. They supply immutable
context during render but acquire and release Nexus leases only from committed effects:

```ts
interface PicodashNexusProviderBoundaryProps<
  Fields extends PicodashFieldDefinitions = PicodashFieldDefinitions,
  Result extends CoreTransactionResult = CoreTransactionResult,
> {
  children: ReactNode
  nexus: RootNexus<Fields, Result>
  providerId?: string
}

type PicodashNexusEntityBoundaryProps<
  Fields extends PicodashFieldDefinitions = PicodashFieldDefinitions,
  Result extends CoreTransactionResult = CoreTransactionResult,
> = Readonly<{
  children: ReactNode
  nexus: ScopedNexus<Fields, Result>
}> &
  ({ kind: 'dashPanel'; allowStandalone?: never } | { kind: 'dashList'; allowStandalone?: boolean })
```

`PicodashNexusProviderBoundary` resets inherited root and scope ancestry. An entity boundary always
requires a scoped Nexus. With inherited context it uses the nearest host, regardless of
`allowStandalone`; a different scope acquires the ordinary hosted relationship. Without context,
an unopted boundary (or any DashPanel boundary) throws `missing-nexus-context` with exactly
`{ required: 'root-or-scoped' }`. A rootless DashList opts into a private standalone host only when
`allowStandalone: true`; `false` and omission preserve the missing-context error. The standalone
host is constructed without leases, provides frozen root/scoped context during render, and mounts
the root DashList plus queued descendants only after commit. It releases descendants deepest-first
and leaves child declarations retryable if activation fails. A direct DashPanel child of the
standalone host fails with `invalid-integration-handle` `{ role: 'host', reason: 'wrong-kind' }`.

## React hooks

```ts
usePicodashNexus()                    // RootNexus | ScopedNexus
usePicodashNexus('settings')          // ScopedNexus
usePicodashRootNexus()                // RootNexus
usePicodashScope()                    // ScopedNexus or throws

usePicodashNexusSelector(nexus, selector, equalityFn?)
usePicodashRootSelector(selector, equalityFn?)
usePicodashScopeSelector(selector, equalityFn?)
```

| API                             | Contract | Implementation | Notes                                                                   |
| ------------------------------- | -------- | -------------- | ----------------------------------------------------------------------- |
| Contextual Nexus hooks          | Accepted | Verified       | Nearest root/scoped context semantics and exact missing-context errors. |
| Explicit Nexus selector         | Accepted | Verified       | Root or scoped Nexus; server/client snapshots use `getState()`.         |
| Root/scope contextual selectors | Accepted | Verified       | Root/scope selector context and equality delegation.                    |
| Optional equality function      | Accepted | Verified       | Defaults to `Object.is`; equal selections retain their reference.       |
| `shallowEqual`                  | Accepted | Verified       | One-level records and arrays/tuples only.                               |

Contextual hooks throw when their required boundary is absent. Passing a scope ID to
`usePicodashNexus` resolves a view from the nearest root without creating metadata or registering a
relationship. The explicit selector works without context. Selectors are pure, may run repeatedly,
and receive immutable data snapshots only. Server and client hooks use the same synchronous Nexus
snapshot contract.

## Trust boundary

A scoped Nexus is not a capability-limited Nexus. Any code with a root or scoped Nexus is trusted
to access every root field. Use separate roots and application-controlled adapters for untrusted or
separately permissioned plugins.

## Prototype reconciliation

The current package remains useful evidence, but these prototype surfaces do not define the target:

| Prototype surface                           | Target disposition                                      |
| ------------------------------------------- | ------------------------------------------------------- |
| Actions returned inside `getState()`        | Move to stable root/scoped Nexus APIs.                  |
| Per-Panel `panelId`/`scopeId` Nexus options | Replace with root identity plus canonical scoped views. |
| Standard Schema passed through `validate`   | Move to the dedicated `schema` stage.                   |
| `allowUnset` and unset field outputs        | Replace with explicit JSON optional values.             |
| Presentation compatibility exports          | Move presentation ownership to DashList/Dashlets.       |
| `PicodashPanel*` document functions/types   | Replace with the typed `documents` capability.          |
| Filename, MIME, and JSON/YAML codec helpers | Move to consuming products or a dedicated codec entry.  |
| Public item/order implementation helpers    | Move behind Nexus integration or DashList ownership.    |
| Standalone diagnostic channel construction  | Replace with the root `diagnostics` namespace.          |
| Hook-generated React state/reducer adapters | Defer; keep the manual adapter contract authoritative.  |
| Imperative registration and deregistration  | Replace with committed declarative leases.              |

Clean pre-v1 removal is preferred over compatibility aliases unless a later decision explicitly
requires them.

## Related documents

- [Nexus contract decisions](nexus-contract-decisions.md)
- [ADR 0002](../adr/0002-provider-level-nexus-and-scoped-views.md)
- [Documentation status](document-status.md)
- [Roadmap](../ROADMAP.md)
