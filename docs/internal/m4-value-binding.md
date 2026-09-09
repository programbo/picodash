# M4: standalone DashList value binding

The owner approved M4 after hands-on use on 2026-09-09, reporting that it works nicely.
This is the recovery project's M4, not Phase 4 Picodash integration.

## Scope decision

On 2026-09-09 the owner authorized proceeding with the existing public Nexus API and reassessing
its fitness from M4/M5 evidence while D1 remains open. This is not blanket acceptance of the full
Nexus contract or a claim that the D1 decision gate has closed.

The retained slice is one ephemeral Nexus, three typed fields, field validation, public field
handles, standalone List IDs, and `setValues`. DashList owns binding registration, drafts, issues,
and subscriptions. The application owns root creation and destruction after its Lists unmount.
No application code imports the integration lease API or private package sources.

The alternative of replacing Nexus or introducing application-owned mirror state is deferred:
this slice can exercise the existing public contract directly. M5 still needs evidence for reset,
atomic validation, and persistence. Documents, migration, recovery plans, groups, ordering, and
additional Dashlets remain outside M4.

## Runnable example

Reserve the worktree port with `bun run port:reserve`, then run `LAB_PORT=<reserved-port> bun run lab`.
Open `/lab` and choose **Value binding**. The preset keeps its existing `interaction` identity.

- `value-binding-model.ts` defines workspace name, refresh interval, and live updates.
- `value-binding-lab.tsx` mounts ready-made controls and a field-bound interval readout.
- `composed-value-bindings.tsx` expresses the same controls with public Dashlet render contexts
  and `@picodash/dashlist/ui` primitives.

All three files are in `apps/lab/src/components/contract-lab/`. The two Lists share values, while
each editor retains its own invalid draft. Number input commits on blur or a supported numeric key;
text and switch changes update immediately. The example has no persistence: leaving and reopening
the preset restores defaults.

The **Disable controls** toggle applies the existing per-Dashlet policy. List-level disabled
cascading remains a broader unimplemented contract; M4 does not add that API. The shared theme
Provider supplies light, dark, system, and the existing application-owned Ocean recipe.

Visual review found that disabled Text, Number, and Switch controls lacked distinct presentation.
Their existing DashList stylesheet now consumes UI's `--picodash-opacity-disabled` token and uses
the disabled cursor on the rendered React Aria roots. Labels, issues, and readouts remain readable
at full opacity. The browser matrix asserts the actual disabled rendering in both compositions.

## Evidence

`apps/lab/tests/contract-lab.spec.ts` contains one cohesive M4 journey:

| Path                               | Evidence                                                                                                                                      |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Ready-made and composed UI → Nexus | Text, number, and keyboard switch edits independently inspected through Bridge                                                                |
| Nexus → both Lists and readouts    | Application `setValues` button and allowlisted Bridge write, plus bounded Bridge wait                                                         |
| Invalid input                      | Both editors retain invalid text/number input while Bridge and readouts retain valid canonical values                                         |
| Presentation                       | Keyboard traversal; normal/focused, invalid, disabled captures in light, dark, both system resolutions, and Ocean; 390px layout               |
| Lifecycle                          | Only the Console is a Panel; closing disconnects the binding Bridge session; reopening restores defaults and readiness without browser errors |

Run with `LAB_PORT=<reserved-port> bun run --cwd apps/lab test:e2e --grep 'standalone value binding parity' --workers=1`.
The test saves PNGs to `output/playwright/m4/` and attaches them to its report. Package tests remain
the primary owner of validation, interaction, and semantic matrices; this journey proves the
standalone browser composition.

Verification on 2026-09-09: 254 DashList tests and 9 Lab state/driver tests passed. All 14 Lab
journeys passed; after the disabled-style correction, the focused M4 journey passed again with
the saved visual matrix. The Lab production build passed. Workspace formatting, lint, and types
are checked separately after package builds finish so declaration-output cleanup cannot race them.

## Owner review

Check both Lists with pointer and keyboard, including an empty workspace name and an interval of 61. Check the theme buttons and disabled state, then **Apply example values** with clean inputs.
Owner acceptance is recorded above; these steps remain the bounded review checklist for changes.
