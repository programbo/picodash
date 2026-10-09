# TargetSliderDashlet

> Historical design exploration. Implemented by [ADR 0008](../adr/0008-organizational-subgroups-and-linked-controls.md).
> The [linked controls guide](../development/linked-controls.md) owns the final `result` union and public APIs;
> draft alternatives and open questions below are retained as design history, not current instructions.

> Contract: Draft
> Implementation: Planned
> Evidence: None for this component. Existing public layout and binding contracts are linked below.
> Source: John's design handoff through Mara, 2026-10-09; bore-domain and marker-motion decisions relayed by Maz the same day.
> Name: `TargetSliderDashlet` is approved. “MaraSlider 🦊” is a workshop nickname, not an export.

`TargetSliderDashlet` lets a user edit a requested numeric target while seeing the outcome selected
by the application. It is useful when constraints and priorities mean that a requested value cannot
always be achieved exactly.

This proposal records the agreed intent and identifies unresolved behavior before implementation.
It does not add an export, change an accepted contract, or describe a capability available in the
current dogfood packages, including `0.1.0-dogfood.6`. The direct-manipulation design is still being
explored.

## Meaning and ownership

| Term                    | Meaning                                                                                                                                    | Owner                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| Target                  | The requested numeric value, edited by the user or another application control.                                                            | Application/Nexus field                  |
| Feasible domain         | Outcomes the solver can produce: discrete values, continuous intervals, isolated points, or a combination. Not enumerated by this control. | Application solver                       |
| Marks                   | Optional authored reference ticks. They need not enumerate or describe the feasible domain.                                                | Consumer presentation                    |
| Achieved value          | The selected result after all relevant constraints and priority ordering.                                                                  | Application solver                       |
| Scale                   | The finite numeric interval mapped onto the track.                                                                                         | Consumer configuration                   |
| Allowed target interval | An optional continuous interval that limits edits, distinct from the feasible domain.                                                      | Consumer policy, enforced by the control |

Picodash renders the supplied information and handles input. It does not solve the domain, choose
the nearest option, infer priorities from row order, or copy the achieved value into the target.
For example, a module target of 1.5 may produce an achieved module of 1.4 even when 1.6 is available,
because reduction has higher priority. The control must display the supplied 1.4 result.

Numeric fields and direct manipulators can edit the same target field. They do not maintain
separate synchronized target stores. Hover, focus, gesture coordinates, and marker geometry remain
transient presentation state. Achieved value and marks do not require new persisted Nexus fields.

## Agreed anatomy and behavior

The editable thumb sits **above** the track and follows the requested target. It slides independently
of the authored marks and retains normal keyboard and accessible numeric-edit semantics.
“Freely sliding” means no snapping to marks or feasible outcomes. A finite positive `step` controls
target-edit precision; its default still needs a decision.

A distinct read-only marker sits **below** the track and animates to each new achieved position.
It carries the achieved readout, which immediately displays the supplied destination number,
whether or not it coincides with a mark. It is not a second thumb or an input. Its animated position
is transient presentation state: it never emits intermediate domain values or writes the target.

John confirmed two design directions on 2026-10-09: achieved values and authored marks are
independent systems that can be used together, and the achieved marker should animate as enjoyable
feedback. This supersedes the earlier direct-placement/no-transition recommendation. The component
as a whole remains Draft / Planned; motion details below are proposed implementation constraints.

Optional marks show authored numeric reference points without crowding the track. Their values and
any supplied labels must also be available accessibly. Marks are not individual tab stops and do not
become selectable options. Omitting `marks` or supplying `[]` renders no authored ticks and says
nothing about whether outcomes are available. Marks constrain neither the target nor the achieved
value; the control never requires exhaustive outcome membership.

Changes to marks or the achieved result preserve the target. Fixed scale with an allowed target
interval and a scale normalized to current feasible bounds remain presentation choices. Neither
choice permits silently clamping or replacing canonical state.

## Mapping to public DashStack layout

