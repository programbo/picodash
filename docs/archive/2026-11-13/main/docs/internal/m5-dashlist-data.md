# M5: DashList validation, reset, and persistence

The owner approved the local implementation on 2026-09-09, reporting that it functions as expected.
M5's automated and hands-on exit evidence is complete.
D1 is closed as Keep; D2 remains the separate DashList fitness decision.

The existing Value binding preset uses one persistent Nexus and the same three fields in both
ready-made and composed Lists. It uses the public Web Storage adapter with the dedicated
`picodash-contract-lab-value-binding-v1` key. Nexus persistence state supplies the save message;
pending, error, and conflict states never claim success. Initialization failure shows an unavailable
message. Reset lab clears only the Lab's owned example keys.

Each List has an Actions menu using the existing `DashListResetValuesItem`. Its confirmation
resets registered canonical fields and discards the target List's drafts. Shared canonical values
change in both Lists; other Lists' dirty drafts retain their existing stale-draft contract.

The browser journey `proves standalone value binding parity` now proves:

- Valid UI edits and a three-field Bridge write reach both Lists; the write reports saved.
- Invalid text and number drafts leave canonical values valid. Reload restores the saved values
  and removes the invalid draft.
- A three-field batch containing an invalid interval changes neither live values nor saved payload.
- Cancelling reset preserves values and the invalid draft. Confirming reset from either List
  restores defaults, clears its draft, and survives reload in both Lists and readouts.
- Lab reset clears the example values. The existing theme and phone evidence remains in the journey.

Run `LAB_PORT=<reserved-port> bun run test:e2e:lab --grep 'standalone value binding parity'`.
Evidence images remain in `output/playwright/m4/`, including `m5-reset-defaults.png`.
The 254 owning DashList tests pass; workspace formatting, lint, and types pass.
No new Nexus or DashList public API, migration, repair-plan UI, or Bridge reset authority is added.

## Owner review

Open Value binding. Edit either List, refresh, and check the retained values. Enter an empty name
or 61-second interval and check that the readout remains valid. Use a List's actions menu to cancel
and then confirm Reset values; refresh again to verify defaults. Apply example values exercises
the valid multi-field operation. Automated Bridge evidence covers the rejected batch.
