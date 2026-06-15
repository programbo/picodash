# tweaker

Reusable React package for the Tweaker floating config panel.

```tsx
import { TweakerPanel, TweakerProvider, useTweaker } from "tweaker";
import "tweaker/style.css";
```

Hook options support `section`, `sortable`, `opacity`, `hoverOpacity`, `backgroundBlur`, and `hoverBackgroundBlur`.
`TweakerPanel` accepts `theme: "dark" | "light" | "system"` and defaults to `"dark"`.
See the root README and `apps/website` demo for full usage.
