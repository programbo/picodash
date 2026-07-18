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

Tweaker is a pnpm workspace managed with Vite+. It contains reusable React packages plus local demo apps.

- `packages/tweaker`: the publishable `tweaker` React package.
- `packages/panel`: a Vite+ React component library consumed by `apps/demo`.
- `apps/website`: the demo/docs app and Playwright coverage for the package behavior.
- `apps/demo`: a Vite+ React TypeScript demo app with Tailwind CSS that imports `panel` via `workspace:*`.
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
pnpm --filter panel test
pnpm --filter panel build
pnpm --filter demo build
pnpm --filter demo test:e2e
pnpm --filter website test:e2e
pnpm ready
```

`pnpm ready` is the full verification gate. It runs formatting, linting, type checks, package tests, builds, website build, and Playwright e2e tests:

```bash
vp check && vp run -r test && vp run -r build && pnpm --filter website test:e2e && pnpm --filter demo test:e2e
```

Use `vp check --fix` for formatter/linter autofixes. Vite+ may cache some `vp run` tasks; treat successful replay as valid unless you changed test/build inputs that are not tracked by Vite+.

## Port Allocation

This repo is registered with the `ports` CLI as `tweaker` and owns the fixed local port range `6030-6039`.

Assign dev, preview, e2e, test, mock API, and other local servers only from `6030-6039`.

- `6030`: `apps/website` dev server and Playwright e2e web server.
- `6031`: `apps/website` preview server.
- `6032`: canonical `apps/demo` dev server; override it with `DEMO_PORT` for concurrent worktrees.
- `6033`: `apps/demo` preview server.
- `6034`: dedicated `DEMO_PORT=6034` override for the `feature/panel-api-dx` worktree; this does not replace the canonical `6032` default.
- `6035`: dedicated `DEMO_PORT=6035` override for this worktree; this does not replace the canonical `6032` default.
- `6036-6039`: available for future local servers.

When adding a new app or local server, use the next available port from `6036-6039` and update this section plus `README.md`.

## Package Boundaries

The `packages/panel` package is a small Vite+ React component library. Keep it
self-contained and consume it from `apps/demo` through `workspace:*`. `src/index.ts`
is the curated consumer entrypoint; `src/advanced.ts` contains low-level state/hooks,
ordering helpers, theme/storage constants, and normalization/projection helpers. Keep both
entries in the Vite+ pack configuration and package export map. Panel styles are authored
through Tailwind v4 in `packages/panel/src/styles.css`, packed with PostCSS, and consumed
from `panel/style.css`.

Panel inputs live in `packages/panel/src/inputs/`. Common primitives use the unified
`radix-ui` package, direct-manipulation visuals use Motion, and file selection uses
`react-dropzone`. Keep Recharts and the official shadcn chart source demo-local; they are
examples of composing `TweakerItem`, not dependencies of the publishable panel package.

Titled panel header actions live in `packages/panel/src/tweaker-panel-actions.tsx`;
JSON/YAML parsing, serialization, filenames, and validation live in the pure
`tweaker-panel-documents.ts` helper. Keep the action component internal. Bulk group and
field changes belong in the panel store and must use one Zustand transaction. Copy and
export include all currently registered field IDs, including hidden and display-only
fields. Import and reset operate only on currently registered writable fields, including
hidden fields. Imports validate the whole prospective document before mutation. Repairs
must be reviewed through the accessible panel-owned dialog; Accept revalidates and commits
once, while Abort leaves imported values and metadata unchanged. All actions exclude
drafts and stale unregistered values.

Panel theming is package-owned and namespaced. `TweakerProvider`, `TweakerPanel`, and
`FeaturePanel` accept arbitrary named themes; resolve them as panel override, provider
theme, then `"dark"`. The reserved `"system"` provider theme resolves to the current
dark/light preference. Keep the resolved name in React context and repeat
`data-tweaker-theme` on the provider carrier and every portaled panel, select, menu,
submenu, tooltip, dialog overlay/content, and viewer surface. Export `useTweakerTheme()` so
custom controls can propagate the same carrier.

The public visual recipe in `packages/panel/src/styles.css` is the core semantic color
contract (`--tweaker-color-canvas`, surface/raised/muted, text/strong/muted, border,
control, focus, accent/text, success, info, warning, alert, danger, and overlay) plus the
documented optional type/effect scales and shared geometry roles. Shared geometry is only
surface/control radii, `xs`/`sm`/`md`/`lg` control heights, the icon scale, and the large
field minimum height. Keep portal layers and panel width documented separately as host
integration values.

Derived hover, well, state, feature, viewer, slider, switch, and nesting formulas use
private `--_tweaker-*` variables. Do not add public component-family token aliases.
Components must consume theme roles through Tailwind classes (namespaced utilities or v4
CSS-variable shorthand), using canonical utilities for one-off geometry where possible;
never add bespoke component CSS rules or generic global `--color-*`/`--radius-*`
definitions. `theme.ts` remains limited to JS-only Motion, projection geometry, and the
numeric panel layer base.

The panel root exports `TweakerItem`, built-in input components, their public value/props
types, validation contracts, `createTweakerPanelStore`, and panel selector hooks. Pure
normalization/projection helpers are advanced exports. `TweakerItem.contentLayout` accepts
`"inline"`, `"block"`, or `"full"`; block/full descriptions must remain in a separate row
after their content. Do not restore `TweakerControl`, `TweakerField`, `fieldId`,
`placement`, or panel `defaultValues` compatibility APIs.

Composite control values must remain JSON-compatible. Dropzones store file metadata rather than `File` objects, media previews use safe image URLs rather than raw SVG HTML, and temporary object URLs must be revoked when removed or unmounted. Use MotionValues for high-frequency visuals and optional smoothing only; Zustand remains authoritative for persisted/user-editable values, and animated examples must respect reduced-motion.

Panel state may be application-owned through `createTweakerPanelStore({ panelId,
initialValues, initialMeta })` and injected with `<TweakerPanel store={store}>`.
Internal-store panels instead require `id` and may accept `initialValues`/`initialMeta`.
Use `useTweakerPanelStoreSelector(store, selector)` outside panels and the context selector
inside them. Programmatic `setFieldValue` and `setFieldValues` are strict and atomic;
interactive components use `setFieldInput`, which may retain an invalid non-persisted
draft and errors while preserving the canonical value.

Field-backed items may register synchronous `parse` and `validate` contracts.
Standard Schema-compatible validators are accepted directly. Promise-returning contracts
are configuration errors. Parsing and validation ownership belongs in the store contract,
not component effects. Built-in parsers must cover interactive input, programmatic writes,
initial/default/reset values, imports, and reactive constraints consistently. Reactive
repairs are proposed rather than silently written. Shared fields run all active contracts,
aggregate errors, and reject conflicting parser outputs.

The package source is intentionally split by responsibility:

- `packages/tweaker/src/types.ts`: public shared types and store contracts.
- `packages/tweaker/src/control.ts`: control normalization, labels, clamping, section defaults, and control IDs.
- `packages/tweaker/src/store/`: Zustand vanilla store creation and Zod-validated persistence.
- `packages/tweaker/src/react/`: React provider, context accessors, snapshots, and `useTweaker`.
- `packages/tweaker/src/panel/`: panel composition, docking math, ordering helpers, row DnD, sections, and control inputs.
- `packages/tweaker/src/styles.css`: Tailwind-authored package CSS exported as compiled plain CSS through `tweaker/style.css`.
- `packages/tweaker/src/index.ts`: public entrypoint. Keep public exports stable unless intentionally changing the API.

Avoid recreating monolithic `panel.tsx` or `store.tsx` files. Add new behavior to the module that owns the concept.

## Tweaker Public API

The package currently exports:

- Components: `TweakerProvider`, `TweakerPanel`
- Hooks: `useTweaker`, `useTweakerStore`, `useTweakerSnapshot`
- Store utilities: `createTweakerStore`, `normalizeControl`
- Types: `ControlConfig`, `TweakerSchema`, `TweakerValues`, `SetTweakerValue`, `NormalizedControl`, `TweakerState`, `TweakerStore`, `TweakerSnapshot`, `DockState`, `Placement`, `PanelAppearance`, `PanelTheme`, `SectionConfig`, `JsonValue`, `TweakerCustomControlProps`, `TweakerCustomControlComponent`, and individual control types including `DisplayControl`

Consumers import styles with:

```ts
import 'tweaker/style.css'
```

The package export path maps that to `dist/style.css`; do not document or depend on `dist/index.css`.
Tailwind is an internal authoring/build dependency only. Use `@reference "tailwindcss"` and `@apply` in package source when useful, but verify `vp pack` emits plain scoped CSS with no Tailwind directives, preflight, or utility layers for consumers.

## State And Persistence

State is provider-scoped. `TweakerProvider` creates one Zustand vanilla store per provider instance and exposes it through React context. One provider can host multiple named panels.

Persisted data is managed through Zustand `persist` middleware. Values read from `localStorage` must pass the Zod schemas in `packages/tweaker/src/store/persistence.ts` before entering the store. Keep Zod at this trust boundary; do not add broad runtime parsing inside normal render paths unless the data crosses a trust boundary.

Persisted state includes:

- control values
- panel-local, section-local order
- panel-local and section-local collapsed state
- panel-local dock state

Non-persisted state includes registered controls, custom control registry components, panel appearance props/fallbacks, and section order derived from live registrations.

Do not reintroduce automatic pruning of stale persisted values during React registration/unregistration. Stale values are harmless; accidental deletion from transient unmounts is worse. Cleanup should be explicit if it is ever added.

If localStorage shape changes, update:

- Zod schemas in `store/persistence.ts`
- store merge/partialize behavior in `store/create-tweaker-store.ts`
- unit tests in `packages/tweaker/tests/store.test.ts`
- README/API notes when relevant

## Control Registration

`useTweaker(schema, options)` registers a schema into the nearest provider.

- Default panel is `"default"`.
- Default section is `{ id: "controls", label: "Controls" }`.
- `options.panel` routes controls to a named `TweakerPanel`.
- `options.section` accepts a string label or `{ id, label }`; use object form when labels may change.
- `options.reorderable` defaults to `true`.
- `reorderable: false` disables row reordering for every control in that hook registration.
- Panel surface opacity and backdrop blur belong on `TweakerPanel.appearance`; deprecated hook-level effect options are compatibility-only.
- Section order is local to each panel and section; dragging must not move controls across sections or panels.
- Numeric values are clamped according to their normalized control bounds.
- Explicit `type: "number"` stays a number input even if `min` and `max` are present.
- Slider controls can set `formatOptions?: Intl.NumberFormatOptions`; slider output fraction digits are inferred from `step` unless explicit fraction digit options override them.
- Use schema `defaultValue` for defaults. Deprecated `value` remains compatibility-only.
- Use control-level `id` for stable persistence when schema keys may change.
- Schemas may be dynamic. Re-registration must update normalized metadata such as labels, bounds, options, `formatOptions`, `format`, `readOnly`, `hidden`, status, and help.
- When dynamic bounds or options narrow, persisted/current values must be sanitized: clamp numeric values and fall back invalid selects to a valid option.
- Use `type: "display"` for derived readouts. Display controls render from the latest `defaultValue`, ignore persisted values, and refuse `setValue` writes.
- Object control configs can set `readOnly: true` to render a faded, non-editable control while preserving its value.
- Object control configs can set `hidden: true` to hide a row while preserving its value and order slot.
- `SectionConfig.hidden` hides an entire section while preserving its controls' values and order; it is runtime metadata, not persisted state.
- Custom controls are registered on `TweakerProvider.controls` and referenced by `type`; their values must be JSON-serializable.
- `TweakerPanel` accepts `theme: "dark" | "light" | "system"` and defaults to `"dark"`. It also accepts `width?: number | string`, applied as `--tw-panel-width` while still clamping to the viewport. Portaled controls such as select popovers must use the same panel theme.
- Object control configs can set `status: "info" | "alert" | "error"` for blue, amber, or red row tinting with an outline and thicker left border.
- Object control configs can set `help: React.ReactNode` for row help tooltips. Keep tooltip styling owned by the panel; do not add deep tooltip styling props to schemas.
- Object control configs can set `description: React.ReactNode` for row footer content. It is runtime metadata, not persisted state, and schemas must re-register when dynamic description content changes.

When adding control kinds, update normalization, types, input rendering, tests, docs, and demo usage together.

## Drag And Drop

Control rows use dnd-kit and must keep the `RestrictToElement` modifier on sortable rows:

```ts
RestrictToElement.configure({ element: () => listRef.current })
```

Rows also support a pointer-drag fallback and keyboard ArrowUp/ArrowDown reordering on the grip. Preserve all three paths unless a change explicitly replaces them and updates tests.

Panel controls and groups expose an active drag grip only when the item is configured as
reorderable and has another visible, configured-reorderable sibling in the same parent and
pin band. Static top-level items omit the reorder slot; nested static items retain
the marker for row alignment. Both must reject reorder attempts.

The panel header is independently draggable for floating placement and magnetic docking. Keep row drag and panel drag event handling separate.

## Website App

`apps/website` is the demo/docs app and the end-to-end test surface. It imports `tweaker` via `workspace:*`, so package changes should be validated through the app as well as package unit tests.

Use Playwright tests in `apps/website/tests/tweaker.spec.ts` for user-visible behavior such as persistence, reset, docking, pointer reorder, keyboard reorder, multiple panels, custom controls, control help tooltips, and non-reorderable registrations.

When changing UI behavior, prefer verifying with Playwright or the in-app browser in addition to unit tests.

## Demo App

`apps/demo` is the Vite+ React TypeScript Tailwind app for the local `panel` component
package. It imports `panel` through `workspace:*`, defaults to `6032` for `vp dev` and
Playwright e2e, and uses `6033` for `vp preview`. Set `DEMO_PORT=6035` in this worktree;
do not replace the canonical default. Its application-owned Built-in Items panel is the
canonical gallery for every public package input. Keep those rows ordered from common to
specialized, label them by item type, identify component names and meaningful props in
`help`, and reserve `description` for optional-feature variants. The separate Custom
Items panel contains only demo-local `TweakerItem` compositions such as the Standard
Schema/Zod, shadcn/Recharts, pointer-velocity, and waveform/spectrum examples. Keep
representative browser coverage in `apps/demo/tests/built-in-items.spec.ts` and
`apps/demo/tests/custom-items.spec.ts`, and run it through
`DEMO_PORT=6035 pnpm --filter demo test:e2e` in this worktree.

## Documentation

Keep these files aligned:

- `README.md`: root usage and development overview.
- `packages/tweaker/README.md`: package-specific quick reference.
- `packages/panel/README.md`: panel package quick reference.
- `SKILL.md`: local skill/instruction artifact for this project.
- `AGENTS.md`: agent operating guide.

If an API, command, import path, architecture boundary, or verification step changes, update this file in the same change.

## Git And Generated Files

The package and website build outputs may exist locally under `dist/`. Do not edit generated files by hand. Let `vp pack`, `vp build`, or `pnpm ready` regenerate them.

Keep `apps/website/vercel.json` security headers aligned with app behavior. The current CSP allows inline styles because the demo and package use React style attributes for CSS custom properties; do not remove that exception without replacing the inline-style behavior.

Before broad edits, check `git status -sb` and preserve unrelated user changes. Keep commits and PR descriptions focused on the actual behavior or structure change.
