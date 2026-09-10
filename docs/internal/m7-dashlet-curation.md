# M7: curated ready-made Dashlets

Status: **In progress**. This is the first candidate slice, not an approved final inventory.
Baseline: M6 merged in PR #126 at `afbc5ed3d63aab936ead2c90e220f71de1911d67`.

## First working comparison

Value binding now includes Workspace tuning: Text, Number, Slider, Switch, and Display share the
existing three Nexus fields and persistence path. Number supports exact interval entry; Slider
supports quick adjustment; Display independently shows the accepted value. A read-only toggle and
the existing disabled/theme controls expose the same states without making duplicate state stores.
The Bridge discloses the additional List scope but retains its existing field write allowlist.

The historical built-in example at `6a9c56e8` used Text, Number, Slider, Switch, Display, Select,
Segmented, Range, and specialized creative controls. That inventory is comparison evidence, not
an automatic requirement to retain every control. The current Style Lab remains available for
assessing the wider implementation.

## Working disposition ledger

These dispositions select the first recovery workflow. Deferred entries retain their current APIs;
no stable export or accepted contract has been removed by this initial slice.

| Dashlets                                                             | Working disposition                    | Reason and remaining evidence                                                                                                                         |
| -------------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Text, Number, Switch, Display                                        | Keep candidate                         | M4/M5 demonstrate workspace editing, validation and readback. Check their presentation alongside the new slider before final M7 approval.             |
| Slider                                                               | Keep candidate                         | Quick interval tuning and exact Number entry share one canonical value. Compare keyboard operation and read-only/disabled states across themes.       |
| Select, Segmented                                                    | Defer selection to the next assessment | Both appear in the prototype. A real choice workflow is needed to decide whether both earn a place in the small retained set.                         |
| Checkbox, RadioGroup, Combobox, CheckboxGroup, MultiSelect, Search   | Defer                                  | Additional choice and search variants need a supported workflow beyond the workspace tuning baseline. Do not infer usefulness from inventory breadth. |
| Range, Meter, Progress, Status                                       | Defer                                  | Compound ranges and monitoring readouts need a concrete consumer with real state meaning. Do not simulate transport progress to justify them.         |
| Date, Time, DateTime, DateRange, Color                               | Defer                                  | No temporal or color-editing workflow has yet been retained in recovery.                                                                              |
| Chart, Sparkline                                                     | Defer                                  | Existing experimental entrypoint remains pre-alpha; this slice does not promote it.                                                                   |
| Prototype Dropzone, Gradient, Matrix2D, MediaPreview, Vector3, XYPad | Defer                                  | Specialized creative controls need their own consumer evidence before restoration.                                                                    |

## Remaining M7 work

Assess the prototype choice workflow and settle the final inventory; evaluate any controls that earn
retention in the same themes and states. Then explicitly revise excluded stable-contract claims in
the owning references/catalog together, rather than silently treating this candidate list as a new
public contract. Owner hands-on approval remains required before M7 completion or M8 integration.

## Initial evidence

The focused standalone binding journey passes with the candidate controls in light, dark, both
system resolutions, and Ocean. Slider keyboard changes are independently observed through the
Bridge and reflected by Number; read-only changes leave canonical values unchanged, and disabled
controls remain disabled. Existing reset, persistence, invalid-draft, and organization checks pass.
Screenshots are written to `output/playwright/m4/m7-*-readonly.png`.

This workflow exposed a missing thumb label: the Slider group had its visible label, but the
focusable range input only announced its value. The unbound Slider now forwards `aria-labelledby`
to its thumb. The ready-made control test verifies the reference to the visible label, and the
browser checks the computed accessible name. All 254 DashList tests pass. Vite+ checks pass.
