# Picodash — Codebase Review

**Date:** 2026-07-20
**Status updated:** 2026-07-21
**Scope:** Full read-only audit of `packages/panel`, `apps/website`, build/test/CI posture, and documentation surfaces.
**Method:** Parallel deep-dive exploration of source, tests, configs, and on-disk artifacts; spot-checked key findings against the actual files. No edits were made to source.

---

## 1. Executive Summary

The original audit found a strong package with several release-readiness gaps. The focused remediation merged in PR #33 and closed the material correctness, accessibility, release-safety, dependency-hygiene, public-state, streaming, and website-resilience findings.

The original severity labels are retained below as historical audit context, but they should not be read as the current project risk level. In particular, the persistence exception was the immediate runtime defect; CI and keyboard reordering were the largest readiness gaps.

The current status is intentionally split into:

- **Completed items:** implemented and verified by package tests, builds, Chromium E2E, `bun run ready`, dependency audit, CI, and an automated Codex review.
- **Deferred items:** intentionally left unchanged because they require a baseline or production-policy decision, were not demonstrated defects, or are opportunistic maintenance.

The detailed findings in §3 remain the original audit record. Their recommendations are superseded by the status ledger in §5.

---

## 2. Findings Index

| ID  | Sev | Category        | Title                                                                         | Location                                                                                                                                   |
| --- | --- | --------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| S1  | P0  | Stability       | `localStorage.setItem` not wrapped in try/catch                               | `packages/panel/src/panel-persistence.ts:56-59`                                                                                            |
| S2  | P0  | Stability       | No error boundary in website                                                  | `apps/website/src/main.tsx:12-15`                                                                                                          |
| S3  | P0  | DX / Tooling    | No CI, no Dependabot/CodeQL/Snyk/OSV, no audit                                | (repo-wide)                                                                                                                                |
| S4  | P0  | Maintainability | `tsconfig.json` missing `"strict": true`                                      | `apps/website/tsconfig.json:1-30`                                                                                                          |
| S5  | P0  | Maintainability | Catalog bypass for `@types/node` and `typescript`                             | `package.json:12-13`, `packages/panel/package.json:49,58`, `apps/website/package.json:37`                                                  |
| P1  | P1  | DX              | Bundle is 666 KB, no code-splitting                                           | `apps/website/dist/assets/index-CXY0zvQ-.js`                                                                                               |
| P2  | P1  | Maintainability | `@dnd-kit/*` declared but never imported                                      | `packages/panel/package.json:31-33`                                                                                                        |
| P3  | P1  | Stability       | Silent error swallowing in persistence read                                   | `packages/panel/src/panel-persistence.ts:37-48`                                                                                            |
| P4  | P1  | Stability       | Async sparkline errors silently dropped                                       | `packages/panel/src/inputs/sparkline.tsx:342, 349, 357`                                                                                    |
| P5  | P1  | Maintainability | No source maps from `vp pack`                                                 | `packages/panel/vite.config.ts:5-17`                                                                                                       |
| P6  | P1  | Maintainability | No coverage threshold / bundle-size budget / license check                    | `package.json:51`                                                                                                                          |
| P7  | P1  | Maintainability | Retired `packages/tweaker/` directory                                         | `packages/tweaker/`                                                                                                                        |
| P8  | P1  | UX / A11y       | No keyboard-accessible item reorder                                           | `packages/panel/src/picodash-control.tsx:349-361`                                                                                          |
| P9  | P1  | UX / A11y       | Chromium-only E2E; no axe audit, no visual regression                         | `apps/website/playwright.config.ts:19-24`                                                                                                  |
| P10 | P1  | Maintainability | Tailwind sort-function mismatch                                               | `vite.config.ts:11`, `packages/panel/vite.config.ts:28`                                                                                    |
| P11 | P1  | Security        | Missing HSTS header                                                           | `apps/website/vercel.json:2-23`                                                                                                            |
| P12 | P1  | Stability       | TOCTOU window in simple store setters                                         | `packages/panel/src/picodash-panel-store.ts:436-489, 501-535`                                                                              |
| P13 | P1  | Maintainability | Duplicated helpers (`decimalPlaces`, `finiteOr`, `clamp`)                     | see §3.5                                                                                                                                   |
| P14 | P1  | DX              | No skip link to main content                                                  | `apps/website/src/App.tsx`                                                                                                                 |
| L1  | P2  | DX              | Inline `parse`/`validate` foot-gun                                            | `packages/panel/src/picodash-panel-context.tsx:96-112`                                                                                     |
| L2  | P2  | DX              | No `"use client"` note for Next.js consumers                                  | `packages/panel/README.md`                                                                                                                 |
| L3  | P2  | Stability       | Unhandled `clipboard.writeText` rejections                                    | `apps/website/src/interactive-jsx-example.tsx:842`, `apps/website/src/usage-guide.tsx:481`                                                 |
| L4  | P2  | DX              | Meaningless `'use client'` in `scroll-area.tsx`                               | `apps/website/src/components/ui/scroll-area.tsx:1`                                                                                         |
| L5  | P2  | DX              | `.vscode/extensions.json` not provided                                        | `.vscode/`                                                                                                                                 |
| L6  | P2  | Maintainability | Vestigial `prettier` / `prettier-plugin-tailwindcss` deps                     | `package.json:35-36, 60-61`                                                                                                                |
| L7  | P2  | Security        | `dangerouslySetInnerHTML` x3 (safe today, implicit on hljs)                   | `apps/website/src/components/ui/chart.tsx:76`, `apps/website/src/usage-guide.tsx:514`, `apps/website/src/interactive-jsx-example.tsx:1678` |
| L8  | P2  | Maintainability | No migration strategy for `:v1` storage key                                   | `packages/panel/src/panel-persistence.ts:5`                                                                                                |
| L9  | P2  | Stability       | `replaceRegisteredFieldValues` bypasses validation                            | `packages/panel/src/picodash-panel-store.ts:498-500, 672-693`                                                                              |
| L10 | P2  | Maintainability | `tools/*` declared in workspace patterns but doesn't exist                    | `package.json:5-9`                                                                                                                         |
| L11 | P2  | Maintainability | Redundant Vercel rewrites                                                     | `apps/website/vercel.json:25-38`                                                                                                           |
| L12 | P2  | Maintainability | Pre-publish runs build only, not test/lint                                    | `packages/panel/package.json:27`                                                                                                           |
| L13 | P2  | Maintainability | Two large files (`interactive-jsx-example.tsx` 1820 lines, `App.tsx` 819)     | `apps/website/src/`                                                                                                                        |
| L14 | P2  | Maintainability | Heavy synchronous `JSON.stringify` on every store tick                        | `apps/website/src/App.tsx:257-264, 716-720`                                                                                                |
| L15 | P2  | DX              | `playwright.config.ts` references `process.env.CI` that's never set           | `apps/website/playwright.config.ts:16`                                                                                                     |
| L16 | P2  | Maintainability | Zod duplicated transitively (v3 + v4)                                         | `bun.lock`                                                                                                                                 |
| L17 | P2  | Security        | SVG accepted by `PicodashDropzone`                                            | `apps/website/src/built-in-items-panel.tsx:624`                                                                                            |
| L18 | P2  | UX              | Reduced-motion not globally applied to Tailwind transitions                   | `apps/website/src/style.css:10-25`                                                                                                         |
| L19 | P2  | Maintainability | Magic numbers in sparkline defaults                                           | `packages/panel/src/inputs/sparkline.tsx:66-67`                                                                                            |
| L20 | P2  | Maintainability | Unused destructured props in `chart.tsx` chartItemProps                       | `packages/panel/src/inputs/chart.tsx:323-342`                                                                                              |
| L21 | P2  | Maintainability | `feature-panel.tsx` has its own `joinClassNames` helper                       | `packages/panel/src/feature-panel.tsx:159-161`                                                                                             |
| L22 | P2  | Maintainability | `JSON.stringify` roundtrip for memoization keys                               | `packages/panel/src/inputs/select.tsx:37-39`, `packages/panel/src/inputs/segmented.tsx:37-38`                                              |
| L23 | P2  | Maintainability | `@standard-schema/spec`, `bumpp`, `@typescript/native-preview` bypass catalog | `packages/panel/package.json:33, 52-53`                                                                                                    |
| L24 | P2  | DX              | Many validation error messages are unhelpful to end users                     | `packages/panel/src/picodash-validation.ts:335-352, 381`                                                                                   |
| L25 | P2  | UX              | Sparkline exposes only `aria-label`                                           | `packages/panel/src/inputs/sparkline.tsx:417-421`                                                                                          |

