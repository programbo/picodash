# Compose a numeric target with an achieved-value readout

Use `NumberField` from `@picodash/dashstack/ui` inside a bound `Dashlet` when a ready-made
`NumberDashlet` does not leave enough room for your result or supporting content. The public control
supplies Picodash's numeric-input appearance, density, unit formatting, keyboard operation, and
accessibility wiring. It does not read or write Nexus itself.

This recipe works with the public APIs in dogfood `.2`. Snapshot `.4` includes the corrected copyable
`example/NumericTarget.tsx`; no runtime API upgrade is required. In the source checkout the tested
example is `packages/picodash/tests/dogfood/NumericTarget.tsx`.

## Start with the example

Copy `example/NumericTarget.tsx` into your app, create one model for the application's lifetime,
and render `NumericTargetRecipe`. Import the product stylesheet once:

```tsx
import { createRoot } from 'react-dom/client'
import '@picodash/picodash/style.css'
import { createNumericTarget, NumericTargetRecipe } from './NumericTarget.js'

const container = document.getElementById('root')
if (!container) throw new Error('Missing application root')
const nexus = createNumericTarget()
const root = createRoot(container)
root.render(<NumericTargetRecipe nexus={nexus} />)
// On permanent teardown: root.unmount(); nexus.destroy().
```

In an SSR host, create this instance within the appropriate client/request lifetime; do not share
one mutable server-module instance between users. For embedding in an existing Stack, render
`<ModuleTarget id="module-target" nexus={nexus} />` directly inside it. The recipe's factory owns a
single numeric field named `module`; adapt the factory and typed component together for your model.

The custom Dashlet keeps the normal inline label/control layout. A small readout sits below the
styled input. `formatOptions={{ style: 'unit', unit: 'millimeter', maximumFractionDigits: 2 }}`
adds the `mm` presentation; Nexus still stores a number, not a unit-bearing string. There is no
separate `units` prop. Locale follows the React Aria locale context. Importing the packaged CSS is
sufficient for NumberField styling; this example adds no Tailwind requirement.

## Connect the binding without losing drafts

The essential adapter inside `SingleFieldDashletRenderContext<number>` is:

```tsx
const { binding } = context
const value =
  binding.draftValue === null
    ? Number.NaN
    : typeof binding.draftValue === 'number'
      ? binding.draftValue
      : binding.value

return (
  <NumberField
    id={binding.controlId}
    aria-labelledby={context.labelId}
    aria-invalid={binding.invalid || undefined}
    aria-errormessage={binding.issuesId}
    disabled={context.disabled}
    readOnly={context.readOnly}
    value={value}
    step={0.01}
    formatOptions={millimetres}
    onChange={(candidate) => binding.setInput(candidate)}
  />
)
```

The complete example also combines the existing description, issue-region ID, and readout ID into
`aria-describedby`. It uses the shell's issue region rather than duplicating error messages.
A scalar field's validation issues belong to this one input. The disabled/read-only values come
from the resolved context, so parent policies apply too. Dashlet already renders
**Discard changes** for each dirty input binding and supplies eligible stale-overwrite confirmation.
Read-only permits that shell-owned discard action; disabled blocks it. Do not add a second discard
button inside the custom control. `binding.discardInput()` is available for a distinct application
workflow that intentionally discards the draft, not as missing default feedback UI. These recipes
need no additional discard control.

`NumberField` accepts a numeric `value` and calls `onChange(number | null)`. A cleared edit emits
`null`; pass it to `setInput` instead of ignoring it. The validator rejects it as missing, Nexus
retains the null draft, and the adapter uses `NaN` only to display an empty NumberField. Never send
NaN to Nexus or persist it. Do not use `draftValue ?? value`, because that replaces an intentional
empty draft with the accepted value.

Incomplete text such as `-` stays inside NumberField while editing. It is not a Nexus draft yet:
the public control has no raw-text callback or controlled text-value prop. On numeric commit,
Nexus either accepts the candidate or retains the rejected numeric/null draft. Formatting or
incomplete-text normalization can occur on blur. A remount or configuration/value change can replace
control-local text. If the application must inspect, preserve across remounts, or validate every
raw string, use the public `TextField` with a Nexus parser instead. Do not claim NumberField offers
raw-text persistence.

