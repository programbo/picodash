# DashList target reference

DashList is a standalone React composition system for ordered, groupable collections of controls,
readouts, visualizations, previews, and actions. This page describes the aspirational
`@picodash/dashlist` contract.

## Status

> Contract: Accepted
> Implementation: Partial
> Evidence: `packages/dashlist/tests/dashlist.test.tsx`, `packages/dashlist/tests/dashlist.types.test.ts`, and `packages/dashlist/tests/package-artifacts.mjs` cover the alpha shell, semantic structure, Nexus resolution boundary, and package surface.
> Notes: The stable launch contract is accepted. The remaining prototype behavior must be
> reconciled through the conformance matrix; ordering, collapse, and action resets are now implemented,
> while rail behavior remains deferred to later stabilization work. List node declaration
> agreement and the initial binding interaction surface are Verified.

## Package purpose

DashList owns List, group, Dashlet, binding, and reorder composition inside an application-owned
layout. It does not require DashPanel or `PicodashProvider`.

## Standalone composition

```tsx
const nexus = createPicodashNexus({
  nexusId: 'settings',
  schemaVersion: 1,
  valueOwner: 'nexus',
  fields: {
    theme: { defaultValue: 'system' },
    density: { defaultValue: 1 },
  },
})

function Settings() {
  return (
    <DashList id="settings" nexus={nexus}>
      <SelectDashlet
        id="theme"
        field={nexus.fields.theme}
        label="Theme"
        options={['light', 'dark', 'system']}
      />
      <SliderDashlet id="density" field={nexus.fields.density} label="Density" />
    </DashList>
  )
}
```

| API/component       | Contract | Implementation | Notes                                                                                                                         |
| ------------------- | -------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `DashList`          | Accepted | Partial        | Package-native List root and scope boundary; shell and Nexus boundary are implemented.                                        |
| root `nexus` + `id` | Accepted | Partial        | Resolves an explicit scope and opts into standalone hosting without context.                                                  |
| scoped `nexus`      | Accepted | Partial        | `id` may be omitted or must agree; explicit mismatch is rejected.                                                             |
| `children`          | Accepted | Verified       | Arrays/fragments are transparent; every direct declaration commits exactly one matching node, including custom ID forwarding. |

## Context composition

```tsx
<DashPanel id="settings">
  <DashList />
</DashPanel>
```

An id-less primary List inherits the nearest scope. Only one active DashList is permitted in that
scope.

Additional DashLists are permitted in advanced compositions but are not additional primary Lists.
Each requires an explicit ID, resolves a child scope, and registers an active declarative
relationship from the nearest scope. DashList supplies its scoped Nexus context to descendants. A
Provider boundary resets ancestry.

> Contract: Accepted
> Implementation: Partial
> Evidence: `packages/dashlist/tests/dashlist.test.tsx` covers nearest Provider scope resolution,
> explicit child scopes, nested relationships, committed lease cleanup, nested List isolation, and
> custom declaration agreement through StrictMode and keyed lifecycle changes.

## DashList root API

> Contract: Accepted
> Implementation: Partial
> Evidence: `packages/dashlist/tests/dashlist.test.tsx` covers heading/label validation and neutral/list/listitem/group/status semantics; full root API behavior remains Planned.

The package-native component and type names are `DashList` and `DashListProps`. The prototype
aliases `Dashlist`, `DashlistProps`, and `PicodashList` are migration evidence rather than additional
stable names. Picodash reexports the exact foundational component and type.

The target prop shape is:

```ts
type DashListPresentation = 'list' | 'rail'
type DashListOrientation = 'vertical' | 'horizontal'

type DashListHeadingProps =
  | {
      title?: undefined
      headingLevel?: never
    }
  | {
      title: ReactNode
      headingLevel: 1 | 2 | 3 | 4 | 5 | 6
    }

type DashListProps<TValues extends object, CustomTheme extends string = never> = Omit<
  ComponentPropsWithRef<'div'>,
  'aria-label' | 'aria-labelledby' | 'children' | 'id' | 'title'
> &
  DashListHeadingProps & {
    id?: string
    nexus?: RootNexus<TValues> | ScopedNexus<TValues>
    children?: ReactNode
    presentation?: DashListPresentation
    orientation?: DashListOrientation
    reorderable?: boolean
    disabled?: boolean
    readOnly?: boolean
    actionMenu?: false | readonly ReactElement[]
    theme?: PicodashThemeOption<CustomTheme>
    density?: PicodashDensity
    'aria-label'?: string
    'aria-labelledby'?: string
  }
```

`RootNexus` and `ScopedNexus` above denote the corresponding accepted Nexus surfaces; DashList does
not introduce wrapper Nexus types. The generic theme parameter preserves the shared UI foundation's
strict custom-theme union.

The props have these rules:

- `id` is immutable Nexus scope identity for the mount lifetime. It never becomes the root DOM
  `id`; a Panel and its primary List may intentionally share the same scope, and opaque scope IDs
  are not suitable DOM identifiers. Internal accessible relationships use independently generated
  IDs.
- The public root forwards its React 19 ref, `className`, `style`, event handlers, and ordinary
  `data-*` and neutral `div` attributes. The initial API has no second public DOM-ID prop; consumers
  use the forwarded ref, a class, or a `data-*` hook when they need to address the root.
- `nexus` follows the accepted standalone and nearest-context resolution matrix. It is required only
  when context cannot resolve the intended scope. A supplied root/scoped Nexus, `id`, and nearest
  Nexus context must agree where more than one is present.
- `title` renders a visible heading and requires `headingLevel`. Omitting both is valid in normal
  presentation. A Nexus scope ID or component `id` never supplies title text or a heading level.
- `aria-label` and `aria-labelledby` name the active semantic collection: the normal List or the
  rail toolbar. They are deliberately removed from the neutral root's native prop spread.
- `presentation` defaults to `list`. `orientation` defaults to `vertical`, remains dormant while
  normal List presentation is active, and takes effect when the List enters rail presentation.
  Keeping a dormant declared orientation lets an application change presentation without replacing
  the prop.
- An active Nexus orientation override still takes precedence over the declared `orientation`.
- `reorderable` defaults to `true`. `disabled` and `readOnly` default to `false` and cascade under
  the accepted content-policy rules. These and all other runtime presentation props are ordinary
  resolved React values, not `ReactiveProp` callbacks.
- An omitted `actionMenu` renders the standard available List actions. `false` hides the menu. An
  element array adds caller-owned menu items after the standard items using the shared ActionMenu
  separator rules; it does not replace or copy the standard behaviors. When no standard or custom
  item is available, DashList renders no empty menu trigger.
- `children` remains `ReactNode` because TypeScript cannot reliably inspect what a custom component
  will register. The committed-registration checks enforce the accepted List-node declaration
  grammar.

Normal presentation may omit `title` and both accessible-name props. Rail presentation is a
contract error unless a rendered title, `aria-label`, or `aria-labelledby` supplies its toolbar
name. When a title and explicit ARIA name are both supplied, the explicit ARIA relationship names
the collection while the title remains the visible document heading.

## List node declarations

> Contract: Accepted
> Implementation: Verified

`DashList` accepts only top-level List node declarations as children. A top-level **List node
declaration** is:

- a `Dashlet`;
- a `DashGroup`; or
- a custom component that renders exactly one Dashlet or DashGroup and exposes and forwards the
  same explicit `id`.

For the initial launch, `DashGroup` accepts only Dashlet declarations: either a Dashlet or a custom
component that renders exactly one Dashlet and exposes and forwards the same explicit `id`. A
DashGroup inside another DashGroup is a contract error. Nested groups remain a possible post-launch
extension, but require dedicated interaction, responsive-layout, and accessibility design before
the supported grammar can expand.

Arrays and explicit React fragments are transparent and recursively flattened into declaration
order. `null`, `undefined`, and booleans are ignored. Fragment keys and array positions are not
durable identity.

Text, DOM elements, context providers, `Suspense`, error boundaries, and other presentational
wrappers are invalid direct children. They belong around the List or inside a Dashlet. A custom node
component cannot hide a fixed internal ID, change the forwarded ID, return several registered nodes,
or introduce a node kind that its parent does not permit.

A Dashlet is a leaf in the List tree. It may render arbitrary application content, providers,
loading boundaries, and error boundaries, but it cannot contain another registered Dashlet or
DashGroup. DashGroup is the only component that declares node containment, and its initial contract
contains Dashlets only.

This grammar lets every reorderable React child correspond to exactly one registered durable node.
A committed registration that is missing, duplicated, or disagrees with the declaration ID is a
contract error.

The implementation commits declaration and node leases only from committed effects. It validates
the next controlled render for invalid IDs, duplicate IDs, missing or multiple registrations,
forwarded-ID mismatches, forbidden group kinds, and nested registered nodes. StrictMode replay,
conditional cleanup, keyed reparenting, and nested DashList roots do not acquire or retain ghosts.

## Identity

| Identity               | Contract | Implementation | Rule                                                                                                 |
| ---------------------- | -------- | -------------- | ---------------------------------------------------------------------------------------------------- |
| List `id`              | Accepted | Planned        | Scope ID; immutable while mounted.                                                                   |
| Dashlet `id`           | Accepted | Verified       | Required explicit node ID; committed identity is independent of fields.                              |
| DashGroup `id`         | Accepted | Verified       | Required; shares the List-wide node-ID namespace.                                                    |
| Field-derived node ID  | Rejected | Prototype      | Binding identity cannot stand in for node ID.                                                        |
| Binding alias          | Accepted | Verified       | Defaults to field key; explicit aliases are leased per Dashlet item and cleaned up in reverse order. |
| React key or `useId()` | Rejected | Prototype      | Not durable Nexus identity.                                                                          |

IDs are opaque and exact. Every Dashlet and DashGroup requires an explicit `id`, including a
single-field Dashlet. Rebinding a Dashlet must not change its order or interaction identity. Several
Dashlets may bind the same field under different node IDs. Renaming a Dashlet or DashGroup changes
its durable metadata identity and requires an explicit migration when old preferences matter.

## Dashlet model

A Dashlet is one composable List item. It may contain a control, readout, visualization, preview,
action, or compound composition. A writable control is one Dashlet type, not the definition of every
Dashlet.

> Contract: Accepted
> Implementation: Partial
> Notes: The Dashlet role, anatomy boundary, and core structural anatomy are accepted. Supporting
> helper families remain Draft.

The package-native composition names are `DashList`, `DashGroup`, and `Dashlet`. `DashGroup` is a
declarative container node, not a Nexus scope. `Dashlet` is a leaf List node and the presentation and
binding boundary for zero, one, or several fields.

The `@picodash/dashlist/dashlet` subpath is the **Dashlet anatomy** surface. Its `Frame`, `Header`,
`Body`, `Metric`, and related primitives compose content inside a Dashlet. Anatomy primitives do not
independently register nodes, bindings, ordering, or durable metadata.

### DashGroup and Dashlet prop surfaces

> Contract: Accepted
> Implementation: Prototype

The exact package-native component and prop-type names are `DashGroup`, `DashGroupProps`, `Dashlet`,
and `DashletProps`. Compound bindings additionally export `CompoundDashletProps`. The prototype
names `PicodashGroup`, `PicodashGroupProps`, `DashletGroup`, `DashletGroupProps`, `PicodashItem`, and
the `Picodash*ItemProps` family are not parallel stable APIs.

Both registered node components reserve their structural and accessible root attributes:

```ts
type RegisteredNodeNativeProps = Omit<
  ComponentPropsWithRef<'div'>,
  | 'aria-describedby'
  | 'aria-errormessage'
  | 'aria-invalid'
  | 'aria-label'
  | 'aria-labelledby'
  | 'children'
  | 'id'
  | 'role'
  | 'tabIndex'
  | 'title'
>

type DashGroupProps = RegisteredNodeNativeProps & {
  id: string
  label: ReactNode
  'aria-label'?: string
  children?: ReactNode
  collapsible?: boolean
  defaultCollapsed?: boolean
  reorderable?: boolean
  pin?: DashletPin
  disabled?: boolean
  readOnly?: boolean
}
```

`DashGroup.label` is required. A non-text label additionally requires `aria-label`. `collapsible`
defaults to `true`; `defaultCollapsed` defaults to `false`; and an omitted `reorderable` inherits
the containing DashList policy. The Group exposes no controlled `collapsed`, `visible`, generic
`states`, generic `status`, actions, or Nexus prop. Conditional JSX owns presence, while the accepted
collapse override owns user visibility of mounted children.

The Dashlet base surface is:

```ts
type DashletPin = 'start' | 'end'
type DashletLayout = 'inline' | 'block' | 'full'
type DashletBindingMode = 'input' | 'display'

type DashletRailOptions = {
  icon?: ReactNode
  label?: boolean | string
  behavior?: 'reveal' | 'toggle'
}

type DashletBaseProps = RegisteredNodeNativeProps & {
  id: string
  label?: ReactNode
  'aria-label'?: string
  description?: ReactNode
  help?: ReactNode
  layout?: DashletLayout
  pin?: DashletPin
  disabled?: boolean
  readOnly?: boolean
  rail?: Readonly<DashletRailOptions>
  primaryFocusRef?: RefObject<HTMLElement | null>
}
```

Every Dashlet requires a canonical accessible name: a text `label`, or `aria-label` when the label
is absent or non-text. `layout` defaults to `inline`, except accepted compound helpers may default
their composed Dashlet to `block`. A plain custom Dashlet does not infer layout from its children.

The public Dashlet overloads add exactly one binding form to this base:

- an unbound Dashlet has neither `field` nor `fields`;
- a single-field Dashlet has `field` and optional `mode`; and
- a compound Dashlet has an alias-keyed `fields` map and no top-level `mode`.

```ts
type DashletFieldBinding<TValues extends object> = {
  [TKey in Extract<keyof TValues, string>]:
    | PicodashField<TValues, TKey>
    | {
        field: PicodashField<TValues, TKey>
        mode?: DashletBindingMode
      }
}[Extract<keyof TValues, string>]

type DashletFields<TValues extends object = Record<string, PicodashJsonValue>> = Readonly<
  Record<string, DashletFieldBinding<TValues>>
>

type DashletProps<
  TValues extends object = Record<string, PicodashJsonValue>,
  TKey extends Extract<keyof TValues, string> = Extract<keyof TValues, string>,
  TMode extends DashletBindingMode = 'input',
> = DashletBaseProps &
  (
    | {
        field?: never
        fields?: never
        mode?: never
        children?: ReactNode | ((context: DashletRenderContext) => ReactNode)
      }
    | {
        field: PicodashField<TValues, TKey>
        fields?: never
        mode?: TMode
        children?:
          | ReactNode
          | ((context: SingleFieldDashletRenderContext<TValues[TKey], TMode>) => ReactNode)
      }
  )

type CompoundDashletProps<
  TValues extends object,
  TFields extends DashletFields<TValues>,
> = DashletBaseProps & {
  field?: never
  fields: TFields
  mode?: never
  children?: ReactNode | ((context: CompoundDashletRenderContext<TValues, TFields>) => ReactNode)
}
```

`mode` defaults to `input`. Each compound map value is either a field handle or
`{ field, mode? }`, using the same default. `field` and `fields` are mutually exclusive. A `fields`
record must contain at least one binding. The binding aliases, field handles, and modes are immutable
for the mount lifetime; intentional changes use a keyed remount. The explicit Dashlet `id` remains
the same when rebinding should preserve its durable ordering identity.

The stable prop surface does not include:

- `reorderable` on Dashlet, because its containing ordering container owns that policy;
- `visible`, because declarative mounting owns presence and metadata survives ordinary absence;
- generic `states` or `status`, because explicit Dashlet content and the Draft anatomy helpers own
  application status presentation;
- `ReactiveProp` callbacks, because applications derive current values with explicit selectors and
  pass ordinary React props;
- `contentClassName`, because custom content can render its own wrapper inside the public content
  region;
- `valueMode`, which is replaced by the binding descriptor's `mode`;
- `value`, `defaultValue`, `onChange`, or `onValueChange`, because canonical values and observation
  belong to Nexus; or
- Dashlet-level `parse`, `validate`, or reset defaults, which belong to the field contract.

`DashGroup`, `Dashlet`, and their accepted ready-made variants forward their ref, `className`,
`style`, events, and non-reserved native attributes to the outer registered `role="listitem"`
wrapper. `aria-label` names the generated inner `role="group"`, not the List item. The generated
inner group owns fallback focus and description/issue relationships. Consumers cannot override
these roles or structural tab-index rules through the native prop surface.

### Primary focus registration

> Contract: Accepted
> Implementation: Prototype migration required

`primaryFocusRef?: RefObject<HTMLElement | null>` is the sole public registration path for a custom
Dashlet's primary focus target. The caller owns the ref and attaches it to the intended control.
Dashlet reads its current element only when focus redirection or rail reveal requires it; changing
the ref object is an ordinary prop update and does not create Nexus metadata.

Ready-made single-control and action Dashlets supply their control ref internally. Compound and
custom Dashlets nominate one explicitly when safe-area or rail activation should focus a control.
Omitting the prop retains the accepted named-shell fallback. A null, disconnected, disabled, or
inert target also falls back to that shell.

The initial API exposes no selector string, child index, DOM search, `autoFocus` inference,
imperative `registerPrimaryFocus`, context mutation, or public `useRegisterDashlet` hook. These
alternatives make focus depend on incidental descendant structure or leak registration lifecycle
outside the declarative shell.

### Render contexts

> Contract: Accepted
> Implementation: Partial
> Evidence: `packages/dashlist/tests/dashlist-bindings.test.tsx` and
> `packages/dashlist/tests/dashlist.types.test.ts` cover the typed single/compound contexts,
> committed lease lifecycle, callback policy, structured issue regions, List announcement channel,
> and shell-owned stale-overwrite action availability. `apps/lab/tests/contract-lab.spec.ts`
> covers Bridge/UI writes, external-write staleness, and confirmed overwrite in a real browser.

Dashlet render functions use one common shell vocabulary and add either one `binding` or an
alias-keyed `bindings` record:

```ts
interface DashletRenderContext {
  readonly id: string
  readonly disabled: boolean
  readonly readOnly: boolean
  readonly labelId: string
  readonly descriptionId?: string
  readonly issues: readonly TransactionIssue[]
  readonly issuesId?: string
}

interface DashletBindingContext<TValue extends PicodashJsonValue> {
  readonly alias: string
  readonly field: PicodashField<Record<string, TValue>, string>
  readonly value: TValue
  readonly controlId: string
  readonly invalid: boolean
  readonly issues: readonly TransactionIssue[]
  readonly issuesId?: string
}

interface DashletInputBindingContext<
  TValue extends PicodashJsonValue,
> extends DashletBindingContext<TValue> {
  readonly mode: 'input'
  readonly dirty: boolean
  readonly draftValue?: PicodashJsonValue
  readonly touched: boolean
  readonly stale: boolean
  setInput(candidate: PicodashJsonValue): void
  discardInput(): void
  resetValue(): void
}

interface DashletDisplayBindingContext<
  TValue extends PicodashJsonValue,
> extends DashletBindingContext<TValue> {
  readonly mode: 'display'
}

interface SingleFieldDashletRenderContext<
  TValue extends PicodashJsonValue,
  TMode extends DashletBindingMode = 'input',
> extends DashletRenderContext {
  readonly binding: TMode extends 'display'
    ? DashletDisplayBindingContext<TValue>
    : DashletInputBindingContext<TValue>
}

interface CompoundDashletRenderContext<
  TValues extends object,
  TFields extends DashletFields<TValues>,
> extends DashletRenderContext {
  readonly bindings: {
    readonly [TAlias in keyof TFields]: DashletBindingContextFor<TFields[TAlias]>
  }
}
```

`PicodashField<Record<string, TValue>, string>` above denotes a field handle whose value type is
`TValue`; it does not define a new wrapper handle. `DashletFields` is the accepted alias-keyed field
descriptor record, and `DashletBindingContextFor` preserves each descriptor's value and literal
`mode` in the mapped context.

An unbound render function receives `DashletRenderContext`. A single-field render function receives
`SingleFieldDashletRenderContext`; a compound render function receives
`CompoundDashletRenderContext`. Plain React-node children remain valid for every form when the
caller does not need the context.

The common `issues` collection contains composition-level, ambiguous, and cross-field issues.
Binding `issues` contains only issues attributed to that binding. Both retain complete structured
Nexus identities. `issuesId` exists only while its corresponding rendered region exists. The
single-field control may use the common `labelId`; compound controls provide their own individual
labels because the Dashlet label names the composition, not every field.

Input callbacks are UI event callbacks and deliberately return `void`. Dashlet owns Nexus result
handling, shared announcements, issue presentation, and the accepted stale-input confirmation
flow. They enforce resolved policy: `disabled` blocks every input action; `readOnly` blocks
`setInput` and `resetValue` but still permits `discardInput`. Display contexts expose no mutation or
draft properties.

The target does not expose the prototype's duplicate `fieldState` object, string-only `errors`,
flattened item/binding members, or ambiguous `reset` callback. Canonical value, raw draft,
structured issues, binding state, accessible IDs, and operations each have one public name.

### Registered shell

Every Dashlet uses the same public registered shell. The shell owns:

- explicit node identity and registration;
- ordering, pinning, reorder interaction, and announcements;
- zero, one, or several field bindings;
- binding drafts, validation state, and disabled/read-only state;
- focus, hover, issue, and operation-status relationships;
- one accessible name used by controls, reorder announcements, and diagnostics; and
- one content region using `layout="inline"`, `layout="block"`, or `layout="full"`.

A string `label` supplies the accessible name and visible row label. When `label` is absent or is a
non-text React node, the Dashlet requires an explicit `aria-label`. This requirement applies even
when reordering is disabled because diagnostics and state reporting still need a human-readable
identity.

`inline` places the label and content in one row. `block` places content below the label while
retaining the shared row inset. `full` lets rich content span the available Dashlet width. The shell,
not its children, owns the reorder rail and standard error region.

#### Row focus

> Contract: Accepted
> Implementation: Partial

The Dashlet row is an intentional pointer focus affordance. Clicking safe, otherwise inert space
within the row focuses its registered primary focus target. Built-in single-control and action
Dashlets register that control automatically. A compound Dashlet explicitly nominates its primary
target rather than allowing the shell to guess among several inputs. The public registration prop
is `primaryFocusRef`.

When no usable primary target exists, the shell receives focus. It is a named `role="group"` with
`tabIndex={-1}`, so pointer focus is perceivable without adding a second stop to sequential keyboard
navigation. A read-only primary control remains usable; a disabled, inert, absent, or disconnected
target falls back to the shell.

Safe-area redirection does not run when the click originates on an interactive descendant, help
trigger, or reorder handle; when the consumer prevents the event; while the user has a text
selection; or inside a custom region that explicitly opts out. Clicking a real control leaves focus
on that control. Row, label, control, and shell fallback focus all produce the same Dashlet
focus-within presentation.