---

## 3. Detailed Findings

### 3.1 Stability (P0/P1)

#### S1 — `localStorage.setItem` is not wrapped in try/catch _(P0)_

**Location:** `packages/panel/src/panel-persistence.ts:50-60`

```ts
setItem(name, value) {
  if (typeof window === 'undefined') return

  const parsed = picodashPersistedStateSchema.safeParse(value.state)
  if (!parsed.success) return

  window.localStorage.setItem(                      // ← not guarded
    name,
    JSON.stringify({ state: parsed.data, version: value.version }),
  )
}
```

**Impact:** The read path (`getItem`, lines 37-48) is wrapped in `try/catch` and silently returns `null` on failure; the write path is not. A `QuotaExceededError` (storage full, Safari/WebKit private browsing, browser storage disabled, cross-origin embedding) will propagate up through Zustand's `persist` middleware and likely crash the next render of any tree containing a `PicodashProvider` with `persistLayout`. The asymmetric guarding is suspicious and easy to miss.

**Recommendation:**

```ts
try {
  window.localStorage.setItem(name, JSON.stringify({ state: parsed.data, version: value.version }))
} catch {
  // Swallow QuotaExceededError / SecurityError so the panel tree keeps rendering.
  // Optionally forward to a consumer-provided onError hook for telemetry.
}
```

Consider surfacing the failure via an optional `onPersistError` callback on `PicodashProviderProps` so consumers can log it.

---

#### S2 — No error boundary in website _(P0)_

**Location:** `apps/website/src/main.tsx:12-15`

```tsx
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

**Impact:** A single thrown error during render — e.g. `chart.tsx:29` already throws `'useChart must be used within a <ChartContainer />'` on context misuse, and `recharts` itself throws on bad-shape data — unmounts the entire app to a blank screen with no recovery path. There is no `componentDidCatch` or `getDerivedStateFromError` anywhere in `apps/website/src`.

**Recommendation:** Add at least one top-level error boundary wrapping `<App />` (or each route) that renders a fallback UI with a "reload" action. Consider per-panel boundaries inside `PicodashProvider` so a single misbehaving panel doesn't kill the page.

---

#### P3 — Silent error swallowing in persistence read _(P1)_

**Location:** `packages/panel/src/panel-persistence.ts:37-48`

**Impact:** All read failures (parse errors, schema mismatches, IO errors) return `null` with no logging, telemetry, or diagnostic surface. If a user reports "my panel keeps snapping back to top-right," there is no way to discover that persisted state is being discarded. This is the inevitable counterpart to S1's write path, but it deserves its own remediation regardless.

**Recommendation:** Add an optional `onPersistError?: (error, context) => void` hook on `PicodashProviderProps`. Default behavior remains silent for backward compatibility, but consumers (and the demo site) can wire it to `console.warn` or telemetry.

---

#### P4 — Async sparkline errors silently dropped _(P1)_

**Location:** `packages/panel/src/inputs/sparkline.tsx:342, 349, 357`

```ts
void consume().catch(() => undefined)
```

**Impact:** When a user-supplied async iterable source throws, the error is dropped with no UI signal. The sparkline simply stops emitting. `PicodashSparklineProps` has no `onError` callback.

**Recommendation:** Add `onError?: (error: unknown) => void` to `PicodashSparklineProps`. Render a visible "source error" state on the canvas (or expose a `hasError` field via a ref/callback) so users don't see a frozen chart with no feedback.

---

#### P12 — TOCTOU window in simple store setters _(P1)_

**Location:** `packages/panel/src/picodash-panel-store.ts:436-489` (resetters), `:501-535` (`setFieldDefault`, `setFieldValue`, `setFieldValues`)

**Impact:** These actions read state via `getStoreState()`, compute results, and then call `set(...)` separately. Between read and commit, any synchronous code path that interleaves could see stale validation. `acceptRepairProposal` and `applyPicodashConstraintRepair` already re-validate **inside** the commit function to defend against drift — the simpler setters do not.

In practice, JS is single-threaded and React batches, so this is unlikely to bite typical callers. But any consumer that does:

```ts
await something()
store.getState().setFieldValue('x', value)
```

…could see drift if `x` was mutated between the `await` and the call.

**Recommendation:** Move the validation step inside the `set(current => ...)` callback for all writers, matching the pattern already used in `acceptRepairProposal`. Cheap, defensive, and removes a class of subtle bugs.

---

### 3.2 Security

#### P11 — Missing `Strict-Transport-Security` header _(P1)_

**Location:** `apps/website/vercel.json:2-23`

**Impact:** The deployed site has no explicit HSTS header. Vercel adds HSTS automatically on `*.vercel.app` subdomains and on custom domains when HTTPS enforcement is enabled at the project level, but relying on the platform default is fragile — a custom domain or environment change could regress to no HSTS, exposing users to SSL stripping on first visit.

**Recommendation:** Add `"Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload"` to the headers block. While you're there, consider adding `X-Frame-Options: DENY` as defense-in-depth for legacy clients that don't honor CSP `frame-ancestors`.

---

#### L7 — Three `dangerouslySetInnerHTML` call-sites in website _(P2)_

**Locations:**

- `apps/website/src/components/ui/chart.tsx:76` — inline `<style>` from local `ChartConfig` (theme-controlled).
- `apps/website/src/usage-guide.tsx:514` — `hljs.highlight(source, { language }).value` where `source` is a hard-coded string.
- `apps/website/src/interactive-jsx-example.tsx:1678` — `hljs.highlight` of `{component}\n${propType}` where both inputs are hard-coded strings from `builtInPropTypes`.

**Impact:** All three are safe today. `highlight.js` escapes `<`, `>`, `&`, `"`, `'` while emitting its own `<span>` wrappers, so user-controlled data cannot break out. The chart-style case uses only theme-controlled colors. **But the safety is implicit on library behavior rather than structural** — a future hljs regression or a careless refactor that passes live user input to `highlight()` would create an XSS path.

