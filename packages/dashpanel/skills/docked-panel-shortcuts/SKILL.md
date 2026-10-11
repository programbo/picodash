---
name: docked-panel-shortcuts
description: Add a user-recorded, persistent keyboard shortcut that minimizes
  and reveals a docked Picodash DashPanel in a React app. Use for panel keyboard
  access and shortcut persistence, not generic application hotkeys or DashStack
  ordering.
metadata:
  library: '@picodash/dashpanel'
  library_version: '0.0.0'
  purpose: 'Give a docked panel a user-recorded shortcut stored with its Nexus preferences.'
  type: framework
  framework: react
requires: []
sources:
  - programbo/picodash:docs/reference/dashpanel.md
  - src/panel-hotkey.tsx
  - src/index.tsx
---

## Add a shortcut recorder

Use the installed `@picodash/dashpanel` and `@picodash/nexus` packages with React 19+.
Import `@picodash/dashpanel/style.css` once in the application. With the integrated facade,
use `PicodashProvider` and `@picodash/picodash/style.css` instead of nesting Providers.

Create the Nexus once on the client, then pass it to the Provider. Give each Panel a stable,
unique `id`. A changed ID is a different preference scope.

```tsx
import { useState } from 'react'
import { createPicodashNexus } from '@picodash/nexus'
import { createWebStoragePersistenceDriver } from '@picodash/nexus/web-storage'
import { DashPanel, DashPanelProvider } from '@picodash/dashpanel'

export function Inspector() {
  const [nexus] = useState(() =>
    createPicodashNexus({
      valueOwner: 'nexus',
      nexusId: 'my-app-controls',
      schemaVersion: 1,
      fields: {},
      persistence: {
        storageKey: 'my-app-controls-v1',
        driver: createWebStoragePersistenceDriver('local'),
        values: { defaultFieldPolicy: 'omit' },
      },
    }),
  )
  return (
    <DashPanelProvider nexus={nexus}>
      <DashPanel
        id="inspector"
        title="Inspector"
        collapsible
        recordableHotkey
        defaultLayout={{
          placement: { mode: 'fixed', disposition: { kind: 'docked', position: 'full-right' } },
        }}
      >
        <input aria-label="Draft name" defaultValue="Example" />
      </DashPanel>
    </DashPanelProvider>
  )
}
```

Mount this component only after browser hydration: Web Storage requires a browser. When a host
already owns a Nexus, reuse it and its persistence policy; do not create a competing root or store
the binding in another localStorage key. Let the application's existing initialization/recovery
flow handle unavailable storage and quarantined metadata. Destroy an owned Nexus only at permanent
application teardown, after all its Providers unmount.

In a TypeScript consumer, retain the framework's CSS module declarations (for Vite, include
`vite/client`, or `vite-plus/client` for Vite+, in the application types). A bare TypeScript configuration without CSS declarations
can report TS2882 for the stylesheet import; do not remove the stylesheet or disable typechecking.

## Expected behavior

The chip appears only on collapsible docked Panels. Click it or activate it with the keyboard,
then press a modifier chord such as Control+Shift+K. Escape cancels; Backspace/Delete clears.
An invalid or conflicting candidate leaves the old binding intact and recording active.

The shortcut minimizes/reveals through the normal retained Panel lifecycle, and can reveal a
closed but still mounted docked Panel. It does not fire while editing text, recording a shortcut,
or displaying a modal. Holding the keys toggles once. Floating or non-collapsible Panels do not
activate the binding. Re-docking restores it.

The binding is `scope.dashPanelHotkey`, independent of `scope.dashPanel` layout. Use public
`nexus.scope(panelId).setDashPanelHotkey(null)` to clear it programmatically. Layout reset leaves
it intact. Without a persistence driver it lasts only for the Nexus lifetime. Minimized/visible
state is never persisted.

## Failure cases and completion

Do not unmount the Panel to hide it: that removes its shortcut registration. Do not recreate the
Nexus on render. Both mistakes discard the retained behavior demonstrated by the example.
A shortcut conflicting with another mounted TanStack registration is rejected; restored duplicates
are suppressed. Browser/OS shortcuts and unrelated event listeners cannot all be discovered.
Choose another chord if the browser intercepts it. This feature uses physical key codes and displays
platform-specific modifiers.

Verify in a browser: record a key, edit the input, minimize/reveal without losing the draft,
reload and use the saved key, reset layout then re-dock and use it again, and clear it. Check
keyboard focus moves to the reveal/minimize controls without scrolling the document. If these
checks fail, report the installed package version, placement, key, and persistence configuration.
