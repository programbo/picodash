# Expected decisions

## State

- The existing React `useState<SceneValues>` record remains the source of truth.
- A Strict Mode-safe `PicodashValueAdapter<SceneValues>` supplies `getSnapshot`, `subscribe`, and
  atomic `setValues` around the React-owned record.
- Panel writes deliver one complete validated record; there is no second independently mutable
  copy and no per-field mirroring effect.
- Typed field handles, not string field names, bind every Dashlet.
- Defaults and durable validation live in field definitions.

## Composition

- Bloom and quality use compatible built-in Dashlets.
- Atmosphere is one compound `Dashlet` with three field bindings, one ordering boundary, and one
  reset boundary.
- The compound body uses `@picodash/dashlist/dashlet` for accepted semantic anatomy and
  `@picodash/picodash/ui` only where a lower-level interactive primitive is needed.

## Exposure and UX

- A build-time development policy gates both the Panel and launcher.
- The Panel begins visible, is bottom-right snapped, and overlays rather than reflows the canvas.
- Dismissal restores focus to the launcher or another explicit logical target.
- Theme selection uses Picodash theme props and semantic tokens, including `system`.

## Verification

- Type checking and the production Next.js build pass.
- Acceptance exercises host-to-Panel and Panel-to-host synchronization, dismissal/reopen,
  compound reset, theme changes, and keyboard focus.
