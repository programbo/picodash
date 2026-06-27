# tweaker

Reusable React package for the Tweaker floating config panel.

```tsx
import { TweakerPanel, TweakerProvider, useTweaker } from "tweaker";
import "tweaker/style.css";
```

Preferred API:

- Wrap with `<TweakerProvider id="my-app">`.
- Render one or more panels with `<TweakerPanel id="scene" defaultPlacement="top-right" />`.
- Register controls with `useTweaker(schema, { panel, section, reorderable })`.
- Use `defaultValue` for schema defaults and optional control `id` for stable persistence.
- Register custom control components with `TweakerProvider controls={{ color: ColorControl }}` and reference them by `type`.
- Put panel visuals on `TweakerPanel.appearance`; use CSS variables for deeper theming.

Compatibility aliases still work for existing consumers: `storeId`, `placement`, `sortable`, hook-level panel effects, and `value`.

See the root README and `apps/website` demo for full usage.
