# Expected decisions

## State and adapter

- `featureStore` remains the sole source of truth.
- One synchronous whole-record `PicodashValueAdapter<FeatureValues>` maps `getSnapshot`,
  `subscribe`, and `setValues` to the domain store.
- Every Panel write, compound reset, import, or repair crosses the adapter as one complete validated
  record.
- There is no per-field synchronization effect, copied React state, or hidden fallback state.
- Typed handles bind every writable or displayed field.

## Composition and actions

- Log level and endpoint may use compatible built-in Dashlets.
- Feature rollout is one compound Dashlet with one registration and reset boundary.
- Clear cache and Simulate failure are fieldless action Dashlets or action elements. They call
  explicit domain methods and expose state through status/live-region semantics.
- Domain actions are not encoded as booleans or magic Store values.

## Exposure and UX

- A developer-only policy gates both the Panel and persistent launcher before rendering.
- The Panel begins visible, overlays at bottom-left, and restores focus to its launcher after
  dismissal.
- Theme choices use Picodash theme props and semantic tokens, including `system`.
- Domain action progress and outcomes use status/alert semantics without relying on color, and all
  controls retain visible labels, keyboard operation, and reduced-motion behavior.

## Verification

- Type checking and the production Next.js build pass.
- Acceptance checks host/Panel synchronization through the adapter, atomic compound reset,
  developer-only exposure, domain actions, failure semantics, and launcher focus restoration.
