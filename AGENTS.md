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
- `apps/web`: production Next.js App Router website and public product experience.
- `apps/lab`: local-only Next.js debugging app, tested by the shared Playwright suite but not
  deployed as part of the production website.

`apps/web` routes: `/`, `/store`, `/usage`, `/themes`, `/more-examples`, and 404.
`apps/lab` routes: `/lab/state/{provider,scene,built-in-items,custom-items}`,
`/lab/panel-geometry`, `/lab/panel-interaction`, and `/lab/dashlets`; `/` and `/lab` redirect to
`/lab/state`.

`/demo` and the former debugging routes hosted by `apps/web` are not active production routes.

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

`PicodashPanel` exposes public action-menu composition. `actionMenu` is part of the public
`PicodashPanel` API:

- `undefined` => built-in default action menu.
- `false` => menu hidden.
- `readonly ReactElement[]` => wrapped by a root `ActionSubmenu` with the default trigger.
- `ActionSubmenu` root element => replaces the default root trigger.

Public exports include `ActionMenuItem`, `ActionSubmenu`, `ActionMenuSeparator`,
`CopySubmenu`, `ExportSubmenu`, and built-in item components.
`destructive` for `ActionMenuItem` is the tuple `[message, title?, buttonLabel?]`
with defaults `title = label` and `buttonLabel = 'Confirm'`.

`@picodash/panel/style.css` ships complete `dark` and `light` theme recipes. `PicodashProvider
theme="system"` follows `prefers-color-scheme` and reacts to preference changes. Consumers define
named themes by overriding semantic `--picodash-*` tokens under `data-picodash-theme`; the provider
can take a generic custom theme union such as `PicodashProvider<'brand' | 'contrast'>`.
The web gallery's `ocean`, `plum`, `tron`, and `contrast` recipes are demo-only.

Panel placement supports floating, magnetic, and fixed modes. `PicodashPanelSnapPosition` names
magnetic edges, while fixed docking uses the six side/corner positions. `usePicodashPanel` owns
runtime placement changes. Floating edge snaps retain their offset and stay floating. Magnetic
drags keep the real panel natural-sized and floating-style while an animated outline previews the
release target. Side targets commit flush, full-height, and fixed-like; corner targets commit flush,
natural-height, and fixed-like. Top and bottom targets stay natural-height and floating-style,
without fixed retraction. A 40px pull releases an attached magnetic panel without changing mode.
Geometry defaults to the viewport;
`PicodashProvider.panelBoundary`
sets a shared Element/ref boundary and `PicodashPanel.boundary` can override it. Boundaries remain
independent of portal ownership.

## Required Commands

The deployment scripts require a globally installed Vercel CLI. Install it once with
`bun install --global vercel`.

- `bun install`
- `bun run lint`
- `bun run format`
- `bun run dev`
- `bun run web`
- `bun run lab`
- `bun run deploy`
- `bun run deploy:prod`
- `bun run --filter @picodash/lab lint`
- `bun run --filter @picodash/lab format`
- `bun run --filter @picodash/lab check`
- `bun run --filter @picodash/lab build`
- `bun run --filter @picodash/web lint`
- `bun run --filter @picodash/web format`
- `bun run --filter @picodash/panel lint`
- `bun run --filter @picodash/panel format`
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

The shared project defaults are:

- `6030`: web development server via `WEBSITE_PORT`.
- `6031`: web production preview (`start`) server via `WEBSITE_PORT`.
- `6032`: local lab development server via `LAB_PORT`.
- `6033`: web E2E server via `WEBSITE_PORT`.

Ports `6034-6039` can be temporarily allocated to worktrees so development and E2E servers can
run without conflicting with the shared project servers. If an agent needs to briefly run a server
and its allocated port is occupied, it should find a free port in `6034-6039` and pass that port
through the relevant environment variable.

Assign new local services only from the available slots in `6034-6039`.

For this worktree:

```bash
LAB_PORT=6032 WEBSITE_PORT=6033 bun run --filter @picodash/web test:e2e
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
- Keep `apps/web/tests/routes.spec.ts` asserting the production route boundary plus local lab paths
  and their `data-product-route` markers.
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
- Keep floating edge snaps offset and classified as floating. Magnetic drags use stable natural
  panel geometry for pointer intent and animate an independent proxy; never resize or reposition
  the real panel to infer intent. Commit only on release. Side targets are flush, full-height, and
  fixed-like; corner targets are flush, natural-height, and fixed-like. Top and bottom targets stay
  natural-height and floating-style. Keep magnetic mode through the 40px attached release.
- Resolve panel boundaries in panel-override, provider-default, viewport order; `null` explicitly
  selects the viewport, while an unresolved ref falls through to the next boundary.
- Keep fixed start/end lanes outside the auto-lane scrollport and apply the bundled `scroll-fade`
  utility to every root panel scrollport.