The target does not scan for selected, checked, or generally focusable descendants. The prototype's
DOM-search fallback is non-conforming because conditional compound content can change which control
it selects.

#### Labels, supporting content, and issues

> Contract: Accepted
> Implementation: Partial

The visible Dashlet `label` is neutral shell text with a stable ID. It is not automatically an HTML
`label` around or pointing to arbitrary content. Actual controls reference that ID through their own
accessible-name relationship. Compound Dashlets give every input its own accessible label; the
Dashlet label names the composition rather than pretending to label each field.

`description` is visible supporting text with a stable ID and is referenced by the controls that
need it. `help` is supplementary content opened by a keyboard- and touch-accessible
`Help for {accessibleName}` popover. Instructions required to understand or operate a control belong
in the visible description, never only in the help popover.

The shell places regions in this order: label and shell actions, content, description, then current
issues. Field-specific issues attach to their actual control using `aria-invalid` and
`aria-errormessage`. Compound issues render once in the standard issue region. A cross-field issue
attaches to the named Dashlet composition rather than being falsely assigned to one input.

Issues present on initial render are not announced automatically. A newly introduced issue caused
by user input receives one polite announcement. `role="alert"` is reserved for urgent application
failures rather than ordinary field validation.

A dirty binding may expose **Discard changes**, which clears only that binding-local draft.
Canonical **Reset value** is a separate explicit operation and is not represented by the prototype's
ambiguous dirty-state reset icon. A stale draft still requires the accepted confirmed-overwrite
flow.

The prototype's generic `status` enum and arbitrary `states` map remain Draft. Application status
belongs in explicit Dashlet content or the Draft Status helper and includes perceivable text; shell
color alone never communicates it. Native `data-*` attributes remain available for application
styling without a generic state-map API.

The prototype currently applies description and issue ARIA attributes to the Dashlet root. Those
relationships do not propagate to nested controls and do not conform to the target.

Built-in and third-party Dashlets compose this same public shell. The initial public contract does
not expose an imperative or hook-level `useRegisterDashlet` escape hatch. A custom node component
renders and forwards props to `Dashlet` instead of reproducing registration behavior.

### Optional anatomy

Compact controls and readouts may render directly in the shell's content region. Rich or compound
Dashlets may place one anatomy `Frame` in that region and compose `Header`, `Heading`, `Description`,
`Actions`, `Body`, `Footer`, and supporting readout/state primitives inside it.

The anatomy layer is optional and non-registering. It does not own List identity, Nexus bindings,
reordering, shell focus state, or durable metadata. A Frame is content inside one Dashlet, not a
second Dashlet.

#### Core structural anatomy

> Contract: Accepted
> Implementation: Partial

| Component     | Element           | Contract                                                                |
| ------------- | ----------------- | ----------------------------------------------------------------------- |
| `Frame`       | `div`             | Optional Header, exactly one Body, and optional Footer, in that order.  |
| `Header`      | `header`          | Structured introductory content for this Dashlet's anatomy.             |
| `Heading`     | `h2` through `h6` | Requires an explicit `level`; never assumes a document heading level.   |
| `Description` | `p`               | Supporting prose associated with the anatomy heading.                   |
| `Body`        | `div`             | Required primary content region.                                        |
| `Footer`      | `footer`          | Optional trailing information or controls for this anatomy composition. |

`Header` accepts `heading`, `headingLevel`, and `description` convenience slots that compose the
corresponding core elements. Providing `heading` requires `headingLevel`. A manual `children` form
supports exceptional compositions, but the slot and manual forms are mutually exclusive so one
Header cannot declare the same region twice.

Each core component exports a named `*Props` type, accepts the native attributes appropriate to its
fixed element, and forwards its ref. The initial contract does not include a polymorphic `as` prop;
the fixed elements carry the semantic guarantees named above.

The Header `actions` convenience slot is retained as Draft alongside the optional helpers below. It
may compose an `Actions` region, but does not change that region's semantics.

`Actions` and `Toolbar` originated in the prototype rather than an explicit product requirement.
They remain optional Draft helpers so dogfooding can reveal whether they provide durable value:

| Helper    | Provisional purpose                                                             |
| --------- | ------------------------------------------------------------------------------- |
| `Actions` | Neutral Header end-column layout; no implicit ARIA role or keyboard behavior.   |
| `Toolbar` | Explicit React Aria interaction group with orientation-aware keyboard behavior. |

Header never promotes `actions` content to a Toolbar automatically. A caller chooses Toolbar
semantics explicitly and supplies its contextual `aria-label` or `aria-labelledby`; there is no
generic “Dashlet actions” accessible-name default. No separate Header `status` slot is added without
a demonstrated use case. These helpers may be revised or removed before the anatomy inventory is
accepted as part of the stable contract.

Every Draft helper is exported only from `@picodash/dashlist/dashlet`, carries `@experimental` in
its declaration documentation, and is excluded from the component catalog and stable compatibility
promise. No Draft helper is reexported from the DashList or Picodash root.

#### Draft helper families

> Contract: Draft
> Implementation: Prototype

The remaining prototype anatomy helpers stay exported during pre-v1 dogfooding, but are optional
conveniences rather than part of DashList's stable value proposition:

| Family        | Components                                                   | Provisional role                          |
| ------------- | ------------------------------------------------------------ | ----------------------------------------- |
| State         | `EmptyState`, `LoadingState`, `ErrorState`                   | Visual state messages and compositions.   |
| Status        | `Status`, `StatusIndicator`                                  | Compact status text and visual indicator. |
| Metric        | `Metric`, `MetricLabel`, `MetricValue`, `MetricTrend`        | Compact readout composition.              |
| Data          | `DataList`, `DataRow`, `DataLabel`, `DataValue`              | Name/value data using `dl`/`dt`/`dd`.     |
| Visualization | `Surface`, `Caption`, `Legend`, `LegendItem`, `LegendSwatch` | Layout for custom visualizations.         |

State and Status helpers have no default `role="status"`, `role="alert"`, or `aria-live` value.
Those behaviors depend on whether content was present initially or appeared in response to a
change. The Dashlet shell or caller that knows the transition context owns live-region behavior.
Likewise, `aria-busy` belongs on the region being updated, normally the Dashlet shell or Body, not
automatically on a loading message. Every helper still accepts the corresponding native attributes
when a caller deliberately opts into those semantics.

`MetricValue` renders a neutral `span` by default. It does not imply `output`, whose semantics are
appropriate only when the value is the result of a calculation or user action. The Data family
retains its concrete `dl`, grouped `div`, `dt`, and `dd` elements. Visualization helpers provide
layout only; their names do not establish chart roles, accessible names, or descriptions.

While these families remain Draft, their tests cover exports, native-prop/ref forwarding, and the
essential fixed semantics above. Exhaustive prop combinations and interaction matrices wait until
dogfooding justifies promoting a helper into the accepted inventory.

The target retains explicit JSX and typed field handles. It does not generate complete UI from a
field schema.

## Ready-made Dashlet and catalog ownership

> Contract: Accepted
> Implementation: Prototype

DashList owns every generic Nexus-bound ready-made Dashlet that can operate without a DashPanel. It
owns the component implementation and the corresponding catalog metadata. Catalog entries live
with their public components so component behavior, documentation, compatibility metadata, and
agent discovery cannot acquire separate sources of truth.

DashPanel owns no Dashlets. The prototype's ready-made controls and catalog entries under
`@picodash/dashpanel` are misplaced implementation evidence and must move rather than becoming a
compatibility requirement.

Picodash may reexport DashList's stable ready-made Dashlets and aggregate the DashPanel and DashList
catalogs, but it does not copy or redefine their entries. Picodash owns only components that
genuinely compose both products; those are integrated compositions or recipes rather than
foundation-level Dashlets merely because they render inside a Panel.

Third-party Dashlet packages own their own catalog entries. Applications and integration packages
may combine catalogs without transferring ownership. Catalog metadata supports documentation,
discovery, compatibility guidance, and agent tooling; it does not register components, authorize
Nexus access, or otherwise control runtime behavior.

`@picodash/dashlist/catalog` publishes one deeply frozen entry for every Accepted public DashList
component it owns. Its exact JSON-compatible fields, exclusions, reexport rules, and artifact checks
are defined in the [component catalog reference](catalog.md). Draft anatomy helpers are excluded.

### Stable ready-made inventory

> Contract: Accepted
> Implementation: Prototype

The accepted stable `@picodash/dashlist` root exports are:

- `TextDashlet`, `NumberDashlet`, `SliderDashlet`, `SwitchDashlet`, `SelectDashlet`,
  `SegmentedDashlet`, `DisplayDashlet`;
- `CheckboxDashlet`, `RadioGroupDashlet`, `ComboboxDashlet`, `CheckboxGroupDashlet`,
  `MultiSelectDashlet`, `SearchDashlet`;
- `RangeDashlet`, `MeterDashlet`, `ProgressDashlet`, `StatusDashlet`;
- `DateDashlet`, `TimeDashlet`, `DateTimeDashlet`, `DateRangeDashlet`, and `ColorDashlet`.

This set covers scalar values, choices, compound values, temporal values, and readouts without
making optional chart, media, or file dependencies part of the base product. Each ready-made component composes the same public
Dashlet shell, anatomy, Nexus handles, and UI primitives available to application authors. It does
not use a privileged registration or binding path.

Tables, trees, tabs, accordions, dialogs, menus, skeletons, alerts, toolbars, and similar pieces
remain UI primitives, Dashlet anatomy, or recipes unless they gain a distinct Nexus contract.
Specialist direct-manipulation, media, file, and action Dashlets remain deferred.

