# Dashlet feedback experiments

This pass explores feedback for dense, frequently used controls. It does not change the value,
selection, focus, or disclosure contracts. The default duration is the existing
`--picodash-duration-fast` token (150 ms). No extra runtime dependency was added.

## Design decisions

| Interaction         | Feedback                                                                                                          | Immediate behavior                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Segmented selection | React Aria moves the accent background between options.                                                           | Selection, border, and focus move to the new radio immediately. Keyboard selection skips the transition. |
| Checkbox and radio  | Rounded rectangular markers compress slightly on pointer press; the checkmark or inset centre settles into place. | Native checkbox/radio semantics and the existing row focus outline remain intact.                        |
| MultiSelect removal | Motion translates surviving chips into the vacant space without scaling their text.                               | The removed value and remove button disappear immediately. No exit ghost remains interactive.            |
| Group disclosure    | Motion reveals or clips the mounted child list from the header. Rapid reversal uses the current painted height.   | Collapse repairs focus before applying hidden, inert, and ARIA state. Keyboard disclosure is immediate.  |

Checkboxes retain a checkmark; radios use an inset rectangular centre. Both use the switch's corner
radius and the slider track's translucent neutral background when unselected. They measure 16 × 18
px in regular density and 14 × 16 px in Compact. The surrounding label remains the interaction
surface.

Selection paint uses ease-in-out because it moves between visible destinations. Chips and group
reveals use a short ease-out curve. Values and focus never wait for an animation promise. There are
no bouncing springs, animated labels, or delayed removal.

## Integration details

The installed React Aria `Radio` needs its render-prop `isSelected` explicitly passed to
`SelectionIndicator`. The indicator's presence is covered by the existing marker semantics test.

React Aria commits collection rows separately from the parent control. Chip feedback snapshots at
removal and waits for the TagList's child-list mutation before reading the surviving positions.
A callback ref owns the observer, media listener, animation cleanup, and node lifetime.

Group feedback has explicit idle, pending, and animating presentation states. It does not own the
Nexus collapse value. Tailwind preflight hides `[hidden]` with an important declaration, so closing
paint temporarily uses an important inline display override. The content remains inert and
ARIA-hidden throughout that paint. Completion, reversal, keyboard interaction, preference change,
and unmount restore the original styles.

`prefers-reduced-motion: reduce` removes CSS transitions and prevents imperative feedback.
An in-flight preference change cancels imperative motion. Keyboard interaction also settles any
active chip/group animation before continuing.

## Evidence

- DashStack: 262 tests pass, including reversal, immediate hidden/inert state, immediate chip
  removal, reduced-motion cancellation, keyboard suppression, and cleanup.
- Package formatting, lint, types, repository motion policy, and Lab production build pass.
- Live Contract Lab: observed the segmented indicator moving from the previous option while the
  new radio was already selected; keyboard selection had no transition and retained the full ring.
- Live Contract Lab: sampled opening heights between 0 and 220 px and a rapid closing/opening
  reversal. Hidden/inert switched immediately while closing paint continued, then cleared on reopen.
- Live Contract Lab: Option A disappeared before Option B translated approximately 30 px into its
  place. Keyboard removal moved focus to Option B with no translation.
- Regular dark and Compact light marker dimensions and presentation were checked in the browser.

The browser interface used for this pass does not expose media emulation. Reduced-motion evidence
is from the deterministic controller tests and stylesheet policy checks, not an OS-preference
browser run. Touch-device feel and broader assistive-technology testing remain separate checks.

## Research

[Emil Kowalski: You Don't Need Animations](https://emilkowal.ski/ui/you-dont-need-animations)
and [Great Animations](https://emilkowal.ski/ui/great-animations) informed the short durations,
interruptibility, immediate keyboard behavior, and decision to avoid decorative motion.

[React Aria customization](https://react-aria.adobe.com/customization) and
[styling](https://react-aria.adobe.com/styling) informed preserving the existing accessible controls
while changing their presentation. [Motion layout animations](https://motion.dev/docs/react-layout-animations)
reinforced moving chips without stretching their text; this implementation uses the already
installed imperative Motion API for the bounded removal transition.
