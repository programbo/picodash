# Shared UI: implemented surface

`@picodash/ui` supplies shared theme and density providers, semantic tokens, overlays, header composition,
actions, menus, dialogs, tooltips and generic presentation primitives. It does not own canonical application values or Panel placement.
Import `/style.css` when using UI directly. Higher product styles import their shared foundation.

Use [the generated inventory](api/ui.md) for every exported component, hook and prop type.
Semantic `--picodash-*` tokens supply colors, spacing, typography, geometry and motion.
Overlay defaults carry portal, stacking, focus and theme behavior. Theme context supports light, dark, system and application recipes.

`useScrollFade` measures overflow and writes private mask-depth variables. Missing measurements leave content visible.
Overflow cues use scroll-position CSS timelines; timed choreography uses Motion. Forced colors removes content masks.
Keep each observer's cleanup attached to the element lifetime.

Source: [`src`](../../packages/ui/src), [`style.css`](../../packages/ui/style.css), [`scroll-fade.css`](../../packages/ui/scroll-fade.css).
Third-party attribution remains in [`THIRD_PARTY_NOTICES.md`](../../packages/ui/THIRD_PARTY_NOTICES.md).
