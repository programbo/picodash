# Groups, targets, and linked controls

Use one Nexus field for a target shared by a slider, numeric input, and an application manipulator.
Keep computed outcomes in the application's solver result. Picodash presents them without choosing
which outcome is best.

These APIs begin with dogfood.7. Use dogfood.8 or newer for independent unlabelled ticks,
extreme-height overflow recovery, and numeric Panel widths. Check the snapshot manifest before using these exports.
Dogfood.9 also vendors this guide into the consumer; .7/.8 contain it only in the original bundle.
Install the packages and styles using [the dogfooding guide](dogfooding.md).

## Compose priorities with groups

```tsx
import { createPicodashNexus } from '@picodash/nexus'
import { DashStack, DashGroup, TargetSliderDashlet } from '@picodash/dashstack'

const nexus = createPicodashNexus({
  valueOwner: 'nexus',
  fields: {
    bore: {
      defaultValue: 2.37,
      validate: (value: number) =>
        Number.isFinite(value) && value >= 0 && value <= 10
          ? []
          : [{ message: 'Enter a bore target from 0 to 10.' }],
    },
  },
})

function Controls() {
  return (
    <DashStack nexus={nexus} id="designer">
      <DashGroup id="preview" aria-label="Preview" pin="start">
        {/* Put a DisplayDashlet or a custom Dashlet here. */}
      </DashGroup>
      <DashGroup id="geometry" label="Geometry">
        <DashGroup id="targets" label="Targets" reorderable>
          <TargetSliderDashlet
            id="bore"
            label="Bore"
            field={nexus.fields.bore}
            min={0}
            max={10}
            step={0.01}
            marks={[
              { value: 0, label: 'Solid' },
              { value: 2, label: 'Minimum bore' },
            ]}
            result={{ status: 'ready', value: 2.4 }}
            unit="mm"
          />
        </DashGroup>
      </DashGroup>
    </DashStack>
  )
}
```

Supply the real solver result instead of the constant `2.4`. Target edits use the configured step,
not the authored marks or feasible outcomes. A bore target of `1.2` can legitimately achieve `2`;
a ready achieved value of `0` means zero, not unavailable. Use `marks={values.map(value =>
({ value, label: '' }))}` for small unlabelled ticks. Omitting `label` displays the numeric value;
an empty label suppresses visible text while retaining the numeric accessible reference.

The target number is editable. Empty or rejected input stays in the binding draft when the field
validator rejects it. Configure numeric validation as above; a JSON-compatible default alone does
not establish domain validation. The slider does not overwrite valid canonical values outside its
presentation scale: it shows a warning and omits its thumb until the value is representable.

Top-level groups may collapse. Subgroups cannot collapse or pin and keep their columns aligned with
other rows. They inherit the parent label colour unless overridden. Pin only root groups. To keep
a single control pinned, wrap it in a headerless group with an accessible name. A pinned group’s
`reorderable` prop governs its children, not whether the group moves between bands.

## Read effective order

```tsx
import {
  useDashStackGroupOrder,
  getDashStackStructure,
  subscribeDashStackStructure,
} from '@picodash/dashstack'

const scope = nexus.scope('designer')
function SolverPriority() {
  const order = useDashStackGroupOrder(scope, 'targets')
  // Use this subgroup's IDs to rank targets. Moving Geometry does not change this order.
  return <output>{order.join(', ')}</output>
}
const read = () => getDashStackStructure(scope)
const unsubscribe = subscribeDashStackStructure(scope, () => {
  const order = read().nodes.find((node) => node.id === 'targets')?.children ?? []
  // Feed the committed order to the application solver.
})
// On application teardown:
unsubscribe()
```

`useDashStackStructure(scope)` reads the same frozen snapshot. Within a Stack, omit the scope.
`useDashStackOrder()` still reads the nearest container; pass `'root'` for root order. Drag previews
never change these committed views. Unknown groups return an empty order. Hidden descendants remain
in the snapshot with `visible: false`. Before mount, on the server, and after unmount, the effective
structure is empty. Use application-owned declared defaults during that interval; stored overrides
alone are not an effective order.

## Present solver freshness explicitly

The `result` prop is one of:

```ts
{ status: 'ready', value: 2.4 }
{ status: 'pending', lastValue: 2.4 } // Optional last completed value; visible labels stay stable.
{ status: 'no-fit', message: 'Increase the hub diameter.' }
{ status: 'error', message: 'The solver could not run.' }
```

No-fit and error render no numeric achieved marker. Marks can be empty in any state. Achieved values
need not match marks or target steps. Values outside the scale get an honest readout without a
fabricated endpoint marker. Keep all projected controls and geometry on the same application result
revision. Picodash does not coordinate asynchronous solver requests.

The achieved readout immediately shows its destination. Its marker animates from its current painted
position, including interrupted motion. Reduced-motion users get direct placement. Animation never
writes Nexus values or emits a target-change callback.

