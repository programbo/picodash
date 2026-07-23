<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

# Project Guide

Keep this file current whenever workspace structure, scripts, architecture, public API, or verification flow changes.

## Repository Topology

- `packages/panel`: the promoted public package and default API surface.
- `apps/web`: Next.js app-router source of the same interactive gallery and State Lab experiences.

`apps/web` routes: `/`, `/store`, `/usage`, `/themes`, `/more-examples`, `/state-lab/{provider,scene,built-in-items,custom-items}`,
`/panel-geometry-lab` (debugging-only), and 404.
`/state-lab` and `/panel-geometry-lab` are retained as debugging routes and are not treated as public website pages.

`/demo` is deprecated legacy and not an active route/API in this workspace.

## Active API Model

The workspace API is application-owned panel state using the `createPicodashPanelStore` model.
Provider descendants may control registered panel visibility and activation with `usePicodashPanel`;
that visibility is transient and separate from persisted layout. `PicodashPanel close` hides by
default, while the explicit `deregister` close behavior removes the registration and portal before
notifying the host. Application code reads panel values from its explicit store with
`usePicodashPanelStoreSelector`; panel IDs do not provide global value lookup. Advanced provider
access uses `usePicodashProviderSelector` / `usePicodashProviderStoreApi`, while contextual panel
access uses `usePicodashPanelSelector` / `usePicodashPanelStoreApi`. Legacy schema-driven
registration flow is retired.

`@picodash/panel/style.css` ships complete `dark` and `light` theme recipes. `PicodashProvider
theme="system"` follows `prefers-color-scheme` and reacts to preference changes. Consumers define
named themes by overriding semantic `--picodash-*` tokens under `data-picodash-theme`; the provider
can take a generic custom theme union such as `PicodashProvider<'brand' | 'contrast'>`.
The web gallery's `ocean`, `plum`, `cyber`, and `contrast` recipes are demo-only.

Panel placement supports floating, magnetic, and fixed modes. `PicodashPanelSnapPosition` names
magnetic edges, while fixed docking uses the six side/corner positions. `usePicodashPanel` owns
runtime placement changes. Geometry defaults to the viewport; `PicodashProvider.panelBoundary`
sets a shared Element/ref boundary and `PicodashPanel.boundary` can override it. Boundaries remain
independent of portal ownership.

## Required Commands

- `bun install`
- `bun run dev`
- `bun run web`
- `bun run --filter @picodash/panel check`
- `bun run --filter @picodash/panel test`
- `bun run --filter @picodash/panel build`
- `bun run --filter @picodash/web check`
- `bun run --filter @picodash/web test:e2e`
- `bun audit --audit-level=high`
- `bun run --cwd packages/panel release:check`
- `bun run ready`

`bun run ready` is the full gate:

```bash
vp run @picodash/panel#build && vp check && vp run -r test && vp run -r build && bun run --filter @picodash/web test:e2e
```

GitHub CI runs parallel `quality` and `e2e` jobs for pull requests and pushes to `main`. The quality
job audits high-severity vulnerabilities, checks the workspace, and runs unit tests. The E2E job
builds the workspace and runs the Playwright end-to-end suite. Package publication runs the package
check, tests, and build before publishing.

The repository is currently a public preview: Issues are available for feedback, while pull
requests are disabled until the contribution workflow reopens. Versioning and release guidance is
in `RELEASING.md`.

## Port Allocation

This worktree is in the `picodash` port registry range `6030-6039`.

- `6030-6034`: available for additional local services.
- `6035`: this worktree override via `WEBSITE_PORT` for web development and the Playwright/E2E server.
- `6036`: this worktree production start server.
- `6037-6039`: available for future local services.

Assign new local services only from the available slots in this range.

For this worktree:

```bash
WEBSITE_PORT=6035 bun run web
WEBSITE_PORT=6035 bun run --filter @picodash/web test:e2e
```

## Documentation Surfaces

- `README.md`
- `packages/panel/README.md`
- `SKILL.md`
- `AGENTS.md`
- `llms.txt`

Update all five files together when command surface, entrypoints, or architecture changes.

## Package Boundaries

- `@picodash/panel` exports remain package-owned and are used via `@picodash/panel`, `@picodash/panel/advanced`,
  `@picodash/panel/ui`, and `@picodash/panel/style.css`.
- Shared shadcn components live only under `packages/panel/src/components/ui`; workspace apps
  consume `@picodash/panel/ui` and do not keep their own `components.json` or generated copies.
- `@picodash/panel/ui` uses the shadcn `aria-rhea` React Aria contracts. Root overlays must preserve the
  provider portal/theme/z-index contract, while nested submenus inherit their parent overlay.
- Do not document `packages/tweaker` or `apps/demo` as active workspace products.

## Verification Discipline

- Run the narrowest useful commands first, then the required full check before handoff.
- Avoid changing generated outputs (`dist/`) directly.
- Do not run broad tests unless requested by user/task scope.

## Development Behavior Rules

- Keep high-frequency visuals outside persisted stores.
- Keep values and persisted payloads JSON-compatible.
- Keep theme logic on `theme` props and data attributes.
- Validate whole batch writes before mutation in programmatic setters.
- Preserve synchronous parser/validator behavior; promise-based contracts are not supported.
- Keep custom parser/validator callback identities stable across renders.
- Preserve pointer and keyboard reorder parity, including same-band constraints and cancellation.
- Preserve legacy corner-string placements and persisted floating/magnetic layouts when extending
  placement normalization.
- Resolve panel boundaries in panel-override, provider-default, viewport order; `null` explicitly
  selects the viewport, while an unresolved ref falls through to the next boundary.
- Keep fixed start/end lanes outside the auto-lane scrollport and apply the bundled `scroll-fade`
  utility to every root panel scrollport.
