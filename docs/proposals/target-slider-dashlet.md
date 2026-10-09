# TargetSliderDashlet

> Contract: Draft
> Implementation: Planned
> Evidence: None for this component. Existing public layout and binding contracts are linked below.
> Source: John's design handoff through Mara, 2026-10-09.
> Name: `TargetSliderDashlet` is approved. “MaraSlider 🦊” is a workshop nickname, not an export.

`TargetSliderDashlet` lets a user edit a requested numeric target while seeing the outcome selected
by the application. It is useful when constraints and priorities mean that a requested value cannot
always be achieved exactly.

This proposal records the agreed intent and identifies unresolved behavior before implementation.
It does not add an export, change an accepted contract, or describe a capability available in the
current dogfood packages. The direct-manipulation design is still being explored.

## Meaning and ownership

| Term                    | Meaning                                                                                              | Owner                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Target                  | The requested numeric value, edited by the user or another application control.                      | Application/Nexus field                  |
| Available options       | Numeric outcomes supplied by the application for this control's current context. They may be sparse. | Application                              |
| Achieved value          | The selected result after all relevant constraints and priority ordering.                            | Application solver                       |
| Scale                   | The finite numeric interval mapped onto the track.                                                   | Consumer configuration                   |
| Allowed target interval | An optional continuous interval that limits edits, distinct from the available outcomes.             | Consumer policy, enforced by the control |

Picodash renders the supplied information and handles input. It does not solve the domain, choose
the nearest option, infer priorities from row order, or copy the achieved value into the target.
For example, a module target of 1.5 may produce an achieved module of 1.4 even when 1.6 is available,
because reduction has higher priority. The control must display the supplied 1.4 result.

Numeric fields and direct manipulators can edit the same target field. They do not maintain
separate synchronized target stores. Hover, focus, gesture coordinates, and marker geometry remain
transient presentation state. Achieved value and options do not require new persisted Nexus fields.

## Agreed anatomy and behavior

The editable thumb sits **above** the track and follows the requested target. It slides independently
of the available-option ticks and retains normal keyboard and accessible numeric-edit semantics.
“Freely sliding” means no snapping to outcomes; numeric precision and step still need a decision.

A distinct read-only marker sits **below** the track at the achieved value. It carries the achieved
readout and moves between supplied outcomes. It is not a second thumb or an input. Its movement
never writes the target. There is no transition through intermediate values that could imply an
achievable result unless a later motion decision explicitly permits a purely visual treatment.

Small unlabelled ticks show available options without crowding the track. Their values must also be
available accessibly. Ticks are not individual tab stops and do not implicitly become selectable
options. Sparse ticks do not constrain where the target can be placed.

Changes to options or the achieved result preserve the target. Fixed scale with an allowed target
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

| Layer                                                       | Proposed inputs                                                                        | Authority                                               |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `TargetSliderDashlet` at the DashStack root                 | One numeric `field`; available options; achieved result; scale and presentation props. | Target comes exclusively from the binding.              |
| A corresponding controlled `/ui` primitive, name to confirm | Numeric target and change callback; the same result/options and presentation props.    | Consumer supplies controlled state; no Nexus knowledge. |

Do not add both `field` and a competing controlled target prop to the ready-made Dashlet.
Concrete prop names, exported types, defaults, and whether the unbound primitive ships in the same
slice remain proposed. No change to the facade or catalog inventory is implied yet.

The smallest candidate data model is a finite numeric target, a readonly array of distinct finite
numeric options, and a finite achieved number or `null`. This is a proposal, not accepted validation
behavior. Unit formatting must be shared by target, achieved readout, accessible text, and option
values. Options may need greater precision than the editable target's step; they must not be rounded
onto that step or silently deduplicated by formatted text.

## Decisions to resolve

### D1. Equality, availability, and coherent results

**Recommended:** keep both markers visible in their separate vertical positions on an exact match,
with explicit target and achieved labels. Do not merge them into one interactive marker. Compare
actual values using a declared numeric rule, not their formatted strings. If formatting makes
unequal numbers look equal, retain distinguishing precision or avoid an “exact match” claim.
Whether exact equality is sufficient or a consumer-supplied tolerance is needed remains open.

An empty options array and an unavailable achieved result need visible text, not a marker fabricated
at zero or at the target. Recommend keeping a valid target editable when an input domain still
exists, with “No available outcomes” or “Achieved value unavailable” as appropriate. A marker cannot
be placed for `null`. Whether empty options always require a null achieved value is unresolved.

Confirm whether a non-null achieved value must be a member of options, and how stale or pending
solver results are represented. Recommend one coherent consumer-provided result snapshot, rather
than inferring freshness from render timing. A result outside the options must not be silently
snapped to a listed option. A last-valid result, if supported, must be identified as such.