**Recommendation:** Add a code comment at each call-site documenting why it's safe (`// Safe: source is a hard-coded template string; hljs escapes all HTML metacharacters`). Consider a wrapper `<HighlightedCode source={...} language={...} />` component that centralizes the pattern and asserts the input is a string at runtime.

---

#### L17 — SVG accepted by `PicodashDropzone` _(P2)_

**Location:** `apps/website/src/built-in-items-panel.tsx:624`

**Impact:** The demo accepts `.svg` in its dropzone whitelist. SVG files can carry inline `<script>` blocks and `onload=` event handlers. `PicodashMediaPreview` renders them via `<img src="...">`, which **does not** execute scripts in any modern browser. The risk materializes only if a future change swaps `<img>` for `<object>`, `<iframe>`, `<div innerHTML>`, or `useSVG`.

**Recommendation:** Document the constraint in `PicodashMediaPreview` and `PicodashDropzone`: "SVG previews are safe only when rendered via `<img>`. Do not render user-supplied SVG inline." Consider whether SVG should be removed from the demo's default accept-list.

---

### 3.3 DX / Tooling

#### S3 — No CI, no security scanning, no audit _(P0)_

**Location:** repo-wide (no `.github/` directory exists)

**Impact:** All quality gating is delegated to local execution of `bun run ready` (`package.json:51`). None of the following are configured:

- GitHub Actions workflow
- Dependabot
- CodeQL
- Snyk
- OSV-Scanner
- `bun audit` / `npm audit` script
- SBOM generation
- Secret scanning

The `playwright.config.ts:16` references `process.env.CI` that is never set in the current state — suggesting CI was planned or previously existed but is not configured now. The `@picodash/panel` package is publishable to npm via `npm publish`, which runs only `prepublishOnly: vp run build`. No vulnerability scan, license check, or test runs before release.

**Recommendation:** Add `.github/workflows/ci.yml` running `bun install`, `vp check`, `vp run -r test`, `vp run -r build`, `bun run --filter website test:e2e`. Add `.github/dependabot.yml` for npm and Actions updates. Add a scheduled audit workflow (`bun audit --severity high`). Add a `prepublishOnly` chain that runs `vp check && vp test` before build.

---

#### P1 — 666 KB eager bundle, no code-splitting _(P1)_

**Location:** `apps/website/dist/assets/index-CXY0zvQ-.js`

**Impact:** The website ships a single 666 KB JS bundle (uncompressed) on first paint, including `recharts` (~400+ KB unminified) which is only used on `/state-lab`. There is no `React.lazy`, no dynamic `import()`, no `manualChunks` config. The initial blank `<div id="root">` shows nothing during download and parse — no skeleton, no `<noscript>` fallback, no preload hint.

**Recommendation:**

1. Code-split `/state-lab`-specific code (`PanelStatePanel`, chart components) via `React.lazy` + `Suspense`.
2. Code-split `highlight.js` languages (only load `typescript` + `bash` on demand, or replace with a smaller highlighter for the demo).
3. Add `<link rel="modulepreload">` for the main chunk in `index.html`.
4. Add a minimal skeleton or branded loading state in `index.html` so first paint isn't blank.

---

#### P2 — Three `@dnd-kit/*` packages declared but never imported _(P1)_

**Location:** `packages/panel/package.json:31-33`

```json
"@dnd-kit/abstract": "catalog:",
"@dnd-kit/dom": "catalog:",
"@dnd-kit/react": "catalog:",
```

**Impact:** Grep across `packages/panel/src/` returns zero imports for any `@dnd-kit/*` specifier. The actual drag-and-drop uses `motion/react`'s `Reorder` primitive plus a custom `usePointerReorderSession`. These three deps (plus transitive `@dnd-kit/utilities`, etc.) ship in every consumer's bundle for no benefit. Worse, `AGENTS.md` and `SKILL.md` imply `@dnd-kit` is in use — a real documentation-drift trap.

**Recommendation:** Remove the three declarations from `packages/panel/package.json`. Update any internal docs that imply `@dnd-kit` is the DnD primitive. If a migration to `@dnd-kit` is planned, track it in an issue and reference the issue from a TODO in `package.json`, not as a silent dep.

---

#### P5 — No source maps from `vp pack` _(P1)_

**Location:** `packages/panel/vite.config.ts:5-17`

**Impact:** The library's published `dist/` contains `index.mjs`, `index.d.mts`, and `style.css` — no `.map` files. Consumers debugging into `@picodash/panel` will see minified / bundled code with no source mapping. For a published library that other engineers will integrate and debug through, this is a meaningful DX regression.

**Recommendation:** Add `sourcemap: true` to the `pack` config:

```ts
pack: {
  entry: ['src/index.ts', 'src/advanced.ts'],
  sourcemap: true,
  // ...
}
```

---

#### P6 — No coverage threshold / bundle-size budget / license check _(P1)_

**Location:** `package.json:51`

**Impact:** The `ready` script chains format + lint + typecheck + tests + build + e2e — comprehensive on paper, but missing:

1. **No coverage threshold** — `vp test --coverage` is never invoked, no `test.coverage` block in any `vite.config.ts`. Coverage could silently regress.
2. **No bundle-size budget** — no `size-limit`, `bundlesize`, or `vite build --reportCompressedSize` check. Published `dist/index.mjs` could grow unbounded without notice.
3. **No license check** — no `license-checker` or equivalent. The catalog is MIT-heavy today but nothing prevents GPL/AGPL from sneaking in via transitive deps.

**Recommendation:** Add a `test.coverage` block to `packages/panel/vite.config.ts` with thresholds (lines/branches/functions ≥ 80% as a starting baseline). Add `size-limit` config or a `bundlesize` JSON. Add `license-checker --production --failOn "GPL;AGPL"` to a `check:licenses` script invoked from `ready`.

---

#### L1 — Inline `parse`/`validate` foot-gun _(P2)_

**Location:** `packages/panel/src/picodash-panel-context.tsx:96-112`

