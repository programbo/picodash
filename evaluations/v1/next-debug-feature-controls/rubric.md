# Scoring rubric (100 points)

## Deterministic acceptance — 60 points

- Production build and TypeScript checks pass: 10
- Whole-record external adapter, typed fields, and public-import architecture checks pass: 10
- Host updates propagate to the Panel through the external store: 6
- Panel updates propagate atomically to the external store and host: 8
- Feature rollout is one compound unit and resets both values together: 7
- Clear cache calls the domain action and reports success: 6
- Simulated failure reports an accessible failure without corrupting values: 5
- Developer-only exposure gates both Panel and launcher: 4
- Dismiss, persistent launcher reopen, and focus restoration work: 4

## Manual review — 40 points

- External ownership remains unambiguous with no mirrored mutable state or synchronization effects:
  10
- Adapter remains synchronous, whole-record, validation-aware, and appropriate for Strict Mode: 8
- Actions are explicit domain operations rather than writable fields: 6
- Compound composition uses public semantic Dashlet elements and accessible primitives: 5
- Labels, action feedback, focus, contrast, target sizes, and reduced motion meet WCAG 2.2 AA
  intent: 6
- README accurately explains adapter, exposure, actions, and verification: 3
- Changes are focused and avoid unrelated framework churn: 2

No deterministic credit is awarded for tests that were edited, skipped, or weakened.
