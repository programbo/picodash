# Scoring rubric (100 points)

## Deterministic acceptance — 60 points

- Production build and TypeScript checks pass: 10
- Native Nexus, typed handles, public imports, and no mirroring-effect architecture checks pass: 10
- One sample action updates host metrics and Panel metrics consistently: 8
- Status and deployment progress update with semantic text: 7
- Streaming visualization updates and exposes an accessible name/current value: 8
- History remains bounded to 12 samples: 5
- End-user exposure hides both Panel and launcher; operator/developer exposure restores them: 6
- Dismiss, launcher reopen, and focus restoration work: 6

## Manual review — 40 points

- Nexus definitions own valid defaults and durable whole-record constraints: 8
- Service health is one coherent compound Dashlet using accepted public anatomy and accessible
  semantic content: 8
- Streaming treatment uses semantic data tokens, textual fallback, and restrained motion: 7
- Status, progress, labels, focus, contrast, and target sizes meet WCAG 2.2 AA intent: 8
- README accurately explains installation, Nexus ownership, exposure, and verification: 4
- Changes are focused, idiomatic, and free of unrelated framework churn: 5

No deterministic credit is awarded for tests that were edited, skipped, or weakened.