This example deliberately leaves `min` and `max` unset. Nexus validates the business range
0.6–3 mm, allowing a rejected `4` to remain visible with its error. NumberField's optional `min`,
`max`, and `step` control editing and normalization; they do not replace Nexus validation. Adding
hard bounds can constrain or normalize an edit before Nexus sees it. Choose that behavior
intentionally. `step={0.01}` sets this example's editing increment, while unit formatting controls
presentation.

## Derive the achieved value from accepted inputs

The fixture's selection rule rounds the accepted module to the nearest quarter millimetre. It is
an example selection rule, not a planetary solver. Entering `1.6` therefore shows:

```text
Accepted 1.6 mm · Achieved 1.5 mm
```

Entering rejected `4` leaves both readouts based on accepted `1.6`. A real application should
compute the achieved value from its pure solver and committed priority using the same selector as
its other displays. Never compute an apparently accepted result from a rejected draft, or save a
second copy of an easily derived result. If a draft preview is useful, label it separately.

## Choose the draft boundary before composing several targets

| Model                                           | What gets an independent draft?               | Best fit                                                                                                                                                                                    |
| ----------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One scalar field per target                     | Each Dashlet/field binding                    | Independently editable numeric targets with separate errors and stale-input handling. Cross-field constraints belong in `validateValues`; use `setValues` for an atomic programmatic batch. |
| One record field, one editor binding            | The complete record                           | A design submitted and validated together. Preserve every raw member when replacing one. Attribute record-member errors by structured issue path.                                           |
| Several Dashlets bound to the same record field | A separate whole-record draft in each Dashlet | Deliberate alternative editors of one record. A valid change in one can make another editor's rejected record draft stale. They are not shared member drafts.                               |

For a stack of independently editable targets, start with scalar fields unless the application
requires a record-wide editing transaction. A compound Dashlet can bind those fields through an
alias-keyed `fields` map without combining their identities. Do not repeat the Lab shortcut of
spreading only `binding.value` for each record-member change if other raw member drafts must survive.

The [compound-record recipe](consumer-recipes.md#3-keep-compound-invalid-drafts-apart-from-accepted-values)
shows preservation of raw members and canonical issue paths. Programmatic writes run Nexus
validation and do not manufacture UI drafts; an existing rejected draft may become stale.

## Verify native clearing in browser automation

The `agent-browser` 0.33.0 empty `fill` helper produced a blank DOM input but no empty-value
callback in both the isolated React Aria control and Picodash. Tab then restored the previous text.
That sequence did not represent a successful user clear. In the same browser, focus the textbox,
select all of its text, press Backspace, then Tab: the recipe retains an empty rejected draft.
Verify the selection and resulting validation, rather than treating an empty DOM value while focused
as proof of a committed clear. This was also verified in the standalone consumer from both accepted
`1.5` and rejected `4`; its actual solution stayed unchanged. No NumberField runtime patch was needed.

For the confirmed automation sequence, first focus the textbox identified by a fresh snapshot,
then select its contents through the focused native input before sending Backspace and Tab:

```sh
agent-browser --session <your-session> focus <textbox-ref>
agent-browser --session <your-session> eval 'const input = document.activeElement; if (!(input instanceof HTMLInputElement)) throw new Error("Expected focused input"); input.select(); ({ start: input.selectionStart, end: input.selectionEnd, length: input.value.length })'
agent-browser --session <your-session> press Backspace
agent-browser --session <your-session> press Tab
```

Check that the returned selection covers the complete input before deleting. This exercises native
deletion rather than assigning an empty DOM value.

## Verified behavior

The executable consumer test covers incomplete text while editing, a rejected number, a cleared
null draft, an unchanged accepted/achieved readout on rejection, linked errors, read-only discard,
disabled input, and recovery to an accepted edit. It runs against installed tarballs outside the
repository, including `.2`. These are DOM interaction and public-type checks, not a new visual-theme
or browser-locale certification.
