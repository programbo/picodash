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

- `packages/tweaker`: the promoted public package and default API surface.
- `apps/website`: showcase, landing page, and `/gallery` + `/state-lab` demo apps.

## Active API Model

The workspace API is application-owned panel state using the `createTweakerPanelStore` model.
Provider descendants may control registered panel visibility and activation with `useTweakerPanel`;
that visibility is transient and separate from persisted layout. `TweakerPanel close` hides by
default, while the explicit `deregister` close behavior removes the registration and portal before
notifying the host. Legacy schema-driven `useTweaker` registration flow is retired.

## Required Commands

- `bun install`
- `bun run dev`
- `bun run website`
- `bun run --filter tweaker check`
- `bun run --filter tweaker test`
- `bun run --filter tweaker build`
- `bun run --filter website test:e2e`
- `bun run ready`

`bun run ready` is the full gate:

```bash
vp check && vp run -r test && vp run -r build && bun run --filter website test:e2e
```

## Port Allocation

This worktree is in the `tweaker` port registry range `6030-6039`.

- `6030`: website dev and Playwright harness server.
- `6031`: website preview server.
- `6032-6034`: available for additional local services.
- `6035`: this worktree override via `WEBSITE_PORT`.
- `6036-6039`: available for future local services.

Assign new local services only from the available slots in this range.

For this worktree:

```bash
WEBSITE_PORT=6035 bun run website
WEBSITE_PORT=6035 bun run --filter website test:e2e
```

## Documentation Surfaces

- `README.md`
- `packages/tweaker/README.md`
- `SKILL.md`
- `AGENTS.md`
- `llms.txt`

Update all five files together when command surface, entrypoints, or architecture changes.

## Package Boundaries

- `tweaker` exports remain package-owned and are used via `tweaker`, `tweaker/advanced`, and `tweaker/style.css`.
- Do not document `packages/panel` or `apps/demo` as active workspace products.

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