**Impact:** The `useRegisterPicodashItem` registration effect's dependency array lists every prop including `parse` and `validate`. Consumers who pass inline arrow functions for these (a natural pattern) will cause an unmount/mount cycle on every parent render, which in turn re-fires `registerItem` → `analyzePicodashFieldConstraint` → potentially raises a `repairProposal`. This is correctness-preserving but a real perf foot-gun for unwary users. It's documented only obliquely in `AGENTS.md` ("Preserve synchronous parser/validator behavior") and not in user-facing docs.

**Recommendation:** Document the constraint in `packages/panel/README.md`: "If you pass a custom `parse` or `validate`, memoize it with `useCallback` or hoist it to module scope." Consider a `usePicodashParser` / `usePicodashValidator` helper that auto-memoizes, or use `useEvent` / `useRef` to make the effect robust to inline functions.

---

#### L2 — No `"use client"` note for Next.js consumers _(P2)_

**Location:** `packages/panel/README.md`

**Impact:** No `.tsx` file in `src/` carries a `"use client"` directive — correct for Vite consumers, but Next.js App Router consumers will hit "use server" boundary errors when they import `PicodashProvider` into a server component. The package targets React 19 + Vite, so this is the consumer's responsibility, but it's worth a one-line note.

**Recommendation:** Add a "Framework integration" subsection to `packages/panel/README.md` noting that Next.js App Router users must place `"use client"` at the top of any module that imports from `@picodash/panel`.

---

#### L3 — Unhandled `clipboard.writeText` rejections _(P2)_

**Locations:** `apps/website/src/interactive-jsx-example.tsx:841-845`, `apps/website/src/usage-guide.tsx:480-484`

```ts
navigator.clipboard.writeText(...).then(() => setCopied(true))
// no .catch()
```

**Impact:** Clipboard permission can be denied (rare for a user-gesture click, but possible in some embedded contexts and during automation). The promise rejection becomes an unhandled rejection warning. The subsequent `setCopied(true)` would still run on success but the failure case is silent and confusing — the "copied" indicator never lights up with no explanation.

**Recommendation:** Add `.catch((error) => console.warn('Clipboard write failed:', error))` or surface an error toast.

---

#### L4 — Meaningless `'use client'` in `scroll-area.tsx` _(P2)_

**Location:** `apps/website/src/components/ui/scroll-area.tsx:1`

**Impact:** The file starts with `'use client'`, but no other shadcn primitive in `apps/website/src/components/ui/` does. The directive is meaningless in Vite (a Next.js marker). Dead weight and inconsistent.

**Recommendation:** Remove the directive, or normalize across all primitives if you intend to keep the door open to Next.js consumption of the website's UI kit.

---

#### L5 — `.vscode/extensions.json` not provided _(P2)_

**Location:** `.vscode/` (only `settings.json` exists)

**Impact:** `.gitignore:17-19` whitelists `.vscode/extensions.json` for tracking, but the file doesn't exist. New contributors get no extension recommendations. The only setting is `"editor.defaultFormatter": "oxc.oxc-vscode"`.

**Recommendation:** Add `.vscode/extensions.json`:

```json
{
  "recommendations": ["oxc.oxc-vscode", "bradlc.vscode-tailwindcss", "dbaeumer.vscode-eslint"]
}
```

---

#### L6 — Vestigial `prettier` / `prettier-plugin-tailwindcss` deps _(P2)_

**Location:** `package.json:35-36, 60-61`

**Impact:** Both are in the root catalog and root `devDependencies`, but the actual formatter is Oxfmt via `vp check` (`vite.config.ts:7-13`). Prettier is not invoked by any script. Appears to be leftover from before the Vite+ migration.

**Recommendation:** Remove both deps, or document that they're for editor integrations only (and consider whether that's worth the dependency cost).

---

#### L15 — `playwright.config.ts` references `process.env.CI` that's never set _(P2)_

**Location:** `apps/website/playwright.config.ts:16`

```ts
reuseExistingServer: !process.env.CI,
```

**Impact:** With no CI configured, this is dead code: the webServer is always reused if present. Not a bug, but a tell that CI was planned or previously existed. Combined with S3, this reinforces the CI gap.

**Recommendation:** Remedy is the same as S3 — add CI, and the line will become meaningful again.

---

#### L24 — Validation error messages are unhelpful to end users _(P2)_

**Location:** `packages/panel/src/picodash-validation.ts:335-352, 381`

```ts
'Parser returned an invalid result.'
'Validator returned an invalid result.'
'Value could not be parsed.'
```

**Impact:** These are fallback messages for developer-authored parsers/validators that return malformed shapes (e.g. a parser returning `{ output: 'string' }` instead of `{ output: { value: 'string' } }`). They're fine for devs but won't help end users debug custom validation. Mixed with the much better user-facing errors like `'quality must be draft, balanced, or final'` from the README example.

**Recommendation:** Split the messages into dev-mode (`console.warn`) and user-mode (rendered) tiers. Tag the dev-fallback messages with `[picodash]` prefixes so they're identifiable in support tickets.

---

### 3.4 UX / Accessibility

#### P8 — No keyboard-accessible item reorder _(P1)_

**Location:** `packages/panel/src/picodash-control.tsx:349-361`

**Impact:** The drag handle is a `<button>` with `aria-label="Reorder ${label}"` and `aria-disabled={!reorderable}`, but `onPointerDown={beginReorder}` is pointer-only. There is no keyboard-driven reorder (e.g. Space-to-pick-up, arrow-keys-to-move, Space-to-drop). Keyboard users cannot reorder items in any panel — a real ARIA authoring-practices gap for sortable lists.

**Recommendation:** Implement the standard WAI-ARIA sortable list pattern: `aria-roledescription="sortable"` on the handle, `Space`/`Enter` to pick up, `ArrowUp`/`ArrowDown` to move, `Escape` to cancel, `Space`/`Enter` to drop. The existing `moveItemToIndex` action provides the primitive; this is just wiring keyboard events to it. The custom `usePointerReorderSession` is pointer-specific, so you'll need a sibling `useKeyboardReorderSession` that reuses the band/order math.

---

#### P9 — Chromium-only E2E; no axe audit, no visual regression _(P1)_

**Location:** `apps/website/playwright.config.ts:19-24`

```ts
projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
```

**Impact:** Only one project. No Firefox, no WebKit (Safari), no mobile device emulation. For a public-facing website meant to showcase a published React library, this is a meaningful coverage gap — particularly for Safari, where `localStorage` quirks, `dvh`/`dvw` units, and `:focus-visible` rendering differ from Chromium. There's also no `@axe-playwright` scan in the suite (a11y is spot-checked ad-hoc via `aria-*` selectors) and no `toHaveScreenshot()` visual regression.

**Recommendation:**

1. Add at minimum a `webkit` project; ideally `firefox` and a mobile device (e.g. `devices['iPhone 15']`, `devices['Pixel 7']`).
2. Add `@axe-playwright` and inject `AxeBuilder.analyze()` after major route renders.
3. Consider visual regression for at least the gallery root and `/state-lab` root.

