# tweaker

Reusable React package for the Tweaker floating config panel.

```tsx
import { TweakerPanel, TweakerProvider, useTweaker } from 'tweaker'
import 'tweaker/style.css'
```

Preferred API:

- Wrap with `<TweakerProvider id="my-app">`.
- Render one or more panels with `<TweakerPanel id="scene" defaultPlacement="top-right" />`.
- Register controls with `useTweaker(schema, { panel, section, reorderable })`.
- Use `defaultValue` for schema defaults and optional control `id` for stable persistence.
- Register custom control components with `TweakerProvider controls={{ color: ColorControl }}` and reference them by `type`.
- Put panel opacity and backdrop blur on `TweakerPanel.appearance`; use CSS variables for deeper theming.
- Use `theme="dark"`, `theme="light"`, or `theme="system"` on `TweakerPanel` for color theme.
- Use `width={360}` or another CSS length string on `TweakerPanel` to set `--tw-panel-width`.
- Section collapse state is persisted per panel and section.
- Use `status: "info" | "alert" | "error"` on object controls for blue, amber, or red row treatment.
- Use `help: "..."` on object controls for string-only row tooltip copy that inherits panel styling.
- Use `description: React.ReactNode` on object controls for dynamic footer content below the row.
- Use `readOnly: true` to show a value without allowing writes.
- Use `hidden: true` on controls or sections to hide rows while preserving values and order.
- Use `type: "display"` for derived non-interactive values that update on re-registration.
- Use `formatOptions` on number, slider, and display controls for Intl number formatting.

Compatibility aliases still work for existing consumers: `storeId`, `placement`, `sortable`, hook-level panel effects, and `value`.

See the root README and `apps/website` demo for full usage.
