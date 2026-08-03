# Website Design Contract (`apps/web`)

Picodash’s website is the public documentation surface for the agent-first workflow and the canonical
library implementation pattern.

## IA (Evolved)

Canonical IA:

- Homepage (`/`)
- `/docs/get-started/agent`
- `/docs/get-started/manual`
- `/docs/concepts/*`
- `/docs/guides/*`
- `/docs/reference/*`
- `/examples`

Current legacy routes remain redirect-only:

- `/store`
- `/usage`
- `/usage/components`
- `/themes`
- `/more-examples`
- `404` retains browser fallback behavior

## Homepage

Homepage sections:

1. Live host scene with an operating, dismissible Panel
2. Primary action: **Explore demo**
3. Secondary actions: copy prompt, install, docs
4. Scenario: creative controls
5. Scenario: application monitoring
6. Scenario: debug and feature controls
7. Compound Dashlet examples in each scenario
8. `Dashboard → Panel → Dashlet` explanation with typed examples
9. Reliability proof for types, themes, accessibility, diagnostics, and evaluation fixtures

## Visual and Interaction

- Keep the dark technical baseline, high contrast, and focused spacing.
- Preserve the distinction between provider behavior, panel behavior, and Dashlet composition.
- Prefer `@picodash/picodash/style.css` and semantic `--picodash-*` roles; avoid host-only styling dependencies.
- Example surfaces should remain actionably runnable and close to production usage patterns.

## Accessibility and Behavior Constraints

- Preserve visible labels and explicit accessible names.
- Keep mobile-friendly controls for docked/fixed/snapped scenarios.
- Keep close/reopen flows and focus restoration deterministic.