---

#### P14 — No skip link to main content _(P1)_

**Location:** `apps/website/src/App.tsx`

**Impact:** No skip-to-content link exists in any route. Keyboard users must tab through portaled panels and chrome to reach `<main>`. Standard a11y expectation for any non-trivial site.

**Recommendation:** Add `<a href="#main-content" className="sr-only focus:not-sr-only ...">Skip to main content</a>` as the first focusable element in `App`, and add `id="main-content"` to the existing `<main>`. Verify with a keyboard-only test.

---

#### L18 — Reduced-motion not globally applied to Tailwind transitions _(P2)_

**Location:** `apps/website/src/style.css:10-25`

**Impact:** Per-component `useReducedMotion()` calls exist (in `mouse-velocity-sparkline`, `waveform-spectrum`, `interactive-jsx-example`), but generic Tailwind transitions (hover colors, opacity changes, etc.) are not gated by `prefers-reduced-motion: reduce` globally. Tailwind v4 doesn't auto-disable transitions under reduced-motion. The transitions are short and non-essential, but a strict audit would flag this.

**Recommendation:** Add a base layer in `style.css`:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

#### L25 — Sparkline exposes only `aria-label` _(P2)_

**Location:** `packages/panel/src/inputs/sparkline.tsx:417-421`

**Impact:** The SVG has `role="img"` and `aria-label`, but no `aria-describedby` to communicate series names, current value, min/max, or units. For a streaming numeric chart used as the sole representation of a value, this is a thin description.

**Recommendation:** Accept an optional `accessibilityDescription?: (state) => string` prop, or accept an `aria-describedby` ID pointing at a consumer-rendered description. Document the recommended pattern in `packages/panel/README.md`.

---

### 3.5 Maintainability

#### S4 — `tsconfig.json` missing `"strict": true` _(P0)_

**Location:** `apps/website/tsconfig.json:1-30`

**Impact:** The website's `tsconfig.json` has neither `"strict": true` nor an `extends` of a strict base. The only linting flags set are `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `erasableSyntaxOnly`. **All of the following are off:** `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitThis`, `alwaysStrict`, `useUnknownInCatchVariables`, `exactOptionalPropertyTypes`. For a public-facing demo meant to model best practices for the `@picodash/panel` package, this is a notable omission. The root `tsconfig.json` is a minimal 9-line Node-next config and does not propagate strictness either. (The `@picodash/panel` package's own `tsconfig.json` does set `"strict": true` — so the gap is website-only.)

**Recommendation:** Add `"strict": true` to `apps/website/tsconfig.json`. Fix any resulting type errors. Consider extracting a shared `tsconfig.base.json` at the root for consistency.

---

#### S5 — Catalog bypass for `@types/node` and `typescript` _(P0)_

**Location:**

- `package.json:12-13` (catalog: `@types/node: ^24`, `typescript: ^5`)
- `packages/panel/package.json:49` (`@types/node: ^25.6.2`)
- `packages/panel/package.json:58` (`typescript: ^6.0.3`)
- `apps/website/package.json:37` (`typescript: ~6.0.2`)

**Impact:** The catalog exists to enforce version consistency across workspace packages. Two of the most consequential deps bypass it entirely and at different majors:

- `@types/node`: catalog says `^24`, picodash declares `^25.6.2`. Resolved types differ across packages; downstream type inference can disagree depending on which `node_modules` is consulted.
- `typescript`: catalog says `^5`, but both packages declare v6 directly. TypeScript 6.0.x is **not a stable release** at the time of audit — it appears to be tied to the `@typescript/native-preview` dev toolchain. The catalog entry is effectively dead.

This means contributors using different package managers (or `vp install` on different days) could see different type-check results. It also makes the catalog misleading — readers expect it to be the source of truth.

**Recommendation:** Replace the direct version declarations with `"typescript": "catalog:"` and `"@types/node": "catalog:"`, then update the catalog entries to the actually-desired versions (likely `typescript: ^6.0.2` and `@types/node: ^25.6.2`, given the direct declarations). If TypeScript 6 is intentional (for `tsgo`), document why in `AGENTS.md`.

---

#### P7 — Retired `packages/tweaker/` directory _(P1)_

**Location:** `packages/tweaker/`

```
packages/tweaker/
├── dist/          ← gitignored build artifacts
└── node_modules/  ← gitignored deps
```

**Impact:** Zero source files. `git ls-files packages/tweaker` returns empty — nothing is tracked. `AGENTS.md` explicitly says "Do not document `packages/tweaker` or `apps/demo` as active workspace products," confirming retirement. The directory exists only as on-disk cruft from a previous package layout. Not harmful but confusing for new contributors and tools that scan `packages/*`.

**Recommendation:** `rm -rf packages/tweaker`. Optionally add a note to `AGENTS.md` change log explaining the retirement.

---

#### P10 — Tailwind sort-function mismatch _(P1)_

**Location:**

- `vite.config.ts:11` — `sortTailwindcss.functions: ['clsx']`
- `packages/panel/vite.config.ts:28` — `sortTailwindcss.functions: ['joinClassNames']`

**Impact:** When `vp check --fix` runs across the workspace, it applies different class-sort heuristics depending on which config governs the file. Files edited while the picodash config is active will sort class names assuming `joinClassNames(...)`, while root-governed files sort assuming `clsx(...)`. The two helpers exist for the same purpose (`cn` in the website, `joinClassNames` in the package), and the formatter doesn't know to apply both.

**Recommendation:** Update both configs to `sortTailwindcss.functions: ['clsx', 'joinClassNames']` so the formatter recognizes both regardless of which file it's processing.

---

#### P13 — Duplicated helpers (`decimalPlaces`, `finiteOr`, `clamp`, `isUnknownRecord`) _(P1)_

**Locations:**

- `decimalPlaces`: `packages/panel/src/number-format.ts:38-46`, `packages/panel/src/inputs/slider.tsx:159-164`, `packages/panel/src/inputs/range.tsx:231-236` — three implementations, all slightly different in how they handle exponent notation.
- `finiteOr`: `gradient.tsx:495-497`, `xy-pad.tsx:407-409`, `range.tsx:222-224` (inlined), `vector3.tsx:215` (inlined).
- `clamp`: `panel-snapping.ts:237`, `gradient.tsx:503`, `xy-pad.tsx:403`.
- `isUnknownRecord`: `dropzone.tsx:550-552`, `gradient.tsx:499-501` (identical implementations).

**Impact:** Drift risk. The three `decimalPlaces` implementations already disagree on edge cases (scientific notation, very small numbers). When a bug is found in one copy, the others don't get fixed.

**Recommendation:** Consolidate all four into `packages/panel/src/utils.ts` (or a new `packages/panel/src/number-utils.ts`) and import from there. Add unit tests for the canonical implementations.

---

#### L8 — No migration strategy for `:v1` storage key _(P2)_

