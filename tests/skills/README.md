# Initial Intent consumer verification

On 2026-10-12 a fresh agent (`/root/intent_consumer`, no parent conversation) received task.md
against an isolated Bun application with installed trial tarballs `0.1.0-dogfood.9041`. It read the
consumer's Intent-generated AGENTS.md, listed skills, and loaded both
`@picodash/picodash#bind-controls` and `@picodash/dashpanel#docked-panel-shortcuts` through Intent.
Its only owned file was Consumer.tsx, retained here as consumer-solution.tsx.txt.

The task grader is `packages/picodash/tests/dogfood/shortcuts.test.tsx`: copy it beside the candidate
as consumer.test.tsx and change its import from Shortcuts.js to Consumer.js. Use the repository's
`test/setup.ts` and Vite+ test runner. The grader passed for both the maintained Shortcuts.tsx
example and the fresh consumer. It checks the shared control/readout, recorded binding, retained
draft and DOM identity, persisted reload, and explicit clear. The final dogfood smoke test runs the
maintained example from installed tarballs and validates/discovers both version-stamped skills.

Fresh-consumer browser checks also passed toggle/readout, recording, minimize/reveal, reload,
layout reset, clear, and focus transfer. Its temporary browser tab and Bun server were closed and
the listener exit was verified. A screenshot impression about label visibility was not reproduced
or established as a defect; DOM text, accessible name and normal bounds were present.

The bare TypeScript 7 consumer required CSS declarations: the first consumer used the compiler's
side-effect-import switch as a workaround. Guides now specify framework CSS declarations
(`vite/client` for Vite, `vite-plus/client` for Vite+) and retain strict checking. The same
consumer passes strict TypeScript checking with `--types vite-plus/client,react,react-dom`. No runtime dependency on Intent was added.

Discovery evidence is one positive combined task and two observed guide loads. Adjacent negative
prompts are recorded in task.md but automated negative activation rates are unverified. This is
one consumer attempt, not a reliability claim. Structural validation and deterministic task tests
are separate evidence. Trial .9040 exposed missing package repository metadata; .9041 discovery
passed after correction. Final release verification uses the clean-source .40 bundle.

The unchanged grader also ran against a separate incorrect candidate with the persistence driver
removed. It failed at the restored shortcut assertion (`⌨` instead of `K`), confirming that an
ephemeral-only implementation does not pass the task. The successful candidate was left intact.

Installed Intent 0.5.5 validation proves skill structure but skips code-block typechecking: its
`libraryEntry` requires a Git-tracked declared type entry, which installed tarballs cannot supply.
Adding a manifest `types` field does not change that condition. Source-level Intent validation
checks the guide blocks; the installed consumer's separate strict typecheck and interaction grader
check the delivered API. The final .40 bundle passes 14 installed tests, both guide discovery and
version assertions, and Vite/Next builds. Do not report installed structural validation as a
second independent code-block typecheck.

## Closeable panels and contextual group shortcuts (2026-10-12)

A fresh agent (`/root/contextual_consumer`, no parent conversation) completed contextual-task.md in
an isolated Bun consumer installed from trial `0.1.0-dogfood.9042`. It discovered and loaded both
updated guides through Intent and changed only ContextualShortcuts.tsx. Its output is retained as
contextual-consumer-solution.tsx.txt. Strict TypeScript checking passed. The unchanged contextual
consumer grader passed, proving context reuse, retained draft/DOM identity, hide/show, persisted
panel and group bindings after model recreation, and explicit clearing. This is one independent
consumer attempt, not an activation or reliability rate.

To reproduce, copy that candidate, the existing Shortcuts.tsx createSettings helper, the unchanged
contextual-shortcuts.test.tsx grader and test/setup.ts into an installed consumer using Vite+.
A separate negative candidate omitted only createSettings's persistence configuration. The same
grader failed on restored panel binding (keyboard symbol instead of K), as intended. The positive
candidate was left intact. The installed Intent structural-validation limitation described above
still applies; the consumer typecheck and executable grader provide separate delivered-API proof.

The real Lab browser verified recorder placement beside group Detach actions, active-parent
routing, retained detached content and focus, hidden-parent exclusion, and close-only reopening.
The existing persistence and two-panel style journeys also pass. The latter's obsolete underline
expectation was corrected to the already accepted solid-selection styling; no selection behavior
changed in this round.
