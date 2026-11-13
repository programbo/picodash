# Nexus API inventory from source

This report inventories the API that `@picodash/nexus` exposes in the repository. It is a basis for
writing documentation from the implementation, independent of existing completion labels.

Audited on **2026-11-13**, against commit **`7141f010cec0d6b59f4ac94fb54e0f61d4f4979d`**.
The package version at this commit is `0.0.0`. This is a repository snapshot, not evidence of what
has been published to a registry. It records observed behavior without revising accepted contracts.

## Reading this report

The inventory starts at `packages/nexus/package.json` and the four source entrypoints, follows
their returned objects and types, and checks behavior against implementation and owning tests.
Freshly built runtime exports were compared with the source export lists. Existing status tables
were used only to identify documentation differences.

- [Package entrypoints](#package-entrypoints) and [configuration](#construction-and-configuration).
- [Root and scoped APIs](#root-and-scoped-apis), including drafts and durable metadata.
- [Capability namespaces](#capability-namespaces): documents, persistence, and metadata recovery.
- [Observation and integration](#observation-and-integration), including React and Web Storage.
- [Documentation differences](#documentation-differences), [evidence](#evidence-and-limits), and
  [complete named export index](#complete-named-export-index).

Method signatures below abbreviate generic field types as `Field`, inferred canonical records as
`Values`, transaction returns as `Result`, and opaque plan types as their corresponding `*Plan`.
The linked TypeScript declarations retain the exact generics and overloads. These are API
descriptions, not copy-and-paste application examples.

## Package entrypoints

The manifest exposes four JavaScript entries and `@picodash/nexus/package.json`.

| Import                        | Runtime exports | Explicit type-only exports | Role                                                                                              |
| ----------------------------- | --------------: | -------------------------: | ------------------------------------------------------------------------------------------------- |
| `@picodash/nexus`             |              21 |                        146 | Framework-independent construction, errors, document utilities, event validation, and core types. |
| `@picodash/nexus/integration` |               9 |                         23 | Leases, React context boundaries, and lease-bound event publication.                              |
| `@picodash/nexus/react`       |               7 |                          0 | Contextual hooks, selectors, and shallow equality.                                                |
| `@picodash/nexus/web-storage` |               1 |                          2 | Optional Web Storage persistence driver.                                                          |
| Total by import location      |              38 |                        171 | 209 entry-qualified names.                                                                        |

Eight type names occur on both the core and integration entries: the seven prune types and
`NexusInteractionPublisher`. There are **201 distinct exported names**, including **163 distinct
explicitly type-only names**. Runtime classes also have TypeScript instance types; they are counted
in the runtime column rather than counted twice.

The core entry has no reachable React runtime import. React is an optional peer (`>=19`) and is
needed by `/react` and `/integration`. The package declares ESM and `sideEffects: false`.
The core runtime does not expose its internal helpers merely because their source declarations
use `export`.

Sources: [manifest](../../packages/nexus/package.json), [core entry](../../packages/nexus/src/index.ts),
[integration entry](../../packages/nexus/src/integration.ts), [React entry](../../packages/nexus/src/react.ts),
[Web Storage entry](../../packages/nexus/src/web-storage.ts).

## Construction and configuration

`createPicodashNexus(config)` synchronously creates one root authority. There are two value-owner
branches, with overloads that infer fields and conditional capabilities.

| Configuration member     | Observed behavior                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `valueOwner: 'nexus'`    | Nexus owns canonical values. `adapter` is forbidden.                                                                                 |
| `valueOwner: 'external'` | A required synchronous `adapter` owns the complete field record. `initialValues` is forbidden.                                       |
| `fields`                 | Immutable field definitions. Each requires a JSON-compatible `defaultValue`; optional members are `schema`, `parse`, and `validate`. |
| `initialValues`          | Nexus-owned mode only; partial overrides over canonical defaults. These are not the reset baseline.                                  |
| `validateValues`         | Synchronous whole-record validator, run against the complete candidate.                                                              |
| `nexusId`                | Optional public identity for ephemeral roots. Nonempty, trimmed, case-sensitive, and control-character-free.                         |
| `schemaVersion`          | Positive safe integer; requires `nexusId`. Both are required for documents, migrations, persistence, and initial envelopes.          |
| `initialEnvelope`        | Parsed envelope object for synchronous hydration, including driver-free hydration. It is not a JSON string.                          |
| `persistence`            | Adds a driver and storage policy. Nexus-owned mode requires a field inclusion policy; external-owned mode forbids one.               |
| `export`                 | Adds immutable document disclosure policy and export methods. Requires identity and schema version.                                  |
| `migrations`             | Synchronous schema steps keyed by source version; requires identity and schema version.                                              |

Identity is captured at construction. Configuring `nexusId` alone does not enable documents.
There is no public reconfiguration method or dynamic field-registration API.

### Capability gating

| Configuration                               | Additional runtime and typed members on root and scopes                                 |
| ------------------------------------------- | --------------------------------------------------------------------------------------- |
| Neither identity nor schema version         | Core methods, `diagnostics`, and `events`.                                              |
| `nexusId` and `schemaVersion`               | `documents.analyzeImport`, `documents.executeImport`, and `metadataRecovery`.           |
| Identity, schema version, and `export`      | Adds `documents.createExportPlan` and `documents.executeExport`.                        |
| Identity, schema version, and `persistence` | Adds `persistence`; successful transaction results also carry persistence write status. |
| `initialEnvelope` without a driver          | Hydrates state; does not add `persistence`.                                             |

These members are conditionally present, rather than always present with a disabled result.
Root and scoped type aliases have parameters `Fields`, `Result`, `Identified`, and `ExportEnabled`.
The default `RootNexus<Fields>` annotation does not retain every capability inferred by a configured
factory call. Preserving the inferred return type is useful when consuming enabled namespaces.

Sources: [configuration types](../../packages/nexus/src/kernel/index.ts#L253),
[factory overloads and implementation](../../packages/nexus/src/kernel/index.ts#L1574),
[capability composition](../../packages/nexus/src/kernel/index.ts#L980).

### Fields and validation

Field handles are frozen, root-owned objects with a public `key`. `root.fields` and every
`scoped.fields` refer to the same field handles. A fabricated `{ key }` or a handle from another
root cannot authorize a field operation.

| Public type or callback           | Meaning                                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `PicodashFieldDefinition`         | Default plus optional parser, Standard Schema v1 schema, and validator.                                       |
| `ValuesOf<Fields>`                | Canonical record inferred from schema output, or widened defaults when no schema is supplied.                 |
| `PicodashField<Values, Key>`      | Nominal handle carrying field and value inference.                                                            |
| `PicodashFieldOf<Value>`          | Consumer constraint accepting a field whose selected value is assignable to `Value`.                          |
| `PicodashExactFieldOf<Value>`     | Consumer constraint requiring the selected value domain to match `Value` exactly.                             |
| `parse(input)`                    | Interactive input parser returning `{ ok: true, candidate }` or `{ ok: false, issues, repair? }`.             |
| `schema`                          | Synchronous Standard Schema v1 validation/canonicalization. Canonical output must be strict JSON.             |
| `validate(value, context)`        | Field validator returning application issues. It can inspect the complete candidate through `context.values`. |
| `validateValues(values, context)` | Whole-record validator returning application issues.                                                          |

Application issues contain `message`, optional `code: 'app:…'`, and optional relative `path`.
Validation context includes `values`, a source, optional `originScopeId`, and a field handle for a
field validator. Sources are `default`, `initial`, `persistence`, `adapter`, `programmatic`,
`interactive`, `repair`, `reset`, and `import`.

Programmatic writes do not run `parse`. Interactive writes run parsing, schema canonicalization,
and complete-candidate field/root validation. Resets use the validated canonical defaults, not
hydrated or initial values. Defaults, initial values, imported values, and external snapshots have
their own validation paths; parser behavior must not be described as a universal write transform.

Canonical JSON permits null, booleans, strings, finite numbers, plain dense arrays, and plain
data objects. It rejects `undefined`, functions, symbols, bigint, dates, class instances, cycles,
sparse arrays, accessors, and hidden/symbol properties. `-0` becomes `0`. Objects are detached and
frozen; cloned records can have a null prototype. Use `Object.hasOwn` rather than relying on an
instance `hasOwnProperty` method. Runtime snapshot maps are immutable map facades; serialized
documents and envelopes encode maps as arrays of entries.

Sources: [field types](../../packages/nexus/src/kernel/index.ts#L95),
[field views](../../packages/nexus/src/kernel/index.ts#L456),
[JSON boundary](../../packages/nexus/src/json.ts), [candidate pipeline](../../packages/nexus/src/kernel/index.ts#L1949).

### External value adapter

`PicodashValueAdapter<Values>` connects one existing synchronous application store to Nexus. It
projects exactly the configured complete field record, not the application's unrelated state.

| Adapter method                             | Required behavior                                                                                                       |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `getSnapshot(): Readonly<Values>`          | Returns the complete synchronous canonical record. Nexus validates and detaches the snapshot.                           |
| `subscribe(listener): () => void`          | Reports external changes and returns synchronous teardown. Nexus reads again after subscribing to close the setup race. |
| `setValues(completeValues, context): void` | Makes the complete requested record synchronously visible as one atomic application-store write.                        |

`AdapterWriteContext` contains `source`, optional `originScopeId`, `targetScopeIds`, and
`changedFields`. Its source is `programmatic`, `interactive`, `repair`, `reset`, or `import`.
Programmatic scope attribution does not turn that scope into a value access boundary. Reset and
import operations can supply multiple target scopes while still issuing one whole-record write.

Nexus verifies the snapshot after an adapter write. Thrown or async writes, invisible writes,
invalid snapshots, and mismatched results reject the operation. An unhealthy adapter blocks
value-changing writes while Nexus retains its last verified snapshot. A later valid external
notification can recover health. There is no public `adapter.retry` or health-reset method.
Metadata-only operations remain independent of canonical adapter writes.

The adapter must provide the atomicity it promises. Nexus cannot roll back arbitrary host side
effects if an adapter changes its store and then throws or returns an invalid result. External
transport, asynchronous durability, and authentication/authorization remain application concerns.
No Zustand-, reducer-, or hook-specific adapter factory is exported.

Sources: [adapter contract and runtime](../../packages/nexus/src/adapter.ts),
[verified canonical commit](../../packages/nexus/src/kernel/index.ts#L3830).

## Root and scoped APIs

### Identity, snapshots, and subscription

| Member                | Root                                 | Scoped view                                                                  |
| --------------------- | ------------------------------------ | ---------------------------------------------------------------------------- |
| `kind`                | `'root'`                             | `'scoped'`                                                                   |
| `root`                | Absent                               | Owning root.                                                                 |
| `scopeId`             | Absent                               | Opaque scope identity.                                                       |
| `fields`              | Complete root field set.             | Same complete field set.                                                     |
| `scope(scopeId)`      | Canonical scoped view.               | Resolves through the root; does not create relative ancestry.                |
| `getState()`          | `{ values, scopes }`                 | `{ values, scope, interaction }`                                             |
| `subscribe(listener)` | Root snapshot notifications.         | Canonical value changes and changes to this scope's metadata or interaction. |
| `diagnostics`         | Root-wide diagnostics namespace.     | Same root-wide namespace.                                                    |
| `events`              | Root-wide interaction event channel. | Event channel limited to this scope.                                         |

`subscribe` returns an unsubscribe function. Listeners receive no state argument and read the
latest snapshot. Semantically unchanged operations generally preserve snapshot identity and
suppress notifications. A draft-only change notifies the affected scope without notifying root
snapshot subscribers. Metadata in another scope does not notify this scope.

The root snapshot's `scopes` map contains durable metadata, not every live view or entity.
Resolving `scope(id)` creates neither durable metadata nor an ancestry edge. A referenced scope
view has canonical identity through a weak cache. All scoped views expose and can write every
root value. Scopes organize metadata and attribution; they are not authorization boundaries.

Sources: [public interfaces](../../packages/nexus/src/kernel/index.ts#L901),
[root construction](../../packages/nexus/src/kernel/index.ts#L3195),
[scoped construction](../../packages/nexus/src/kernel/index.ts#L4890).

### Value commands and results

These methods exist on both root and scoped receivers.

| Method                            | Return and behavior                                                                 |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| `setValue(field, value)`          | `Result`; validates and changes one field.                                          |
| `setValueOrThrow(field, value)`   | Successful result, or throws the transaction error.                                 |
| `setValues(partialValues)`        | `Result`; validates the complete candidate before committing any part of the batch. |
| `setValuesOrThrow(partialValues)` | Successful result, or throws the transaction error.                                 |
| `resetValue(field)`               | `Result`; restores that field's canonical default through reset validation.         |
| `resetValueOrThrow(field)`        | Successful result, or throws the transaction error.                                 |

A core successful result is `{ ok: true, changedFields, changedScopeIds }`. A rejection is
`{ ok: false, error: PicodashTransactionError, repair? }`. Issues live at `result.error.issues`.
There is no general public `transaction(callback)` or public transaction-builder object.

Unknown batch keys produce structured rejection. Foreign field handles, invalid operation
contracts, and reentrant writes throw `PicodashContractError`. The `OrThrow` methods convert
transaction rejection to a throw; they do not absorb contract errors.

When persistence is configured, successful results additionally contain
`persistence: 'unchanged' | 'saved' | 'pending'`. This describes the operation's durable projection;
an unchanged operation does not prove that previously pending persistence is clean.

Source: [transaction result](../../packages/nexus/src/kernel/index.ts#L1281),
[atomic commit](../../packages/nexus/src/kernel/index.ts#L3830).

### Registered resets and scope destruction

| Method                         | Root arguments                      | Scoped arguments                     | Behavior                                                                         |
| ------------------------------ | ----------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------- |
| `inspectRegisteredValueReset`  | `{ scopeId, includeDescendants? }`  | `{ includeDescendants? }` or omitted | Returns `{ registeredFields, changedFields }`.                                   |
| `resetRegisteredValues`        | `{ scopeId, includeDescendants? }`  | `{ includeDescendants? }` or omitted | Atomically resets distinct fields in active binding registrations.               |
| `resetRegisteredValuesOrThrow` | Same                                | Same                                 | Successful result or transaction error.                                          |
| `destroyScope`                 | `scopeId, { includeDescendants? }?` | `{ includeDescendants? }?`           | Clears targeted durable metadata, quarantined metadata, and binding interaction. |

`includeDescendants` defaults to false and uses live registered relationship edges. Both input and
display bindings participate in registered resets; released bindings do not. Multiple bindings to
the same field select that field once. An inspection reports availability, not a reserved plan;
execution selects from the active registrations at execution time.

Resets leave metadata intact. Existing dirty drafts remain and can become stale when canonical
values change. `destroyScope` does not reset canonical values, release entities or bindings,
invalidate a live scoped view, or encode a permanent removal of that scope.

Sources: [registered reset selection](../../packages/nexus/src/kernel/index.ts#L3960),
[scope destruction](../../packages/nexus/src/kernel/index.ts#L4731).

### Binding drafts, repair, and stale input

The core API exposes five binding commands. Binding handles are acquired through `/integration`.
Commands can be invoked through the root or another same-root scoped receiver; the binding
determines the actual scope, item, alias, and field.

| Method                                   | Return and behavior                                                                                                                                  |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setInput(binding, input)`               | `Result`; accepts JSON input, runs the interactive pipeline, and commits a valid candidate. Rejected input is retained as binding-local draft state. |
| `discardInput(binding)`                  | Boolean indicating whether interaction state was removed.                                                                                            |
| `createStaleInputOverwritePlan(binding)` | Opaque overwrite plan for a stale, currently valid draft. Throws for a clean binding or a draft with input issues.                                   |
| `executeStaleInputOverwrite(plan)`       | `Result`; explicitly retries the captured stale input against the current candidate.                                                                 |
| `executeRepair(plan)`                    | `Result`; applies a validated parser repair proposal after ownership and freshness checks.                                                           |

These are input-binding operations. Display-mode handles cannot edit or discard input. A parser
repair is proposed through a failed `PicodashParseResult`; it is not an automatic coercion. A
usable proposal becomes `result.repair`. Repair and overwrite plans are opaque objects rather than
serializable proposed-value records.

`ScopedNexusSnapshot.interaction.bindings` is a map from item ID to alias to
`BindingInteractionState`. Each record exposes `fieldKey`, optional `draft`, `touched`,
`inputIssues`, and optional `conflict`. A stale conflict contains `kind: 'stale-draft'`,
`baseRevision`, and `baseValue`.

A rejected draft can become stale when a different binding or programmatic write changes its
canonical field. Merely typing a new valid draft does not silently authorize overwriting that
change. Successful input removes the binding interaction record. Discard and binding release also
clear the record.

`interaction.items` and `ItemInteractionState` are exposed types, but the current implementation
does not populate focused, hovered, or active item records. It initializes and carries an empty
items map. Publishing a focus or hover event does not populate it. Document this as an exposed
shape with no current item-state writer, rather than as a working focus-state API.

Sources: [binding command types](../../packages/nexus/src/kernel/index.ts#L739),
[input execution](../../packages/nexus/src/kernel/index.ts#L4155),
[overwrite and repair](../../packages/nexus/src/kernel/index.ts#L4376),
[interaction storage](../../packages/nexus/src/kernel/index.ts#L4068).

### Durable metadata commands

Every command in this table returns `Result`. Root receivers take `scopeId` first; scoped
receivers omit it. Commands operate on Nexus-owned records without requiring a mounted UI.

| Root method signature                                     | Effect                                                                       |
| --------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `setDashPanelLayout(scopeId, layout)`                     | Replaces the complete sparse Panel override record.                          |
| `resetDashPanelLayout(scopeId)`                           | Removes all Panel overrides while retaining List metadata.                   |
| `setDashListRootOrder(scopeId, order)`                    | Sets root ordering overrides.                                                |
| `removeDashListRootOrder(scopeId)`                        | Removes root ordering overrides.                                             |
| `setDashListGroupOrder(scopeId, groupId, order)`          | Sets one group's order; an empty order removes its override.                 |
| `removeDashListGroupOrder(scopeId, groupId)`              | Removes one group-order override.                                            |
| `setDashListCollapseOverride(scopeId, nodeId, collapsed)` | Sets an explicit boolean override.                                           |
| `removeDashListCollapseOverride(scopeId, nodeId)`         | Removes an override so declarations can apply.                               |
| `updateDashListCollapseOverrides(scopeId, updates)`       | Atomically applies unique `[nodeId, boolean \| null]` updates; null removes. |
| `resetDashListMetadata(scopeId)`                          | Removes List overrides while retaining Panel metadata.                       |

Invalid metadata returns `invalid_metadata`. A quarantined target blocks ordinary metadata writes
with `quarantined_metadata`. No-op detection compares normalized metadata. There is no generic
arbitrary metadata-extension API.

`DurableScopeMetadata` has optional `dashPanel` and `dashList` members. List metadata contains
optional `rootOrder`, `groupOrders: ReadonlyMap<string, readonly string[]>`, and
`collapseOverrides: ReadonlyMap<string, boolean>`. Serialized forms use entry arrays instead of maps.

Panel metadata requires `version: 2` and at least one of `placement`, `preferredPosition`, or
`manualSize`. Each is an independent optional override. Position is finite `{ x, y }`.
Manual size contains at least one positive finite CSS-pixel `width` or `height`. This setter is
replacement, not a patch; callers preserving another override must include it in the replacement.

| Panel placement    | Allowed disposition                                                |
| ------------------ | ------------------------------------------------------------------ |
| `mode: 'floating'` | `free`, or `snapped` at any of the eight snap positions.           |
| `mode: 'fixed'`    | `docked` at one of the twelve dock positions.                      |
| `mode: 'hybrid'`   | `free`, `snapped` at top/bottom, or `docked` at any dock position. |

Snap positions are `top-left`, `top`, `top-right`, `right`, `bottom-right`, `bottom`,
`bottom-left`, and `left`. Dock positions are `top-left`, `top-right`, `bottom-right`,
`bottom-left`, `full-left`, `center-left`, `full-right`, `center-right`, `full-top`, `center-top`,
`full-bottom`, and `center-bottom`.

Nexus stores settled overrides. It does not expose Panel geometry resolution, visibility, focus,
z-order, or pointer-preview state through durable metadata.

Sources: [record types](../../packages/nexus/src/kernel/index.ts#L545),
[command declarations](../../packages/nexus/src/kernel/index.ts#L852),
[command implementation](../../packages/nexus/src/kernel/index.ts#L3267),
[metadata validation and serialization](../../packages/nexus/src/metadata.ts).

### Explicit List metadata pruning

Both receivers expose `createPrunePlan(options)` and `executePrunePlan(plan)`.
Root options additionally require `scopeId`.

| Selection mode | Required input                     | Return                                                                                                            |
| -------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `'review'`     | No selection arrays.               | `DashListPruneReview`; inspection only, not executable.                                                           |
| `'explicit'`   | `removeNodeIds` and `keepNodeIds`. | Executable plan; the disjoint arrays must partition all candidates.                                               |
| `'inventory'`  | `knownNodeIds`.                    | Executable plan retaining known candidates and removing unknown ones. Every active node must be in the inventory. |

Candidates are IDs mentioned by stored List metadata but absent from active node leases. Effects
identify `root-order-entry`, `group-order-owner`, `group-order-entry`, and `collapse-override`.
Plans expose candidates and selected IDs, not canonical values. Execution is one-use and checks
the target List metadata plus active-node inventory for freshness. It changes metadata only and
preserves Panel metadata and canonical values. Unmounting a node does not automatically prune it.

Source: [prune implementation](../../packages/nexus/src/kernel/index.ts#L5163).

### Root destruction

Only root exposes `destroy(options?)`. The only explicit option is
`{ discardUnpersisted: true }`. It returns void.

Destruction rejects malformed options, then active leases, then pending durable state without
explicit discard. It releases resources and persistence ownership without erasing durable storage
or resetting values. After success, root/scoped facades and captured capability methods reject
use with `use-after-destroy`. Captured immutable snapshots remain readable. Unsubscribe and
already-released lease cleanup functions retain their cleanup behavior.

There is no public scoped-view `dispose`, `release`, or `destroy` method. `destroyScope` is a state
operation; it is distinct from final root destruction.

Source: [lifecycle enforcement](../../packages/nexus/src/kernel/index.ts#L4714).

## Capability namespaces

### `documents`

Identified roots and scopes expose import. Configuring export policy adds export. Documents are
parsed data objects; JSON text parsing, file I/O, clipboard access, and dialogs belong to consumers.

| Method                                       | Return                                                          |
| -------------------------------------------- | --------------------------------------------------------------- |
| `analyzeImport(document: unknown, options?)` | `{ ok: true, plan }` or transaction rejection. Does not commit. |
| `executeImport(plan)`                        | `Result`; one atomic canonical-value and metadata overlay.      |
| `createExportPlan(options?)`                 | `PicodashExportPlan`; value-free review.                        |
| `executeExport(plan, options?)`              | `{ ok: true, document }` or transaction rejection.              |

Export options have required `includeDescendants` when an options object is supplied; omitting
the whole object defaults it to false. Root options may include `scopeId`; scoped options cannot.
Both accept `fields` and `promoteFields` arrays of real field handles. Whole-root export defaults
to all fields. Scoped export defaults to fields in active input and display bindings in the
selected scope, optionally including registered descendants. Explicit `fields` replaces that
registration-derived selection.

Export policy is independent of persistence policy. `export.documents.defaultFieldPolicy` is
`include`, `redact`, or `omit`. Field overrides are the same strings or
`{ default, allowPromotion?: 'with-confirmation' }`. Promotion is allowed only for explicitly
promotable redacted fields. A plan requesting it requires
`executeExport(plan, { confirmRedactedPromotion: true })`. Supplying confirmation to an export
that does not request promotion is also invalid.

Import options are `allowForeignNexus`, `createMissingScopes`, `fieldMap`, and `scopeMap`.
The booleans default to false. Field maps take source keys to real target handles or `'ignore'`;
scope maps take source IDs to target IDs. Duplicate resolved targets are invalid. Root options
add `targetScopeId`; a scope document imported at the root requires an explicit target. A scoped
receiver accepts a scope document and supplies its own target. A root document cannot be retargeted
to a single scope.

Import overlays included fields and supplied whole-scope metadata. Missing fields/scopes are
retained; redacted fields do not overwrite values. Unknown included fields must be explicitly
ignored or mapped. `createMissingScopes` can admit supplied scope metadata; it does not mount
entities. Calling `scope(id)` alone does not establish an import target's existence. Existing
durable/quarantined metadata or active registrations/relationships do.

Both document kinds use `formatVersion: 1`, `nexusId`, `schemaVersion`, `fields`, and `scopes`.
A scope document additionally has `kind: 'scope'` and `scopeId`; a root document has `kind: 'root'`.
Field entries are `[key, { status: 'included', value }]` or `[key, { status: 'redacted' }]`.
Scope entries are `[scopeId, SerializedDurableScopeMetadata]`. Documents contain no revision,
writer identity, draft state, event history, or executable functions.

Import analysis validates and canonicalizes the candidate before returning a plan. Execution
checks relevant field revisions, target scope existence/metadata, quarantine, and recomputed
validation. Export execution checks the disclosed document and relevant registrations/descendants.
An unrelated change need not invalidate a plan. Plans belong to their originating root and
receiver target and are one-use; serializing a review and reconstructing it does not recreate
execution authority.

Sources: [namespace types](../../packages/nexus/src/kernel/index.ts#L774),
[document implementation](../../packages/nexus/src/kernel/index.ts#L2667),
[strict document shapes](../../packages/nexus/src/documents.ts#L15).

### Standalone document utilities on the core entry

These are public runtime exports even though many applications only need the `documents`
namespace. They operate on data, not a live Nexus authority.

| Export and signature                                                   | Behavior                                                                                                                                           |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `decodePicodashDocument(value: unknown)`                               | Strictly decodes an already-parsed value to a detached frozen document. Requires sorted, unique entries.                                           |
| `normalizePicodashDocument(value)`                                     | Runtime alias of `decodePicodashDocument`.                                                                                                         |
| `encodePicodashDocument(document)`                                     | Validates, sorts, detaches, and freezes a document object. Does not return JSON text.                                                              |
| `normalizePicodashExportPolicy(value, fieldKeys)`                      | Validates disclosure policy and rejects overrides for undeclared fields.                                                                           |
| `normalizePicodashExportOptions(value, receiver = 'root')`             | Normalizes selection and descendant options for `'root'` or `'scope'`.                                                                             |
| `normalizePicodashExportExecutionOptions(value, requiresConfirmation)` | Validates required promotion confirmation or its required absence.                                                                                 |
| `normalizePicodashImportOptions(value, receiver = 'root')`             | Defaults booleans/maps and enforces receiver-specific targeting options.                                                                           |
| `normalizePicodashFieldMap(value, operation = 'import-analysis')`      | Produces sorted source/target entries, allowing handles or `'ignore'`.                                                                             |
| `normalizePicodashScopeMap(value, operation = 'import-analysis')`      | Produces sorted source/target scope entries.                                                                                                       |
| `stripRedactedPicodashDocumentFields(document)`                        | Returns a document containing included fields only.                                                                                                |
| `documentToSchemaMigrationPayload(document)`                           | Removes redacted fields and produces `{ schemaVersion, values, scopes }`.                                                                          |
| `documentFromSchemaMigrationPayload(original, payload)`                | Rebuilds the original document kind/identity with migrated fields, scopes, and schema version.                                                     |
| `migratePicodashDocument(document, targetSchemaVersion, migrations)`   | Runs the synchronous schema chain and rebuilds the document.                                                                                       |
| `buildPicodashDocumentOverlay(input)`                                  | Computes a detached overlay and review lists from supplied values, scopes, field keys, optional compatible keys/existence, and normalized options. |

Pure helpers do not validate a live root's field ownership or run its field/root callbacks.
In particular, the overlay helper is not an alternative canonical write path. Public types include
freshness input structures, but the normalization/freshness functions using those structures are
not exported by the core entry.

Sources: [document helpers](../../packages/nexus/src/documents.ts#L349),
[overlay input and result](../../packages/nexus/src/documents.ts#L899).

### `persistence`

Root and scopes share one persistence namespace. The core driver is synchronous:

| Driver member | Signature                                                  |
| ------------- | ---------------------------------------------------------- |
| `identity`    | Object identifying the underlying storage authority.       |
| `read`        | `(storageKey: string) => string \| null`                   |
| `write`       | `(storageKey: string, envelope: string) => void`           |
| `remove`      | `(storageKey: string) => void`                             |
| `subscribe?`  | `(storageKey: string, listener: () => void) => () => void` |

Live roots claim the `(driver.identity, storageKey)` pair to prevent duplicate authority in the
same runtime. Nexus-owned persistence includes values according to
`values.defaultFieldPolicy: 'include' | 'omit'` and optional per-field overrides. External-owned
persistence stores metadata only and forbids a values policy and envelope values.

| Namespace method                        | Return and behavior                                                                             |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `getState()`                            | `PicodashPersistenceState`.                                                                     |
| `subscribe(listener)`                   | Teardown function for capability-state notifications.                                           |
| `flush()`                               | `'unchanged'`, `'saved'`, or `'pending'`; retries pending work but does not resolve a conflict. |
| `createConflictResolutionPlan(options)` | Plan for a currently observed conflict.                                                         |
| `executeConflictResolution(plan)`       | `PersistentTransactionResult`.                                                                  |
| `createErasePlan()`                     | Review with `kind`, `hasDurableEnvelope`, and `discardsPendingEnvelope`.                        |
| `executeErase(plan, { confirm: true })` | `{ ok: true, erased, discardedPendingEnvelope }` or `{ ok: false, error }`.                     |

Persistence state is discriminated by `status: 'clean' | 'pending' | 'error' | 'conflict'`.
All variants carry `durableRevision`, `liveRevision`, and `hasPendingEnvelope`. Only error has
`lastError`; only conflict has `conflict`. The conflict reports foreign envelope/removal and local
and durable revision/writer identities.

Conflict options are `{ mode: 'reload' }`, `{ mode: 'overwrite' }`, or
`{ mode: 'reconcile', onOverlap: 'local' | 'durable' }`. Reconciliation compares local and durable
changes with their common confirmed baseline. Fields are merged individually; metadata and
quarantine are whole-scope units. Reload retains policy-omitted live fields. Foreign removal can
reload to the validated baseline. There is no automatic last-writer-wins overwrite.

Ordinary successful live commits can remain pending when the driver fails. External canonical
value writes alone return `persistence: 'unchanged'`; metadata commits can save. Erasure verifies
removal and clears pending/conflict state while retaining current live values and metadata. A
later durable change can save again. Root destruction does not erase storage.

Envelopes use `kind: 'picodash-nexus-envelope'`, `formatVersion: 1`, `nexusId`, `schemaVersion`,
`revision`, `writerId`, serialized `scopes`, and `valueOwner`. Only the Nexus-owned branch contains
`values`. Driver records are JSON strings; `initialEnvelope` is the corresponding parsed object.
The envelope format and the Panel payload's `version: 2` are separate version axes.

Sources: [driver/configuration/state/methods](../../packages/nexus/src/persistence.ts#L22),
[public recovery plans](../../packages/nexus/src/kernel/index.ts#L3686),
[conflict and erase controller](../../packages/nexus/src/persistence.ts#L1608).

### Migrations and `metadataRecovery`

`SchemaMigrations` is a record from source version to `PicodashSchemaMigration`. Each callback
receives a detached frozen `{ schemaVersion, values, scopes }` and must synchronously return the
next version's strict JSON payload. The chain advances one version per step. Missing steps,
newer source schemas, async results, malformed results, wrong versions, callback failures, and
failed final validation are distinct failure reasons.

Malformed hydrated metadata can be quarantined per scope while valid values and other scopes
survive. Ordinary metadata commands refuse that quarantined scope. Identified roots/scopes expose
the shared recovery namespace:

| Method                               | Behavior                                                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `getState()`                         | `{ quarantinedScopes: ReadonlyMap<string, { scopeId, raw }> }`.                                                                       |
| `subscribe(listener)`                | Subscribes to quarantine changes; returns teardown.                                                                                   |
| `replaceScope(scopeId, replacement)` | `Result`; strict serialized metadata replaces a quarantined record, or null discards it. An unquarantined target is a contract error. |

The exact obsolete Panel prototype `{ placement, preferredPosition }` is handled separately:
hydration discards that Panel preference, preserves independently valid List metadata, and emits
`panel_layout_obsolete`. This is default recovery, not a compatible setter/import format.
Quarantined raw metadata is available only through the explicit recovery capability, not through
diagnostics. Persistence retains quarantined raw data until deliberate recovery.

Sources: [migration types and runner](../../packages/nexus/src/migration.ts),
[recovery API](../../packages/nexus/src/metadata-recovery.ts),
[replacement execution](../../packages/nexus/src/kernel/index.ts#L5417),
[hydration metadata handling](../../packages/nexus/src/metadata.ts).

## Observation and integration

### Diagnostics

`diagnostics.getState()` returns `{ current: ReadonlyMap<string, PicodashDiagnostic> }`.
`diagnostics.subscribe(listener)` returns teardown. Root and scoped receivers share the same
root-wide diagnostic state; scoped access is not filtered.

Diagnostic records contain `code`, `severity`, safe `message`, structured `identity`, `count`, and
`lastOccurrence`. Map keys are opaque. `lastOccurrence` is a monotonically advancing occurrence
counter, not a wall-clock timestamp. Some named conditions add safe details such as `reason` or
`unknownFieldCount`. The generic diagnostic type intentionally is not a closed condition union.

Subscriber exceptions are isolated so later callbacks still execute. Diagnostics aggregate by
safe channel identity and recover when that channel next dispatches successfully. They do not
expose thrown objects, stack traces, canonical values, or raw drafts. Adapter health, persistence
failure, unknown persisted fields, quarantined metadata, obsolete Panel layouts, and interaction
delivery limits also use diagnostics. There is no public diagnostic emitter or clear method.

Source: [diagnostics](../../packages/nexus/src/diagnostics.ts).

### Interaction events

Every root/scoped Nexus exposes `events.subscribe(listener, filter?)` and `events.getSequence()`.
Filters accept arrays `scopeIds`, `kinds`, and `types`. A scoped channel applies an additional
same-scope restriction. Its sequence getter still reports the root-wide sequence.

An event is `{ sequence, timestamp, source, event }`. Source is
`{ scopeId, kind: 'dashPanel' | 'dashList', generation }`. Sequence is root-local and timestamp is
nondecreasing monotonic time. Input source is `mouse`, `touch`, `pen`, `keyboard`, `programmatic`,
or `automatic`.

| Type                        | Payload beyond `type`, `target`, and `input` |
| --------------------------- | -------------------------------------------- |
| `hover`, `focus`            | `phase: 'enter'                              | 'leave'`.   |
| `pointer`                   | `phase: 'down'                               | 'up'        | 'cancel'                         | 'move' | 'click'`; optional position, button, buttons, modifiers. |
| `drag.start`, `drag.update` | `interactionId`, `operation: 'move'          | 'resize'    | 'reorder'`, optional geometry.   |
| `drag.end`                  | Same drag fields plus `outcome: 'accepted'   | 'unchanged' | 'rejected'` and optional reason. |
| `drag.cancel`               | Same drag fields plus required reason.       |
| `command`                   | Command name, outcome, and optional reason.  |
| `layout`                    | `reason: 'content'                           | 'boundary'  | 'policy'` and required geometry. |

Geometry has `initial`, `requested`, `applied`, `delta`, and `stepDelta` rectangles, optional
`pointerDelta`, and optional constraint names. Events contain detached JSON data. Native events,
DOM objects, and arbitrary extra properties are rejected.

The core also exports `NEXUS_INTERACTION_TYPES` and
`normalizeNexusInteractionEvent(input: unknown): NexusInteractionEvent`. The normalizer validates
a complete event object; it grants no publication authority. Current limits include 4,096 UTF-8
bytes per complete event and 256 events per synchronous dispatch chain. The hub queues events
published during a canonical mutation until its write lock is released.

Events do not mutate values, metadata, binding interaction, persistence, or snapshot identity.
The channel retains no history and offers no replay method. Nexus does not synthesize product
gestures or coalesce animation frames itself; products decide which events to publish.

Sources: [event types and validation](../../packages/nexus/src/interactions.ts),
[publisher](../../packages/nexus/src/integration-leases.ts#L588).

### Integration leases

`@picodash/nexus/integration` exposes six imperative functions:

| Function                                                      | Return and role                                                                                                         |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `acquireProviderLease(root, { providerId? }?)`                | `ProviderLease`; provider ID defaults to `'default'` and must be unique on the root.                                    |
| `acquireEntityLease(scope, options)`                          | `EntityLease`; `kind: 'dashPanel'` requires a host lease; `'dashList'` allows an omitted host for standalone operation. |
| `acquireRelationshipLease(parentEntity, childEntity)`         | `RelationshipLease`; registers live scope ancestry within one host/root.                                                |
| `acquireBindingLease(scope, { itemId, field, alias?, mode })` | `BindingHandle`; mode is `'input'` or `'display'`; alias defaults to the field key.                                     |
| `acquireDashListNodeLease(scope, { nodeId })`                 | `DashListNodeLease`; records active node presence independently of whether a node binds fields.                         |
| `publishNexusInteraction(entityLease, input)`                 | `NexusInteractionEvent`; publishes with Nexus-derived scope and entity generation.                                      |

Every lease has `release()`. Binding handles also expose `scopeId`, `itemId`, `alias`, `field`, and
`mode`. Other handles are opaque apart from release. Releases are idempotent, but provider/entity
release refuses active dependents. Relationships must be removed before their dependent entity
leases. Binding release clears its interaction state. Live leases prevent root destruction.

One Panel and one List can share a scope on one host. Duplicate same-kind entities, cross-host
scope ownership, duplicate binding tuples/node IDs, foreign handles, relationship parent conflicts,
cycles, and same-scope relationship edges are contract errors. Host parentage and explicit scope
ancestry are separate facts; hosting an entity does not replace a relationship lease.

Source: [integration lease implementation](../../packages/nexus/src/integration-leases.ts).

### Integration React boundaries

The remaining three runtime exports on `/integration` are:

| Export                           | Public inputs and behavior                                                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PicodashNexusProviderBoundary`  | `children`, root `nexus`, optional `providerId`. Establishes a hard root/host/context boundary.                                                  |
| `PicodashNexusEntityBoundary`    | `children`, scoped `nexus`, and `kind`. Only `kind: 'dashList'` accepts optional `allowStandalone`; standalone operation requires it to be true. |
| `useNexusInteractionPublisher()` | Stable function returning an event or undefined. Reuses the nearest declarative entity's lease rather than acquiring a duplicate entity.         |

Context exists during render. Registration and cleanup occur in committed effects, with no lease
acquisition during server rendering. Nested entities register ancestry when they change the scope;
same-scope nesting does not add an edge. An existing Provider host takes precedence over the
standalone opt-in. Provider unmount does not destroy the application-supplied root.
The publisher returns undefined without a currently usable declarative entity context.

Sources: [boundary props and components](../../packages/nexus/src/integration-boundaries.ts),
[declarative lifecycle](../../packages/nexus/src/declarative-integration.ts).

### React hooks and selectors

`@picodash/nexus/react` exports exactly seven runtime functions:

| Function                                                 | Return and behavior                                                   |
| -------------------------------------------------------- | --------------------------------------------------------------------- |
| `usePicodashNexus()`                                     | Nearest root or scoped context.                                       |
| `usePicodashNexus(scopeId)`                              | Scoped view resolved through the nearest root.                        |
| `usePicodashRootNexus()`                                 | Nearest root context.                                                 |
| `usePicodashScope()`                                     | Nearest scoped context; throws if the nearest context is only a root. |
| `usePicodashNexusSelector(nexus, selector, equalityFn?)` | Selection over an explicit root/scoped Nexus; no context required.    |
| `usePicodashRootSelector(selector, equalityFn?)`         | Contextual root selection.                                            |
| `usePicodashScopeSelector(selector, equalityFn?)`        | Contextual scope selection.                                           |
| `shallowEqual(left, right)`                              | One-level equality helper for plain records and dense arrays/tuples.  |

The table has eight signatures because `usePicodashNexus` has two call forms. Missing required
context throws `PicodashContractError` with `code: 'missing-nexus-context'`.
Selectors use `useSyncExternalStore` and `Object.is` by default. An equality function can retain
the previous selected reference. `shallowEqual` compares values with `Object.is`; distinct nested
objects do not compare deeply, and distinct map/set/class instances are not shallow records.

The explicit selector preserves inference from the supplied Nexus. Contextual hooks use the broad
context field record; they do not infer a concrete parent's application field schema or enabled
capabilities from the JSX tree. There is no exported raw context or ordinary `NexusProvider` on
this entry; advanced boundaries live on `/integration`.

Source: [React API](../../packages/nexus/src/react.ts).

### Web Storage

`createWebStoragePersistenceDriver(source)` is the sole runtime export from `/web-storage`.
`PicodashWebStorageSource` is `'local' | 'session' | PicodashWebStorage`, where a supplied object
implements `getItem`, `setItem`, and `removeItem`.

The function returns a `PicodashPersistenceDriver`. Named sources resolve browser storage lazily,
so importing the module and constructing the driver need not access browser globals immediately.
Actual unavailable-storage operations fail rather than silently falling back to memory.
Named browser storage subscribes to matching native storage events. An arbitrary supplied storage
object does not gain a subscription automatically. Driver identities are stable for the same
storage authority, including recognized named-storage aliases.

Source: [Web Storage driver](../../packages/nexus/src/web-storage.ts).

## Errors and plan authority

| Public class/name              | Availability and handling                                                                                                                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PicodashContractError`        | Runtime core export; `code`, safe string `context`, optional normalized issues. Used for API misuse, ownership, lifecycle, and contract violations.                                                                            |
| `PicodashTransactionError`     | Runtime core export; immutable normalized `issues`. Used inside rejected results and by `OrThrow` methods.                                                                                                                     |
| `PicodashDocumentError`        | Runtime core export extending `TypeError`; `code: 'invalid_document'`, structured `reason`, empty path. Used by standalone document codecs/helpers.                                                                            |
| `PicodashDocumentOptionsError` | Runtime core export extending `TypeError`; `code: 'invalid-document-options'`, `operation`, and `reason`. Used by standalone option helpers.                                                                                   |
| `PicodashInitializationError`  | Exported from the core entry **only as a type**. Construction can throw this internal runtime class, but the public module has no value of that name for `instanceof`. Its shape exposes `name`, `code`, `reason`, and issues. |

Namespace document operations translate invalid options to `PicodashContractError`, while invalid
documents can become transaction rejections. The standalone utilities have their own error
classes; their failure conventions must not be copied wholesale to the live namespace.
Some low-level standalone utilities also throw ordinary `TypeError` or an internal migration
error. There is no public `SchemaMigrationError` constructor export.

Repair, stale-input overwrite, import/export, prune, persistence conflict, and erase plans are
root-owned execution tokens. Their visible review fields are not sufficient to forge, clone,
persist, or transfer authority. Freshness checks are specific to each family. First valid
execution attempts generally consume the token, including stale or rejected attempts; malformed
options and reentrant calls can be rejected before consumption. Retry by obtaining a fresh plan
rather than assuming a failed execution leaves one reusable.

Sources: [core error classes and results](../../packages/nexus/src/kernel/index.ts#L1238),
[initialization error](../../packages/nexus/src/adapter.ts#L94),
[document errors](../../packages/nexus/src/documents.ts#L63),
[public export boundary](../../packages/nexus/src/index.ts).

## Documentation differences

These are concrete observations at the audited commit, not a replacement completion matrix.

| Existing statement or documentation shape                                                     | Source-grounded finding                                                                                                                                                         | Documentation consequence                                                                  |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Nexus README says contextual hooks remain planned.                                            | Five contextual hooks are exported, implemented, and covered by runtime/type tests.                                                                                             | Describe the current seven-function React entry and its two `usePicodashNexus` call forms. |
| Root README says implementation begins after the documentation baseline.                      | The package already implements the commands and namespaces inventoried here.                                                                                                    | Do not use the root README timeline to determine current API availability.                 |
| Most package introductions emphasize target/prototype/partial labels.                         | Factory capabilities, returned objects, source exports, and built exports provide more precise availability evidence.                                                           | State audited commit and per-entry behavior; do not infer a global percentage complete.    |
| Target integration reference declares three orientation-override functions and related types. | `acquireDashListOrientationOverrideLease`, `getDashListOrientationOverride`, and `subscribeDashListOrientationOverride` are absent from source entries and fresh built modules. | Keep them in intended-contract documentation, outside current API instructions.            |
| Target reference discusses future `inspectRuntime()`.                                         | No runtime-inspection function or namespace is exposed. `inspectRegisteredValueReset` is a specific existing inspection method.                                                 | Avoid implying a generic Provider/entity/binding registry inspector exists.                |
| `PicodashInitializationError` appears in the core export list.                                | It occurs inside an `export type` block.                                                                                                                                        | Do not write a runtime named import or public `instanceof` example for it.                 |
| Field parser comment says it is not executed by Phase 1.                                      | `setInput` executes it, with repair and stale-input behavior.                                                                                                                   | Treat old phase comments as historical; describe the actual interactive pipeline.          |
| `ItemInteractionState` declares focus/hover/active flags.                                     | No public operation currently populates item records.                                                                                                                           | Separate declared data shape from currently produced state and event observation.          |
| `encode`/`decode` document names can suggest a text codec.                                    | Both consume/produce document objects; serialization is consumer-owned.                                                                                                         | Show JSON parsing/stringification as separate consumer operations.                         |
| Persistence result can be `'unchanged'`.                                                      | The root can still have an older pending/error/conflict condition.                                                                                                              | Use `persistence.getState()` for current durability health.                                |

This report leaves the existing target decisions and their progress records intact. A subsequent
documentation rewrite can use this inventory to separate current usage reference from accepted
future contracts. Absent APIs include a generic runtime inspector, adapter factories, dynamic field
registration, a public arbitrary transaction builder, and a core event replay/history API.

## Evidence and limits

Fresh validation on this checkout:

| Check                                           | Observed result                                                                                                                                                                              |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run --filter @picodash/nexus check`        | Formatting passed for 71 files; no warnings, lint errors, or type errors in 67 checked files.                                                                                                |
| `bun run --filter @picodash/nexus test`         | 39 test files, 473 tests passed.                                                                                                                                                             |
| `bun run --filter @picodash/nexus build`        | Four ESM entries and declarations built successfully. Tool reports the TypeScript 7 API as experimental.                                                                                     |
| `bun run --filter @picodash/nexus test:package` | Package artifact checks passed, including entry boundaries and declaration assertions.                                                                                                       |
| Source export comparison                        | All four freshly built runtime export lists exactly matched their source entry inventories.                                                                                                  |
| Direct built-module probes                      | Confirmed conditional namespaces, root/scoped method sets, aliasing, atomic rejection, programmatic/parser separation, repair, stale drafts, registered reset, and event/snapshot isolation. |

Primary owning evidence is in [Nexus tests](../../packages/nexus/tests):

| Area                                                  | Main evidence files                                                                                                                                                                                                                              |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fields, types, JSON, transactions                     | `kernel.test.ts`, `kernel.types.test.ts`, `kernel-issues.test.ts`, `json.test.ts`.                                                                                                                                                               |
| Binding input and plans                               | `binding-interaction.test.ts`, `stale-input-overwrite.test.ts`, `integration-bindings.test.ts`.                                                                                                                                                  |
| Scope metadata, resets, pruning, lifecycle            | `scope-metadata.test.ts`, `metadata.test.ts`, `panel-layout-v2.test.ts`, `reset-value.test.ts`, `reset-registered-values.test.ts`, `dashlist-prune.test.ts`, `root-lifecycle.test.ts`.                                                           |
| External authority, persistence, migration, documents | `adapter.test.ts`, `persistence.test.ts`, `external-persistence.test.ts`, `external-persistence-controller.test.ts`, `migration-recovery.test.ts`, `documents.test.ts`, `documents-integration.test.ts`.                                         |
| React, leases, events, diagnostics, packaging         | `react.test.tsx`, `integration.test.ts`, `declarative-integration.test.ts`, `integration-react.test.tsx`, `interaction-events.test.ts`, `interaction-publisher.test.tsx`, `diagnostics.test.ts`, `web-storage.test.ts`, `package-artifacts.mjs`. |

The package check supplies static type evidence; passing runtime tests alone is not treated as
type proof. No browser or cross-product suite was run for this inventory. It does not establish
browser gesture behavior, product UX quality, registry publication, release readiness, exhaustive
contract conformance, or the correctness of every invalid JavaScript callback shape. These limits
do not change which names the audited package exports.

## Complete named export index

The following index was extracted from the four source entries. Each name links to its defining
source file and declaration line. The index includes every explicit type-only export, including
supporting aliases and reason unions that do not need their own user guide. Overloaded functions
are listed once. Private imports and internal-only source exports are excluded.

### `@picodash/nexus`

| Export                                      | Kind             | Declaration                                                                  |
| ------------------------------------------- | ---------------- | ---------------------------------------------------------------------------- |
| `buildPicodashDocumentOverlay`              | Runtime function | [documents.ts:924](../../packages/nexus/src/documents.ts#L924)               |
| `createPicodashNexus`                       | Runtime function | [kernel/index.ts:1574](../../packages/nexus/src/kernel/index.ts#L1574)       |
| `decodePicodashDocument`                    | Runtime function | [documents.ts:349](../../packages/nexus/src/documents.ts#L349)               |
| `documentFromSchemaMigrationPayload`        | Runtime function | [documents.ts:863](../../packages/nexus/src/documents.ts#L863)               |
| `documentToSchemaMigrationPayload`          | Runtime function | [documents.ts:843](../../packages/nexus/src/documents.ts#L843)               |
| `encodePicodashDocument`                    | Runtime function | [documents.ts:357](../../packages/nexus/src/documents.ts#L357)               |
| `migratePicodashDocument`                   | Runtime function | [documents.ts:889](../../packages/nexus/src/documents.ts#L889)               |
| `NEXUS_INTERACTION_TYPES`                   | Runtime constant | [interactions.ts:86](../../packages/nexus/src/interactions.ts#L86)           |
| `normalizeNexusInteractionEvent`            | Runtime function | [interactions.ts:284](../../packages/nexus/src/interactions.ts#L284)         |
| `normalizePicodashDocument`                 | Runtime function | [documents.ts:354](../../packages/nexus/src/documents.ts#L354)               |
| `normalizePicodashExportExecutionOptions`   | Runtime function | [documents.ts:640](../../packages/nexus/src/documents.ts#L640)               |
| `normalizePicodashExportOptions`            | Runtime function | [documents.ts:603](../../packages/nexus/src/documents.ts#L603)               |
| `normalizePicodashExportPolicy`             | Runtime function | [documents.ts:418](../../packages/nexus/src/documents.ts#L418)               |
| `normalizePicodashFieldMap`                 | Runtime function | [documents.ts:656](../../packages/nexus/src/documents.ts#L656)               |
| `normalizePicodashImportOptions`            | Runtime function | [documents.ts:700](../../packages/nexus/src/documents.ts#L700)               |
| `normalizePicodashScopeMap`                 | Runtime function | [documents.ts:680](../../packages/nexus/src/documents.ts#L680)               |
| `PicodashContractError`                     | Runtime class    | [kernel/index.ts:1230](../../packages/nexus/src/kernel/index.ts#L1230)       |
| `PicodashDocumentError`                     | Runtime class    | [documents.ts:63](../../packages/nexus/src/documents.ts#L63)                 |
| `PicodashDocumentOptionsError`              | Runtime class    | [documents.ts:92](../../packages/nexus/src/documents.ts#L92)                 |
| `PicodashTransactionError`                  | Runtime class    | [kernel/index.ts:1256](../../packages/nexus/src/kernel/index.ts#L1256)       |
| `stripRedactedPicodashDocumentFields`       | Runtime function | [documents.ts:834](../../packages/nexus/src/documents.ts#L834)               |
| `AdapterHealthDiagnostic`                   | Type only        | [adapter.ts:87](../../packages/nexus/src/adapter.ts#L87)                     |
| `AdapterHealthReason`                       | Type only        | [adapter.ts:32](../../packages/nexus/src/adapter.ts#L32)                     |
| `AdapterInitializationFailureReason`        | Type only        | [adapter.ts:38](../../packages/nexus/src/adapter.ts#L38)                     |
| `AdapterUnhealthyIssue`                     | Type only        | [adapter.ts:73](../../packages/nexus/src/adapter.ts#L73)                     |
| `AdapterWriteContext`                       | Type only        | [adapter.ts:12](../../packages/nexus/src/adapter.ts#L12)                     |
| `AdapterWriteFailedIssue`                   | Type only        | [adapter.ts:80](../../packages/nexus/src/adapter.ts#L80)                     |
| `AdapterWriteFailureReason`                 | Type only        | [adapter.ts:25](../../packages/nexus/src/adapter.ts#L25)                     |
| `BindingInteractionCommands`                | Type only        | [kernel/index.ts:739](../../packages/nexus/src/kernel/index.ts#L739)         |
| `BindingInteractionState`                   | Type only        | [kernel/index.ts:724](../../packages/nexus/src/kernel/index.ts#L724)         |
| `CoreTransactionResult`                     | Type only        | [kernel/index.ts:1267](../../packages/nexus/src/kernel/index.ts#L1267)       |
| `DashListCollapseOverrideUpdate`            | Type only        | [kernel/index.ts:552](../../packages/nexus/src/kernel/index.ts#L552)         |
| `DashListMetadataRecord`                    | Type only        | [kernel/index.ts:545](../../packages/nexus/src/kernel/index.ts#L545)         |
| `DashListPruneCandidate`                    | Type only        | [kernel/index.ts:628](../../packages/nexus/src/kernel/index.ts#L628)         |
| `DashListPruneEffect`                       | Type only        | [kernel/index.ts:622](../../packages/nexus/src/kernel/index.ts#L622)         |
| `DashListPruneReview`                       | Type only        | [kernel/index.ts:633](../../packages/nexus/src/kernel/index.ts#L633)         |
| `DashListPruneSelection`                    | Type only        | [kernel/index.ts:639](../../packages/nexus/src/kernel/index.ts#L639)         |
| `DashPanelDockPositionRecord`               | Type only        | [kernel/index.ts:564](../../packages/nexus/src/kernel/index.ts#L564)         |
| `DashPanelLayoutRecord`                     | Type only        | [kernel/index.ts:609](../../packages/nexus/src/kernel/index.ts#L609)         |
| `DashPanelManualSizeRecord`                 | Type only        | [kernel/index.ts:600](../../packages/nexus/src/kernel/index.ts#L600)         |
| `DashPanelPlacementRecord`                  | Type only        | [kernel/index.ts:578](../../packages/nexus/src/kernel/index.ts#L578)         |
| `DashPanelSnapPositionRecord`               | Type only        | [kernel/index.ts:554](../../packages/nexus/src/kernel/index.ts#L554)         |
| `DestroyRootOptions`                        | Type only        | [kernel/index.ts:691](../../packages/nexus/src/kernel/index.ts#L691)         |
| `DestroyScopeOptions`                       | Type only        | [kernel/index.ts:695](../../packages/nexus/src/kernel/index.ts#L695)         |
| `DocumentExportCommands`                    | Type only        | [kernel/index.ts:793](../../packages/nexus/src/kernel/index.ts#L793)         |
| `DocumentImportCommands`                    | Type only        | [kernel/index.ts:780](../../packages/nexus/src/kernel/index.ts#L780)         |
| `DurableScopeMetadata`                      | Type only        | [kernel/index.ts:617](../../packages/nexus/src/kernel/index.ts#L617)         |
| `ExternalOwnedConfig`                       | Type only        | [kernel/index.ts:316](../../packages/nexus/src/kernel/index.ts#L316)         |
| `ExternalOwnedPersistenceConfig`            | Type only        | [persistence.ts:39](../../packages/nexus/src/persistence.ts#L39)             |
| `HydrationSourceConflictReason`             | Type only        | [persistence.ts:137](../../packages/nexus/src/persistence.ts#L137)           |
| `InvalidDestroyOptionsReason`               | Type only        | [kernel/index.ts:684](../../packages/nexus/src/kernel/index.ts#L684)         |
| `InvalidPersistenceEnvelopeReason`          | Type only        | [persistence.ts:128](../../packages/nexus/src/persistence.ts#L128)           |
| `InvalidPruneOptionsReason`                 | Type only        | [kernel/index.ts:650](../../packages/nexus/src/kernel/index.ts#L650)         |
| `InvalidResetOptionsReason`                 | Type only        | [kernel/index.ts:699](../../packages/nexus/src/kernel/index.ts#L699)         |
| `InvalidScopeIdReason`                      | Type only        | [kernel/index.ts:678](../../packages/nexus/src/kernel/index.ts#L678)         |
| `ItemInteractionState`                      | Type only        | [kernel/index.ts:757](../../packages/nexus/src/kernel/index.ts#L757)         |
| `NexusInteractionEvent`                     | Type only        | [interactions.ts:63](../../packages/nexus/src/interactions.ts#L63)           |
| `NexusInteractionEvents`                    | Type only        | [interactions.ts:74](../../packages/nexus/src/interactions.ts#L74)           |
| `NexusInteractionFilter`                    | Type only        | [interactions.ts:69](../../packages/nexus/src/interactions.ts#L69)           |
| `NexusInteractionGeometry`                  | Type only        | [interactions.ts:14](../../packages/nexus/src/interactions.ts#L14)           |
| `NexusInteractionInput`                     | Type only        | [interactions.ts:30](../../packages/nexus/src/interactions.ts#L30)           |
| `NexusInteractionPublisher`                 | Type only        | [interactions.ts:81](../../packages/nexus/src/interactions.ts#L81)           |
| `NexusInteractionRect`                      | Type only        | [interactions.ts:13](../../packages/nexus/src/interactions.ts#L13)           |
| `NexusInteractionSource`                    | Type only        | [interactions.ts:6](../../packages/nexus/src/interactions.ts#L6)             |
| `NexusOwnedConfig`                          | Type only        | [kernel/index.ts:527](../../packages/nexus/src/kernel/index.ts#L527)         |
| `NexusOwnedPersistenceConfig`               | Type only        | [persistence.ts:28](../../packages/nexus/src/persistence.ts#L28)             |
| `OperationSource`                           | Type only        | [adapter.ts:10](../../packages/nexus/src/adapter.ts#L10)                     |
| `PersistenceConflictResolutionOptions`      | Type only        | [persistence.ts:92](../../packages/nexus/src/persistence.ts#L92)             |
| `PersistenceDriverUnavailableReason`        | Type only        | [persistence.ts:123](../../packages/nexus/src/persistence.ts#L123)           |
| `PersistenceEraseResult`                    | Type only        | [persistence.ts:112](../../packages/nexus/src/persistence.ts#L112)           |
| `PersistenceFailureReason`                  | Type only        | [persistence.ts:84](../../packages/nexus/src/persistence.ts#L84)             |
| `PersistenceWriteStatus`                    | Type only        | [persistence.ts:45](../../packages/nexus/src/persistence.ts#L45)             |
| `PersistentTransactionResult`               | Type only        | [persistence.ts:70](../../packages/nexus/src/persistence.ts#L70)             |
| `PicodashDashListPrunePlan`                 | Type only        | [kernel/index.ts:663](../../packages/nexus/src/kernel/index.ts#L663)         |
| `PicodashDiagnostic`                        | Type only        | [diagnostics.ts:1](../../packages/nexus/src/diagnostics.ts#L1)               |
| `PicodashDiagnostics`                       | Type only        | [diagnostics.ts:31](../../packages/nexus/src/diagnostics.ts#L31)             |
| `PicodashDiagnosticsState`                  | Type only        | [diagnostics.ts:14](../../packages/nexus/src/diagnostics.ts#L14)             |
| `PicodashDocument`                          | Type only        | [documents.ts:44](../../packages/nexus/src/documents.ts#L44)                 |
| `PicodashDocumentExportResult`              | Type only        | [kernel/index.ts:774](../../packages/nexus/src/kernel/index.ts#L774)         |
| `PicodashDocumentFailureReason`             | Type only        | [documents.ts:46](../../packages/nexus/src/documents.ts#L46)                 |
| `PicodashDocumentFieldEntry`                | Type only        | [documents.ts:20](../../packages/nexus/src/documents.ts#L20)                 |
| `PicodashDocumentFieldHandle`               | Type only        | [documents.ts:462](../../packages/nexus/src/documents.ts#L462)               |
| `PicodashDocumentFieldValue`                | Type only        | [documents.ts:15](../../packages/nexus/src/documents.ts#L15)                 |
| `PicodashDocumentOptionOperation`           | Type only        | [documents.ts:75](../../packages/nexus/src/documents.ts#L75)                 |
| `PicodashDocumentOptionReason`              | Type only        | [documents.ts:77](../../packages/nexus/src/documents.ts#L77)                 |
| `PicodashDocumentOverlay`                   | Type only        | [documents.ts:909](../../packages/nexus/src/documents.ts#L909)               |
| `PicodashDocumentOverlayInput`              | Type only        | [documents.ts:899](../../packages/nexus/src/documents.ts#L899)               |
| `PicodashEnvelopeHeader`                    | Type only        | [persistence.ts:48](../../packages/nexus/src/persistence.ts#L48)             |
| `PicodashEnvelopeInput`                     | Type only        | [persistence.ts:58](../../packages/nexus/src/persistence.ts#L58)             |
| `PicodashExactFieldOf`                      | Type only        | [kernel/index.ts:484](../../packages/nexus/src/kernel/index.ts#L484)         |
| `PicodashExportConfig`                      | Type only        | [documents.ts:390](../../packages/nexus/src/documents.ts#L390)               |
| `PicodashExportExecutionOptions`            | Type only        | [documents.ts:484](../../packages/nexus/src/documents.ts#L484)               |
| `PicodashExportFieldPolicy`                 | Type only        | [documents.ts:380](../../packages/nexus/src/documents.ts#L380)               |
| `PicodashExportFreshnessInput`              | Type only        | [documents.ts:1041](../../packages/nexus/src/documents.ts#L1041)             |
| `PicodashExportOptions`                     | Type only        | [documents.ts:481](../../packages/nexus/src/documents.ts#L481)               |
| `PicodashExportPlan`                        | Type only        | [documents.ts:742](../../packages/nexus/src/documents.ts#L742)               |
| `PicodashExportPlanReview`                  | Type only        | [documents.ts:732](../../packages/nexus/src/documents.ts#L732)               |
| `PicodashExportPolicy`                      | Type only        | [documents.ts:385](../../packages/nexus/src/documents.ts#L385)               |
| `PicodashField`                             | Type only        | [kernel/index.ts:456](../../packages/nexus/src/kernel/index.ts#L456)         |
| `PicodashFieldDefinition`                   | Type only        | [kernel/index.ts:209](../../packages/nexus/src/kernel/index.ts#L209)         |
| `PicodashFieldDefinitions`                  | Type only        | [kernel/index.ts:223](../../packages/nexus/src/kernel/index.ts#L223)         |
| `PicodashFieldMappingTarget`                | Type only        | [documents.ts:514](../../packages/nexus/src/documents.ts#L514)               |
| `PicodashFieldOf`                           | Type only        | [kernel/index.ts:471](../../packages/nexus/src/kernel/index.ts#L471)         |
| `PicodashFields`                            | Type only        | [kernel/index.ts:498](../../packages/nexus/src/kernel/index.ts#L498)         |
| `PicodashFieldValidator`                    | Type only        | [kernel/index.ts:161](../../packages/nexus/src/kernel/index.ts#L161)         |
| `PicodashImportFieldMappingTarget`          | Type only        | [documents.ts:488](../../packages/nexus/src/documents.ts#L488)               |
| `PicodashImportFreshnessInput`              | Type only        | [documents.ts:1052](../../packages/nexus/src/documents.ts#L1052)             |
| `PicodashImportOptions`                     | Type only        | [documents.ts:519](../../packages/nexus/src/documents.ts#L519)               |
| `PicodashImportPlan`                        | Type only        | [documents.ts:759](../../packages/nexus/src/documents.ts#L759)               |
| `PicodashImportPlanReview`                  | Type only        | [documents.ts:745](../../packages/nexus/src/documents.ts#L745)               |
| `PicodashInitializationError`               | Type only        | [adapter.ts:93](../../packages/nexus/src/adapter.ts#L93)                     |
| `PicodashInitializationErrorCode`           | Type only        | [adapter.ts:53](../../packages/nexus/src/adapter.ts#L53)                     |
| `PicodashInitializationErrorReasonByCode`   | Type only        | [adapter.ts:45](../../packages/nexus/src/adapter.ts#L45)                     |
| `PicodashIssueCode`                         | Type only        | [kernel/index.ts:101](../../packages/nexus/src/kernel/index.ts#L101)         |
| `PicodashIssueInput`                        | Type only        | [kernel/index.ts:128](../../packages/nexus/src/kernel/index.ts#L128)         |
| `PicodashJsonPrimitive`                     | Type only        | [kernel/index.ts:95](../../packages/nexus/src/kernel/index.ts#L95)           |
| `PicodashJsonValue`                         | Type only        | [kernel/index.ts:96](../../packages/nexus/src/kernel/index.ts#L96)           |
| `PicodashMetadataRecovery`                  | Type only        | [metadata-recovery.ts:13](../../packages/nexus/src/metadata-recovery.ts#L13) |
| `PicodashMetadataRecoveryState`             | Type only        | [metadata-recovery.ts:9](../../packages/nexus/src/metadata-recovery.ts#L9)   |
| `PicodashNormalizedFieldMap`                | Type only        | [documents.ts:491](../../packages/nexus/src/documents.ts#L491)               |
| `PicodashNormalizedImportOptions`           | Type only        | [documents.ts:522](../../packages/nexus/src/documents.ts#L522)               |
| `PicodashNormalizedScopeMap`                | Type only        | [documents.ts:495](../../packages/nexus/src/documents.ts#L495)               |
| `PicodashParseResult`                       | Type only        | [kernel/index.ts:201](../../packages/nexus/src/kernel/index.ts#L201)         |
| `PicodashPersistence`                       | Type only        | [persistence.ts:180](../../packages/nexus/src/persistence.ts#L180)           |
| `PicodashPersistenceConflict`               | Type only        | [persistence.ts:76](../../packages/nexus/src/persistence.ts#L76)             |
| `PicodashPersistenceConflictResolutionPlan` | Type only        | [persistence.ts:98](../../packages/nexus/src/persistence.ts#L98)             |
| `PicodashPersistenceDiagnostic`             | Type only        | [persistence.ts:140](../../packages/nexus/src/persistence.ts#L140)           |
| `PicodashPersistenceDriver`                 | Type only        | [persistence.ts:20](../../packages/nexus/src/persistence.ts#L20)             |
| `PicodashPersistenceErasePlan`              | Type only        | [persistence.ts:105](../../packages/nexus/src/persistence.ts#L105)           |
| `PicodashPersistenceState`                  | Type only        | [persistence.ts:146](../../packages/nexus/src/persistence.ts#L146)           |
| `PicodashQuarantinedScopeMetadata`          | Type only        | [metadata-recovery.ts:4](../../packages/nexus/src/metadata-recovery.ts#L4)   |
| `PicodashRepairPlan`                        | Type only        | [kernel/index.ts:733](../../packages/nexus/src/kernel/index.ts#L733)         |
| `PicodashRootDocument`                      | Type only        | [documents.ts:25](../../packages/nexus/src/documents.ts#L25)                 |
| `PicodashRootExportOptions`                 | Type only        | [documents.ts:465](../../packages/nexus/src/documents.ts#L465)               |
| `PicodashRootImportOptions`                 | Type only        | [documents.ts:497](../../packages/nexus/src/documents.ts#L497)               |
| `PicodashSchemaMigration`                   | Type only        | [migration.ts:10](../../packages/nexus/src/migration.ts#L10)                 |
| `PicodashSchemaMigrationPayload`            | Type only        | [migration.ts:4](../../packages/nexus/src/migration.ts#L4)                   |
| `PicodashScopedExportOptions`               | Type only        | [documents.ts:473](../../packages/nexus/src/documents.ts#L473)               |
| `PicodashScopedImportOptions`               | Type only        | [documents.ts:506](../../packages/nexus/src/documents.ts#L506)               |
| `PicodashScopeDocument`                     | Type only        | [documents.ts:34](../../packages/nexus/src/documents.ts#L34)                 |
| `PicodashStaleInputOverwritePlan`           | Type only        | [kernel/index.ts:735](../../packages/nexus/src/kernel/index.ts#L735)         |
| `PicodashValidationContext`                 | Type only        | [kernel/index.ts:145](../../packages/nexus/src/kernel/index.ts#L145)         |
| `PicodashValueAdapter`                      | Type only        | [adapter.ts:19](../../packages/nexus/src/adapter.ts#L19)                     |
| `RegisteredValueResetInspection`            | Type only        | [kernel/index.ts:713](../../packages/nexus/src/kernel/index.ts#L713)         |
| `ResetRegisteredValuesOptions`              | Type only        | [kernel/index.ts:705](../../packages/nexus/src/kernel/index.ts#L705)         |
| `RootDashListPruneOptions`                  | Type only        | [kernel/index.ts:648](../../packages/nexus/src/kernel/index.ts#L648)         |
| `RootMetadataCommands`                      | Type only        | [kernel/index.ts:852](../../packages/nexus/src/kernel/index.ts#L852)         |
| `RootNexus`                                 | Type only        | [kernel/index.ts:984](../../packages/nexus/src/kernel/index.ts#L984)         |
| `RootNexusSnapshot`                         | Type only        | [kernel/index.ts:673](../../packages/nexus/src/kernel/index.ts#L673)         |
| `RootResetRegisteredValuesOptions`          | Type only        | [kernel/index.ts:709](../../packages/nexus/src/kernel/index.ts#L709)         |
| `SchemaMigrationFailureReason`              | Type only        | [migration.ts:16](../../packages/nexus/src/migration.ts#L16)                 |
| `SchemaMigrations`                          | Type only        | [migration.ts:14](../../packages/nexus/src/migration.ts#L14)                 |
| `ScopedDocumentExportCommands`              | Type only        | [kernel/index.ts:817](../../packages/nexus/src/kernel/index.ts#L817)         |
| `ScopedDocumentImportCommands`              | Type only        | [kernel/index.ts:804](../../packages/nexus/src/kernel/index.ts#L804)         |
| `ScopedMetadataCommands`                    | Type only        | [kernel/index.ts:877](../../packages/nexus/src/kernel/index.ts#L877)         |
| `ScopedNexus`                               | Type only        | [kernel/index.ts:996](../../packages/nexus/src/kernel/index.ts#L996)         |
| `ScopedNexusSnapshot`                       | Type only        | [kernel/index.ts:768](../../packages/nexus/src/kernel/index.ts#L768)         |
| `ScopeInteractionState`                     | Type only        | [kernel/index.ts:763](../../packages/nexus/src/kernel/index.ts#L763)         |
| `SerializedDashListMetadataRecord`          | Type only        | [metadata.ts:41](../../packages/nexus/src/metadata.ts#L41)                   |
| `SerializedDashPanelLayoutRecord`           | Type only        | [metadata.ts:48](../../packages/nexus/src/metadata.ts#L48)                   |
| `SerializedDurableScopeMetadata`            | Type only        | [metadata.ts:51](../../packages/nexus/src/metadata.ts#L51)                   |
| `StaleDraftConflict`                        | Type only        | [kernel/index.ts:718](../../packages/nexus/src/kernel/index.ts#L718)         |
| `SubscriberExceptionDiagnostic`             | Type only        | [diagnostics.ts:25](../../packages/nexus/src/diagnostics.ts#L25)             |
| `SubscriberExceptionIdentity`               | Type only        | [diagnostics.ts:18](../../packages/nexus/src/diagnostics.ts#L18)             |
| `TransactionIssue`                          | Type only        | [kernel/index.ts:134](../../packages/nexus/src/kernel/index.ts#L134)         |
| `ValuesOf`                                  | Type only        | [kernel/index.ts:358](../../packages/nexus/src/kernel/index.ts#L358)         |
| `ValuesValidator`                           | Type only        | [kernel/index.ts:166](../../packages/nexus/src/kernel/index.ts#L166)         |

### `@picodash/nexus/integration`

| Export                               | Kind             | Declaration                                                                              |
| ------------------------------------ | ---------------- | ---------------------------------------------------------------------------------------- |
| `acquireBindingLease`                | Runtime function | [integration-leases.ts:210](../../packages/nexus/src/integration-leases.ts#L210)         |
| `acquireDashListNodeLease`           | Runtime function | [integration-leases.ts:489](../../packages/nexus/src/integration-leases.ts#L489)         |
| `acquireEntityLease`                 | Runtime function | [integration-leases.ts:407](../../packages/nexus/src/integration-leases.ts#L407)         |
| `acquireProviderLease`               | Runtime function | [integration-leases.ts:369](../../packages/nexus/src/integration-leases.ts#L369)         |
| `acquireRelationshipLease`           | Runtime function | [integration-leases.ts:531](../../packages/nexus/src/integration-leases.ts#L531)         |
| `PicodashNexusEntityBoundary`        | Runtime function | [integration-boundaries.ts:85](../../packages/nexus/src/integration-boundaries.ts#L85)   |
| `PicodashNexusProviderBoundary`      | Runtime function | [integration-boundaries.ts:56](../../packages/nexus/src/integration-boundaries.ts#L56)   |
| `publishNexusInteraction`            | Runtime function | [integration-leases.ts:593](../../packages/nexus/src/integration-leases.ts#L593)         |
| `useNexusInteractionPublisher`       | Runtime function | [integration-boundaries.ts:142](../../packages/nexus/src/integration-boundaries.ts#L142) |
| `AcquireBindingOptions`              | Type only        | [integration-leases.ts:52](../../packages/nexus/src/integration-leases.ts#L52)           |
| `AcquireDashListNodeOptions`         | Type only        | [integration-leases.ts:83](../../packages/nexus/src/integration-leases.ts#L83)           |
| `BindingHandle`                      | Type only        | [integration-leases.ts:92](../../packages/nexus/src/integration-leases.ts#L92)           |
| `DashListNodeLease`                  | Type only        | [integration-leases.ts:87](../../packages/nexus/src/integration-leases.ts#L87)           |
| `DashListPruneCandidate`             | Type only        | [kernel/index.ts:628](../../packages/nexus/src/kernel/index.ts#L628)                     |
| `DashListPruneEffect`                | Type only        | [kernel/index.ts:622](../../packages/nexus/src/kernel/index.ts#L622)                     |
| `DashListPruneReview`                | Type only        | [kernel/index.ts:633](../../packages/nexus/src/kernel/index.ts#L633)                     |
| `DashListPruneSelection`             | Type only        | [kernel/index.ts:639](../../packages/nexus/src/kernel/index.ts#L639)                     |
| `EntityLease`                        | Type only        | [integration-leases.ts:67](../../packages/nexus/src/integration-leases.ts#L67)           |
| `EntityLeaseOptions`                 | Type only        | [integration-leases.ts:38](../../packages/nexus/src/integration-leases.ts#L38)           |
| `InvalidBindingHandleReason`         | Type only        | [integration-leases.ts:50](../../packages/nexus/src/integration-leases.ts#L50)           |
| `InvalidDashListNodeOptionsReason`   | Type only        | [integration-leases.ts:77](../../packages/nexus/src/integration-leases.ts#L77)           |
| `InvalidEntityOptionsReason`         | Type only        | [integration-leases.ts:31](../../packages/nexus/src/integration-leases.ts#L31)           |
| `InvalidPruneOptionsReason`          | Type only        | [kernel/index.ts:650](../../packages/nexus/src/kernel/index.ts#L650)                     |
| `NexusBindingMode`                   | Type only        | [integration-leases.ts:48](../../packages/nexus/src/integration-leases.ts#L48)           |
| `NexusEntityKind`                    | Type only        | [integration-leases.ts:29](../../packages/nexus/src/integration-leases.ts#L29)           |
| `NexusInteractionPublisher`          | Type only        | [interactions.ts:81](../../packages/nexus/src/interactions.ts#L81)                       |
| `PicodashDashListPrunePlan`          | Type only        | [kernel/index.ts:663](../../packages/nexus/src/kernel/index.ts#L663)                     |
| `PicodashNexusEntityBoundaryProps`   | Type only        | [integration-boundaries.ts:44](../../packages/nexus/src/integration-boundaries.ts#L44)   |
| `PicodashNexusProviderBoundaryProps` | Type only        | [integration-boundaries.ts:35](../../packages/nexus/src/integration-boundaries.ts#L35)   |
| `ProviderLease`                      | Type only        | [integration-leases.ts:62](../../packages/nexus/src/integration-leases.ts#L62)           |
| `RelationshipLease`                  | Type only        | [integration-leases.ts:72](../../packages/nexus/src/integration-leases.ts#L72)           |
| `RootDashListPruneOptions`           | Type only        | [kernel/index.ts:648](../../packages/nexus/src/kernel/index.ts#L648)                     |

### `@picodash/nexus/react`

| Export                     | Kind             | Declaration                                            |
| -------------------------- | ---------------- | ------------------------------------------------------ |
| `shallowEqual`             | Runtime function | [react.ts:120](../../packages/nexus/src/react.ts#L120) |
| `usePicodashNexus`         | Runtime function | [react.ts:29](../../packages/nexus/src/react.ts#L29)   |
| `usePicodashNexusSelector` | Runtime function | [react.ts:54](../../packages/nexus/src/react.ts#L54)   |
| `usePicodashRootNexus`     | Runtime function | [react.ts:37](../../packages/nexus/src/react.ts#L37)   |
| `usePicodashRootSelector`  | Runtime function | [react.ts:105](../../packages/nexus/src/react.ts#L105) |
| `usePicodashScope`         | Runtime function | [react.ts:43](../../packages/nexus/src/react.ts#L43)   |
| `usePicodashScopeSelector` | Runtime function | [react.ts:112](../../packages/nexus/src/react.ts#L112) |

### `@picodash/nexus/web-storage`

| Export                              | Kind             | Declaration                                                      |
| ----------------------------------- | ---------------- | ---------------------------------------------------------------- |
| `createWebStoragePersistenceDriver` | Runtime function | [web-storage.ts:96](../../packages/nexus/src/web-storage.ts#L96) |
| `PicodashWebStorage`                | Type only        | [web-storage.ts:3](../../packages/nexus/src/web-storage.ts#L3)   |
| `PicodashWebStorageSource`          | Type only        | [web-storage.ts:9](../../packages/nexus/src/web-storage.ts#L9)   |