**Location:** `packages/panel/src/panel-persistence.ts:5`

```ts
export const panelLayoutStorageKey = 'picodash-panel:provider-layout:v1'
```

**Impact:** The storage key includes a literal `:v1` suffix and the envelope stores a `version` field, but no migration code consumes the version. On a schema-breaking change, the old `:v1` data would either be silently discarded (read returns `null`) or — on write — would throw if the storage is at quota (see S1). There is no documented upgrade path.

**Recommendation:** Add a `migrate(persistedState, version): State` function to the persist config. When bumping the storage key version, write a migration that transforms v1 to v2 and document the policy in `packages/panel/README.md`.

---

#### L9 — `replaceRegisteredFieldValues` bypasses validation _(P2)_

**Location:** `packages/panel/src/picodash-panel-store.ts:498-500, 672-693`

**Impact:** This action writes raw values without `resolvePicodashFieldValue`. It's safe today because the only caller is `applyPicodashPanelImport` (which pre-validates), but it's exposed via the public `PicodashPanelState` type and reachable via `@picodash/panel/advanced`. A future direct caller could corrupt state.

**Recommendation:** Either (a) add a `.__internal` prefix to the action name to signal its scope, (b) gate it behind a `source: 'import'` parameter that callers must acknowledge, or (c) document the precondition in a JSDoc and add a dev-mode assertion that the caller pre-validated.

---

#### L10 — `tools/*` declared in workspace patterns but doesn't exist _(P2)_

**Location:** `package.json:5-9`

```json
"workspaces": {
  "packages": ["apps/*", "packages/*", "tools/*"]
}
```

**Impact:** The `tools/*` pattern is dead config. `ls tools/` would fail. Bun will resolve an empty glob, so it's not a bug, but it's misleading.

**Recommendation:** Remove `tools/*` from the workspace patterns, or create `tools/.gitkeep` with a planned first tool if you intend to add tooling packages.

---

#### L11 — Redundant Vercel rewrites _(P2)_

**Location:** `apps/website/vercel.json:25-38`

```json
"rewrites": [
  { "source": "/gallery",    "destination": "/index.html" },
  { "source": "/state-lab",  "destination": "/index.html" },
  { "source": "/(.*)",       "destination": "/index.html" }
]
```

**Impact:** The first two rewrites are subsumed by the catch-all. Not a bug, but adds two extra rules without changing behavior.

**Recommendation:** Remove the explicit `/gallery` and `/state-lab` rewrites. The catch-all `/(.*)` handles them.

---

#### L12 — Pre-publish runs build only, not test/lint _(P2)_

**Location:** `packages/panel/package.json:27`

```json
"prepublishOnly": "vp run build"
```

**Recommendation:** Change to `"prepublishOnly": "vp check && vp run -r test && vp run build"` to prevent shipping a broken package.

---

#### L13 — Two large files in website _(P2)_

**Location:** `apps/website/src/interactive-jsx-example.tsx` (1820 lines), `apps/website/src/App.tsx` (819 lines).

**Impact:** Both are well-structured with small named sub-components, but `interactive-jsx-example.tsx` in particular mixes data-derivation helpers (`commonInputLinesForConfig`, `remainingGroupsForConfig`, `chartPropsForConfig`, `sourceForExample`) with presentational primitives. Cognitive load for maintainers.

**Recommendation:** Extract the code-generation helpers into `apps/website/src/lib/example-codegen.ts`. Consider splitting `App.tsx` into route-level files (`gallery.tsx`, `state-lab.tsx`, `not-found.tsx`).

---

#### L14 — Heavy synchronous `JSON.stringify` on every store tick _(P2)_

**Locations:**

- `apps/website/src/App.tsx:257-264` — builds `panelSnapshots` on every render of `DemoExperience`. Selectors `(state) => state` (`App.tsx:249-254`) return a new top-level reference whenever anything changes.
- `apps/website/src/App.tsx:716-720` — `JSON.stringify(value, null, 2)` into `<pre>` for every `StateSection`, not memoized.
- `apps/website/src/interactive-jsx-example.tsx:1178-1207` — `snapshotForDisplay` re-walks the entire `items` map on each store change.

**Impact:** For the demo this is fine; it would not scale to many panels. During drag interactions, `JSON.stringify` can run dozens of times per second.

**Recommendation:** Memoize the JSON.stringify calls. For `panelSnapshots`, debounce or only rebuild on idle. For `JsonView`, snapshot the store on a slower cadence (e.g. `requestIdleCallback`).

---

#### L16 — Zod duplicated transitively (v3 + v4) _(P2)_

**Location:** `bun.lock`

**Impact:** Catalog pins `zod: ^4.4.3` (resolves to `zod@4.4.3`). But `@modelcontextprotocol/sdk`, `shadcn`, and `zod-to-json-schema` pull in `zod@3.25.76` as a transitive. The two majors coexist in `node_modules`. Bundle size and bundle-analysis confusion result.

**Recommendation:** Mostly out of your control (transitive). Track upstream releases of `shadcn` and `zod-to-json-schema` for v4 support. In the meantime, add a `bun why zod` step to your audit workflow and document the duplication in `AGENTS.md`.

---

#### L19 — Magic numbers in sparkline defaults _(P2)_

**Location:** `packages/panel/src/inputs/sparkline.tsx:66-67, 96, 119, 625`

```ts
const sparklineWidth = 320
const sparklineHeight = 88
const maxPoints = 60
const height = 96
```

**Impact:** The SVG `viewBox` is locked to `0 0 320 88` but the visible height is configurable — non-obvious why these specific numbers were chosen.

**Recommendation:** Extract to named constants at the top of the file with comments. Consider exporting them via `@picodash/panel/advanced` so consumers can build matching layouts.

---

#### L20 — Unused destructured props in `chart.tsx` _(P2)_

**Location:** `packages/panel/src/inputs/chart.tsx:323-342`

**Impact:** A long list of `_areaChartProps`, `_barChartProps`, etc. prefixed with `_` to intentionally strip before forwarding. Visually noisy.

**Recommendation:** Use a single `omit` helper, or destructure into a `rest` object per chart type and pass `rest` through.

---

#### L21 — `feature-panel.tsx` has its own `joinClassNames` helper _(P2)_

**Location:** `packages/panel/src/feature-panel.tsx:159-161`

**Impact:** Inconsistent with the rest of the codebase, which uses `cn` from `utils.ts`. Two helpers doing the same thing.

**Recommendation:** Replace with `import { cn } from './utils.js'` and delete the local helper.

---

#### L22 — `JSON.stringify` roundtrip for memoization keys _(P2)_

**Locations:** `packages/panel/src/inputs/select.tsx:37-39`, `packages/panel/src/inputs/segmented.tsx:37-38`

```ts
const optionValuesKey = JSON.stringify(options.map((o) => o.value))
const optionValues = useMemo(() => options.map((o) => o.value), [optionValuesKey])
// ...
JSON.parse(optionValuesKey) as string[]
```