## Share a gesture with a profile

```ts
const gesture = nexus.createNumericGesture(nexus.fields.bore, {
  onEnd(event) {
    // One logical edit. Observe event.outcome, reason, changed, and rollback.
    // Called in a microtask after the Nexus write lock has unwound.
  },
})
gesture.begin()
const result = gesture.update(2.37) // Normal transaction result; canonical updates are live.
gesture.commit() // Returns the same frozen event synchronously.
// Escape: gesture.cancel('escape')
// Lost capture: gesture.cancel('capture-lost')
// On unmount/cleanup:
gesture.release()
```

Begin returns false when already active. Update requires an active gesture and a finite number.
Rejected updates leave the gesture active at its last accepted canonical value. Commit/cancel on
an idle controller return undefined and emit nothing. Begin followed by commit without changes
emits `changed: false`. Release is idempotent and cancels a still-owned edit. Released controllers
cannot begin again.

Cancellation restores the starting value only while the gesture still owns the field revision.
External A→B→A writes revoke ownership, even when the final number looks unchanged. A new invalid
draft on the same input binding also supersedes its previous gesture. Unrelated fields are never
rolled back. If current validators reject restoration, `rollback` is `'rejected'` and the actual
final value remains visible. `finalValue: null` means an external write made the canonical value
nonnumeric; that write is preserved and the gesture is cancelled. Other rollback outcomes are `'applied'`, `'unnecessary'`, and
`'superseded'`. Treat cancellation as an observed outcome, not an unconditional promise of restoration.

Use `scope.createNumericGesture` for scope attribution. Advanced registered input bindings use
`scope.createNumericInputGesture(binding, options)`; a custom Dashlet render binding exposes
`binding.createNumericGesture(options)` for numeric fields. These preserve input drafts, issues,
and validation. Normal SliderDashlet and TargetSliderDashlet drag/held-key edits use this path.
Escape, capture loss, hidden ancestors, unmount and changed scale cancel ownership. Numeric text
editing retains NumberField's normal binding commit policy.

Destroying a scope cancels its gesture controllers. Root destruction checks active leases and existing unpersisted state before cancelling controllers.
If saving the cancellation rollback itself fails, destruction refuses to discard it: the gesture is
ended, but the root stays usable so the application can retry persistence or explicitly discard it. Active integration leases and unpersisted-state
checks still apply. Release controllers before destroying their application services.

## Link attention and deliberately open an input

```ts
import { revealDashlet } from '@picodash/dashstack'
const scope = nexus.scope('designer')
const main = scope.createItemInteractionSource('main:bore')
const mini = scope.createItemInteractionSource('mini:bore')
main.set({ hovered: true })
mini.set({ active: true })
main.set({ hovered: false }) // Does not erase mini's active state.

const linked = scope.getState().interaction.items
const nativeRow = linked.get('bore') // Dashlet publishes its own hover/focus/active flags.
const profile = linked.get('mini:bore') // App-owned IDs require no shell registration.

// Explicit Enter/click-to-edit command, never an ordinary hover handler:
const reveal = await revealDashlet(scope, 'bore')
if (!reveal.ok) console.info(reveal.reason) // not-found, rejected, or unavailable
main.release()
mini.release()
```

Use the scoped Nexus selector to derive row `glow` from profile-only IDs and profile highlighting
from row plus peer-profile IDs. This preserves a distinct treatment for remote attention. When its
row is collapsed, apply that derived glow to the top-level group's header using the group's `glow` prop. The application owns the mapping; neither hover nor focus opens groups implicitly.
The explicit reveal command expands ancestors, waits for their rendered availability, and focuses
the registered primary input. Disabled, removed, or unregistered controls return failure. Custom
controls register through `primaryFocusRef`; public NumberField and Slider register themselves.

## Label compact custom checkboxes

The unbound `Checkbox` has an accessible name but no visible-label slot. For a compact composite
row that needs a clickable visible label, use a native `<label>` containing a controlled
`<input type="checkbox">` and its text. Feed changes through the public binding or Nexus API.
Use `CheckboxGroupDashlet` when the collection itself should be a registered row. Do not wrap
Picodash's Checkbox (which already renders a label) in another label.

## Put an existing Stack inside a responsive Panel

Keep the existing root Nexus and scope ID. The nested Stack inherits the Panel's `designer` scope
when it omits both `id` and `nexus`, so existing Stack order and collapsed groups survive.

```tsx
import { DashPanel, DashPanelProvider, type DashPanelDefaultLayout } from '@picodash/dashpanel'

const defaultLayout: DashPanelDefaultLayout = narrow
  ? { placement: { mode: 'floating', disposition: { kind: 'free' } }, preferredPosition: { x: 8, y: 8 } }
  : { placement: { mode: 'fixed', disposition: { kind: 'docked', position: 'full-left' } } }

<DashPanelProvider nexus={nexus}>
  <DashPanel id="designer" title="Configuration"
    defaultLayout={defaultLayout} dockPositions={narrow ? [] : ['full-left']}>
    <DashStack aria-label="Configuration controls">
      {/* Keep the existing groups and Dashlets here. */}
    </DashStack>
  </DashPanel>
</DashPanelProvider>
```

