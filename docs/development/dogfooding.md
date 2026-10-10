# Use Picodash in another project

Use a dogfood snapshot to try Picodash in a real React application and bring findings back to this
repository. Each snapshot contains the five public packages at one exact prerelease version,
a standalone installer, an executable example, and a source-commit record. Nothing is published to
a registry. External dependencies still download from your configured registry.

These are development previews, not a promise of stable APIs or saved-data compatibility. Keep the
previous snapshot while evaluating an update. Dev Bridge is private development tooling and is not
included. The supported Bridge host workflow is currently Contract Lab-only; see the
[external-app integration boundary](agent-dev-bridge.md#external-apps-current-support-boundary)
before attempting to connect a separate Vite app. The experimental charts entry is not part of the
starter example.

## Find the recommended snapshot

The recommended release is pinned in `docs/development/recommended-snapshot.json`, not selected
by sorting generated directories. From this Picodash checkout, run:

```sh
bun run dogfood:locate
```

It verifies the pinned bundle's hashes and clean-source marker, then prints the exact version,
source commit, source checkout, bundle directory, installer, and canonical documentation paths.
It fails if the recommendation is unavailable; it never substitutes a `.9001`-style trial bundle.
On John's machine the source checkout is:

```text
/Users/john/.codex/worktrees/918b3f3e-fbd3-443a-b926-2c30c6bd42fa/picodash
```

A copied bundle already identifies itself in `snapshot.json`. Its source commit is provenance;
its source checkout path is not needed after installation. The repository recommendation can move
forward without changing an older immutable bundle.

For custom displays, shared UI/agent priority policy, compound invalid drafts, documents, and
persistence boundaries, continue with [the application recipes](consumer-recipes.md).
For groups, TargetSlider, gestures and linked attention, see [linked controls](linked-controls.md).
For custom numeric controls, see [NumberField targets and achieved readouts](numeric-targets.md).
For Any maximum and feasible slider intervals, see [open-ended ranges](open-ended-ranges.md).

## Detachable groups (snapshot .24)

Copy `example/Detachable.tsx` and its `Controls.tsx` model companion, create the Nexus once, and
render `<Detachable nexus={nexus} />`. Inside `PicodashProvider`, a labelled root group can use
`detachable` (Hybrid) or `detachable="floating"`. Use the right header action or pull the header
sideways to detach; the Panel's Return action or a drag into its original Stack returns it.

Controls, drafts, IDs and order stay intact. The home heading can reveal the detached Panel.
Disclosure state and Panel position are remembered for the session. Fine-pointer desktop viewports
of at least 768px support detachment; narrowing returns inline. Subgroups and headerless groups
cannot detach. Detached layout is not persisted. The editor surface mounts after browser hydration.

## Authored Dashlet emphasis (snapshot .6)

`band`, `glow`, and `tint` are independent visual props on every Dashlet. Bare props or `true`
use theme defaults, `false` or omission turns them off, and a CSS color string supplies an override.
They imply no status, validation meaning, or automatic label. `example/Emphasis.tsx` is a compiled
facade example; copy its `Controls.tsx` companion for the sample model factory.

```tsx
<SwitchDashlet
  id="enabled"
  label="Enabled"
  field={nexus.fields.enabled}
  band
  glow={linkedHovered || linkedFocused}
  tint="var(--attention-color)"
/>
```

Themes may define `--picodash-dashlet-band-color`, `--picodash-dashlet-glow-color`, and
`--picodash-dashlet-tint-color`. Each falls back to the current accent. Focus and validation remain
independent. Supply text or another non-color cue for essential meaning. Forced-colors mode hides
these decorative treatments. Unlike the earlier recipes, these props require a runtime upgrade
from `.2`–`.5` to `.6` or later; installing only this example is not sufficient.

## Install a snapshot

Requirements: Bun 1.3.14 or later, Node 22.12 or later, and a standalone React 19+ application.
The installer currently targets Bun projects, not npm/pnpm/Yarn or a workspace root. No Tailwind
configuration is required to use the packaged styles.

1. Copy the complete snapshot directory somewhere accessible. Keep its `snapshot.json`, installer,
   and all five `.tgz` files together. Treat installers as code: use a bundle from a trusted source.
2. In your application, install React and React DOM if they are not already dependencies:

   ```sh
   bun add react@19 react-dom@19
   ```

3. Run the snapshot's installer, supplying the application directory:

   ```sh
   bun /path/to/0.1.0-dogfood.6/install.mjs /path/to/my-app
   ```

4. Import the stylesheet once from your application's entry or global layout:

   ```ts
   import '@picodash/picodash/style.css'
   ```

The installer verifies the tarball hashes before editing your app. It copies the bundle into
`vendor/picodash/<version>/`, adds all five packages as local tarball dependencies, pins the same
paths in Bun `overrides`, and runs `bun install`. This ensures transitive imports use the same Nexus
and UI packages. It preserves unrelated dependencies, overrides, and scripts.

Commit **package.json, bun.lock, and the vendor directory** in your application. Another machine
can then use `bun install --frozen-lockfile` without the Picodash checkout or the original bundle.
Do not omit the vendored tarballs from CI or deployment build inputs. Check your app's ignore rules
if `.tgz` files are excluded. No global links or edits inside `node_modules` are needed.

The snapshot manifest records the source commit and SHA-256 hashes. Hashes detect changed files;
they are not a cryptographic signature or proof of who produced the bundle. A manifest with
`dirty: true` is a local trial whose uncommitted changes cannot be reconstructed from its commit.

## Render your first control

The bundle's `example/Controls.tsx` exports `createSettings()` and `Controls`. Copy it into your
application. The same file is typechecked and exercised by the external-consumer smoke check.
It creates a boolean field, binds a Switch Dashlet to it, and reads it through a selector:

```tsx
import { createRoot } from 'react-dom/client'
import { Controls, createSettings } from './Controls'
import '@picodash/picodash/style.css'

const nexus = createSettings()
const container = document.getElementById('root')
if (!container) throw new Error('Missing root element')
const root = createRoot(container)
root.render(<Controls nexus={nexus} />)

// When permanently disposing this embedded application:
// root.unmount()
// nexus.destroy()
```

Nexus is the state owner. A field is one typed value in that state. A Dashlet binds a control to a
field; a DashStack organizes those Dashlets. Toggling the switch should change the application
readout between On and Off. Keep the Nexus instance stable across renders. Unmount its React
consumers before destroying it.

In Next.js App Router, keep interactive composition behind a `'use client'` boundary and import the
stylesheet from the root layout. Create Nexus per mounted application instance, for example with a
lazy `useState(createSettings)` initializer in that client component; do not share a mutable Nexus
singleton across server requests.

The bundle installs the complete compatible family, but your code can import from the owning
package: `@picodash/nexus` for state, `@picodash/dashstack` for controls, or
`@picodash/dashpanel` for movable panels. `@picodash/picodash` provides the combined facade.
The example uses the facade without requiring a floating panel. The aggregate stylesheet works
with these standalone imports too. Advanced APIs may be available only from their owning package.

## Dock a hybrid panel flush below an app header

Give the workspace below your header its own measured boundary. Set a shared 12px inset on the
Provider, then clear it for the panel that should touch the workspace edge:

```tsx
'use client'
import { useRef, type ReactNode } from 'react'
import { DashPanel, DashPanelProvider } from '@picodash/dashpanel'
import type { createSettings } from './Controls'

export function WorkspacePanel({
  nexus,
  children,
}: {
  nexus: ReturnType<typeof createSettings>
  children: ReactNode
}) {
  const workspaceRef = useRef<HTMLDivElement>(null)
  return (
    <div style={{ display: 'grid', height: '100dvh', gridTemplateRows: 'auto minmax(0, 1fr)' }}>
      <header>Gear designer</header>
      <div ref={workspaceRef} style={{ position: 'relative', minHeight: 0, overflow: 'auto' }}>
        {children}
        <DashPanelProvider
          nexus={nexus}
          boundary={workspaceRef}
          boundaryInset={12}
          dockPositions={[
            'top-left',
            'top-right',
            'bottom-left',
            'bottom-right',
            'full-left',
            'full-right',
          ]}
        >
          <DashPanel
            id="workspace-tools"
            title="Design controls"
            width={320}
            boundaryInset={0}
            defaultLayout={{
              placement: {
                mode: 'hybrid',
                disposition: { kind: 'docked', position: 'full-left' },
              },
            }}
          >
            <p>Place your controls here.</p>
          </DashPanel>
          <DashPanel
            id="workspace-candidates"
            title="Candidates"
            width={320}
            boundaryInset={0}
            dockPositions={['full-left', 'full-right']}
            defaultLayout={{
              placement: {
                mode: 'hybrid',
                disposition: { kind: 'docked', position: 'full-right' },
              },
            }}
          >
            <p>Place candidate results here.</p>
          </DashPanel>
        </DashPanelProvider>
      </div>
    </div>
  )
}
```

Use the stable Nexus instance from the first-control example and render your canvas as
`<WorkspacePanel nexus={nexus}>{canvas}</WorkspacePanel>`. The example needs only React and the
installed Picodash styles. Give the host page zero body margin if it should fill the viewport.
`example/WorkspacePanel.tsx` and its `Controls.tsx` type companion are included in snapshots built
after `.28`; the APIs used here already work in `.28`. If your app already uses
`PicodashProvider`, apply the same `boundary` and `boundaryInset` props there instead of nesting
another Provider.

The grid gives the workspace the remaining height below the header. DashPanel measures that
**element's rectangle**, so `full-left` fills the workspace height and meets its left edge without
covering the header. Hybrid still allows the user to drag the panel away and dock it again.
Omitting `boundary` uses the inherited boundary, or the viewport when none is supplied. Explicit
`boundary={null}` chooses the viewport; an unresolved ref falls back until it can be measured.
Changing the boundary does not change where Panel DOM is portaled, and the panel does not reserve
space in the workspace's document layout. Reserve canvas space separately if you want it.

`boundaryInset` accepts finite, non-negative CSS pixels. A Panel override replaces the Provider
inset; `0` clears all four sides. The tuple forms use physical sides, including in RTL layouts:

| Value            | Insets                                |
| ---------------- | ------------------------------------- |
| `12`             | 12px on every side                    |
| `[8, 12]`        | 8px top/bottom, 12px left/right       |
| `[8, 12, 16]`    | 8px top, 12px left/right, 16px bottom |
| `[8, 12, 16, 0]` | top, right, bottom, left respectively |

An omitted Panel inset inherits the Provider's setting. `null` is not a valid inset. The inset
applies to both docking and free movement, so this panel also has zero boundary clearance when
undocked. Snapping has its own additional offset. For only a flush left edge while keeping 12px
on the other sides, use `boundaryInset={[12, 12, 12, 0]}` instead.

`defaultLayout` is the starting placement when there is no applicable saved layout override.
Completed moves and docks record an override in Nexus; reload durability depends on the app's
Nexus persistence setup. Changing a default does not erase an existing override. To deliberately
return this panel to its current declared default, call `nexus.resetDashPanelLayout('workspace-tools')`
or use its Reset layout action. Do not reset on every render. Boundaries and insets are live policy,
not saved placement: a panel already docked `full-left` only needs the inset change; no reset is
required. A saved floating placement remains floating until the user docks or resets it.

### Enable corners at the Provider, then narrow individual panels

The Provider's `dockPositions` is the maximum allowed set. A Panel inherits it when its own
`dockPositions` is omitted; an explicit Panel list may only narrow that set. Adding `top-left`
only to a Panel while its Provider permits only full sides throws
`Panel dock position top-left widens the Provider policy.`

The example enables all four corners and both full sides on the Provider. Design controls inherits
all six; Candidates narrows to `full-left` and `full-right`. Apply the same arrangement to an
existing `PicodashProvider`. Each exact dock has one occupant, so an occupied destination cannot
accept a second panel. Panels share occupancy only when their Provider, resolved boundary, and
resolved inset match; both example panels clear the inset for that reason.

Standalone `DashPanelProvider` supports twelve positions: the four corners, plus `full-left`,
`center-left`, `full-right`, `center-right`, `full-top`, `center-top`, `full-bottom`, and
`center-bottom`. `PicodashProvider` supports the eight corner and left/right positions; it excludes
the four horizontal top/bottom positions. An explicit list replaces the default allowed list.
Dock policy applies to fixed and docked hybrid panels; floating placement uses snapping instead.

### Corner sizing and drag targets

Corner panels keep their content height up to an allocation cap. A lone corner does **not** force
its content to two-thirds height. Native allocations on each left or right side are:

| Occupants on that side             | Height allocation                                            |
| ---------------------------------- | ------------------------------------------------------------ |
| One corner                         | Up to two-thirds of the available height                     |
| Top and bottom corners             | Up to half each                                              |
| One corner and a full-side panel   | Corner up to one-third; full side fills the other two-thirds |
| Both corners and a full-side panel | Each gets one-third; corners may be shorter                  |
| Full-side panel alone              | Fills the available height                                   |

The available height comes from the resolved boundary after insets. Oversized corner content
scrolls inside its allocation. These are live caps, not saved user heights. Center-side allocations
and the complete occupancy rules are in the
[dock arena contract](../reference/dashpanel.md#dock-occupancy-and-allocation).

During a hybrid drag, the panel must approach the left or right boundary edge. The pointer's
vertical position within that boundary chooses the target: top quarter selects the top corner,
bottom quarter selects the bottom corner, and the middle half selects the full side. If that
full-side position is disabled, the middle zone can target the corresponding enabled center-side
position. A disabled or occupied candidate is not replaced with a different available corner.
The placement menu also exposes enabled destinations that do not have a drag zone. Releasing on
an available target commits the dock.

Canvas readout offsets belong to your app. For a top-corner panel, offset only the corresponding
top readout row; for a bottom-corner panel, only the bottom row. A full-side panel may require both.
Use the occupied panel's rendered bounds when calculating clearance, rather than treating the
corner's maximum allocation as its actual height. Picodash does not reposition those readouts or
reserve their layout space.

See the [boundary contract](../reference/dashpanel.md#boundaries-insets-and-portals) and
[durable layout](../reference/dashpanel.md#durable-layout) for the full rules.

## Compose custom groups and pinned controls

Snapshot `.26` adds local ordering pins on Dashlets and subgroups, with root
scrolling controlled by `DashStack.stickyLanes` (default `"both"`). The instructions below
retain the root-group wrapper compatible with earlier snapshots. Snapshots through `.25`
do not expose the new API. See [pin bands](../reference/dashstack.md#pin-bands).

A custom component used directly inside a DashStack must receive a stable `id` **at the call
site** and forward that same ID to the single DashGroup or Dashlet it renders. An ID hidden
inside the component is not enough: DashStack reads the child declaration before the wrapper
renders. A React `key` does not replace `id`. Missing IDs can fail at runtime with
`invalid-node-id`; changing the ID inside the wrapper also violates registration.

In snapshots through `.25`, `pin="start"` and `pin="end"` belong only on **root DashGroups**. To pin a SegmentedDashlet or
another control, put it inside a pinned root group. Dashlets and nested subgroups cannot be
pinned. A custom root-group wrapper should expose and forward `pin` as well as `id`:

```tsx
'use client'
import {
  createPicodashNexus,
  DashGroup,
  DashStack,
  SwitchDashlet,
  type DashGroupProps,
} from '@picodash/picodash'

export function createGroupedSettings() {
  return createPicodashNexus({
    valueOwner: 'nexus',
    fields: { enabled: { defaultValue: true } },
  })
}

type SettingsNexus = ReturnType<typeof createGroupedSettings>

function DriveGroup({
  id,
  pin,
  nexus,
}: {
  id: DashGroupProps['id']
  pin?: DashGroupProps['pin']
  nexus: SettingsNexus
}) {
  return (
    <DashGroup id={id} label="Drive" pin={pin}>
      <SwitchDashlet id="enabled-control" label="Enabled" field={nexus.fields.enabled} />
    </DashGroup>
  )
}

export function GroupedControls({ nexus }: { nexus: SettingsNexus }) {
  return (
    <DashStack id="grouped-settings" nexus={nexus}>
      <DriveGroup id="drive" pin="start" nexus={nexus} />
      <DashGroup id="mechanical-roles" label="Mechanical roles" />
    </DashStack>
  )
}
```

Create `createGroupedSettings()` once per mounted application and pass that stable instance to
`GroupedControls`. The wrapper's `id="drive"` identifies the group; `id="enabled-control"`
identifies its child Dashlet; `enabled` identifies the Nexus field. These are separate identities.
The pinned group is a direct Stack child, even though its implementation lives in `DriveGroup`.

**Typecheck and render.** TypeScript cannot prove what an arbitrary wrapper renders or where a
group sits in the Stack. In dogfood `.23`, `pin` on a SegmentedDashlet passed the consumer's
typecheck but failed at runtime. Do not treat accepted props as permission to bypass the
composition contract. Start the application, render each composition, and exercise its controls
before reporting an integration as working.

The source fixture `packages/picodash/tests/dogfood/GroupedControls.tsx` is checked by the external
consumer smoke test and will ship as `example/GroupedControls.tsx` in newly packed snapshots.
Existing immutable bundles keep their original guide and examples.

## Put action buttons inside custom Dashlets

A custom Dashlet can contain a native `<button type="button">` or the public `Button` from
`@picodash/ui`. Use `onClick` for the native button and `onPress` for the public Button. Interactive
children keep their own pointer and keyboard activation; no extra context or event propagation
blocker is required.

`primaryFocusRef` is optional. Attach the same ref to the intended control and the Dashlet when
clicking empty row space or revealing the Dashlet from a rail should focus that control. Without
it, those actions focus the named Dashlet shell. It is not required to activate a child button.

**Keep interaction feedback separate from application activity.** A Dashlet's
`interaction.items.get(id)?.active` flag includes pointer and keyboard presses on that Dashlet.
It does not mean a geometry edit, solver operation, or other domain task is running. Deriving a
button's disabled state from _any_ active Dashlet can disable the button during its own press.
React Aria cancels a press interrupted by disabling, even if the button becomes enabled again
on release. A programmatic `.click()` does not exercise that sequence.

For example, when playback must pause or become unavailable during geometry manipulation, derive
that condition from the relevant geometry controls or the application's geometry gesture state.
Use explicit control IDs, excluding the playback Dashlet:

```ts
const isManipulating = geometryControlIds.some((id) => interaction.items.get(id)?.active === true)
```

Check action buttons with a real pointer click and Enter or Space, including transitions into and
out of disabled state. Replacing a public Button with a native button can change event timing;
it does not resolve a self-disabling feedback loop.

## Offer presets without restricting custom values

The current `Combobox` from `@picodash/dashstack/ui` and ready-made `ComboboxDashlet` select only
from their supplied `options`. They do not expose `allowsCustomValue`. `@picodash/ui` and
`@picodash/picodash/ui` do not export a ComboBox. Do not cast unsupported props onto these controls
or assume that typing a value absent from `options` will commit it.

For an application-owned value such as playback RPM, compose the editor inside a custom Dashlet:

- A native input with an associated `datalist` provides suggestions while allowing other values,
  without adding a dependency. Give it an accessible label and use the same unique ID for the
  input's `list` attribute and the datalist's `id`. Browser presentation and suggestion behavior
  vary; test the target browsers.
- When you need a styled listbox with controlled selection and filtering, use `ComboBox` directly
  from `react-aria-components` with `allowsCustomValue`, `Input`, `Button`, `Popover`, `ListBox`, and
  `ListBoxItem`. Declare React Aria as an application dependency rather than relying on Picodash's
  transitive installation. This is application composition, not an additional Picodash export.

Keep the editable text draft separate from the committed number. For positive RPM, reject blank,
non-finite, zero, and negative values before committing; retain the last valid speed while the
user edits. Apply the same validation to presets and typed values. Define a commit policy such as
Enter or blur, and show invalid input without silently clamping it. If the value belongs in Nexus,
put its canonical validation on the field and use the public binding contract.

For safe-area focus redirection, pass a ref to the custom Dashlet's `primaryFocusRef` and attach it
to the actual input (React Aria's `Input` when using that composition). That ref is optional for
normal direct interaction. Keep the self-disabling feedback rule above in mind for both native
and React Aria controls.

## Match a Tailwind v4 host layout to the theme

Picodash ships its own control styles. If your application already uses Tailwind v4, map public
Picodash tokens into host utilities with **`@theme inline`** in your global stylesheet:

```css
@import 'tailwindcss';
@import '@picodash/picodash/style.css';

@theme inline {
  --color-pico-canvas: var(--picodash-color-canvas);
  --color-pico-surface: var(--picodash-color-surface);
  --color-pico-text: var(--picodash-color-text);
  --color-pico-border: var(--picodash-color-border);
}
```

Put the elements using those utilities **inside** the provider:

```tsx
import type { ReactNode } from 'react'
import { PicodashThemeProvider, type PicodashTheme, type PicodashDensity } from '@picodash/ui'

export function HostLayout({
  children,
  theme = 'system',
  density = 'regular',
}: {
  children: ReactNode
  theme?: PicodashTheme
  density?: PicodashDensity
}) {
  return (
    <PicodashThemeProvider theme={theme} density={density}>
      <main className="min-h-dvh bg-pico-canvas p-4 text-pico-text">
        <section className="rounded-lg border border-pico-border bg-pico-surface p-4">
          {children}
        </section>
      </main>
    </PicodashThemeProvider>
  )
}
```

The provider places token values on its DOM carrier, not on `:root` or `body`. It uses
`display: contents`, so the child `main` owns the full-height background. A parent outside that
carrier cannot inherit its tokens. Pass the same theme preference to host and control composition;
adding a host `.dark` class alone does not change Picodash's provider state.

`@theme inline` makes `bg-pico-canvas` reference `var(--picodash-color-canvas)` on the consuming
element. Plain `@theme` instead introduces an alias that can resolve at the root, where the scoped
Picodash token is unavailable or has the wrong value. That can produce a white/transparent host
background beside dark controls. See Tailwind's
[guidance on referencing other variables](https://tailwindcss.com/docs/theme#referencing-other-variables).

You can also use `bg-(--picodash-color-canvas)` and `text-(--picodash-color-text)` directly inside
the provider without aliases. Tailwind remains optional for Picodash itself. Verify light, dark,
and nested-provider layouts; computed colors should follow the nearest provider.

## Keep groups translucent inside a frosted Panel

If a Panel looks frosted only in the gaps between groups, inspect the group background before
increasing the blur. DashPanel already paints a translucent background and applies backdrop blur.
DashGroups paint `--picodash-color-well` on top of it; an opaque well hides the blurred content
beneath each group, even when the Panel itself is translucent.

Give the well color an alpha component in your application's theme. For a partial restyle of the
built-in themes, add these overrides after importing the Picodash stylesheet:

```css
[data-picodash-theme='dark'] {
  --picodash-color-well: rgb(24 28 32 / 35%);
}

[data-picodash-theme='light'] {
  --picodash-color-well: rgb(242 245 250 / 35%);
}
```

These are starting values to adjust against your canvas, not new built-in defaults. For an
existing named theme, change its `--picodash-color-well` definition instead. This is a partial
restyle, not a complete named-theme recipe: new named themes must define the full shared color
palette and `color-scheme` described in the
[theme contract](../reference/ui.md#theme-and-stylesheet-contract). Apply the rule to the public theme carrier
so it also matches Panels and overlays carrying that theme outside the original DOM subtree.

Keep the existing Panel-level blur. Adding `backdrop-filter` to each group creates extra blur
layers and changes the appearance; it is not needed to reveal the Panel's existing blurred
background. Changing the well token requires no private component selector or package patch.
Use color alpha rather than CSS `opacity`, which would also fade labels, inputs, and focus feedback.
The well token is shared: this change affects every well-colored element in that theme.

Alpha accumulates through overlapping backgrounds. A 65.5%-opaque Panel with a 35%-opaque group
has roughly 77.6% combined opacity over the canvas; the group is not simply 35% opaque overall.
Nested translucent groups can become denser again. Keep foreground colors readable and check
expanded groups, nested groups, and controls over both light and dark canvas content.

To verify your theme, inspect computed styles on the Panel and an expanded group. The Panel should
retain its backdrop blur, while the group's background color should now have alpha below one.
The current implementation mixes the Panel surface color with transparency and uses twice
`--picodash-blur-surface` (12px by default, producing 24px of Panel blur). Those implementation
values can change; the consumer adjustment is the public well color, not a copied Panel recipe.

## Update or roll back

Run the installer from a **new** snapshot against the same application directory:

```sh
bun /path/to/0.1.0-dogfood.7/install.mjs /path/to/my-app
```

It moves all five dependencies and overrides together. Restart the application dev server, run
its checks, and exercise the controls you actually use before committing the update. Leave the
previous vendor directory in place until you are satisfied.

To roll back, run the previous snapshot's installer. The app already retains a copy:

```sh
bun /path/to/my-app/vendor/picodash/0.1.0-dogfood.6/install.mjs /path/to/my-app
```

Then restart and check the app again. A package rollback does not reverse application source edits
or migrate saved Nexus data. Keep data backups when testing persistence changes. Once an update is
accepted, unused old vendor directories can be removed in a separate application commit.

If installation fails, the installer exits unsuccessfully and keeps `package.json` and vendored
files available for inspection. Fix the registry, network, or dependency error and rerun it, or
use the previous installer. It does not claim an atomic rollback of `node_modules` or `bun.lock`.
Do not manually update just one `@picodash/*` dependency or leave an old override behind.

## Turn a finding into a Picodash fix

Use one real application workflow first. Check pointer and keyboard operation, regular and compact
density, light and dark themes, disabled/read-only behavior, and persistence if your app uses it.
Check the browser console as well as the visible result.

For each finding, record:

- Snapshot version and `sourceCommit` from `vendor/picodash/<version>/snapshot.json`.
- Framework, React/Bun versions, browser, and relevant theme/density.
- The smallest public-API example and steps that reproduce it.
- Expected versus actual behavior, plus a screenshot or error when useful.

Fix the owning source package in Picodash, add a regression check at the cheapest faithful layer,
and create a new snapshot version. Install that snapshot back into the originating application
and repeat its reproduction. Also record awkward APIs or missing documentation: dogfooding should
improve integration effort, not only catch broken controls. Never patch generated `dist` or a
consumer's installed package as the lasting fix.

## Create the next snapshot

From the Picodash repository, with dependencies installed and source changes committed:

```sh
bun run dogfood:test
bun run dogfood:pack 0.1.0-dogfood.7
bun run dogfood:check output/dogfood/0.1.0-dogfood.7
```

Choose an unused version. `dogfood:pack` runs package release checks and builds, stages only the
packages' declared distribution files plus licenses/readmes, resolves workspace and catalog
references, and packs into `output/dogfood/<version>/`. It leaves source package versions unchanged
and refuses an existing output directory. Copy that whole directory to distribute it; retain the
exact bundle for reproducibility. Generated bundles are ignored by Git in the Picodash repository.

`dogfood:check` installs the bundle in a temporary project outside the monorepo, repeats the install,
checks public TypeScript consumption, operates the packed switch and selector in a DOM test, and
builds the application with Vite and Next.js, including the combined CSS. It also exercises the compound-design and priority recipes. It removes its temporary project.
Pass a second bundle directory to additionally exercise switching versions and rolling back from
the vendored installer.
This verifies package consumption; it does not certify every framework, browser, or Picodash API.

For an explicitly uncommitted local trial, append `--allow-dirty` to `dogfood:pack`. The manifest
records that status. Use a new version and clean source for a bundle you intend to share.
Registry publication, automated release channels, and workspace consumers can follow after this
feedback loop has been exercised.

After validating a new clean bundle, update `docs/development/recommended-snapshot.json` in a
scoped documentation commit. `dogfood:locate` is the consumer discovery command; trial builds do
not change the recommendation automatically. The pinned version must remain available at its
recorded output location, or the command reports it unavailable.