Use the existing [inline layout](../reference/dashstack.md#responsive-row-and-compound-layout).
The outer row has four tracks: affordance, label, fluid control, and optional trailing value.
A single content root spans the final two tracks when there is no separate trailing-value sibling.
The target track, upper thumb, lower marker, and associated readouts form that one content root.

This satisfies “the two columns to the right of the label.” It requires neither a new full-width
layout variant nor application CSS targeting private grid classes. `layout="block"` already exists
for below-label content, but is not required by this design. Internal vertical room for both markers
must be verified in regular and compact density, narrow Stacks, and reordered drag previews.

The component should use the shared shell's label, description, issue area, focus registration,
read-only/disabled policies, and draft/discard behavior. It should not add a competing shell or
independent validation/reset controls. Its combined root may have a wider track than an ordinary
Slider row that reserves the final column for a separate output; that is intentional.

## Proposed API direction, not an importable signature

Follow the existing [bound and unbound control layers](../reference/dashstack.md#component-specific-ready-made-props):

| Layer                                                       | Proposed inputs                                                                           | Authority                                               |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `TargetSliderDashlet` at the DashStack root                 | One numeric `field`; `achieved`; optional `marks`; scale and presentation props.          | Target comes exclusively from the binding.              |
| A corresponding controlled `/ui` primitive, name to confirm | Numeric target and change callback; the same `achieved`, `marks`, and presentation props. | Consumer supplies controlled state; no Nexus knowledge. |

Do not add both `field` and a competing controlled target prop to the ready-made Dashlet.
The prop names below are the proposed direction. Exported types, defaults, and whether the unbound
primitive ships in the same slice remain proposed. No change to the facade or catalog inventory
is implied yet.

| Proposed prop                                             | Meaning                                                                                                                                  |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `achieved: number \| null`                                | Required consumer-supplied result. A finite number places the read-only marker; `null` means unavailable. Zero is a result, not absence. |
| `marks?: readonly { value: number; label?: ReactNode }[]` | Optional reference points, matching the ordinary Slider's authored mark shape. No `options` prop or outcome-membership check.            |
| `min`, `max`                                              | Finite track scale; never inferred from marks. Defaults remain to be decided.                                                            |
| `step`                                                    | Finite positive target-edit precision. It neither quantizes the achieved value nor generates marks.                                      |
| `allowedRange?`                                           | Candidate continuous target-edit restriction, separate from solver feasibility; adoption follows D2.                                     |

The smallest candidate data model is a finite numeric target, a finite achieved number or `null`,
and optional finite marks. The application owns feasibility; the first version needs no feasible-domain
prop. Unit formatting must be shared by target, achieved readout, accessible text, and mark values.
Achieved values and marks may have greater precision than the target's step; they must not be
rounded onto that step or silently deduplicated by formatted text. An achieved value outside the
track scale is a presentation mismatch, not an excuse to snap to a mark or fabricate an edge value;
its exact readout remains visible, with the marker/warning treatment to settle under D2.

### Bore example: a continuous interval plus isolated zero

Suppose the application permits a finished bore of `0` (no bore) or any diameter in
`[minimumBore, maximumBore]`. The target remains editable throughout `[0, maximumBore]`, including
requested diameters in `(0, minimumBore)`. Do not use `allowedRange` to remove that target interval:
it expresses requests the solver may be unable to achieve, not invalid edits by definition.

For `minimumBore = 2`, `maximumBore = 8`, and target `step = 0.01`, the application may supply:

| Target | Supplied `achieved` | Optional `marks`                             | Required display                                                                |
| ------ | ------------------- | -------------------------------------------- | ------------------------------------------------------------------------------- |
| `0.15` | `0`                 | `[{ value: 0 }, { value: 2 }, { value: 8 }]` | Target at 0.15 and achieved marker at zero.                                     |
| `2.37` | `2.37`              | The same three marks                         | Both values at 2.37 in their distinct upper/lower roles, despite no mark there. |
| `2.37` | `2.37`              | Omitted or `[]`                              | The same target/result behavior, with no authored ticks.                        |

These are supplied solver results, not a nearest-value rule. Picodash does not choose zero for small
bore requests, skip the gap itself, or enumerate every hundredth of a millimetre. A separate numeric
editor can bind the same target field. The application can explain “No bore, or at least 2 mm”
through the existing description; optional marks are not a complete feasibility legend. Animating
from zero across the gap to the minimum bore is a visual transition between supplied results, not
a claim that intervening bore diameters are feasible.

## Decisions to resolve

### D1. Equality, availability, and coherent results

**Recommended:** keep both markers visible in their separate vertical positions on an exact match,
with explicit target and achieved labels. Do not merge them into one interactive marker. Compare
actual values using a declared numeric rule, not their formatted strings. If formatting makes
unequal numbers look equal, retain distinguishing precision or avoid an “exact match” claim.
Whether exact equality is sufficient or a consumer-supplied tolerance is needed remains open.

An unavailable achieved result needs visible text, not a marker fabricated at zero or at the target.
Recommend keeping a valid target editable when an input domain still exists, with “Achieved value
unavailable.” A marker cannot be placed for `null`. Empty or omitted marks do not make a result
unavailable; a non-null achieved value need not be a member of marks or lie on the target step grid.

How stale or pending solver results are represented remains open. Recommend one coherent
consumer-provided result snapshot rather than inferring freshness from render timing. `null` alone
must not be interpreted as proof of no feasible outcomes rather than a pending result. A last-valid
result, if supported, must be identified as such.

### D2. Scale, constraints, and changes during a gesture

**Recommended:** separate the full scale, the allowed target interval, authored marks, and the
application-owned feasible domain. Existing Slider `allowedRange` restricts pointer and keyboard
edits to one continuous interval; it does not mean “only the ticks.” Changing marks, achieved value,
or solver feasibility must not introduce an input restriction. Decide whether TargetSlider adopts
that prop unchanged. A visual feasible-region prop would be a separate future proposal, not a
prerequisite for displaying continuous achieved values.

Changing `min`/`max` remaps coordinates; it does not normalize the stored physical target into a
percentage. A canonical target outside the new scale or allowed interval needs an honest exact
readout and a presentation warning, consistent with the
[existing mismatch contract](../reference/dashstack.md#component-specific-ready-made-props).
An edge indicator, an unavailable editor, and explicit replacement interaction remain choices to
settle. No ordinary in-range thumb may falsely imply that an out-of-range target equals the edge.

Consumer-supplied scale changes must remain valid even when the solver can produce zero or one
outcome. Deriving scale bounds in the application cannot produce an invalid zero-width or reversed
scale. The control must never derive bounds from the first and last marks. Decide the fallback
scale or unavailable-editor presentation explicitly.

If scale, constraints, target, or marks change while dragging, gesture handling needs explicit
states and cancellation rules. Recommend marks/result-only updates leave the gesture intact,
while coordinate-changing scale updates end the gesture without an extra target write. Confirm
this against live remapping before implementation. An external target write must follow the
existing binding conflict policy rather than being overwritten by a stale drag.

### D3. Precision, pointer/touch, and keyboard edits

**Recommended:** inherit the ordinary Slider's configured step and keyboard navigation, without
jumping between available outcomes. Arrow keys, Home/End, and supported larger-step commands must
apply to the target's editable interval. Clarify a suitable default step for fractional quantities;
the current Slider default of one may be unsuitable for module values.

Pointer and touch hit targets must remain usable independently of the small visible thumb.
Confirm track-click behavior, cancellation on lost capture, and whether clicking the read-only
marker does nothing or focuses the target. Marker/tick clicks must never become implicit
“use achieved” or “pick this outcome” writes. Touch scrolling must remain usable outside a captured
gesture. Read-only and disabled states retain their different shell semantics.

The target thumb must respond immediately to pointer, touch, and keyboard input; it must not ease
behind the input or wait for the achieved-marker animation. If an implementation introduces coordinated
gesture, external-update, and cancellation behavior, model that protocol explicitly; do not scatter
it across unrelated effects and booleans. The worst state machine is the one you don't know you're
writing. Select XState or the existing trusted control's protocol only after the required states
are known; this proposal does not mandate a new runtime dependency.

### D4. Accessible and visible numeric presentation

**Recommended:** give the target input an accessible name such as “Module target” and report its
requested value, units, range, and step. Give the achieved output a separate name such as “Achieved
module.” Achieved value must never replace the target's accessible value. Neither the marker nor
each tick adds a slider role or tab stop.

Confirm where the visible target readout lives, and whether it is directly editable. It must fit
inside the combined control root rather than restoring a separate final-column readout. A compact
upper readout is a candidate; the achieved readout stays below. Labels must remain legible when
markers coincide or approach either end. Position and text must distinguish the roles without
relying on color.

For authored marks, recommend a short accessible description plus an on-demand textual list
with one disclosure control when the set is long. Describe these as reference marks, not an
exhaustive list of feasible outcomes. Decorative ticks can then be hidden from the accessibility
tree without hiding their values. Confirm this against compactness and touch needs;
announcing the full list on every arrow key would be excessive. Define whether result changes are
announced on settled edits or via a deliberate status action, rather than creating a live-region
announcement for every pointer frame.

If an editable numeric presentation is included, preserve rejected drafts and the shell's discard
behavior. Use real selection/deletion when testing empty input: the
[NumberField automation caveat](../development/numeric-targets.md) still applies.

### D5. Dense ticks and marker motion

**Recommended:** place ticks at actual numeric positions, not evenly spaced mark indices. When
authored marks are dense enough to overlap, any visual thinning must be deterministic, keep the
complete accessible mark list, and never change target editing or the achieved value. Decide whether
thinning is allowed or whether ticks simply merge visually in the first version.

The achieved marker animates between supplied numeric results. Its visible and accessible readouts
show the latest supplied destination immediately; they do not count through interpolated numbers.
Animation must not delay result availability, emit change callbacks, trigger solver work, or create
Nexus writes. The target thumb and target readout remain immediate under input.

Retarget an interrupted animation from its current rendered position toward the newest result,
without jumping back to the previous result or queuing obsolete destinations. Keep motion within
the track and avoid overshoot. Respect `prefers-reduced-motion` by placing the marker at the latest
result immediately; enabling reduced motion mid-transition should finish it immediately. These
rules apply whether results follow pointer, keyboard, or external application changes.

**Recommended lifecycle:** place the first available result directly, since there is no preceding
result to animate from. If `achieved` becomes `null`, cancel motion and remove the numeric marker;
show the unavailable presentation from D1. A later numeric result starts directly at its supplied
position. Coordinate-changing scale updates should cancel the old animation and remap the latest
result; out-of-scale values follow the mismatch presentation rather than an animation to a false
edge value. Confirm these lifecycle choices with the gesture policy in D2 before implementation.

Keep the achieved readout associated with its moving marker, with no overlap of the upper thumb,
focus ring, or adjacent rows. Duration and easing remain visual tuning choices, not user-fixed
numbers or new public props. Tune for short, interruptible feedback without bounce or a backlog
under frequent solver updates. Exact shape and contrast remain visual-design decisions.

## Acceptance examples for a future implementation

| Scenario                                                  | Required invariant or decision to prove                                                             |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Target 1.5; marks 1.0, 1.4, 1.6; achieved 1.4             | Upper target stays at 1.5; lower marker shows supplied 1.4; no nearest-match calculation.           |
| Target equals achieved                                    | Both roles and values remain identifiable; equality rule follows D1.                                |
| Marks change but target does not                          | Ticks may move; target and achieved values remain unchanged; zero target writes.                    |
| Target lies between sparse marks                          | Pointer and keyboard can retain it at the configured precision.                                     |
| Marks omitted or empty; achieved 2.37                     | Show achieved 2.37 with no ticks; do not infer unavailable outcomes.                                |
| Target 0.15; achieved 0; bore minimum 2                   | Preserve target in the solver's gap; display zero as a real achieved result.                        |
| Target and achieved 2.37; marks only 0, 2, 8              | Display both roles at 2.37; no membership check or snapping.                                        |
| Target step 0.1; achieved 2.37                            | Preserve achieved precision independently of the target grid and marks.                             |
| Achieved changes from 0 to 2 across the bore gap          | Animate position only; readout immediately shows 2; no intermediate domain values or target writes. |
| A newer achieved result arrives during motion             | Retarget from the rendered position; no jump back, queued results, or track overshoot.              |
| Reduced motion is active or enabled during motion         | Place the marker at the latest result immediately; preserve the same numeric and input behavior.    |
| First result, null result, or scale change during motion  | Apply D5's explicit lifecycle policy; do not animate from a fabricated result.                      |
| Target is edited while achieved marker moves              | Target feedback remains immediate for pointer, touch, and keyboard.                                 |
| Achieved is null, pending, or stale                       | Null has no marker; follow D1's explicit pending/stale policy; never infer it from marks.           |
| Scale shrinks past the target or collapses to one outcome | Preserve the exact target; follow D2's warning/fallback policy.                                     |
| Bounds or external target change during drag              | Follow D2's interruption/conflict rule; no stale-coordinate write.                                  |
| Read-only, disabled, rejected draft, or stale draft       | Preserve existing binding and shell policies with target/achieved attribution.                      |
| Narrow, compact, zoomed, coarse-pointer, or reordered row | Keep readable labels, usable targets, unclipped focus, and the combined inline span.                |

Type tests should prove the binding and controlled APIs cannot introduce competing target
owners. Pure/component tests should prove no writes on result/marks updates, event parity,
mismatch and draft handling, and accessible relationships. Motion tests must distinguish supplied
numeric values from interpolated geometry and prove interruption, null, scale-change, and reduced-motion
behavior without domain writes. Contract Lab browser checks should prove real pointer/touch geometry,
keyboard focus, exact-match legibility, dense ticks, responsive layout, destination readout stability,
and smooth retargeting without overshoot or delayed target feedback. Screen-reader behavior needs direct evaluation before claiming accessibility verification.

## Excluded from this proposal

The planetary designer's square physical-scale view and its direct-manipulation rings remain
application-owned. Minimum ring wall, sun/planet split, sun bore, and the representative planet bore
may edit domain targets, but do not create gear-specific TargetSlider behavior. Planet count's
atomic open-ended range is a separate [composition](../development/open-ended-ranges.md), not a
second endpoint on TargetSlider. No consumer changes, solver work, implementation, or package
release are authorized by this handoff.