**Impact:** Wasteful serialization + an `as string[]` cast that bypasses runtime validation. The input is already a known-shape from the `options` prop.

**Recommendation:** Use `useShallow` from `zustand/react/shallow` (already in deps) or a dedicated `useDeepMemo` helper. At minimum, drop the `JSON.parse` and re-derive from `options` directly inside the memo.

---

#### L23 — `@standard-schema/spec`, `bumpp`, `@typescript/native-preview` bypass catalog _(P2)_

**Location:** `packages/panel/package.json:33, 52-53`

**Impact:** Three direct deps bypass the workspace catalog. `@standard-schema/spec: ^1.1.0` is a runtime contract (real dep), `bumpp: ^11.1.0` is a version-bump tool with no `release` script using it, and `@typescript/native-preview: 7.0.0-dev.20260509.2` is a calendar-pinned dev toolchain used by `pack.dts.tsgo: true`. The calendar pin will reproduce identically on any machine (pin is exact), but a fresh install months later may surface registry-rotation issues if the dev version is yanked.

**Recommendation:** Add all three to the root catalog for visibility. Document in `AGENTS.md` that `@typescript/native-preview` is intentionally calendar-pinned for `tsgo` and may need periodic updates.

---

### 3.6 Documentation Surfaces

#### Doc drift: AGENTS.md implies `@dnd-kit` is the DnD primitive _(P2 → resolved by P2 fix)_

**Location:** `AGENTS.md` (no explicit line, but the package.json deps listing implies it) + user prompt itself referenced "@dnd-kit".

**Impact:** The actual implementation uses `motion/react` Reorder and a custom pointer reorder session. Any agent or contributor reading the docs will reach for the wrong abstraction.

**Recommendation:** After removing the `@dnd-kit/*` deps (P2), add a "Drag and reorder" subsection to `packages/panel/README.md` describing the actual implementation (`motion/react` Reorder + custom pointer session, pointer-only today with keyboard reorder on the roadmap — see P8).

---

## 4. What's Working Well

These deserve explicit recognition so they're not regressed in future refactors.

### Source hygiene

- **Zero `any` types** in `packages/panel/src/`.
- **Zero `console.log` / `console.warn` / `console.error`** in production source.
- **Zero `TODO`, `FIXME`, `XXX`, `HACK`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, `eslint-disable*` directives** in either `src/` or `apps/website/src/`.
- **No `dangerouslySetInnerHTML`** in the `@picodash/panel` package.
- **No `eval`, `new Function`, no string-argument `setTimeout`** for code execution.
- **No `postMessage` handlers**, no `window.message` listeners — package has no cross-origin attack surface.

### Validation discipline

- **Atomic batch writes** in `writeFieldValues` (`packages/panel/src/picodash-panel-store.ts:752-772`): if any field fails, the entire batch is rejected. State references remain stable.
- **Async parser/validator rejection** (`packages/panel/src/picodash-validation.ts:102-103`): if a parser/validator returns a Promise, the result is `{ errors: [unsupportedAsyncError], success: false }`. Matches README/SKILL contract.
- **JSON compatibility enforced at the validation boundary** via `jsonCompatibilityError` with `WeakSet` cycle detection — rejects `Date`, `Map`, `Set`, class instances, `Symbol`, functions, non-finite numbers.
- **Standard Schema v1 protocol** correctly consumed via `validator['~standard'].validate(value)`.
- **Sync `parse`/`validate`** is enforced (Promise results are explicitly rejected with a clear error).
- **Multiple items bound to the same field** fan-out all contracts and must all pass.

### Accessibility strengths

- **Roving tabindex** in `PicodashMatrix2D` with arrow-key navigation (`packages/panel/src/inputs/matrix-2d.tsx:151-171, 257-283`). Supports both `radio` and `toggle` roles.
- **Two visually-hidden `<input type="range">`** sliders in `PicodashXYPad` (`packages/panel/src/inputs/xy-pad.tsx:271-306`) for keyboard users, with `aria-controls` pointing at the pad.
- **`<button role="switch" aria-checked>`** in `ui.tsx:197-216`.
- **Radix dialogs** with focus trapping and `onCloseAutoFocus` to restore focus to triggers.
- **Live regions** `role="status" aria-live="polite"` for action announcements and dropzone rejection messages.
- **`role="alert"`** for inline field errors (`packages/panel/src/picodash-control.tsx:425`).
- **Excellent keyboard support** in `PicodashGradient` slider handles (arrow keys = 1%, shift+arrow = 10%, `Home`/`End` = edges, `Delete`/`Backspace` = remove stop).
- **`useReducedMotion()`** consulted in 5 components; CSS `motion-reduce:` on collapsible disclosures.

### Persistence strengths

- **SSR guards** on all storage operations (`typeof window === 'undefined'` early returns).
- **Double Zod validation** of localStorage reads (envelope + payload).
- **JSON.parse wrapped in try/catch** on the read path.
- **Only non-sensitive state persisted** (panel positions/docks — no field values, no meta, no PII).

### Resource cleanup

- All `window.addEventListener` with `capture: true` cleaned up via returned destructors.
- `ResizeObserver.disconnect()` called in `use-panel-layout.ts`, `picodash-reorder-list.tsx`, `xy-pad.tsx`.
- `IntersectionObserver` cleaned up in `sparkline.tsx`.
- `URL.revokeObjectURL` called for all synthesized blob URLs (in `picodash-panel-actions.tsx` and `dropzone.tsx`).
- `matchMedia` listener cleaned up in `picodash-provider.tsx:299-301`.

### Security posture (website)

