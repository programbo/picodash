# Compose an open-ended count range

Keep an unrestricted upper bound as `null` in application state. Project it to a finite endpoint
for Picodash's range control, and provide an explicit **Any maximum** checkbox. This preserves the
request when other inputs change the current feasible ceiling.

The public APIs used here are available in dogfood `.2`. Snapshot `.5` adds this guide and
`example/OpenCountRange.tsx`; it does not change runtime APIs. In the source checkout, the tested
example is `packages/picodash/tests/dogfood/OpenCountRange.tsx`.

## Use the composition

Copy `example/OpenCountRange.tsx` into your app. It exports an application-owned model factory and
`OpenCountRangeRecipe`, which renders a bound Dashlet inside its own Stack. Import
`@picodash/picodash/style.css` once and create the model once for the appropriate application/client
lifetime, as in the [numeric target example](numeric-targets.md#start-with-the-example).

Pass the model as `nexus`, the solver's current ceiling as `feasibleMax`, and its achieved count as
`achieved`. Both solver props are finite safe integers or `null`; `feasibleMax: null` means there are
no candidates, while `achieved: null` means no solution satisfies the request. The example's domain
floor of two is illustrative, not a planetary-gear rule. Adapt it to the application.

The public primitives come from `@picodash/dashstack/ui`. `RangeSlider` is controlled and does not
write Nexus itself. The bound Dashlet supplies the binding, draft handling, and discard action.
The checkbox's `aria-label` is also its visible label. No extra label or duplicate discard button
is needed.

## Store intent, derive the endpoint

The entire request is one validated Nexus field:

```ts
type CountWindow = { min: number; max: number | null }
// Example initial request:
const requested: CountWindow = { min: 3, max: null }
```

The adapter uses these rules:

| Action                                | Stored request                  | Display                                |
| ------------------------------------- | ------------------------------- | -------------------------------------- |
| Feasible ceiling changes from 8 to 12 | Remains `{ min: 3, max: null }` | End moves from 8 to 12                 |
| Move only Start from 3 to 4           | `{ min: 4, max: null }`         | Any remains selected                   |
| Move End from 12 to 11                | `{ min: 4, max: 11 }`           | Any becomes unselected                 |
| Move a finite End to the far right    | Keeps a finite maximum          | Does not silently mean Any             |
| Select Any maximum                    | `{ min: 4, max: null }`         | End uses the current finite projection |

Toggling Any off uses the displayed endpoint as the explicit maximum. All edits submit one whole
record through `binding.setInput`; there is no intermediate state with separately written bounds.
Recomputing the display does not call a setter or create a Nexus notification.

The essential projection is:

```ts
const end = requested.max ?? Math.max(requested.min, feasibleMax ?? requested.min)
const value = { start: requested.min, end }
const scaleMax = Math.max(countFloor + 1, end, feasibleMax ?? countFloor)
```

The copyable example contains `projectCountWindow` and `applyCountDrag`. These are application
helpers, not Picodash exports. They preserve `null` when only Start changes, and use the new finite
End when that endpoint changes. A no-op edit at End leaves Any unchanged; use the checkbox for an
explicit mode change.

When the ceiling drops below the requested minimum, the track still displays the request. When an
explicit finite maximum exceeds the ceiling, it also stays intact and the scale extends to show it.
A finite endpoint is therefore **not proof of feasibility**. The separate requested-range, feasible-
ceiling, and achieved-count readouts explain the difference. With no candidates, the track uses a
finite fallback and the achieved readout says “No feasible solution.” Neither case silently rewrites
saved intent.

This example validates integer, ordered request bounds, not gear geometry. Compute `achieved` from
accepted Nexus values and committed priority using your solver. A rejected draft must not replace
the accepted design or its achieved result. Choose an explicit application policy if infeasible
requests should instead be rejected; Picodash does not choose that policy for you.

## Public control limits

`RangeSlider` and ready-made `RangeDashlet` take finite `{ start, end }` values with finite
`min`, `max`, and `step`. They have no open-ended endpoint prop. Do not pass `null` or `Infinity`
to the control. `null` belongs in the application's request field, while `Infinity` is not valid
Nexus JSON data.

The public range control does not expose `allowedRange`, `marks`, or per-thumb custom value text.
Its Start and End inputs remain numeric. The example associates both with the explanatory readout;
“Any” is conveyed by that description and the checkbox, not by an unbounded thumb announcement.
If a thumb must itself announce “Any” in place of a number, that needs a public control extension.
The example has keyboard/DOM evidence, not a screen-reader usability certification.

## Choose a module slider's scale

For a single module target, `SliderDashlet` supports either changing `min`/`max` or keeping the full
scale fixed and setting `allowedRange={{ min: feasibleMin, max: feasibleMax }}`. A changing physical
scale visually normalizes the current interval without storing a second percentage field. A fixed
scale preserves spatial meaning and shows unavailable portions of the track.

`allowedRange` is one continuous interval within the full scale, with step-aligned bounds. It is not
a list of valid values. If a new interval excludes the accepted value, application business logic
must decide whether to adjust it atomically, retain the request and display a no-fit state, or reject
the change. The ready-made Dashlet does not silently rewrite Nexus; an incompatible value can produce
a presentation warning. Do not render a range with reversed bounds when there is no solution.

If the UI genuinely needs a 0–100 scale, use an unbound `Slider` inside a bound Dashlet and map its
finite percentage to the canonical physical value. Handle a zero-width feasible interval separately,
and apply your domain's quantization before submitting the physical value. Treat the percentage as
derived presentation, not a second persisted source of truth.

For sparse feasible values such as `[3, 5, 8]`, marks merely label positions; they do not prevent 4,
6, or 7. Use a Select/Segmented control for a small set, or an application-owned integer-index slider
that maps indices to candidates. Persist the actual candidate value or stable identity, not an index
whose meaning changes when the candidate list changes. A minimum and maximum alone cannot represent
that sparse feasible set.

## Verification

The example test exercises ceiling changes without writes, atomic Start/End edits, explicit Any
selection, preservation of a finite request beyond the ceiling, no-candidate display, and rejection
of Infinity. It also runs with public typechecking in the standalone tarball-consumer check. This
validates the adapter and package boundary; the application's solver still needs its own feasibility
and priority tests.
