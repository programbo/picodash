# Nexus: implemented API

Nexus renders no UI. It owns canonical JSON values, synchronous valid changes, scoped draft state,
persistence, documents, diagnostics, and integration lifetimes. It currently also embeds Panel and Stack metadata
and interaction semantics. Those couplings are documented in [the design audit](../design/nexus-api-audit.md).

The [complete generated export inventory and declarations](api/nexus.md) cover `@picodash/nexus`, `/react`, `/integration`,
and `/web-storage`. There are no supported cross-package source imports.

## Create a root and access values

```ts
import { createPicodashNexus } from '@picodash/nexus'

const nexus = createPicodashNexus({
  valueOwner: 'nexus',
  fields: { enabled: { defaultValue: true }, gain: { defaultValue: 0.5 } },
})
const inspector = nexus.scope('inspector')
const result = nexus.setValues({ enabled: false, gain: 0.75 })
if (!result.ok) console.log(result.issues)
const gain = nexus.getState().values.gain
```

`fields` produces root-owned typed handles. A scope is a view over the same values, not an independent value store.
`scope(id)` addresses a scope on the root even when called on another scope; it does not construct a hierarchical path.
Field definitions support parsing, Standard Schema validation and validators; root configuration supports whole-value validation.
All candidate fields are parsed and validated before a batch mutates canonical state. Values and persisted payloads must be strict JSON data.

| Surface                | Operations and behavior                                                                                                           |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Values, root and scope | `setValue`, `setValues`, `resetValue` and their `OrThrow` counterparts; field handles must belong to the root                     |
| Observation            | `getState`, `subscribe`; stable immutable snapshots, subscription returns cleanup                                                 |
| Registered reset       | `inspectRegisteredValueReset`, `resetRegisteredValues`, `resetRegisteredValuesOrThrow`; selection depends on live binding leases  |
| Scope lifecycle        | Root `destroyScope(id, options)` and scope `destroyScope(options)`; optional descendant handling follows registered relationships |
| Root lifecycle         | `destroy`; refuses active leases or unsaved persistence unless the explicit discard contract applies                              |

Root snapshots contain `values` and durable `scopes`. Scoped snapshots contain the same `values`, the selected `scope` metadata,
and ephemeral `interaction`. A scoped subscriber observes the selected channel; a root snapshot is not a global dump of all ephemeral state.

## Ownership and optional capabilities

`valueOwner: 'nexus'` stores values internally. `valueOwner: 'external'` adapts a synchronous store through
`getSnapshot`, `subscribe` and `setValues`. Adapter writes are verified by read-back; health failures appear through diagnostics
and failed operations. Async stores require an application adapter architecture, not a promise returned from a synchronous contract.

`nexusId` and `schemaVersion` identify documents and schema migrations. The creation overloads encode which capabilities exist:
`persistence` requires persistence configuration; `metadataRecovery` and `documents` require identity;
document export additionally requires an explicit export policy. Do not assume every root has every optional namespace.

## Binding drafts and gestures

Integration consumers acquire binding leases through `@picodash/nexus/integration`. Bindings identify a scope, item, alias,
field and input/display mode. They are capabilities, not interchangeable string addresses.

| Operation                                                     | Purpose                                                                                      |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `setInput(binding, input)`                                    | Parse and validate input; retain rejected draft and issues without changing canonical values |
| `discardInput(binding)`                                       | Clear the binding draft                                                                      |
| `createStaleInputOverwritePlan`, `executeStaleInputOverwrite` | Explicitly overwrite a stale draft after another canonical write                             |
| `executeRepair(plan)`                                         | Apply a validator-produced repair through the transaction path                               |
| `createValueGesture`, `createValueInputGesture`               | Begin/update/commit/cancel a reversible interaction over a field or binding                  |
| `createNumericGesture`, `createNumericInputGesture`           | Number-specific gesture entrypoints                                                          |

A binding snapshot records `fieldKey`, optional `draft`, `touched`, `inputIssues` and optional stale conflict.
Gesture cancellation attempts rollback only while its revision/input ownership remains current; an external write supersedes it.
Gestures are explicit stateful protocols. Consumers must release them and their binding leases.

## Item attention and interaction events