- **CSP** is strong: `default-src 'self'`, `script-src 'self'` (no `unsafe-inline` or `unsafe-eval`), `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, `form-action 'self'`, `upgrade-insecure-requests`.
- **X-Content-Type-Options: nosniff**.
- **Referrer-Policy: strict-origin-when-cross-origin**.
- **Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()**.
- **No `_blank` links, no `window.opener`, no external scripts, no hardcoded secrets, no direct `localStorage` access** in the website.

### Test coverage (positive)

- **Strict-write discipline** is thoroughly unit-tested (`packages/panel/tests/validation.test.ts:89-115, 150-173`): rejected writes don't notify subscribers and leave `state.values` referentially stable.
- **Malformed parser result handling** is table-driven (`packages/panel/tests/validation.test.ts:592-639`).
- **Reorder geometry** is heavily exercised with pointer offsets, leading-edge crossing, tall-item handling, multi-row reversals, elastic overshoot (`packages/panel/tests/index.test.tsx:655-829`).
- **CSS theme contract** enforced declaratively (`packages/panel/tests/theme-contract.test.ts:37-66`): verifies every `--(?:_)?picodash-*` token is declared, referenced, has no public-component-family prefix, and appears in `README.md`.
- **E2E** is exceptionally thorough for Chromium: routing, interactive JSX editors, drag-reorder with explicit threshold itineraries and direction reversals, import/export with JSON+YAML, repair-review flow, theme switching, accessibility assertions on portaled surfaces, pointer-velocity sparkline visibility resume behavior, and pixel-level geometry assertions.

### Architectural strengths

- **Workspace catalog exists** and is used for the majority of deps — the bypass cases are the exception, not the rule.
- **Engine pinning** (`engines: { bun: ">=1.3.14", node: ">=22.12.0" }`) and `packageManager: "bun@1.3.14"`.
- **`overrides.vite: "catalog:"` and `overrides.vitest: "catalog:"`** — strong dedupe of the Vite family.
- **Website aliases `@picodash/panel` to its source** (`apps/website/vite.config.ts:11-19`) — eliminates a class of publish-order bugs.
- **`dedupe: ['react', 'react-dom']`** in the website config — prevents the classic twin-React bug.
- **Provider uses `useMemo`** on context values to minimize re-renders.
- **`useShallow`** correctly used for object/array selectors throughout.

---

## 5. Remediation Status

### Completed

These items were implemented in the focused remediation and merged in PR #33.

| Findings | Completed change                                                                                                                                                                                               |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1       | Persistence writes and removals now catch quota and security exceptions. Malformed reads remain silent by design.                                                                                              |
| S2       | The website root now has a visible recovery error boundary.                                                                                                                                                    |
| S3, L15  | The focused release-gate scope is complete: GitHub CI runs a frozen install, high-severity audit, Chromium setup, and the full `bun run ready` gate. Weekly Dependabot updates are configured.                 |
| S4       | Website TypeScript strict mode is enabled.                                                                                                                                                                     |
| S5       | TypeScript and Node types are catalog-owned at the versions already resolved by the workspace.                                                                                                                 |
| P2       | Unused `@dnd-kit/*` dependencies were removed. Documentation reflects the actual Motion-based reorder implementation.                                                                                          |
| P4       | `PicodashSparkline` exposes `onSourceError(error: unknown)` and safely handles rejection, cancellation, source replacement, callback replacement, and synchronous source-factory failures.                     |
| P5       | Published library bundles include source maps.                                                                                                                                                                 |
| P8       | Root and nested lists support keyboard reordering with Space/Enter, arrow keys, Escape cancellation, pinned-band constraints, movement boundaries, live announcements, and pointer/keyboard session exclusion. |
| P14      | Every route exposes a visible-on-focus skip link targeting its main content.                                                                                                                                   |
| L1       | Public documentation requires stable `parse` and `validate` callback identities.                                                                                                                               |
| L2       | Package and website guidance documents the Next.js client-component boundary.                                                                                                                                  |
| L3       | Clipboard failures produce visible feedback instead of an unhandled rejection.                                                                                                                                 |
| L6       | Unused Prettier dependencies were removed.                                                                                                                                                                     |
| L9       | `replaceRegisteredFieldValues` validates the full replacement atomically before mutation or notification.                                                                                                      |
| L10      | The empty `tools/*` workspace pattern was removed.                                                                                                                                                             |
| L12      | `prepublishOnly` runs package checks, tests, and build.                                                                                                                                                        |
| —        | The website gained regression coverage for its skip link and clipboard fallback. Persistence, replacement imports, sparkline streaming, and keyboard reorder received focused unit/E2E coverage.               |

### Deferred

These items are intentionally not part of the completed remediation. They should remain deferred until the stated prerequisite or a concrete failure justifies the work.

| Findings | Deferred decision                                                                                                                                               |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1       | Do not code-split `/state-lab` blindly. Charts and syntax highlighting are also used by the gallery; profile real route usage before restructuring bundles.     |
| P3       | Keep malformed persistence reads silent and do not add a new provider callback API solely for this review.                                                      |
| S3       | Dedicated CodeQL, Snyk, OSV, SBOM, and license-scanning services were not added. Reassess them against the current CI/audit baseline and repository policy.     |
| P6       | Do not impose arbitrary 80% coverage, bundle-size, or license thresholds before establishing baselines.                                                         |
| P7       | Treat `packages/tweaker/` as untracked local debris in the main checkout, not as a repository remediation.                                                      |
| P9       | Additional browser, axe, and visual-regression coverage remains optional follow-up work after the existing Chromium baseline is stable.                         |
| P10      | Keep subtree-specific Tailwind sort functions unless an actual formatting conflict demonstrates a need to combine them.                                         |
| P11      | Do not add HSTS preload or `includeSubDomains` until the production custom-domain policy is confirmed.                                                          |
| P12      | No setter TOCTOU change is planned. Zustand reads, validation, and writes are synchronous here; the audit's `await` example does not create the alleged window. |
| P13, L21 | Do not consolidate unrelated small helpers solely for this review. Refactor them when nearby code already needs maintenance.                                    |
| L4, L5   | Editor and framework-marker cleanup is optional and unrelated to release correctness.                                                                           |
| L7       | The current `dangerouslySetInnerHTML` sites are safe with their hard-coded/highlighter-controlled inputs. Revisit only if their trust boundary changes.         |
| L8       | Define storage migrations when a v2 schema is designed; no speculative migration is needed for the current v1 payload.                                          |
| L11      | Redundant Vercel rewrites are harmless and can be simplified opportunistically.                                                                                 |
| L13      | Large-file decomposition should follow an ownership or maintenance need, not line count alone.                                                                  |
| L14, L22 | JSON serialization and memo-key cleanup should be driven by measured runtime cost.                                                                              |
| L16      | Transitive Zod v3/v4 duplication is upstream-controlled; revisit as dependencies gain v4 support.                                                               |
| L17      | SVG-through-`img` is safe under the current rendering path. Reassess if user SVG is ever rendered inline or through an active document surface.                 |
| L18      | Do not add a global reduced-motion override that changes all transitions solely for this audit.                                                                 |
| L19, L20 | Sparkline constants and chart prop stripping are low-risk implementation details for opportunistic cleanup.                                                     |
| L23      | Catalog ownership was limited to TypeScript and Node types. Other intentionally pinned or package-specific tools remain unchanged.                              |
| L24      | Validation-message improvements remain product-copy work rather than a correctness fix.                                                                         |
| L25      | Richer sparkline descriptions remain an optional API enhancement; the current SVG retains its accessible name.                                                  |

---

## 6. Summary

The focused remediation closed the release-blocking runtime and readiness gaps identified by this audit. The workspace now has guarded persistence, strict website typing, catalog alignment, CI and dependency updates, stronger publish gates, source maps, keyboard reordering, public-state validation, streaming error delivery, route-level recovery, skip navigation, and visible clipboard failure handling.

The remaining findings are deferred deliberately. None should be promoted back into the release-critical plan without new evidence, an established baseline, or the production-policy decision identified in §5.

---

_The original audit was conducted read-only. This status update records the remediation merged in PR #33 and the decisions intentionally deferred._