The application supplies `narrow` from its own responsive policy. Changing `defaultLayout` is
supported. A valid saved dock disabled by `dockPositions` stays dormant; the declared fallback
renders without overwriting desktop preferences. Restoring the dock policy restores that saved
placement. A saved floating placement remains applicable and takes precedence over defaults.

This is an ordinary Panel, without modal focus containment or a backdrop. Drawer/sheet
presentations and skinny toolbar/pop-out Dashlets are not implemented in this snapshot. Import
`@picodash/dashpanel/style.css` as well as the Stack and UI styles. The complete compiled
`ResponsiveDesigner` example is included in `LinkedControls.tsx` in the dogfood bundle.

## Compare a numeric target and actual

Dogfood.11 adds `TargetNumberDashlet` and the unbound `TargetNumber` from
`@picodash/dashstack/ui`. The editable target is on the left and the read-only actual
is on the right. Both labels sit below their fields, aligned to the start edge.
`targetLabel` defaults to `"Target"`; `actualLabel` defaults to `"Actual"`.

```tsx
<TargetNumberDashlet
  id="reduction"
  label="Reduction"
  field={nexus.fields.reduction}
  step={0.01}
  unit=":1"
  result={{ status: 'ready', value: solver.reduction }}
  targetLabel="Target"
  actualLabel="Actual"
/>
```

`unit` is a display-only string suffix, so `:1` never enters the numeric field value.
It also works on `NumberField`, `NumberDashlet`, `TargetSlider`, and `TargetSliderDashlet`.
For localized numeric units, existing `formatOptions` still works. Do not supply both an
Intl unit formatter and the same `unit` suffix or the unit will appear twice. On TargetNumber,
`formatValue` formats only the actual number; `unit` supplies its suffix. On TargetSlider,
`formatValue` retains its existing role as the complete achieved readout, so add any unit there
or omit `formatValue` to use the new suffix automatically.

`TargetNumberResult` and `TargetSliderResult` accept the same ready, pending, no-fit, and error
variants. Pending with `lastValue` retains the last number without changing a visible label;
pending without one displays an em dash. Neither control stores a hidden previous solver result.
TargetNumber keeps the actual field in place for every state. TargetSlider reserves one short
result-message line, so pending, no-fit and error do not move the next Dashlet. Detailed result
messages remain available through accessible status text. Applications may instead keep the last
completed `ready` snapshot on each control and own freshness in one `aria-busy` workspace with a
delayed updating indicator. Picodash does not add a solver timer.

## Keep numeric intent when slider capacity changes

The TargetSlider input now follows its thumb above the track. Its position clamps at both track
edges, and its lift/scale has reserved space. Pointer motion remains direct; reduced motion turns
off the feedback transitions. The editable field stays mounted through scale and result changes.

For application-owned dynamic capacity, compose a Dashlet with unbound TargetSlider. `value`
positions the thumb; `inputValue` preserves numeric intent even when the latest capacity is smaller.
New edits should go through the application's constraint policy. Do not overwrite the stored intent
just because the presentation capacity changed.

```tsx
import { Dashlet, type SingleFieldDashletRenderContext } from '@picodash/dashstack'
import { TargetSlider } from '@picodash/dashstack/ui'

;<Dashlet id="bore" label="Bore" field={nexus.fields.bore}>
  {({ binding, labelId, disabled, readOnly }: SingleFieldDashletRenderContext<number>) => (
    <TargetSlider
      id={binding.controlId}
      aria-labelledby={labelId}
      value={Math.max(0, Math.min(capacity, binding.value))}
      inputValue={
        binding.dirty
          ? typeof binding.draftValue === 'number'
            ? binding.draftValue
            : null
          : binding.value
      }
      onChange={(next) =>
        binding.setInput(next === null ? null : Math.max(0, Math.min(capacity, next)))
      }
      createGesture={(options) => binding.createNumericGesture(options)}
      min={0}
      max={capacity}
      step={0.001}
      unit="mm"
      result={result}
      disabled={disabled}
      readOnly={readOnly}
    />
  )}
</Dashlet>
```

This example assumes positive capacity and values on the `0.001` grid. For zero capacity, render a
read-only numeric comparison instead of inventing a nonzero scale. If the application permits other
steps, supply a representable thumb value through its own constraint policy. `createGesture`
preserves Escape rollback and external-write ownership; ordinary text entry uses the binding draft.
The installed `LinkedControls.tsx` recipe includes this composition as `CapacityTarget`.