`ChartDashlet` and `SparklineDashlet` are experimental subpath exports only; they are not root
exports or catalog entries. They use `Chart` and the native `ChartDefinition` from
`@tanstack/charts/react`, and keep chart runtime
state outside persisted Nexus. The boundary is pre-alpha and isolated behind the optional exact
`@tanstack/charts` `0.12.0` peer; Recharts and shadcn `ChartContainer` are not supported. Before
promotion, the package must verify bounded cleanup, SSR, accessibility, resize, theme, and
reduced-motion behavior. See the [TanStack Charts overview](https://tanstack.com/charts/v0/docs/overview)
and [grammar of graphics](https://tanstack.com/charts/v0/docs/concepts/grammar-of-graphics).

### Typed composition grammar

Stable Dashlets use an explicit JSX grammar. Nexus fields and application-owned external values are
the data; `field` and `fields` bindings are the channels; `/ui` controls are presentation marks;
options, bounds, formatters, and chart scales determine representation; labels, descriptions, help,
issues, axes, and legends are guides; anatomy and compound content provide layers; and `Dashlet`,
`DashGroup`, and `DashList` provide composition and identity. These roles are additive and
explicit—no component infers hidden fields or identity from its children.

| Stable component       | Canonical field/value contract    | Semantic distinction                                                                     |
| ---------------------- | --------------------------------- | ---------------------------------------------------------------------------------------- |
| `RadioGroupDashlet`    | one scalar choice                 | Longer or vertical choice list; use `SegmentedDashlet` for compact visible choices.      |
| `ComboboxDashlet`      | one scalar choice                 | Searchable single selection.                                                             |
| `MultiSelectDashlet`   | array of choices                  | React Aria multi-ComboBox plus TagGroup.                                                 |
| `CheckboxGroupDashlet` | array of choices                  | Small, visible multi-selection set.                                                      |
| `RangeDashlet`         | one `{ start, end }` object field | Atomic two-value update; never two independent fields.                                   |
| `DateRangeDashlet`     | one `{ start, end }` object field | Atomic temporal range update; strict JSON representation.                                |
| `ProgressDashlet`      | one numeric field                 | Determinate, field-bound progress only.                                                  |
| `StatusDashlet`        | one explicit status value         | Uses an option map for label, tone, and optional icon; never infers tone from the value. |
| `ColorDashlet`         | one CSS color string              | Nexus schemas decide which CSS formats or color spaces are accepted.                     |

Temporal Dashlets use strict JSON values and never persist `Date` instances. Calendar dates are ISO
date strings, local times are ISO time strings, date-times are RFC 3339 strings with offsets, and
ranges are `{ start, end }` objects. `DateDashlet`, `TimeDashlet`, and `DateTimeDashlet` each bind
one field. `MeterDashlet` is a readout with explicit bounds/formatting, while `ProgressDashlet` is
field-bound and determinate. Indeterminate activity remains an unbound `/ui` primitive because a
Nexus field always has a concrete value.

### Export paths

> Contract: Accepted
> Implementation: Prototype

- `@picodash/dashlist` exports DashList, DashGroup, Dashlet, and the stable ready-made Dashlets.
- `@picodash/dashlist/dashlet` exports non-registering anatomy.
- `@picodash/dashlist/ui` exports the accepted unbound accessible controls listed under
  [Public package surfaces](#public-package-surfaces).
- `@picodash/dashlist/catalog` exports descriptive package metadata.
- `@picodash/picodash` reexports the same stable components and types.
- `@picodash/picodash/catalog` combines foundation catalogs without copying their entries.

The dedicated subpaths distinguish semantic purpose rather than component quality. Optional future
families must not force large integration dependencies into the base package merely because a
prototype already exists.

### Shared ready-made contract

> Contract: Accepted
> Implementation: Prototype

Every stable ready-made Dashlet requires an explicit `id`, a type-compatible Nexus `field` handle,
and a visible `label`. A non-text label also requires an explicit accessible string under the
accepted Dashlet-label contract. Ready-made Dashlets share applicable shell props such as
`description`, `help`, `pin`, `disabled`, `readOnly`, and `layout` rather than defining parallel
versions of those behaviors.

Field defaults belong exclusively to Nexus. A ready-made Dashlet does not accept `defaultValue`,
and a Nexus-bound Dashlet does not expose generic `value`, `onChange`, `onValueChange`, `parse`, or
`validate` props. The component owns only the presentation conversion required by its control, such
as turning number-input text into a numeric candidate. Nexus owns canonical parsing, schema
validation, field validation, mutation, and observation.

Ready-made configuration uses ordinary React prop values rather than prototype `ReactiveProp`
callbacks. An application derives dynamic options, bounds, labels, or formatting with an explicit
Nexus selector or its own state and passes the resolved value. React prop changes remain supported;
they do not create an implicit second Nexus subscription inside every component.

Changing options, bounds, formatting, or other presentation configuration never silently replaces,
clamps, or otherwise writes a canonical value that the new presentation cannot represent. The
component follows the ready-made presentation-compatibility behavior described below and waits for
an explicit application or user operation.

Every built-in registers its primary focus target and applies the accepted label, description,
issue, disabled, and read-only behavior. `DisplayDashlet` remains field-bound. Applications compose
an unbound readout from the public Dashlet shell and a `/ui` display primitive.

The component layers are:

1. underlying accessible primitives, whether upstream or package-private;
2. unbound, themed components exported from `@picodash/dashlist/ui`; and
3. Nexus-bound `*Dashlet` components exported from the DashList root.

The `/ui` layer exposes ordinary controlled component APIs and has no Nexus-binding knowledge.
Picodash reexports the exact DashList components and prop types instead of wrapping them with
facade-specific state or behavior.

### Component-specific ready-made props

> Contract: Accepted
> Implementation: Verified for the focused prop, mismatch, and locale slice; broader DashList
> stabilization remains Partial.

| Component                 | Field type                           | Component-specific props                                                                                                    |
| ------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `TextDashlet`             | `string`                             | `multiline?`, `minRows?`, `placeholder?`                                                                                    |
| `NumberDashlet`           | `number`                             | `min?`, `max?`, `step?`, `placeholder?`, `formatOptions?`                                                                   |
| `SliderDashlet`           | `number`                             | `min?`, `max?`, `step?`, `marks?`, `formatOptions?`, `formatValue?`                                                         |
| `SwitchDashlet`           | `boolean`                            | None                                                                                                                        |
| `SelectDashlet<T>`        | `string \| number`                   | `options`, `placeholder?`                                                                                                   |
| `SegmentedDashlet<T>`     | `string \| number`                   | `options`                                                                                                                   |
| `DisplayDashlet<T>`       | Any JSON value                       | `formatValue?`                                                                                                              |
| `CheckboxDashlet`         | `boolean`                            | None                                                                                                                        |
| `RadioGroupDashlet<T>`    | `string \| number`                   | `options`, `orientation?: 'vertical' \| 'horizontal'` (default `vertical`)                                                  |
| `ComboboxDashlet<T>`      | `string \| number`                   | `options`, `placeholder?`                                                                                                   |
| `CheckboxGroupDashlet<T>` | `readonly T[]`                       | `options`                                                                                                                   |
| `MultiSelectDashlet<T>`   | `readonly T[]`                       | `options`, `placeholder?`                                                                                                   |
| `SearchDashlet`           | `string`                             | `placeholder?`                                                                                                              |
| `RangeDashlet`            | `{ start: number; end: number }`     | `min?=0`, `max?=100`, `step?=1`, `formatOptions?`, `formatValue?`                                                           |
| `MeterDashlet`            | `number`                             | `min?=0`, `max?=100`, `formatOptions?`, `formatValue?`                                                                      |
| `ProgressDashlet`         | `number`                             | `min?=0`, `max?=100`, `formatOptions?`, `formatValue?`                                                                      |
| `StatusDashlet<T>`        | `string \| number`                   | `options`                                                                                                                   |
| `DateDashlet`             | ISO date string                      | `min?`, `max?`, `locale?`, `shouldForceLeadingZeros?`                                                                       |
| `TimeDashlet`             | ISO local-time string                | `min?`, `max?`, `locale?`, `granularity?`, `hourCycle?`, `shouldForceLeadingZeros?`                                         |
| `DateTimeDashlet`         | RFC 3339 offset date-time            | `timeZone` (required), `min?`, `max?`, `locale?`, `granularity?`, `hourCycle?`, `hideTimeZone?`, `shouldForceLeadingZeros?` |
| `DateRangeDashlet`        | `{ start: ISO date; end: ISO date }` | `locale?`, `shouldForceLeadingZeros?`                                                                                       |
| `ColorDashlet`            | CSS color string                     | `format?: 'hex' \| 'hexa' \| 'rgb' \| 'rgba' \| 'hsl' \| 'hsla' \| 'hsb' \| 'hsba'` (default `hex`)                         |

Built-ins accept the shared Dashlet shell, except `children`, `mode`, `primaryFocusRef`, generic
value authorities (`value`, `defaultValue`, `onChange`, `onValueChange`), parser/validator props,
and arbitrary inner-control prop bags. `MeterDashlet`, `ProgressDashlet`, and `StatusDashlet` are
display bindings and therefore omit `disabled` and `readOnly`.

The four temporal Dashlets and their `/ui` controls keep `locale?: string` as a local presentation
override. A supplied value must be a valid BCP 47 tag and wraps only that control in React Aria's
nested `I18nProvider`; omission renders no local provider and inherits the nearest ambient locale.
Locale changes segment order, direction, localized text, and number presentation. It is never stored
in Nexus, persistence, or canonical JSON, and does not alter `timeZone`.

Configuration failures are developer errors: structural and relational validation throws `TypeError`
(duplicate or non-finite choice values, missing text alternatives for non-text labels, invalid
bounds, non-positive steps, invalid temporal bounds, invalid locale or time zone, and unsupported
color formats). Standard Intl option failures may retain their platform `RangeError`, and formatter
or `formatValue` callback exceptions propagate unchanged. Configuration failure never writes Nexus.

A valid canonical value that the current props cannot represent is an ephemeral presentation
mismatch. The Dashlet renders the exact canonical JSON value and a descriptive warning, without
clamping, normalization, inferred Status tone/icon, persistence, or writes. Scalar unavailable
choices may remain operable for an explicit replacement; array, range, temporal, status, and color
mismatches that cannot be edited honestly render an unavailable editor. Mismatch warnings use
descriptive relationships, never `aria-invalid`; rejected Nexus input issues use the binding's own
invalid and error-message relationships.

`TextDashlet.minRows` is a positive integer valid only when `multiline` is true. Multiline content
grows from that minimum. `SliderDashlet` defaults to `min={0}`, `max={100}`, and `step={1}`. Its
`marks` prop is an explicit readonly array of `{ value, label? }`; the initial API has no boolean or
interval shorthand. Number formatting uses `Intl.NumberFormatOptions`. A `formatValue` callback
receives only the canonical field value; applications select and close over any additional state
explicitly.

Select and Segmented share a generic `DashletChoiceOption<T>` representation. An option is either a
primitive choice value or `{ value, label?, textValue?, icon?, disabled? }`. Choice values are
unique. A non-text label requires `textValue`. An empty options array is valid and produces an
unavailable control state. Neither component silently selects the first option. Segmented is
horizontal at initial launch; other orientations wait for a dedicated responsive and interaction
contract.

Every stable ready-made Dashlet also supplies a default rail icon representing its control or
readout type: text, number, slider, switch, select, segmented control, or display. Applications may
replace that icon through the shared rail configuration described below.

`DisplayDashlet` renders primitive values as text and structured values as readable JSON by
default. `formatValue` replaces that presentation. Nexus fields always have concrete JSON values,
so Display has no unbound `value` or fallback-default prop.

Ready-made Dashlets accept neither `children` nor arbitrary inner-control prop bags. Applications
that need lower-level attributes or custom composition use the Dashlet shell with `/ui` controls.
`className`, `style`, native `data-*` attributes, and the forwarded `ref` belong to the outer
Dashlet shell.

### Presentation compatibility

> Contract: Accepted
> Implementation: Planned

A **presentation mismatch** occurs when a canonical Nexus value is valid but the current ready-made
control configuration cannot represent it faithfully. It is distinct from both invalid component
configuration and a rejected Nexus transaction.

Invalid component configuration is a developer contract error. Examples include duplicate option
values, non-finite bounds, `min > max`, and a non-positive step. A built-in throws the package's
structured contract error rather than silently swapping, deduplicating, or normalizing those props.

A valid configuration with an unavailable choice or an out-of-range canonical value produces a
derived, ephemeral presentation mismatch. The Dashlet displays the actual canonical value and an
associated warning. It never fabricates a selected option, clamps the displayed value, or writes a
replacement. When the control can honestly represent no current selection, it may remain operable
so the user can explicitly choose a replacement. Otherwise, editing is unavailable until the
configuration or canonical value changes.

An explicit replacement is an ordinary Nexus transaction, not an automatic repair. A later value
or prop change that restores compatibility clears the warning without a Nexus write.

Presentation warnings relate to the affected control or named Dashlet composition through
descriptive ARIA relationships. They do not use `aria-invalid`, because the canonical value remains
valid. A warning present initially is not announced; one introduced while the affected Dashlet has
focus receives one polite announcement.

The mismatch is derived from current value and props. It is never persisted, exported, or recorded
as a binding input issue. Runtime diagnostics may expose the stable code
`presentation_incompatible` with safe scope, item, alias, field, and reason context, but never the
field value.

This ready-made behavior does not establish a generic public presentation contract for custom
Dashlet bindings. A future contract must separately freeze its generic shape, synchronous
evaluation and failure behavior, accessible warnings, and safe diagnostics. The core custom-binding
slice does not emit `presentation_incompatible`.

## Responsive row and compound layout

> Contract: Revised
> Implementation: Partial
> Evidence: `packages/dashlist/src/style.css`, `packages/dashlist/tests/style.test.ts`, and
> `packages/dashlist/tests/dashlist.test.tsx` cover the shared four-track ordering-grid recipe,
> label-width token, bounded trailing-value track, List-width compact marker, inline stacking, and
> coarse pointer target declarations. Rendered responsive geometry and drag-preview geometry remain
> planned.
> Notes: The original `cqi` label default required inline-size containment on the intrinsically
> sized List root, which is incompatible with DashPanel's accepted `fit-content` behavior. The grid
> now derives its fluid label share directly from its own width while the public token provides a
> length cap. The `18rem` compact threshold uses a non-persisted `ResizeObserver` marker because CSS
> size queries require the same incompatible containment.

DashList responsiveness follows its own container width, never the viewport. Each ordering
container owns one shared alignment grid across its start, automatic, and end pin bands. A
DashGroup establishes a new alignment context for its children; descendant rows do not force their
tracks to match the parent List.

The normal inline grid has four tracks: reorder handle, label, fluid control, and optional trailing
value. Rows without a trailing value span the final two tracks. Slider outputs share the trailing
track so sibling Slider controls retain equal track widths.

`layout="inline"` is the default and uses the stacked arrangement below an initial `18rem` container
threshold. `layout="block"` always places content below the label while preserving the handle inset.
`layout="full"` places content on a new row spanning the complete Dashlet width. Label/actions,
content, description, and issues retain their DOM and focus order under every visual arrangement.
Content-cell wrappers establish subgrid cells only for inline layout; in block and full layouts they
do not establish layout boxes, so application content retains its own internal layout and explicit
whitespace. Whitespace-only output from a child component is layout-empty in inline mode. A lone
inline control spans the fluid control and optional trailing-value tracks, while mixed element and
text roots retain separate control and trailing tracks. Native `hidden` roots do not reserve inline
cells, including when component-composed siblings share one content cell, and toggling `hidden`
updates the layout without remounting content.

The initial label track uses `clamp(6rem, 30%, var(--picodash-dashlet-label-width))`, with
`--picodash-dashlet-label-width: 10rem` as its public preferred cap. Long labels wrap rather than
truncate. Trailing values are never ellipsized: their track has an initial `8rem` maximum, wraps
when necessary, and cannot consume the control's initial `6rem` minimum usable width.

Compound Dashlets default to block layout. Their controls use a separate responsive internal grid
and cannot alter sibling Dashlets' shared outer tracks. At compact widths, compound content reduces
to one column unless the application explicitly supplies another layout that satisfies the same
reflow and overflow requirements.

The resolved row arrangement is captured at reorder pickup. A detached or fixed-position drag
preview retains that geometry instead of losing its subgrid or crossing a responsive threshold.
Ordinary responsive layout uses one `ResizeObserver` only to project whether the List is below the
`18rem` compact threshold. It observes both the List root and a private, out-of-flow `1rem` probe in
the owner document, so root-font-size changes update the threshold independently of List size; CSS
owns the resulting layout. The observation is transient and is never stored in Nexus or
persistence. Drag-preview measurement separately preserves captured geometry during reorder.

The package avoids horizontal page overflow at 320 CSS pixels and under 200% zoom. Segmented choices
may wrap, and coarse-pointer targets retain the accepted minimum size.

## Rail presentation

> Contract: Accepted
> Implementation: Planned
> Notes: Behavior, precedence, and the Nexus integration lease are accepted.

Rail presentation reduces a DashList to a vertical or horizontal strip of Dashlet icons. Activating
an ordinary icon reveals that Dashlet's content without unmounting its siblings. It supports compact
mobile navigation and persistent desktop tool or object palettes; it is not a mobile-only mode.

Each Dashlet may declare shared rail configuration:

```ts
type DashletRailOptions = {
  icon?: ReactNode
  label?: boolean | string
  behavior?: 'reveal' | 'toggle'
}
```

`label: true` displays the Dashlet's existing visible label below its icon. A string displays that
alternative, usually shorter, label in the same position. `false` and `undefined` omit the visible
rail label. This option never replaces or removes the Dashlet's canonical accessible name: the icon
control and its tooltip continue to use that name. Ready-made Dashlets provide type-specific default
icons; a custom Dashlet used in rail presentation must provide one.

The effective orientation is `vertical` or `horizontal`. An active orientation supplied through the
scoped Nexus takes precedence over an orientation declared on DashList. Picodash uses this
precedence to force `full/center-left` and `full/center-right` Panels to vertical and
`full/center-top` and `full/center-bottom` Panels to horizontal. Corner docks publish no Picodash
override: their effective Nexus or prop orientation chooses which adjoining edge the rail follows.
Free and snapped Panels also publish no override. Orientation changes presentation only: it neither
reorders nodes nor creates an order override.

The override is supplied only through
`@picodash/nexus/integration.acquireDashListOrientationOverrideLease`. DashList observes it through
the accepted scoped getter/subscription channel. Applications receive no general Nexus override
command: they use the public `orientation` prop, and an absent integration lease reveals that prop or
the `vertical` default. The runtime channel creates and persists no DashList metadata.

The rail is a named React Aria toolbar. Its effective orientation sets `aria-orientation` and its
roving-focus axis: Up and Down navigate a vertical rail, while Left and Right navigate a horizontal
rail in visual order and respect the current text direction. Tab enters at the current toolbar item
and then leaves the toolbar rather than visiting every icon. A rail requires a name supplied by the
DashList title, `aria-label`, or `aria-labelledby`.

The revealed Dashlet and DOM focus are separate state. Activating a reveal icon exposes its Dashlet
and then focuses that Dashlet's registered primary target. The revealed Dashlet has an explicit
Close affordance; activating its selected icon and pressing Escape are additional dismissal paths.
Blur does not dismiss it because focus may legitimately move into portaled menus, help popovers, or
other related content. The reveal button exposes `aria-expanded` and `aria-controls`. Close or
Escape restores focus to the originating icon when it remains available; otherwise focus moves to
the nearest available rail control. A nested overlay consumes Escape before the rail reveal
contract. Active/revealed state is transient and is never persisted or exported.

`SwitchDashlet` defaults to `behavior="toggle"`: its rail item is the actual switch and changes the
canonical value in one interaction rather than revealing a second control first. Applications may
select reveal behavior when they need the full Dashlet. A rejected transaction keeps the canonical
state and reports the issue at the rail item. Long-press recognition wins over toggle activation and
must not change the value.

### Groups in a rail

DashGroups remain structural nodes and are not flattened. Each group renders a recognizable named
disclosure header. Its disclosure toggles the same collapse override used in normal List
presentation, hiding or revealing its child icons. Hidden children remain mounted, registered,
bound, inert, and excluded from the accessibility tree under the accepted collapse contract.

Root reordering treats a DashGroup as one root node. Expanded child icons reorder only among their
siblings in that group and pin band. A group whose effective child-container policy is
`reorderable={false}` still reveals its child icons normally, but those children have no drag
handles.

### Rail reorder mode

Long-pressing any Dashlet icon is the coarse-pointer shortcut for entering a transient rail reorder
mode. Recognition uses a movement tolerance so scrolling does not accidentally enter the mode. When
the long press wins, it suppresses the icon's normal reveal or toggle activation and reveals the
handles for every currently visible node whose effective container and pin-band rules permit
reordering.

Normal Dashlet icon activation is suppressed while reorder mode is active. DashGroup disclosures
remain operable: collapsing hides the child icons, and expanding reveals them with handles when the
group's child container is reorderable and without handles otherwise. A collapse change cancels an
active drag before updating visibility, while reorder mode itself remains active.

Long press is not the only way to discover or operate this mode. Rail presentation also provides a
keyboard-accessible Reorder action and a visible Done control while the mode is active. Done,
Escape, or an interaction outside the DashList exits the mode; an outside interaction is not
swallowed after dismissal. If a drag is active, dismissal cancels that drag before leaving the
mode.

Entering or leaving reorder mode writes nothing. Each pointer or keyboard drag retains the accepted
container, pin-band, preview, announcement, cancellation, and single atomic commit rules. Before
pickup, orientation keys navigate the toolbar. During an active rail reorder, the same axis keys
move the node; Home and End move to the first and last valid position. The horizontal mapping
follows visual order in both left-to-right and right-to-left contexts.

## Field bindings

```tsx
<Dashlet id="exposure" label="Exposure" field={nexus.fields.exposure}>
  {({ binding }) => (
    <Slider
      id={binding.controlId}
      value={binding.draftValue ?? binding.value}
      aria-invalid={binding.invalid || undefined}
      aria-errormessage={binding.issuesId}
      onChange={binding.setInput}
    />
  )}
</Dashlet>
```

The exact render-context names and properties are defined in [Render contexts](#render-contexts).
Accepted binding behavior is:

- handles are nominally owned by the root Nexus;
- canonical values are root-global;
- drafts, touched state, input issues, and stale conflicts are binding-local;
- the same root field may appear in several items/scopes;
- dirty drafts survive canonical updates but become stale;
- binding state clears on final unmount.

| Binding capability               | Contract | Implementation | Notes                                                                                                                                                                                |
| -------------------------------- | -------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Typed canonical field handle     | Accepted | Verified       | `dashlist-bindings.test.tsx` exercises single and compound public leases; Nexus owns cross-root rejection.                                                                           |
| Draft and parse feedback         | Accepted | Verified       | Input contexts expose Nexus-owned draft, touched, stale, issues, set/discard/reset operations.                                                                                       |
| Stale-draft conflict             | Accepted | Verified       | Shell keeps the draft, offers discard and shared-UI confirmed overwrite, preserves it on cancel or stale/failed plans, and routes structured issues through the List status channel. |
| Compound multi-field transaction | Accepted | Prototype      | Whole candidate validates atomically.                                                                                                                                                |
| Cross-field issue presentation   | Accepted | Verified       | Alias, unique field-key, and unique `values`-path attribution preserve Nexus order; ambiguous and cross-field issues remain on the named composition.                                |

The single `field` and compound `fields` forms are mutually exclusive. Compound bindings use
explicit aliases as keys. A Dashlet with neither form is an unbound readout, visualization, preview,
or action and still participates in node identity and ordering.

### Compound issue attribution

> Contract: Accepted
> Implementation: Verified
> Evidence: `packages/dashlist/tests/dashlist-bindings.test.tsx` covers compound ownership,
> composition-level rejection, exact deduplication, and issue-region relationships;
> `packages/nexus/tests/binding-interaction.test.ts` covers binding, cross-field, and root issue
> identity preservation.

DashList consumes Nexus-normalized `TransactionIssue` records. It never parses issue messages or
creates a second issue-path convention. An issue with an explicit `scopeId` or `itemId` that does
not match the current Dashlet is not a local binding issue.

For issues eligible for presentation by a compound Dashlet, DashList resolves one owning binding in
this order:

1. an `alias` matching one registered binding;
2. a `fieldKey` matching exactly one registered binding;
3. a canonical `['values', fieldKey, ...path]` path matching exactly one registered binding.

The alias is decisive when Nexus can attribute an issue to the binding that originated an input
operation. Field and path matching cover field validators and whole-value validators that do not
know about presentation aliases. A nested path identifies detail within the field value but does
not create another binding identity.

When several aliases in the same Dashlet bind one field and an issue does not identify an alias,
the issue is ambiguous and belongs to the Dashlet composition rather than an arbitrarily selected
control. Cross-field, operation-wide, unknown-field, and root-invariant issues also belong to the
Dashlet composition when that Dashlet initiated the rejected transaction. If another application
operation initiated the rejection, its initiating List- or application-level UI owns those issues;
DashList does not make unrelated mounted Dashlets display them.

A field-specific issue renders once in the standard issue region and relates only to its resolved
control through `aria-invalid` and `aria-errormessage`. A composition-level issue renders once,
marks the named Dashlet group invalid, and relates that group to the issue region without marking
every child control invalid. The accepted single polite announcement rule still applies to a newly
introduced input issue.

Custom Dashlet content receives the complete structured issues, including code, path, and known
identity properties. Presentation may format their messages but must not discard that structured
identity. DashList collapses exact duplicates by code, path, message, scope, item, field, and alias
while preserving Nexus order.

## Content availability and value mutability

> Contract: Accepted
> Implementation: Prototype

`disabled` and `readOnly` are separate declarative interaction policies:

| Policy     | Meaning                                                                  |
| ---------- | ------------------------------------------------------------------------ |
| `disabled` | Dashlet content controls and action interactions are unavailable.        |
| `readOnly` | Input bindings cannot change or reset canonical values through DashList. |

Neither policy is authorization or a Nexus write restriction. External Nexus commands, adapters,
imports, and other bindings continue to update canonical values under their own contracts.

DashList, DashGroup, and Dashlet may declare either policy. Container values cascade to descendant
Dashlets. Effective disabled/read-only state is additive: a descendant cannot use `false` to
override a disabled or read-only ancestor. Dashlet exposes the resolved policies through its public
content context. Package Dashlets must honor them; custom content is responsible for applying them
to its own controls.

Disabled content controls and unbound action controls cannot activate. Read-only input bindings
remain perceivable and focusable but cannot change or reset canonical values. An unbound action is
unaffected by `readOnly` and is blocked only by `disabled`. A binding declared in display mode is
permanently read-only regardless of surrounding props.

Reorder handles and DashGroup disclosure controls remain available under both policies. Applications
use `reorderable={false}` or `collapsible={false}` when those structural interactions must also be
disabled. Help, descriptions, values, statuses, and validation issues remain perceivable. The shell
does not make the whole Dashlet inert or apply container-level `aria-disabled`; native or ARIA state
belongs on each affected control.

Entering disabled or read-only state preserves existing drafts without committing or discarding
them. Read-only content may still offer **Discard draft** because that changes binding-local state,
not the canonical value. Disabled content permits no actions, including discard. Later canonical
updates may make a preserved draft stale under the normal conflict rules.

Read-only controls normally retain focus so their value can be inspected or copied. If disabling a
focused control removes it from navigation, DashList repairs focus to the nearest available shell
affordance or adjacent node. These policies and their resolved state are not durable metadata and
are not included in persisted or exported documents.

## Groups and containment

```tsx
<DashGroup id="rendering" label="Rendering">
  <SliderDashlet id="exposure" field={nexus.fields.exposure} />
  <SelectDashlet id="quality" field={nexus.fields.quality} />
</DashGroup>
```

| Group behavior             | Contract | Implementation | Notes                                        |
| -------------------------- | -------- | -------------- | -------------------------------------------- |
| Declarative containment    | Accepted | Prototype      | Persistence never owns parent membership.    |
| One group level            | Accepted | Planned        | DashGroups contain Dashlets only at launch.  |
| Nested groups              | Draft    | Prototype      | Unsupported until dedicated UX work is done. |
| Collapsible group          | Accepted | Prototype      | User state is a durable override.            |
| Group-level actions/status | Draft    | Prototype      | Neither is inferred or aggregated initially. |
| Conditional children       | Accepted | Prototype      | Absence never proves obsolescence.           |

Items and groups share a node namespace within the List scope. Reparenting releases the previous
registration before mounting under a new container.

`label` is the canonical visible group identity; native `title` is not used as its substitute. A
group requires a label, and a non-text label additionally requires `aria-label` for reorder and
diagnostic text. Its outer registered wrapper is a `role="listitem"`; the generated inner shell is
a named `role="group"` rather than a page landmark.

In normal presentation, the group's node wrapper is one `role="listitem"` in its parent collection,
and its immediate-child ordering container is a nested `role="list"` labelled by the group label.
The group label does not implicitly create a document heading. Applications use an explicitly
levelled heading where their document structure requires one.

Groups are collapsible by default and begin expanded: `collapsible` defaults to `true`, while
`defaultCollapsed` defaults to `false`. A collapsible label is a button with `aria-expanded`,
`aria-controls`, and a stable mounted content-region ID. A non-collapsible label is non-interactive;
it is not rendered as a disabled or pointer-blocked button.

Each group owns one immediate-child ordering container. Reordering remains sibling-only, and moving
a group moves its whole Dashlet subtree. Pointer and keyboard reordering never move a Dashlet into
or out of a group. Applications reparent Dashlets by changing declarative JSX. The declaration wins
immediately; previous-parent ordering metadata remains dormant until pruning and may restore the
Dashlet's former position if it returns.

An empty declared group remains a valid visible node. Conditional absence does not delete its
collapse or ordering metadata. Group-level `actions` and `status` remain Draft and have no inferred
or aggregated behavior in the initial contract.

## Ordering

> Contract: Accepted
> Implementation: Partial

- Before customization, siblings follow declaration order.
- A completed user reorder creates a per-container durable override.
- New nodes append to a customized container in declaration order.
- Returning dormant nodes recover their prior position where possible.
- Reset removes the override and returns to current declaration order.
- Containment is never persisted as order metadata.
- Cross-container dragging is not supported by the initial contract.
- Cancelled pointer or keyboard reorder writes nothing.
- A committed effective order is the DOM and accessibility-tree order. CSS order, transforms, and
  detached previews may represent only an uncommitted candidate.

### Pin bands

> Contract: Accepted
> Implementation: Partial

Every ordering container has `start`, automatic, and `end` bands. Dashlet and DashGroup nodes accept
`pin?: "start" | "end"`; omitting the prop selects the automatic band. Pinning is declarative
application configuration, not user-owned Nexus state. There is no built-in pin or unpin interaction
in the initial contract.

A durable container order controls relative order within each band. Nodes reorder only against
visible siblings in the same band and never cross a band boundary. An interactive handle appears
only when the effective container policy permits reordering and at least two visible nodes occupy
that band.

At the DashList root, start and end bands remain outside the automatic band's scrollport. Inside a
DashGroup, bands determine order but do not create nested fixed scroll regions.

Changing `pin` moves a node immediately to the declared band. Existing relative order is preserved
where meaningful; otherwise the node follows already-customized destination nodes in declaration
order. Reset removes the complete container override across all bands. Pin values themselves are
not persisted or included in exported documents because the consuming JSX remains authoritative.

### Interaction parity

> Contract: Accepted
> Implementation: Partial

The ownership of reorderability is accepted even though the detailed interaction contract remains
Draft. `reorderable` is a policy on an ordering container, not on an individual node:

- `DashList.reorderable` controls whether its immediate Dashlets and DashGroups can be reordered;
- `DashGroup.reorderable` controls whether its immediate Dashlets can be reordered; and
- Dashlet has no `reorderable` prop.

A DashList defaults to `reorderable={true}`. When a DashGroup omits the prop, its child container
inherits the DashList policy. An explicit DashGroup value overrides that inherited policy for the
group's Dashlet children only. This permits fixed root groups with reorderable contents, or a
reorderable root containing a group whose Dashlets stay fixed.

A DashGroup's own `reorderable` value therefore does not control whether that group can move within
its parent DashList. The parent container's policy always controls movement of its immediate nodes.
When a container is reorderable, every visible node in the same declared pin band participates in
that ordering. There are no node-level fixed barriers or additional implicit segments; `start`,
automatic, and `end` remain the only lanes. Disabling user reordering does not ignore the declared
order or an existing durable order override.

Pointer and keyboard reordering produce the same valid committed orders and respect the same
container and band constraints. Reordering starts only from the shell-owned handle, never from
Dashlet content or a group disclosure control. An unchanged click, tap, pickup, or drop creates no
durable override.

#### Pointer interaction

- Dragging is vertical and constrained to the active container and pin band.
- The automatic lane scrolls when the pointer approaches its edges.
- A group-child drag scrolls the nearest containing DashList scrollport rather than creating a
  nested scroll region.
- Coarse-pointer handles provide at least a 44 CSS pixel hit target even when the visible indicator
  is smaller.
- Pointer cancellation restores the original visual order and writes nothing.

#### Keyboard interaction in normal presentation

| Key                | Active-session behavior                               |
| ------------------ | ----------------------------------------------------- |
| `Space` or `Enter` | Pick up the focused node, or commit its current slot. |
| `ArrowUp`          | Move one valid position toward the band start.        |
| `ArrowDown`        | Move one valid position toward the band end.          |
| `Home`             | Move to the first valid position in the band.         |
| `End`              | Move to the last valid position in the band.          |
| `Escape`           | Cancel and restore the original order.                |

Moving focus away from the active handle cancels the session. Commit or cancellation keeps focus
on that handle when its node still exists.

#### Session and persistence rules

Only one reorder session may be active in a DashList. Pointer and keyboard candidate orders are
ephemeral interaction state outside persisted Nexus snapshots. A changed order commits atomically
once on completion; cancellation never persists a temporary order or compensating write.

A membership, visibility, pin, effective reorder policy, or external order change makes an active
session stale and cancels it. Reduced-motion preference removes transition animation without
changing candidate, commit, cancellation, focus, or announcement behavior.

#### Accessible feedback

Each handle is named `Reorder {accessibleName}` and references one shared set of keyboard
instructions. The implementation does not use deprecated `aria-grabbed` or misleading
`aria-pressed` state. Its `aria-keyshortcuts` lists Space, Enter, ArrowUp, ArrowDown, Home, End, and
Escape; the described instructions remain the primary discoverable explanation.

The single polite status region owned by DashList announces pickup, movement, first/last boundaries,
commit, and cancellation. Announced positions count visible nodes in the active pin band. Focus
remains on the moved handle after a successful commit or cancellation whenever that node remains
mounted. Detached previews, transformed candidate copies, and insertion indicators are hidden from
the accessibility tree and never create extra focus targets.

## Collapse overrides

> Contract: Accepted
> Implementation: Partial

Only DashGroup exposes collapse behavior in the initial DashList contract. Dashlet has no collapse
props or durable collapse metadata. `collapsible` defaults to `true`, and `defaultCollapsed` defaults
to `false`.

The declared default applies when no durable user override exists. Changing `defaultCollapsed`
therefore updates an uncustomized group but does not replace a user's choice. Returning a group to
its current declared default removes the redundant override. Reset also deletes the override so the
latest declared default applies.

The initial contract does not expose a controlled `collapsed` prop. Application commands and user
interaction both update the scoped Nexus override, preserving one state authority. Setting
`collapsible={false}` forces expanded presentation and renders a non-interactive label. Existing
collapse metadata becomes dormant and is diagnosed as ignored rather than deleted; it may apply
again if collapse support returns.

Collapsed Dashlets remain mounted, registered, and bound. Their drafts, local React state, field
bindings, and order metadata survive. The content becomes inert, unfocusable, visually hidden, and
excluded from the accessibility tree immediately, even when the closing visual transition has not
finished.

If focus is inside a group when it collapses, focus moves to the disclosure button before the
content becomes inert. An active child reorder session is cancelled first. An external collapse
change also cancels a root reorder session when the resulting geometry invalidates its preview. A
collapsed group remains reorderable as one root node with its entire Dashlet subtree.

The disclosure button's `aria-expanded` and `aria-controls` state communicates collapse without a
live-region announcement. Reduced-motion preference removes the visual transition without changing
state, registration, or focus behavior. Metadata for absent groups remains until explicit pruning
or scope destruction.

## Pruning

| API/capability              | Contract | Implementation | Notes                                           |
| --------------------------- | -------- | -------------- | ----------------------------------------------- |
| Candidate prune plan        | Accepted | Planned        | Lists dormant IDs without classifying them.     |
| Explicit remove/keep IDs    | Accepted | Planned        | Required when no complete inventory exists.     |
| `knownNodeIds` inventory    | Accepted | Planned        | Application asserts authoritative completeness. |
| Automatic unmounted pruning | Rejected | —              | Conditional rendering makes it unsafe.          |

DashList acquires one committed Nexus node-presence lease per Dashlet and DashGroup while retaining
its private declaration, kind, and containment validation. Unmount releases presence but never
deletes metadata. Prune review lists dormant metadata references and their effects. Execution is
available only after an explicit remove/keep partition or an authoritative `knownNodeIds`
inventory; active nodes can never be removed. Pruning affects only List metadata, never canonical
values, bindings, drafts, or declarative relationships.

## Reset behavior

| Action                  | Contract | Implementation | Behavior                                     |
| ----------------------- | -------- | -------------- | -------------------------------------------- |
| Discard one draft       | Accepted | Prototype      | Leaves canonical value unchanged.            |
| Reset registered values | Accepted | Partial        | Active fields; atomic; optional descendants. |
| Reset List metadata     | Accepted | Partial        | Removes order/collapse overrides.            |
| Destroy scope           | Accepted | Planned        | Erases scope state but not identity.         |

The built-in “Reset values” action combines canonical reset with discarding drafts in targeted
bindings. Other scopes' drafts remain and become stale if they share reset fields.

## List behavior actions

> Contract: Accepted
> Implementation: Partial

DashList owns and exports List-specific action behaviors. Standalone applications may compose them
into their own controls, and Picodash may place the same exports in an integrated Panel action menu.
DashPanel does not implement, wrap, or copy them.

The public surface has a headless controller layer and UI-bound menu-item layer:

```ts
type DashListActionAvailability = 'unavailable' | 'disabled' | 'enabled'

type DashListActionNexusResult = CoreTransactionResult | PersistentTransactionResult

type DashListActionExecutionResult =
  | {
      status: 'not_executed'
      availability: 'unavailable' | 'disabled'
    }
  | {
      status: 'executed'
      result: DashListActionNexusResult
    }

interface DashListActionController {
  readonly availability: DashListActionAvailability
  execute(): DashListActionExecutionResult
}

interface DashListActions {
  readonly expandAll: DashListActionController
  readonly collapseAll: DashListActionController
  readonly resetValues: DashListActionController
  readonly resetList: DashListActionController
}

declare function useDashListActions(scopeId?: string): DashListActions
```

The hook returns an immutable action snapshot; unchanged entries and every `execute` function retain
`Object.is` identity across renders. A narrow Nexus subscription replaces only entries whose
availability changed. `execute()` rechecks the current target. If it is no longer enabled, no Nexus
command runs and the result is `not_executed` with the current availability.

`executed` means that the Nexus command ran, not that it necessarily committed. Consumers inspect
`result.ok` for a structured transaction rejection and the sorted changed-identity arrays for a
successful no-op or mutation. Persistence-capable results retain their accepted persistence status.
Programmer/lifecycle failures such as a destroyed root, illegal reentrancy, or ownership misuse
remain thrown `PicodashContractError` objects; the action layer does not disguise them as ordinary
disabled or transaction results.

An omitted `scopeId` targets the active DashList in the nearest Nexus scope. An explicit `scopeId`
targets that root-global scope in the same Nexus and need not equal the nearest scope because an
action is a control, not a new entity boundary. The hook throws outside Nexus context. A scope with
no active DashList is temporarily `unavailable`, not a contract exception, because declarative
mounts and conditional rendering may legitimately change target availability. The API accepts no
`nexus` prop.

Availability has one meaning across custom and built-in renderers:

- `unavailable`: the active target or the action's domain does not exist; omit it by default;
- `disabled`: the action is relevant but would currently make no change; render it disabled; and
- `enabled`: execution may commit its documented operation.

The initial accepted actions include `Expand all` and `Collapse all`. They target active,
collapsible DashGroups in the current List scope, never inferred dormant groups or descendant Lists.
Each action applies one atomic metadata update, omits redundant overrides relative to declared group
defaults, and is disabled when it would make no change. When the target has at least one active
collapsible group, both actions remain visible and the no-op member is disabled. Without an active
collapsible group, both are unavailable. Disabled and read-only content policies do not disable
these structural actions.

The initial `Reset` submenu contains two separate actions:

- `Reset values…` atomically resets fields registered by the current List and discards drafts in
  those targeted bindings. It does not include descendant Lists by default and does not change List
  metadata.
- `Reset list…` removes the current scope's root and group order overrides plus group collapse
  overrides. Values and drafts remain unchanged; declaration order and current declared group
  defaults apply again.

Both labels use an ellipsis because their confirmation dialogs state the exact affected domain.
`Reset list…` is disabled when no relevant metadata override exists. DashList exposes no combined
`Reset all` action.

The root package exports the standard UI-bound components:

- `DashListActionItems`, the standard fragment for an existing action-menu root;
- `DashListExpandAllItem` and `DashListCollapseAllItem`;
- `DashListResetSubmenu`;
- `DashListResetValuesItem`; and
- `DashListResetListItem`.

These components use generic action-menu and dangerous-operation primitives from `@picodash/ui`.
They accept the same optional `scopeId` targeting rule as the hook. They own fixed standard labels,
icons, availability mapping, confirmation copy, structured failure reporting, and accessible status
announcements. Picodash composes these exact exports; it does not maintain facade-specific action
implementations.

`DashListActionItems` renders both group actions when collapsible groups exist, available document
items, and then the `Reset` submenu when at least one reset operation can make a change. Separators
appear only between non-empty groups. A visible Reset submenu contains both reset items and disables
the no-op member. The fragment supplies no root trigger or global header chrome.

The built-in reset items always use the dangerous-operation modal. `Reset values…` explains that it
targets the current List's registered values and drafts, that shared canonical fields also change in
other Lists, and that order/collapse metadata remains. `Reset list…` explains that values and drafts
remain. If the effect summary changes while confirmation is open, the old confirmation is
invalidated and the updated effect must be confirmed. The headless hook performs no modal work;
custom UI using it is responsible for equivalent confirmation friction.

DashList does not render global action chrome merely because it mounts. Applications place the
standard fragment, individual items, or their own controls using the hook.

## Header composition

> Contract: Accepted
> Implementation: Planned

DashList uses and explicitly reexports the presentational `DashHeader` from `@picodash/ui`. A List
may supply its title and List behavior menu through the shared named slots, while DashList retains
the actions and all List semantics. The header does not read Nexus state, expand groups, reset a
List, or execute commands.

The shared API has `leading`, `title`, `actions`, and `trailing` slots in fixed DOM order and no
general `children` prop. The title slot supplies its own heading element and level. These slots are
an internal composition boundary for DashList, not a public `headerSlots` override: List props
create the default slot nodes, while List action composition provides the accepted additive
extension path. The complete target is recorded in the [shared UI reference](ui.md#dashheader).

## Documents

> Contract: Accepted standalone action surface, JSON codec, and browser workflow
> Implementation: Prototype migration required

DashList delegates import/export validation, field disclosure, sensitive promotion, and atomic value
writes to Nexus. A scoped document may include:

- the List scope's durable order/collapse overrides;
- optionally active descendant scopes;
- deduplicated canonical values for actively registered fields, subject to export policy.

It never contains drafts, focus/hover state, active relationships, or inferred dormant field
membership.

DashList owns the browser-facing workflow around those Nexus objects: JSON text, clipboard writes,
file selection and download, scoped preview/confirmation dialogs, structured issue presentation,
and accessible announcements. Nexus does not acquire browser or codec dependencies.

The root package exports:

- `useDashListDocumentActions(scopeId?, options?)`, using the same nearest/explicit scope targeting
  and action availability rules as `useDashListActions`;
- `DashListDocumentItems`, the standard document fragment for an existing action-menu root;
- `DashListExportItem`; and
- `DashListImportItem`.

`DashListActionItems` composes `DashListDocumentItems` automatically. Export is unavailable when the
Nexus lacks export policy; import is unavailable when the Nexus lacks the identified document
capability. Missing capabilities omit their items rather than rendering controls that fail when
used. The headless document hook owns no dialog; custom UI must preserve the same review and
confirmation requirements.

`options.maxImportBytes` is a positive safe integer limiting the UTF-8 source size before parsing.
It defaults to `1_048_576` bytes (1 MiB). The built-in import item exposes the same prop. Invalid
limits are contract errors; applications that deliberately accept larger documents must raise the
limit explicitly.

### JSON codec and browser policy

The initial codec serializes the immutable Nexus document as UTF-8 JSON with two-space indentation
and one trailing newline. `Copy JSON` and `Download JSON` use the exact same serialized text. The
codec preserves the property order returned by Nexus and does not apply an independent key-sorting
pass. Byte-for-byte stability across separate, semantically equivalent documents is not an initial
contract.

Downloaded documents use the MIME type `application/json` and a filename in the form
`picodash-<scope-slug>.json`. The scope slug is derived only for human recognition: normalize the
scope ID with NFKD, lowercase it, replace each run outside ASCII letters and digits with `-`, trim
leading and trailing `-`, limit the result to 64 characters, and fall back to `scope` when empty.
The filename never determines document or target identity.

The import picker advertises `.json,application/json`, but extension and reported MIME type are
advisory. DashList accepts one selected file whose byte size is within the configured limit, reads
it as UTF-8, parses it as JSON, and then delegates document validation and analysis to Nexus. It
does not infer YAML from content or accept multiple files.

Browser capabilities affect only the relevant destination:

- omit `Copy JSON` when clipboard writing is unavailable;
- omit `Download JSON` when Blob/object-URL download primitives are unavailable;
- keep export available when at least one destination remains; and
- make import unavailable when file selection or reading is unavailable.

DashList does not reveal document values in a manual-copy fallback because that could expose
included or promoted sensitive fields beyond the reviewed export flow. Clipboard denial, file-read
failure, JSON parse failure, and download creation failure produce structured UI issues while the
dialog remains recoverable. A browser-accepted clipboard write means the text was handed to the
clipboard API. A browser-accepted download means only that download initiation succeeded; neither
claim implies durable storage.

### Export action

`Export…` creates a Nexus export plan for the current List scope with `includeDescendants: false`.
The preview identifies the source Nexus and scope and summarizes included, redacted, omitted, and
shared fields without displaying field values. It never promotes redacted fields by default.

If immutable Nexus policy permits promotion, the dialog may offer an explicit include-sensitive
choice. Promotion uses the dangerous-operation confirmation and passes
`confirmRedactedPromotion: true` only for that single plan execution. Consent is never remembered.
Any stale plan requires a fresh preview and confirmation.

Successful execution produces one scope document. The dialog offers the browser destinations that
are currently supported under the accepted JSON codec policy. YAML and codec plugins remain
post-alpha questions.

### Import action

`Import…` accepts parsed JSON for one `kind: 'scope'` document and targets the current action scope.
A root document or a scope document containing descendant scopes is rejected rather than projected
or partially imported. Source and target scope IDs may differ, but the preview shows both
identities prominently.

The initial UI uses Nexus's compatible same-key field mapping. Unknown or incompatible fields block
execution; it does not expose arbitrary `fieldMap`, `scopeMap`, or `createMissingScopes` controls.
A foreign Nexus document requires explicit confirmation before analysis is executed with
`allowForeignNexus: true`. Redacted or absent entries remain unchanged according to Nexus rules.

Nexus analysis supplies the value, metadata, shared-field, identity, migration, and validation
effects shown in the confirmation dialog. Import executes the opaque plan atomically. If the plan
becomes stale, DashList discards it and requires review of a new analysis. Announcements reflect the
structured Nexus result and never claim that an external application store durably saved imported
values.

## Styling and theming

> Contract: Accepted shared foundation and product-owned token inventory; implementation evidence
> pending for exhaustive shared-token consumption and structural stylesheet inventory
>
> Implementation: Prototype

DashList consumes theme, density, shared semantic tokens, and product-neutral primitives from
`@picodash/ui`. It owns List, Dashlet, row, group, rail, and binding structure in its own stylesheet.
Standalone DashList may establish or inherit the shared UI theme boundary without depending on
DashPanel or Picodash.

Implementation conformance must record:

- required structural stylesheet and exhaustive shared-token consumption;
- default and compact density behavior;
- custom visualization token guidance.

The target stylesheet imports `@picodash/ui/style.css` and does not copy its theme recipe. Public
List and Dashlet tokens use `--picodash-list-*` or `--picodash-dashlet-*`; private formulas use
`--_picodash-*`. The shared `--picodash-shadow-panel` prototype name is replaced by
`--picodash-shadow-elevated` because dragged List nodes consume the same generic role as Panels.

DashList initially owns exactly two public product tokens:

| Variable                              | Purpose                                              | Syntax     | Regular default |
| ------------------------------------- | ---------------------------------------------------- | ---------- | --------------- |
| `--picodash-dashlet-label-width`      | Preferred label track width cap in inline layout.    | `<length>` | `10rem`         |
| `--picodash-dashlet-field-min-height` | Minimum field visualization and state-region height. | `<length>` | `6rem`          |

The label token is a preferred track width rather than a truncation boundary; long labels wrap.
The field token replaces the prototype's generic `--picodash-field-surface-min-height` name.

No initial public token controls row height, trailing-value width, nested inset, drag paint,
responsive thresholds, or rail geometry. Those are structural or package-private values. A future
rail token requires implementation evidence of a concrete host customization need and a focused
public-contract review.

The deferred viewer Dashlet contributes no launch token. Its prototype-specific shadow and maximum
layer are retired rather than moved into the shared inventory. If that Dashlet later enters the
accepted package, it uses the shared overlay stacking and elevation contracts by default; a
DashList-owned viewer token requires evidence that the shared role cannot express a real consumer
need.

The exhaustive shared-consumption table is implementation evidence produced after DashList
structure and its composed `@picodash/ui` recipes are frozen. The table identifies the consuming
List, Dashlet, or shared
component for every dependency and links token meanings to the canonical
[shared UI inventory](ui.md#shared-public-token-inventory).

### Density

> Contract: Accepted
> Implementation: Planned

`@picodash/ui` defines `PicodashDensity = 'regular' | 'compact'`, with `regular` as the default.
Density is orthogonal to the `light`, `dark`, `system`, or application-declared color theme. It
resolves from the nearest theme context and may be overridden by DashPanelProvider, DashPanel,
DashList, or the integrated Picodash Provider through an ordinary `density` prop.

Theme carriers and detached portal roots repeat both `data-picodash-theme` and
`data-picodash-density`. Density recipes change shared spacing, typography, and control geometry,
plus any explicitly documented compact value for DashList-owned geometry. They do not change color
roles, component semantics, durable placement, or accepted responsive layout modes. A custom color
theme therefore works with both densities without defining a second `brand-compact` theme name.
`system` resolves only the color theme.

Compact presentation may reduce visible geometry but retains at least 44 CSS pixel hit targets for
coarse pointers. Density is runtime presentation and Picodash does not persist it automatically. An
application that wants a durable preference stores and supplies that preference explicitly.

## Accessibility contract

> Contract: Accepted
> Implementation: Prototype migration required

DashList targets WCAG 2.2 AA. The following rules define the initial collection, focus, naming,
announcement, and rail behavior. Component-specific requirements for Dashlet labels and issues,
DashGroup disclosure, row focus, reordering, and collapse remain normative where they are defined
earlier in this reference.

### Collection semantics

The DashList root is a neutral `div`. A rendered `DashHeader` precedes the collection rather than
becoming part of it. In normal presentation, the immediate ordering container is one `role="list"`
and every immediate Dashlet or DashGroup node has one outer `role="listitem"`. A DashGroup's child
ordering container is a nested List. Pin bands, fixed-lane wrappers, and scrollports are layout
only; they do not divide one ordering container into several semantic lists.

The implementation does not use GridList, grid, tree, or application semantics. The normal List
does not impose roving focus or reinterpret native control arrow keys. Tab follows the rendered
controls and ordinary native behavior, except while a focused reorder handle owns an active
keyboard session.

DashList does not virtualize its initial collection and does not synthesize `aria-setsize` or
`aria-posinset`. A committed effective order is the DOM and accessibility-tree order. Candidate
drag copies, transforms, insertion indicators, and other uncommitted previews are hidden from the
accessibility tree and cannot receive focus.

### Names and focus

A rendered DashList title is an explicitly levelled document heading and labels the collection
through `aria-labelledby`. An application may instead supply `aria-label` or `aria-labelledby`.
Normal presentation may be unnamed when the surrounding document already supplies sufficient
context; rail presentation always requires a name. A Nexus scope ID or component `id` never becomes
an inferred user-facing name.

Each Dashlet's named shell is a `role="group"` inside its List item. Its canonical accessible name
is shared by its control relationships, reorder feedback, and diagnostics. Safe row-click focus
redirection does not turn the row into a button or add an extra sequential Tab stop. Dashlet and
DashGroup label requirements, primary-target fallback, collapse focus repair, and disabled-focus
repair follow the earlier component contracts.

Menus, popovers, and confirmation dialogs inherit their keyboard, focus containment, and focus
restoration behavior from the accepted `@picodash/ui` primitives. DashList adds behavior only where
the List operation requires it.

### Announcements

Each mounted DashList owns exactly one persistent, initially empty, visually hidden
`role="status"` region with `aria-live="polite"` and `aria-atomic="true"`. Reorder feedback, newly
introduced validation issues, presentation warnings, and action or document-operation results are
serialized through that region so concurrent features do not create competing announcements.
Initial validation issues and initial status content are rendered but not announced. An urgent
application failure may use an inline `role="alert"`; ordinary validation and operation feedback do
not.

Each nested DashList owns its own status region. An ancestor does not repeat a descendant's
announcement. Per-Dashlet live regions and transient live regions are non-conforming because they
can overlap, announce initial content, or disappear before assistive technology consumes an update.

### Rail semantics

Rail presentation replaces the normal List collection with the named React Aria toolbar described
in [Rail presentation](#rail-presentation). Its effective orientation controls
`aria-orientation`, roving focus, and reorder movement. Horizontal navigation follows visual order
and the current text direction. Tab enters at the current toolbar item and then leaves the toolbar.

Ordinary rail items are named buttons. Reveal buttons expose `aria-expanded` and `aria-controls`;
`SwitchDashlet` retains switch semantics and changes its value in one interaction. Dismissing
revealed content with Close, its selected icon, or Escape restores focus to the originating icon or
the nearest available rail control. A nested overlay consumes Escape before the rail.

During rail reorder mode, ordinary Dashlet activation is suppressed while group disclosures remain
operable. Available node handles and a visible Done control are keyboard reachable. Long press is a
supplementary coarse-pointer shortcut, not the only way to discover or enter reorder mode. An active
handle consumes the effective orientation keys, Home, End, Enter or Space, and Escape according to
the accepted reorder contract. Handles are named buttons and do not expose `aria-pressed` or
`aria-grabbed`.

## Public package surfaces

| Surface                        | Contract | Implementation | Notes                                 |
| ------------------------------ | -------- | -------------- | ------------------------------------- |
| `@picodash/dashlist`           | Accepted | Prototype      | List, groups, Dashlets, and actions.  |
| `@picodash/dashlist/dashlet`   | Accepted | Prototype      | Core accepted; helper families Draft. |
| `@picodash/dashlist/ui`        | Accepted | Prototype      | Exact unbound-control inventory.      |
| `@picodash/dashlist/catalog`   | Accepted | Prototype      | Descriptive package metadata.         |
| `@picodash/dashlist/style.css` | Accepted | Prototype      | Complete structural styles.           |

The unbound `/ui` inventory is `TextField`, `NumberField`, `Slider`, `Switch`, `Select`,
`SegmentedControl`, `Display`, `Checkbox`, `RadioGroup`, `Combobox`, `CheckboxGroup`, `MultiSelect`,
`SearchField`, `RangeSlider`, `Meter`, `ProgressBar`, `Status`, `DateField`, `TimeField`,
`DateTimeField`, `DateRangeField`, and `ColorField`, plus their owning public prop types. These are
controlled components used to compose custom Dashlets; they do not read Nexus context. Indeterminate
progress exists only at this unbound layer. Shared Button, Label, Tooltip, Toolbar, confirmation,
ActionMenu, and Provider components remain canonically UI-owned and are not copied into this
entrypoint.

> Contract: Accepted
> Implementation: Verified for root class composition
> Evidence: `packages/dashlist/tests/ui-controls.test.tsx`,
> `packages/dashlist/tests/choice-controls.test.tsx`, and
> `packages/dashlist/tests/value-controls.test.tsx`
> Notes: Every public `/ui` control keeps its package structural root class when `className` is
> omitted or empty. A non-empty string `className` is appended to that same root. `ColorField`
> applies the same rule to both its React Aria root for valid colors and its native input fallback
> for an invalid color string. This evidence covers class composition only; it does not promote the
> broader `/ui` inventory beyond its existing implementation status.

## Deferred product questions

These questions do not block the initial implementation because their related features are outside
the accepted launch surface:

1. Nested DashGroup interaction and presentation beyond one group level.
2. Group-level actions and aggregated status.
3. A generic custom-binding presentation contract, including its shape, synchronous evaluation and
   failure behavior, accessible warnings, and safe diagnostics.
4. YAML or a general document-codec plugin surface.

## Implementation readiness

No unresolved DashList contract question blocks implementation. Work begins only after compatible
Nexus and shared UI foundations reach the roadmap's dogfooding threshold. DashList conformance must
still produce:

1. cohesive regular, compact, normal List, and rail visual evidence;
2. the exhaustive shared-token consumption table and public data-slot inventory; and
3. an audit proving that private structural selectors and formulas have not become accidental
   customization promises.

## Related documents

- [DashList responsive measurement decision](../adr/0006-dashlist-responsive-measurement.md)
- [DashList value proposition](../product/value-propositions.md#dashlist)
- [Shared UI target reference](ui.md)
- [Nexus target reference](nexus.md)
- [Nexus decisions](nexus-contract-decisions.md)
- [Component catalog target reference](catalog.md)
- [Roadmap](../ROADMAP.md)
