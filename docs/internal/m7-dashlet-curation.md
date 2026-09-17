# M7: curated ready-made Dashlets

Status: **Ready for owner review; approval pending**.
Baseline: M6 merged in PR #126 at `afbc5ed3d63aab936ead2c90e220f71de1911d67`.

## Retained workflow

Value binding → Workspace tuning brings together seven ready-made Dashlets. Text names the
workspace. Number gives exact refresh entry; Slider offers quick adjustment of the same field.
Switch enables live updates. Select chooses Builds, Deployments, or Checks. Segmented switches
between Summary and Details. Display independently reads back the accepted interval.

The activity preview consumes the selected source and detail level through public Nexus selectors.
Its records are explicitly samples, not a claim of live transport. The existing Web Storage driver
saves both choices along with the original values. Workspace actions confirms reset of this List's
bound values. Choices have Nexus validators; the Bridge discloses and allowlists these two fields
alongside the original three, only in development. Production continues to refuse Bridge operation.

## Disposition decision

The historical built-in example at `6a9c56e8` used Text, Number, Slider, Switch, Display, Select,
Segmented, Range, and specialized creative controls. M7 retains controls that earn a distinct job in
the recovered workflow. The prior 22-control stable claim was broader than the product evidence.
The reference and catalog now distinguish retained candidates from deferred implementations.
Owner approval of this proposed release scope remains the final gate.

| Dashlets                                                             | Disposition       | Reason                                                                                                                                                                                                             |
| -------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Text, Number, Switch, Display                                        | Keep              | Exact editing, an on/off setting, and independent readback are demonstrated in M4/M5 and the shared review example.                                                                                                |
| Slider                                                               | Simplify and keep | Quick adjustment complements exact numeric entry. The example uses one formatted value instead of duplicating the numeric output and a second trailing output. Its focusable thumb now includes the visible label. |
| Select                                                               | Keep              | A compact source selector preserves space while offering several named choices. Its popup and keyboard behavior are exercised in the actual List.                                                                  |
| Segmented                                                            | Keep              | Two frequently switched views remain visible and require one action. Keyboard arrow navigation changes the same canonical field as pointer selection.                                                              |
| Checkbox, RadioGroup, Combobox, CheckboxGroup, MultiSelect, Search   | Defer             | Additional choice and search variants have no retained consumer beyond the demonstrated switch, source selector, and small visible choice set.                                                                     |
| Range, Meter, Progress, Status                                       | Defer             | Compound ranges and monitoring readouts need a consumer with real state meaning; sample transport progress would not establish that need.                                                                          |
| Date, Time, DateTime, DateRange, Color                               | Defer             | No temporal or color-editing workflow is retained in recovery.                                                                                                                                                     |
| Chart, Sparkline                                                     | Defer             | Experimental chart entrypoints remain pre-alpha.                                                                                                                                                                   |
| Prototype Dropzone, Gradient, Matrix2D, MediaPreview, Vector3, XYPad | Defer             | Specialized creative controls need their own consumer evidence before restoration.                                                                                                                                 |

No control is removed solely to reduce the count. The fifteen deferred root implementations remain
available for evaluation, with their owning tests, but are omitted from the stable catalog. The
catalog contains the seven retained ready-made entries plus existing composition/action entries.
Artifact checks enforce both retained admission and deferred exclusion. Facade documentation uses
the same status; no component ownership or entrypoint changes are introduced.

## Review and evidence

The standalone binding browser journey owns the cohesive review path: editable/invalid/disabled
states, read-only controls, themes, slider-to-Nexus/Number closure, visible-label accessibility,
pointer source/segment selection, keyboard choice navigation, rejected out-of-domain values,
preview changes, saved choices after reopening, reset cancellation, and confirmed reset/reload.
Nexus outcomes are independently inspected through Dev Bridge. Package tests own deterministic
control behavior and the catalog boundary.

The focused binding and long reordering browser journeys pass. The mobile geometry assertion
checks that the Slider thumb clears its description; the track now reserves the thumb's height.
Theme and phone captures are retained under `output/playwright/m4/m7-*.png`.

Verification on 2026-09-17: DashList `release:check` passed (254 tests, build, package artifacts,
and pack inspection); workspace `vp check` and artifact/motion policy checks passed. The Lab
production build passed. An isolated browser loaded the tailnet production URL, reached ready
state, changed source/detail choices, observed preview changes, and retained those choices after
reload with no browser errors. The production server runs independently of the agent session.

Review light, dark, system, and Ocean using Binding theme. In Workspace tuning, change the source
and detail level, tune the interval, try read-only and disabled controls, then reload. Workspace
actions → Reset values restores the declared defaults after confirmation. The same example is
served as a production build over the existing tailnet URL for owner review.

M8 integration remains blocked on owner approval of M7. This milestone does not claim completion
of broader integrated layout polish, the deferred control families, or their release gates.
