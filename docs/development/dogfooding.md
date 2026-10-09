# Use Picodash in another project

Use a dogfood snapshot to try Picodash in a real React application and bring findings back to this
repository. Each snapshot contains the five public packages at one exact prerelease version,
a standalone installer, an executable example, and a source-commit record. Nothing is published to
a registry. External dependencies still download from your configured registry.

These are development previews, not a promise of stable APIs or saved-data compatibility. Keep the
previous snapshot while evaluating an update. Dev Bridge is private development tooling and is not
included. The experimental charts entry is not part of the starter example.

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