`scope.createItemInteractionSource(itemId)` returns `{ set(patch), release() }`. The fixed flags are `focused`, `hovered`, and `active`.
Multiple live sources combine each flag with OR. Releasing a source removes its contribution; a consumer must clear ended attention
or release the source. The flags are ephemeral and excluded from persistence and documents. DashStack supplies the DOM behavior in
[`item-attention.ts`](../../packages/dashstack/src/item-attention.ts).

`root.events` and `scope.events` expose `subscribe(listener, filter?)` and `getSequence()`.
The fixed event types are hover, focus, pointer, drag start/update/end/cancel, command and layout.
Event attribution includes scope, entity kind and generation. Publishers are acquired through live integration boundaries or leases.
This stream has no persisted replay log. The Bridge adds its own bounded transport journal and cursors.
These named flags and events are current consumer couplings, not the proposed generic state contract.

## Durable consumer metadata

Root commands take a scope ID; scoped commands omit it. They currently include:

| Family         | Commands                                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------------------------- |
| Panel layout   | `setDashPanelLayout`, `resetDashPanelLayout`; sparse `version: 2` placement, preferred position and manual size |
| Hotkeys        | `setDashPanelHotkey`, `setDashGroupHotkey`; `null` clears committed opaque preference text                      |
| Stack order    | Set/remove root order and group order                                                                           |
| Stack collapse | Set/remove one override, atomically update several, reset Stack metadata                                        |
| Stack pruning  | `createPrunePlan` in review, explicit or inventory mode; `executePrunePlan`                                     |

Panel layout resets preserve unrelated hotkeys and Stack metadata. Declared layout defaults, live geometry, focus, visibility,
activation, z-order and previews are not durable layout overrides. Obsolete prototype Panel layouts recover to current defaults
while other valid scope metadata survives. This recovery is not a compatibility migration promise.

## Persistence, recovery and documents

A persistence driver provides synchronous `read`, `write`, `remove`, a stable `identity`, and optional external-change subscription.
`createWebStorageDriver` is the opt-in browser storage adapter. Nexus-owned values require an explicit include/omit persistence policy;
external-owned values remain owned by the external store and Nexus persists metadata only.

`persistence` provides `getState`, `subscribe`, `flush`, conflict-resolution plan creation/execution, and erase plan creation/execution.
Transactions can succeed canonically while persistence is pending. Inspect the persistence result separately from `ok`.
Erase requires explicit confirmation; plan objects are root-owned and freshness checked.

`metadataRecovery` provides a quarantine view and a controlled replacement operation for invalid scope metadata.
Document namespaces expose `analyzeImport`, `executeImport`, and, when enabled, `createExportPlan` and `executeExport`.
The root entrypoint also exports pure decode/encode/normalize, field/scope mapping, redaction, migration and overlay utilities.
Import/export uses policy, field identity, mapping, review and freshness checks; JSON decoding alone does not authorize a write.

## Errors and diagnostics

Ordinary invalid values return `ok: false` with issues. `OrThrow` variants throw `PicodashTransactionError`.
Invalid contracts, foreign handles, reentrant writes and use after destruction throw `PicodashContractError`.
`PicodashDocumentError` and `PicodashDocumentOptionsError` distinguish document decoding and option failures.

`PicodashInitializationError` still exists in [`adapter.ts`](../../packages/nexus/src/adapter.ts). It is exported from the public root
as a **type only**. No replacement error type has taken its place. Its runtime error has a stable name, code, reason and issues;
a consumer cannot import its constructor for public `instanceof` checks. This asymmetry is an audit finding.

`diagnostics.getState().current` and `diagnostics.subscribe` expose current diagnostic conditions, counts and occurrence information.
They do not expose arbitrary application objects or evaluation. There is no exported generic runtime-reflection API in the consolidated
entrypoints. For disclosed remote inspection, read [Dev Bridge](../development/agent-dev-bridge.md).

## React and integration entrypoints

`/react` provides root/scope context access, explicit Nexus selectors, root/scope selectors and `shallowEqual`.
The selector hook accepts an equality function and subscribes to Nexus; it does not create another store.
`/integration` exposes provider, entity, relationship, binding and Stack-node leases, declarative boundaries and event publishing.
Entity kinds remain the closed union `dashPanel | dashStack`. Lifetime and relationship validation belongs to Nexus today;
consumer naming and Stack structure are extraction candidates.

Typechecked examples live in [`tests`](../../packages/nexus/tests) and [consumer fixtures](../../packages/picodash/tests/dogfood).
API presence is established by declarations and artifact checks; runtime behavior requires the owning tests.
