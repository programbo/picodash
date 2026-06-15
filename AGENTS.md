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

Keep this file current whenever the repo structure, scripts, architecture, package API, or verification flow changes. Future agents should be able to start here and avoid rediscovering project conventions from scratch.

## What This Repo Is

Tweaker is a pnpm workspace managed with Vite+. It contains a reusable React package plus a local demo/docs app.

- `packages/tweaker`: the publishable `tweaker` React package.
- `apps/website`: the demo/docs app and Playwright coverage for the package behavior.
- `pnpm-workspace.yaml`: workspace package globs and dependency catalog.
- `vite.config.ts`: root Vite+ formatting, linting, staged checks, and cached task config.
- `apps/website/vercel.json`: production security headers for static Vercel deployments.

Use pnpm workspace commands and Vite+ commands. Do not replace the toolchain with plain Vite, npm, yarn, or ad hoc scripts.

## Required Commands

Run the narrowest useful checks while working, then run the full gate before handing off meaningful changes.

```bash
pnpm install
pnpm dev
pnpm --filter tweaker check
pnpm --filter tweaker test
pnpm --filter tweaker build
pnpm --filter website test:e2e
pnpm ready
```

`pnpm ready` is the full verification gate. It runs formatting, linting, type checks, package tests, builds, website build, and Playwright e2e tests:

```bash
vp check && vp run -r test && vp run -r build && pnpm --filter website test:e2e
```

Use `vp check --fix` for formatter/linter autofixes. Vite+ may cache some `vp run` tasks; treat successful replay as valid unless you changed test/build inputs that are not tracked by Vite+.

## Package Boundaries

The package source is intentionally split by responsibility:

- `packages/tweaker/src/types.ts`: public shared types and store contracts.
- `packages/tweaker/src/control.ts`: control normalization, labels, clamping, section defaults, and control IDs.
- `packages/tweaker/src/store/`: Zustand vanilla store creation and Zod-validated persistence.
- `packages/tweaker/src/react/`: React provider, context accessors, snapshots, and `useTweaker`.
- `packages/tweaker/src/panel/`: panel composition, docking math, ordering helpers, row DnD, sections, and control inputs.
- `packages/tweaker/src/styles.css`: package CSS exported as `tweaker/style.css`.
- `packages/tweaker/src/index.ts`: public entrypoint. Keep public exports stable unless intentionally changing the API.

Avoid recreating monolithic `panel.tsx` or `store.tsx` files. Add new behavior to the module that owns the concept.

## Public API

The package currently exports:

- Components: `TweakerProvider`, `TweakerPanel`
- Hooks: `useTweaker`, `useTweakerStore`, `useTweakerSnapshot`
- Store utilities: `createTweakerStore`, `normalizeControl`
- Types: `ControlConfig`, `TweakerSchema`, `TweakerValues`, `SetTweakerValue`, `NormalizedControl`, `TweakerState`, `TweakerStore`, `TweakerSnapshot`, `DockState`, `Placement`, `StaleMode`, and individual control types

Consumers import styles with:

```ts
import "tweaker/style.css";
```

The package export path maps that to `dist/style.css`; do not document or depend on `dist/index.css`.

## State And Persistence

State is provider-scoped. `TweakerProvider` creates one Zustand vanilla store per provider instance and exposes it through React context.

Persisted data is managed through Zustand `persist` middleware. Values read from `localStorage` must pass the Zod schemas in `packages/tweaker/src/store/persistence.ts` before entering the store. Keep Zod at this trust boundary; do not add broad runtime parsing inside normal render paths unless the data crosses a trust boundary.

Persisted state includes:

- control values
- section-local order
- panel collapsed state
- panel dock state

Non-persisted state includes registered controls and section order derived from live registrations.

If localStorage shape changes, update:

- Zod schemas in `store/persistence.ts`
- store merge/partialize behavior in `store/create-tweaker-store.ts`
- unit tests in `packages/tweaker/tests/store.test.ts`
- README/API notes when relevant

## Control Registration

`useTweaker(schema, options)` registers a schema into the nearest provider.

- Default section is `Controls`.
- `options.section` controls the section label.
- `options.sortable` defaults to `true`.
- `sortable: false` disables row reordering for every control in that hook registration.
- Section order is local to each section; dragging must not move controls across sections.
- Numeric values are clamped according to their normalized control bounds.
- Explicit `type: "number"` stays a number input even if `min` and `max` are present.

When adding control kinds, update normalization, types, input rendering, tests, docs, and demo usage together.

## Drag And Drop

Control rows use dnd-kit and must keep the `RestrictToElement` modifier on sortable rows:

```ts
RestrictToElement.configure({ element: () => listRef.current });
```

Rows also support a pointer-drag fallback and keyboard ArrowUp/ArrowDown reordering on the grip. Preserve all three paths unless a change explicitly replaces them and updates tests.

The panel header is independently draggable for floating placement and magnetic docking. Keep row drag and panel drag event handling separate.

## Website App

`apps/website` is the demo/docs app and the end-to-end test surface. It imports `tweaker` via `workspace:*`, so package changes should be validated through the app as well as package unit tests.

Use Playwright tests in `apps/website/tests/tweaker.spec.ts` for user-visible behavior such as persistence, reset, docking, pointer reorder, keyboard reorder, and non-sortable registrations.

When changing UI behavior, prefer verifying with Playwright or the in-app browser in addition to unit tests.

## Documentation

Keep these files aligned:

- `README.md`: root usage and development overview.
- `packages/tweaker/README.md`: package-specific quick reference.
- `SKILL.md`: local skill/instruction artifact for this project.
- `AGENTS.md`: agent operating guide.

If an API, command, import path, architecture boundary, or verification step changes, update this file in the same change.

## Git And Generated Files

The package and website build outputs may exist locally under `dist/`. Do not edit generated files by hand. Let `vp pack`, `vp build`, or `pnpm ready` regenerate them.

Keep `apps/website/vercel.json` security headers aligned with app behavior. The current CSP allows inline styles because the demo and package use React style attributes for CSS custom properties; do not remove that exception without replacing the inline-style behavior.

Before broad edits, check `git status -sb` and preserve unrelated user changes. Keep commits and PR descriptions focused on the actual behavior or structure change.
