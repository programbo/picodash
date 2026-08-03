# @picodash/dashpanel

`@picodash/dashpanel` is the standalone draggable, dockable panel shell for React applications.
It owns placement, boundaries, visibility, action menus, portals, and panel lifecycle state.
Use `@picodash/store` when panel-owned controls need typed reactive state.

```tsx
import { PicodashPanel, PicodashProvider } from '@picodash/dashpanel'
import '@picodash/dashpanel/style.css'

export function App() {
  return (
    <PicodashProvider>
      <PicodashPanel id="inspector" title="Inspector">
        Panel content
      </PicodashPanel>
    </PicodashProvider>
  )
}
```

Use `boundary` on a panel or `panelBoundary` on the provider when the panel should move and clip
relative to an application-owned element instead of the viewport. The panel's public action menu
can be replaced or extended with placement, collapse, drag, theme, import, export, and reset items.

The package intentionally does not export Dashlist or Dashlet composition. Install
`@picodash/dashlist` for lists, groups, and Dashlets, or use `@picodash/picodash` when an integrated
facade is more convenient.

## Commands

```bash
bun run --filter @picodash/dashpanel check
bun run --filter @picodash/dashpanel release:check
```
