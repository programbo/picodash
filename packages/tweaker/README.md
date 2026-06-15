# tweaker

Reusable React package for the Tweaker floating config panel.

```tsx
import { TweakerPanel, TweakerProvider, useTweaker } from "tweaker";
import "tweaker/style.css";
```

Hook options support `section`, `sortable`, `opacity`, `hoverOpacity`, `backgroundBlur`, `hoverBackgroundBlur`, and `tooltipForeground`.
Object-shaped controls support `tooltip` for a React Aria tooltip icon beside the label.
`TweakerPanel` accepts `theme: "dark" | "light" | "system"` and defaults to `"dark"`.
Object controls support `status: "info" | "alert" | "error"` for blue, amber, or red row treatment.
See the root README and `apps/website` demo for full usage.
