---
name: bind-controls
description: Build a React settings panel or inspector with Picodash controls
  bound to application values. Use for initial Nexus and DashStack integration
  custom Dashlet wrappers, or contextual detachable-group shortcuts; not a planetary solver or generic forms.
metadata:
  library: '@picodash/picodash'
  library_version: '0.0.0'
  purpose: 'Bind Picodash controls and application readouts to one typed Nexus.'
  type: framework
  framework: react
requires: []
sources:
  - programbo/picodash:docs/development/consumer-recipes.md
  - tests/dogfood/Controls.tsx
  - src/index.ts
  - src/detachable-group.tsx
  - tests/dogfood/ContextualShortcuts.tsx
---

## Bind a control and a readout

Use the installed `@picodash/picodash` package with React 19+. Import
`@picodash/picodash/style.css` once. Package styles work without consumer Tailwind configuration.
Create one Nexus for the application's lifetime; the same root supplies fields and selectors.

```tsx
import { useState } from 'react'
import {
  createPicodashNexus,
  DashStack,
  SwitchDashlet,
  usePicodashNexusSelector,
} from '@picodash/picodash'

function createSettings() {
  return createPicodashNexus({
    valueOwner: 'nexus',
    fields: { enabled: { defaultValue: true } },
  })
}
function Controls({ nexus }: { nexus: ReturnType<typeof createSettings> }) {
  const enabled = usePicodashNexusSelector(nexus, (state) => state.values.enabled)
  return (
    <>
      <DashStack id="settings" nexus={nexus}>
        <SwitchDashlet id="enabled-control" label="Enabled" field={nexus.fields.enabled} />
      </DashStack>
      <output aria-label="Application value">{enabled ? 'On' : 'Off'}</output>
    </>
  )
}
export function Settings() {
  const [nexus] = useState(createSettings)
  return <Controls nexus={nexus} />
}
```

`nexus` on a standalone Stack supplies its boundary. When composing a Panel and Stack, use one
`PicodashProvider nexus={nexus}`, put `DashPanel` inside it, then put `DashStack` inside the Panel
without another Nexus. Do not nest Providers simply to render another control. Each Stack, Group,
Dashlet, and field has its own identity; labels and React keys do not substitute for IDs.

TypeScript needs the framework's CSS declarations for the stylesheet import (Vite: `vite/client`; Vite+: `vite-plus/client`).
Keep strict typechecking; a bare compiler configuration does not know CSS imports automatically.

## Custom content and wrappers

Use a `Dashlet` with children for arbitrary application content; use `DisplayDashlet` for a bound
formatted value. For a custom wrapper declared directly inside a Stack or Group, expose `id` at
the call site and forward the same ID to its one returned Dashlet or Group:

```tsx
import { Dashlet } from '@picodash/picodash'
function Summary({ id }: { id: string }) {
  return (
    <Dashlet id={id} label="Summary">
      Application-owned result
    </Dashlet>
  )
}
// Inside a DashStack or DashGroup:
const summary = <Summary id="summary" />
```

Hardcoding the ID only inside `Summary` leaves the parent declaration without an identity and
throws `invalid-node-id`. Verify wrappers inside the real Stack, not only in isolation.

## Keep application meaning in the application

Use `nexus.fields.name` as the field handle; never fabricate or cast one. Compute derived readouts
from selectors rather than synchronizing another copy with effects. Use the application's pure
constraint/solver logic and validated Nexus writes for domain rules. Stack order exposes user
priority; Picodash does not infer gear geometry or assign physical meaning to it.

The example is ephemeral. Persistent values/preferences require a Nexus ID, schema version, and
persistence driver; do not imply this snippet survives reload. Destroy an owned root only after
all its mounted consumers unmount at permanent application teardown.

## Verify the integration

Render the actual Stack. Toggle Enabled and confirm both the control and application readout
change together. Confirm a custom wrapper has its explicit stable ID at the call site. Run the
consumer's typecheck and browser check with the installed version. Report package version and the
smallest failing composition if a field or parent declaration is rejected; do not bypass it with
`any` or private package imports.

## Contextual detachable-group shortcuts

When a settings group should pop into a Panel, keep it inside a `DashPanel` and add `detachable`
and `recordableHotkey` to its labelled root `DashGroup`. The recorder appears beside Detach in
its original header. The parent's visibility and expanded state enable the shortcut. The shortcut
detaches or shows the existing Panel; Return to stack is a separate action. Keep stable Stack and
group IDs so the saved binding survives reload. Nexus must have a persistence driver as described
in the installed `@picodash/dashpanel#docked-panel-shortcuts` guide; do not store a second preference.

```tsx
import { DashPanel, DashStack, DashGroup, Dashlet } from '@picodash/picodash'
export function GeometryTools() {
  return (
    <DashPanel id="geometry" title="Geometry" collapsible={false} showCloseButton recordableHotkey>
      <DashStack id="geometry-stack">
        <DashGroup id="tools" label="Geometry tools" detachable recordableHotkey>
          <Dashlet id="draft" label="Draft">
            <input aria-label="Geometry draft" defaultValue="Example" />
          </Dashlet>
        </DashGroup>
      </DashStack>
    </DashPanel>
  )
}
```

Mount inside the existing PicodashProvider. The Panel chip stays after its title; close-only Panels
use Hide/Show. Do not unmount on Close. No parent Panel means no group recorder; the initial
fine-pointer, 768px desktop detachment policy still applies.
Different parents may reuse the same group key. When several are eligible, the active parent wins;
with one eligible binding, focus need not already be inside it. Same-parent and global Panel
conflicts are rejected. Typing, recording and modals suppress shortcuts. Do not install competing
DOM keydown handlers to implement the same action.
Verify two visible parents with the same group key: only the active one's group detaches, drafts
survive return, hiding its parent disables that group key, and recorded bindings survive reload.
