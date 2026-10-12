# Build an application with Picodash

These recipes extend the installation guide with public calls available in the dogfood packages.
Snapshot `0.1.0-dogfood.4` includes the corrected executable examples described here. The public
APIs used were also present in `.2`; existing consumers can copy the updated examples without a
runtime package upgrade. These recipes add no planetary solver or agent transport.

**Functions imported from `./designer-model.js` are application example code, not Picodash exports.**
Copy `example/designer-model.ts` and `example/Designer.tsx` together into your app. They use only
public package entrypoints. Their tests also run from installed tarballs outside this repository.
The three-number design and two target IDs deliberately keep the example bounded.

For a styled numeric control with units and achieved-value subtext, use the
[NumberField target recipe](numeric-targets.md). It also explains the per-field versus record-wide
draft choice and the limits of incomplete-text handling. For an unrestricted upper bound, see
[open-ended ranges and slider constraints](open-ended-ranges.md).

For Slider endpoint stops such as Off or Any, see
[endpoint detents](linked-controls.md#endpoint-detents-off-any-or-application-defined-stops),
available from dogfood.13. Output formatting remains application-owned.

For transient dock/undock readout reservations with a fixed camera, copy the
[dock-reactive layout recipe](dock-reactive-layout.md). For development-only app observation and
allowlisted writes, use [Agent Dev Bridge](agent-dev-bridge.md#external-development-apps).

## Custom wrappers must expose their Stack node ID

A component used directly inside `DashStack` or `DashGroup` must accept an explicit `id` at the
call site and forward that same ID to its single returned Dashlet or DashGroup. The parent reads
the child's declaration before rendering the wrapper. Hardcoding the ID only inside the wrapper
leaves the parent without an identity and throws `invalid-node-id` at runtime. React `key` does
not substitute for `id`; TypeScript may not catch a wrapper that omits this prop.

```tsx
import { Dashlet } from '@picodash/dashstack'

function Summary({ id }: { id: string }) {
  return (
    <Dashlet id={id} label="Summary">
      Application-owned result
    </Dashlet>
  )
}

// Inside a DashStack or DashGroup:
;<Summary id="summary" />
```

The installed `SelectedProfile`, `ModuleTarget`, and `CapacityTarget` examples follow this rule.
Keep the ID stable and independent of the label or current value. Verify custom wrappers in a
rendered Stack; a standalone component render does not exercise parent declaration validation.

## 1. Render a derived SVG inside a Dashlet

Supply your own pure, synchronous solver with this example interface:

```ts
import type { Solver } from './designer-model.js'

// Solver = (design, priority) => Solution | null
// design: { ratio: number; module: number; diameter: number }
// priority: 'ratio' | 'module'
// Solution: { profilePath: string; halfExtent: number; summary: string }
```

`profilePath` is your selected solution's SVG path data, centered about the origin.
`halfExtent` is a positive finite coordinate extent containing the complete profile. The example
constructs a square viewBox from it and scales the SVG to the available width. `summary` supplies
the accessible image name and visible readout. Return `null` for an infeasible design. The fixture
used in tests draws a square; it is not a gear profile or an engineering validation algorithm.

Create one Nexus for the application's lifetime and pass the same solver to the model and UI:

```tsx
import { createRoot } from 'react-dom/client'
import { createDesigner } from './designer-model.js'
import { DesignerRecipe } from './Designer.js'
import '@picodash/picodash/style.css'

// `solve` is your application's implementation of Solver.
const nexus = createDesigner(solve)
const root = createRoot(container)
root.render(<DesignerRecipe nexus={nexus} solve={solve} />)
// On permanent teardown: root.unmount(); nexus.destroy()
```

The example's `SelectedProfile` renders an **unbound custom `Dashlet`** with `layout="block"` and
`pin="start"`. It subscribes through `usePicodashNexusSelector(nexus, state => state)` and derives
the selected solution with `selectDesign(snapshot, solve)`. It stores neither the solution nor SVG
in Nexus, and uses no effect to synchronize a second copy. Your solver and profile generation can
be memoized when expensive without changing the saved-state contract.

`DisplayDashlet` is the ready-made formatted-value control. It is not the arbitrary SVG renderer.
For arbitrary content, use `Dashlet` with JSX children. An unbound Dashlet needs no `field` or
`mode`. If a custom readout should register a field for scope-level document/reset membership,
use `field={nexus.fields.design} mode="display"`; that does not make the derived geometry a field.
The example uses root documents, so unbound profile membership does not omit the requested design.

Do not set `disabled` merely because a visualization is informational. Display bindings have no
input methods. `readOnly` prevents editing input bindings while preserving inspection and allowed
discard behavior. `disabled` blocks input actions and changes disabled presentation. Reordering
and group disclosure have separate container policies. A custom control must forward the supplied
`disabled` and `readOnly` state; the example editor does so.

## 2. Use committed order as priority in UI and headless code

This recipe has one scope, `designer`, and one group, `targets`. That group always declares exactly
two unpinned nodes, in this default order:

```ts
;['reduction', 'tooth-size']
```

Their IDs express identity. Application code gives their relative order meaning. The example's
`priorityFromOrder` finds the first recognized target, falling back to the declaration default.
The targets are informational rows in this small example; an app may put the corresponding inputs
inside those same nodes without changing their identities or ordering policy.

Inside a Dashlet in this group:

```tsx
import { useDashStackOrder } from '@picodash/dashstack'
import { priorityFromOrder } from './designer-model.js'

const priority = priorityFromOrder(useDashStackOrder())
```

The hook reads the nearest container's **committed effective order**. `'root'` instead reads the
Stack's root siblings, where `targets` is one group node, not its flattened child IDs. A drag
preview does not change the hook's committed snapshot. Cancellation and a no-op drop write nothing.

For the same fixed group outside React, use the public saved metadata plus the same declared
default. The example's `selectDesign` does exactly this:

```ts
const snapshot = nexus.getState()
const order = snapshot.scopes.get('designer')?.dashStack?.groupOrders.get('targets') ?? [
  'reduction',
  'tooth-size',
]
const priority = priorityFromOrder(order)
const solution = solve(snapshot.values.design, priority)
```

Both UI and agent callers can call `selectDesign(nexus.getState(), solve)`. UI tests compare this
policy with the hook after actual keyboard reordering. The helper is valid because this group is
fixed, always declared, and unpinned. It is **not a general headless effective-order API**. The
public React hook performs full declaration/pin/dormant-node reconciliation; raw Nexus overrides
do not. Dynamic membership, pin bands, nested-container flattening, or arbitrary reordered Stacks
need an explicit application contract or a future public headless resolver. Do not import private
DashStack ordering code or claim that raw saved IDs are the current rendered order.

To change this group's priority programmatically:

```ts
const result = nexus.setDashStackGroupOrder('designer', 'targets', ['tooth-size', 'reduction'])
```

The example's `setPriority(nexus, 'module')` first checks effective priority. It returns `null` when
no change is needed; otherwise it returns the Nexus transaction result above. Thus requesting the
default priority again does not cause another write. The recipe factory explicitly seeds this
fixed group's default order because priority is required application data in exported designs. Never mutate the
snapshot's Maps or mirror priority in another persisted field. `removeDashStackGroupOrder` restores
declaration-default ordering for that group; root siblings use `setDashStackRootOrder` and
`removeDashStackRootOrder` instead. For this business-priority recipe, reset with
`setPriority(nexus, 'ratio')` so exported documents retain an explicit default order.

Priority only ranks feasible candidates in this recipe. Feasibility must remain independent of
priority, and default inputs must have a solution. Validation checks both rankings. If reordering
can invalidate the accepted request in your domain, this recipe is insufficient: define that
transition and rejection policy before treating layout order as a business command.

## 3. Keep compound invalid drafts apart from accepted values

The example stores one field, `design`, containing `{ ratio, module, diameter }`. `DesignRecordEditor`
binds that field once and renders three individually labeled controls. Its input parser accepts
numeric text, and its validator rejects out-of-range or infeasible records. Programmatic writes
must supply a complete typed record; they run validation but do not run the UI text parser.

```ts
const accepted = nexus.getState().values.design
const result = nexus.setValue(nexus.fields.design, { ...accepted, diameter: 120 })
if (!result.ok) {
  // Show result.error.issues in the initiating application/agent workflow.
  // No canonical value changed and no UI draft was invented by this call.
}
```

For a field validator, `{ path: ['module'], message: '…' }` is relative to its field. Nexus returns
the canonical issue path `['values', 'design', 'module']`. The example editor uses that path to mark
only the module input invalid and relate it to the shell-owned error region. It never parses error
messages. Record-wide feasibility errors stay on the Dashlet rather than marking an arbitrary
member. Three properties inside one object are not three Nexus fields or binding identities.

Interactive edits use the Dashlet context's `binding.setInput(rawRecord)`. On rejection,
`binding.value` remains accepted while `binding.draftValue` retains raw text such as `"invalid"`.
The SVG continues to derive from canonical requested values and committed priority. That is the
last accepted **input state**, not a separately stored historic geometry result. Changing committed
priority may select a different solution from those same accepted inputs.

A successful external write can mark an existing dirty draft stale; it does not silently erase or
apply it. Dashlet already renders **Discard changes** for a dirty binding and owns its supported
stale-input confirmation behavior. The editor must not duplicate these shell actions. Use
`binding.discardInput()` only for an intentional additional application workflow; the normal editor
needs no extra discard button. Do not implement overwrite by copying an arbitrary stale record directly
into `setValue` and bypassing that workflow.

If each property needs independent binding drafts or field-level disclosure, declare several Nexus
fields instead. A compound Dashlet uses an alias-keyed `fields` map; cross-field invariants belong
in `validateValues`, and a programmatic `setValues({...})` validates the complete candidate
atomically. That is a different data model from this single-record example.

## 4. Save requested values and priorities together

`createDesigner` supplies stable `nexusId`, `schemaVersion`, and an explicit document export policy.
For this small app, use a root document. It contains the requested design plus durable scope
metadata, including the target order. Root export works without a mounted UI; scoped export
otherwise depends on active registered field membership unless fields are selected explicitly.

```ts
const exported = nexus.documents.executeExport(nexus.documents.createExportPlan())
if (exported.ok) {
  const fileText = JSON.stringify(exported.document)
  // Save fileText with your application's file/download API.
}

const document: unknown = JSON.parse(fileTextFromUser)
const analysis = nexus.documents.analyzeImport(document, { createMissingScopes: true })
if (analysis.ok) {
  // Present/review the proposed effects in your application's import workflow.
  // After accepting those effects, use this exact plan:
  const result = nexus.documents.executeImport(analysis.plan)
}
```

Handle parse errors, unsuccessful analysis/execution, and stale plans. Analysis is non-mutating;
plans belong to their root, are single-use, and can become stale before execution. Missing scope
creation creates durable metadata, not mounted Dashlets. Foreign identities and renamed scopes or
fields require explicit mapping/permission options, not silent acceptance. The recipe uses the
same identity and schema on export and import.

Imports overlay the content present in the document. An absent scope is not an instruction
to erase the target's existing priority. A document from a fresh headless root that never stored
`designer` metadata could therefore leave a previously reordered target module-first. Present
scope records replace their mapped target records; omission inside a present record is not the same
as omitting that scope entirely.

This example's factories explicitly seed `['reduction', 'tooth-size']` for the fixed priority group,
including in a headless root. The persistent factory seeds only when that order is absent after
hydration, preserving existing saved priority. This is an application choice because priority is
business data; it is not a rule to save every presentation-only Stack default. The consumer test
exports a default source into an already reordered target and checks that it returns to ratio-first.
Old documents that omitted the designer scope still need an explicit import policy, such as
preserving the target order or mapping that absence to the application's default. Do not silently assume replace
semantics or clear unrelated scopes.

A successful root import commits values and metadata together. The consumer test observes one
notification and the same resulting selection on a fresh, unmounted root. Calling `setValue` and
`setDashStackGroupOrder` separately is **not** a combined atomic transaction. Do not promise a
single notification for those two independent calls. Do not serialize `getState()` as a document:
it contains Maps and is not the persistence/document format.

For automatic browser persistence, use the separate example factory:

```ts
import { createWebStoragePersistenceDriver } from '@picodash/nexus/web-storage'
import { createPersistentDesigner } from './designer-model.js'

const driver = createWebStoragePersistenceDriver('local')
const nexus = createPersistentDesigner(solve, driver)
const status = nexus.persistence.getState()
```

Create this in the browser when storage is available. It persists included values and durable
metadata in one root envelope and hydrates them before activation. Use stable IDs across restarts.
`schemaVersion` changes need application-owned migrations; renaming a Dashlet/group changes its
ordering identity. Drafts, drag previews, SVG, and selected solutions are not persisted.

An accepted transaction is not necessarily durable: persistent results distinguish `saved`,
`pending`, and `unchanged`; `persistence.getState()` distinguishes clean, pending, error, and
conflict. `persistence.flush()` retries eligible pending work; it does not silently resolve a
conflict. Conflict resolution and erase have explicit plan/execution APIs. Do not claim “Saved”
from `result.ok` alone or destroy pending state merely to dismiss a warning.

Storage denial, malformed durable values, and incompatible identities/schemas can fail startup.
Metadata recovery and migrations have their own public policies; this recipe does not supply a
complete recovery UI or consent flow. Do not automatically delete existing storage to make startup
succeed. Preserve the data and expose an explicit recovery choice. Async remote storage is not a
core persistence driver: drivers are synchronous. In external-owned mode, Picodash persists its
metadata, not the host store's application values. Saving only values would lose priority.

## 5. Observe and control the same model from an agent

The bundle provides headless **in-process APIs**, not a shipped CLI, MCP server, HTTP service, or
browser discovery protocol. Dev Bridge remains private and absent. Installing the bundle does not
make a running browser Nexus reachable from another process.

For code holding the same Nexus instance, the supported calls are:

| Need                                 | Public call                                                                                               |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Accepted values and durable metadata | `nexus.getState()`                                                                                        |
| Observe changes                      | `nexus.subscribe(listener)`; listener reads `getState()`; returned function unsubscribes                  |
| Validated programmatic edit          | `nexus.setValue(nexus.fields.design, candidate)` or `nexus.setValues({ design: candidate })`              |
| Priority change                      | `nexus.setDashStackGroupOrder('designer', 'targets', order)` through the bounded application policy above |
| Inspect binding-local drafts         | `nexus.scope('designer').getState().interaction`; subscribe on that scoped view for interaction updates   |

Project a deliberate JSON response, for example the requested record, priority, and selected
summary returned by the shared selector. Do not expose arbitrary root access or serialize Maps
blindly. A scope organizes state; it is not an authorization boundary. The receiving application
owns transport, input validation, permissions, and which values or drafts it discloses.

For an out-of-process agent, the host must implement that narrow adapter or the agent must use the
application's accessible UI. This is an explicit unsupported delivery seam, not an undocumented
consumer setup step. No new transport is implemented by these recipes. Likewise, an asynchronous
solver needs an application-owned pending/cancellation/result workflow; Nexus validators are
synchronous. Keep that workflow explicit rather than spreading it across unrelated effects.

## Verification and limits

The public-entrypoint consumer fixture tests invalid draft attribution, last accepted values,
external-write staleness, hook/headless priority agreement, cancel/no-op behavior, root document
restore, persistence reload, and pending-write recovery. The external consumer check installs the
actual tarballs and compiles these examples, then runs their DOM tests alongside Vite/Next builds.
These are package-consumption and interaction checks, not certification of gear geometry,
manufacturing, all visual layouts, remote agent connectivity, or a complete recovery product.

Canonical repository references for deeper API work are `docs/reference/nexus.md` (fields,
metadata, documents, persistence) and `docs/reference/dashstack.md` (bindings, render contexts,
reconciliation). Their status annotations distinguish implemented behavior from target contracts.

## React to a prospective dock target

Use `useDashPanel(panelId)` from `@picodash/dashpanel` to read transient `dockPreview` while a Hybrid
Panel offers a valid pointer dock target. `example/DockPreview.tsx` is a typed public consumer.
The application owns its readout positioning and camera policy. Do not infer a committed placement
from preview or measure the proxy on every pointer event. See the
[controller bounds and lifecycle](../reference/dashpanel.md#panel-controller) for viewport
coordinates, occupied targets and clearing behavior.
