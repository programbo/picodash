# Scoring rubric (100 points)

## Deterministic acceptance — 60 points

- Production build and TypeScript checks pass: 10
- React-owned whole-record binding and typed field-handle architecture checks pass: 10
- Host controls update the Panel and preview: 8
- Panel controls update the host and preview: 8
- Atmosphere is a single compound Dashlet and resets all three fields together: 8
- Dismiss, launcher reopen, and focus restoration work: 8
- Light, dark, and system theme choices remain operable: 4
- Production exposure gate removes Panel and launcher: 4

## Manual review — 40 points

- State ownership is unambiguous; no duplicated state or synchronization effects: 10
- Public DashList `/dashlet` and Picodash `/ui` composition surfaces are used without internal or
  rejected facade imports: 8
- Panel placement is unobtrusive and does not shift the canvas: 6
- Labels, target sizes, focus, contrast, and reduced motion meet WCAG 2.2 AA intent: 8
- README accurately explains installation, ownership, exposure, and verification: 4
- Changes are focused, idiomatic, and free of unrelated framework churn: 4

No deterministic credit is awarded for tests that were edited, skipped, or weakened.
