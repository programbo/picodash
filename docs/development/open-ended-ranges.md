# Compose an open-ended count range

Keep an unrestricted upper bound as `null` in application state. In dogfood `.23`, map it to a
finite `endDetent={{ value: sentinel, label: 'Any' }}` on RangeSlider. The sentinel is a presentation
value and never enters the domain request. The earlier Any maximum checkbox is no longer needed.

## Use the composition

Copy `example/OpenCountRange.tsx` into your app. It exports `createOpenCountNexus` and
`OpenCountRangeRecipe`. Import `@picodash/picodash/style.css` once and create the model once for the
application/client lifetime. The source fixture is `packages/picodash/tests/dogfood/OpenCountRange.tsx`.
Pass `feasibleMax` and `achieved` from the solver as finite safe integers or `null`; null means no
candidates/no solution. Two is this example's domain floor, not a planetary-gear rule.

The request remains one validated field:

```ts
type CountWindow = { min: number; max: number | null }
const requested: CountWindow = { min: 3, max: null }
```

`projectCountWindow` includes the feasible ceiling and any finite requested endpoint in the numeric
scale, then places Any at `scaleMax + 1`. It rejects a ceiling with no safe integer left for the
sentinel. The control provides a separate physical gap; the sentinel's numerical distance does not
set that gap's width. Changing feasibility only changes this projection, never the stored request.

| Action                                                                                     | Stored request                        |
| ------------------------------------------------------------------------------------------ | ------------------------------------- |
| Feasible ceiling changes while Any is selected                                             | Keeps `max: null`                     |
| Move Start while Any is selected                                                           | Changes `min`, keeps `max: null`      |
| Move End inward from Any                                                                   | Sets the last regular numeric maximum |
| Reach the regular numeric maximum                                                          | Keeps a finite maximum                |
| Pull End through its detent, press End, or press its increasing arrow again at the maximum | Sets `max: null`                      |

Both `onChange` and the gesture adapter map `{ start, end }` to the complete `{ min, max }` record.
The adapter wraps `binding.createValueGesture(options)` and forwards begin/commit/cancel/release;
its update maps the sentinel back to null. Keeping the live `active` getter is essential: external
writes revoke gesture ownership synchronously. Escape restores the initial whole record only while
that gesture still owns it. Never independently write the two bounds or let a local rollback
replace newer application data. The copyable example includes this adapter.

A finite request beyond the feasible ceiling remains visible and editable; it is not proof of a
solution. No candidates produce a finite fallback scale and “No feasible solution” in the separate
Planets Dashlet. The solver owns feasibility and priorities. A rejected draft must not replace the
accepted design or achieved result.

## Public control contract

`RangeSlider` and `RangeDashlet` accept finite `startDetent` and `endDetent` objects using the same
`{ value, label }` shape as Slider. Start's extra stop belongs only to the lower thumb; End's belongs
only to the upper. Numeric endpoints remain ordered and step-aligned. Both thumbs can coincide in
the numeric interval; neither crosses the other or enters the other thumb's detent.

Track clicks select numeric values. Pulling a thumb beyond its endpoint crosses the resisted gap.
Held arrows park at the numeric boundary; release and press again to enter the detent. Home/End
select the active thumb's permitted outer limit. RTL reverses horizontal arrows. Native accessible
value text announces Any/Off at the respective stop. `formatValue(range)` controls the combined
visual readout, for example `3–Any` or `3–∞`; it does not change accessibility or saved meaning.

RangeDashlet binds one finite `{ start, end }` field and supplies owned gesture handling automatically.
Nullable domain fields use the custom Dashlet adapter above. Unbound RangeSlider takes `createGesture`
when a host needs revision-safe rollback; without it, it remains a controlled input whose owner
handles cancellation. Detents do not add arbitrary uneven steps, allowedRange, or reference marks.
Never send `null` or `Infinity` to the control.

## Derived scalar results

An asynchronous solver's achieved count need not become a second Nexus field. Render an unbound
`Dashlet` with an `output`, as the example does for Planets. Use `DisplayDashlet` when the result is
already a Nexus field. For pending results, show “Calculating” or explicitly label a retained result
as previous; for no-fit show “No feasible solution”; do not silently present a stale result as fresh.
The example's `achieved: null` means no-fit, not pending. Apps with pending/error states should pass
their explicit result state to their own readout component.

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

The copyable example tests projection changes without writes, whole-record Start/End edits,
Any-to-finite and finite-to-Any transitions, infeasible saved intent, and rejection of Infinity.
It is typechecked in the isolated tarball consumer. DashStack tests own detent keyboard semantics,
ordered updates, cancellation, external-write fencing, configuration changes and read-only behavior;
Nexus gesture tests own atomic rollback and revision fencing. Browser checks own pointer geometry,
RTL, spring paint and reduced motion. The application's solver needs its own feasibility tests.