### D2. Scale, constraints, and changes during a gesture

**Recommended:** separate the full scale, the allowed target interval, and the set of available
outcomes. Existing Slider `allowedRange` restricts pointer and keyboard edits to one continuous
interval; it does not mean “only the ticks.” Merely changing the feasible options must not introduce
an input restriction. Decide whether TargetSlider adopts that prop unchanged or needs an explicitly
visual feasible-region prop.

Changing `min`/`max` remaps coordinates; it does not normalize the stored physical target into a
percentage. A canonical target outside the new scale or allowed interval needs an honest exact
readout and a presentation warning, consistent with the
[existing mismatch contract](../reference/dashstack.md#component-specific-ready-made-props).
An edge indicator, an unavailable editor, and explicit replacement interaction remain choices to
settle. No ordinary in-range thumb may falsely imply that an out-of-range target equals the edge.

Zero, one, and many outcomes must be considered separately. Normalizing to the current feasible
bounds cannot produce an invalid zero-width or reversed scale when there are fewer than two
outcomes. Decide the fallback scale or unavailable-editor presentation explicitly.

If scale, constraints, target, or options change while dragging, gesture handling needs explicit
states and cancellation rules. Recommend options/result-only updates leave the gesture intact,
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

The control must not ease the thumb behind the pointer. If an implementation introduces coordinated
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

For available options, recommend a short accessible description plus an on-demand textual list
with one disclosure control when the set is long. Decorative ticks can then be hidden from the
accessibility tree without hiding their values. Confirm this against compactness and touch needs;
announcing the full list on every arrow key would be excessive. Define whether result changes are
announced on settled edits or via a deliberate status action, rather than creating a live-region
announcement for every pointer frame.

If an editable numeric presentation is included, preserve rejected drafts and the shell's discard
behavior. Use real selection/deletion when testing empty input: the
[NumberField automation caveat](../development/numeric-targets.md) still applies.

### D5. Dense ticks and marker motion

**Recommended:** place ticks at actual numeric positions, not evenly spaced option indices. When
options are dense enough to overlap, any visual thinning must be deterministic, keep the complete
accessible option list, and never change the available outcomes or achieved value. Decide whether
thinning is allowed or whether ticks simply merge visually in the first version.

Keep the achieved readout associated with its marker when values jump, and avoid overlap with the
upper thumb, focus ring, or adjacent rows. Initial behavior should place the marker directly at its
supplied value. Any later motion must respect reduced motion and must not suggest an intermediate
solution or delay target feedback. Exact shape, contrast, and motion remain visual-design decisions.

## Acceptance examples for a future implementation

| Scenario                                                  | Required invariant or decision to prove                                                   |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Target 1.5; options 1.0, 1.4, 1.6; achieved 1.4           | Upper target stays at 1.5; lower marker shows supplied 1.4; no nearest-match calculation. |
| Target equals achieved                                    | Both roles and values remain identifiable; equality rule follows D1.                      |
| Options change but target does not                        | Ticks/result may move; zero target writes.                                                |
| Target lies between sparse options                        | Pointer and keyboard can retain it at the configured precision.                           |
| Empty options or unavailable result                       | Explicit unavailable presentation; no fabricated marker or target replacement.            |
| Achieved is absent from options, pending, or stale        | Apply the explicit D1 policy; do not conceal inconsistent information.                    |
| Scale shrinks past the target or collapses to one outcome | Preserve the exact target; follow D2's warning/fallback policy.                           |
| Bounds or external target change during drag              | Follow D2's interruption/conflict rule; no stale-coordinate write.                        |
| Read-only, disabled, rejected draft, or stale draft       | Preserve existing binding and shell policies with target/achieved attribution.            |
| Narrow, compact, zoomed, coarse-pointer, or reordered row | Keep readable labels, usable targets, unclipped focus, and the combined inline span.      |

Type tests should prove the binding and controlled APIs cannot introduce competing target
owners. Pure/component tests should prove no writes on result/options updates, event parity,
mismatch and draft handling, and accessible relationships. Contract Lab browser checks should prove
real pointer/touch geometry, keyboard focus, exact-match legibility, dense ticks, and responsive
layout. Screen-reader behavior needs direct evaluation before claiming accessibility verification.

## Excluded from this proposal

The planetary designer's square physical-scale view and its direct-manipulation rings remain
application-owned. Minimum ring wall, sun/planet split, sun bore, and the representative planet bore
may edit domain targets, but do not create gear-specific TargetSlider behavior. Planet count's
atomic open-ended range is a separate [composition](../development/open-ended-ranges.md), not a
second endpoint on TargetSlider. No consumer changes, solver work, implementation, or package
release are authorized by this handoff.
