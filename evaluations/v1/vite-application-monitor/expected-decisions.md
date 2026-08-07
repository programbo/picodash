# Expected decisions

## State

- One `createPicodashStore<MonitorValues>` instance owns all monitor values.
- Typed field handles bind every built-in or compound Dashlet.
- One atomic Store write advances request rate, latency, errors, progress, status, and history.
- History validation enforces JSON-compatible samples and a maximum of 12 entries.
- No React effect or duplicate mutable record is used to synchronize host and Panel.

## Composition

- Service health is one compound Dashlet because its metrics, state, progress, and history form one
  semantic monitoring unit.
- It uses accepted anatomy from `@picodash/dashlist/dashlet`, accessible primitives from the public
  UI surface, and ordinary semantic HTML/SVG rather than depending on experimental helper families.
- The sparkline or equivalent streaming visual uses semantic data-color tokens and has an
  accessible name plus current-value text.

## Exposure and UX

- A role policy gates the Panel and launcher for operator/developer roles.
- The Panel overlays the application at top-right, starts visible, and is explicitly reopenable.
- Disconnected and recovery samples use semantic status treatment, not color alone.
- Light, dark, and system themes use Picodash theme props and semantic tokens.
- The stream has an accessible name and textual fallback; status changes use an appropriate live
  region, keyboard focus is restored after dismissal, and reduced motion is respected.

## Verification

- Type checking and the Vite production build pass.
- Acceptance advances deterministic samples, checks the bounded stream, verifies semantic
  monitoring output, tests exposure changes, and checks dismiss/reopen focus.
