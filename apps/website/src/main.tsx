import { StrictMode, type CSSProperties, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { TweakerPanel, TweakerProvider, useTweaker, type TweakerSchema } from "tweaker";
import "tweaker/style.css";
import "./style.css";

const renderingSchema = {
  speed: {
    value: 0.72,
    min: 0,
    max: 2,
    step: 0.01,
    label: "Speed",
    tooltip: (
      <>
        <strong>Animation speed</strong>
        <span>Higher values shorten the preview loop duration.</span>
      </>
    ),
  },
  exposure: {
    type: "number",
    value: 1,
    min: 0,
    max: 4,
    step: 0.1,
    tooltip: "Numeric controls can keep a compact helper beside the label.",
  },
  bloom: { type: "checkbox", value: true, label: "Bloom" },
} satisfies TweakerSchema;

const materialSchema = {
  shape: {
    type: "select",
    value: "orb",
    options: { Orb: "orb", Prism: "prism", Plate: "plate" },
  },
  tint: {
    type: "select",
    value: "green",
    options: ["green", "amber", "blue"],
    label: "Tint",
  },
  roughness: { type: "slider", value: 0.34, min: 0, max: 1, step: 0.01 },
} satisfies TweakerSchema;

const buildSchema = {
  channel: {
    type: "select",
    value: "stable",
    options: ["stable", "canary"],
    label: "Channel",
  },
  telemetry: { value: true, label: "Telemetry" },
} satisfies TweakerSchema;

function Demo() {
  const [dimmed, setDimmed] = useState(true);
  const [rendering, setRendering] = useTweaker(renderingSchema, {
    section: "Rendering",
    tooltipForeground: "#d5f4ff",
  });
  const [material] = useTweaker(materialSchema, { section: "Material" });
  const [build] = useTweaker(buildSchema, {
    section: "Build",
    sortable: false,
    opacity: dimmed ? 0.55 : 1,
    hoverOpacity: dimmed ? 0.95 : 1,
    backgroundBlur: dimmed ? 0 : 8,
    hoverBackgroundBlur: 8,
  });

  const previewStyle = useMemo<CSSProperties>(
    () =>
      ({
        "--demo-speed": `${rendering.speed}s`,
        "--demo-exposure": String(rendering.exposure),
        "--demo-roughness": String(material.roughness),
        "--demo-tint": `var(--tint-${material.tint})`,
      }) as CSSProperties,
    [material.roughness, material.tint, rendering.exposure, rendering.speed],
  );

  return (
    <>
      <TweakerPanel placement="top-right" title="Tweaker" />
      <main className="site-shell">
        <section className="hero">
          <div className="hero__copy">
            <p className="eyebrow">React config panel</p>
            <h1>Tweaker</h1>
            <p>
              A compact Leva-inspired floating panel with typed controls, persisted values,
              section-local reordering, and magnetic docking.
            </p>
          </div>

          <div className="preview" style={previewStyle}>
            <div
              className={`preview__object preview__object--${material.shape} ${rendering.bloom ? "has-bloom" : ""}`}
            />
            <div className="preview__readout">
              <span>Speed {Number(rendering.speed).toFixed(2)}</span>
              <span>Exposure {Number(rendering.exposure).toFixed(1)}</span>
              <span>Roughness {Number(material.roughness).toFixed(2)}</span>
              <span>Channel {build.channel}</span>
            </div>
          </div>
        </section>

        <section className="docs-grid" aria-label="Usage examples">
          <article>
            <h2>Install</h2>
            <pre>
              <code>{`pnpm add tweaker
import "tweaker/style.css";`}</code>
            </pre>
          </article>

          <article>
            <h2>Use</h2>
            <pre>
              <code>{`const [values, setValue] = useTweaker({
  speed: {
    value: 0.72,
    min: 0,
    max: 2,
    tooltip: <>Higher values shorten the loop.</>,
  },
  bloom: { value: true },
}, { section: "Rendering" });`}</code>
            </pre>
          </article>

          <article>
            <h2>Programmatic update</h2>
            <button
              className="demo-button"
              type="button"
              onClick={() => setRendering("speed", 1.25)}
            >
              Set speed to 1.25
            </button>
          </article>

          <article>
            <h2>Runtime panel effects</h2>
            <pre>
              <code>{`const [dimmed, setDimmed] = useState(true);

useTweaker(schema, {
  section: "Build",
  opacity: dimmed ? 0.55 : 1,
  hoverOpacity: dimmed ? 0.95 : 1,
  backgroundBlur: dimmed ? 0 : 8,
  hoverBackgroundBlur: 8,
  tooltipForeground: "#d5f4ff",
});`}</code>
            </pre>
            <button
              className="demo-button docs-action"
              type="button"
              onClick={() => setDimmed((value) => !value)}
            >
              {dimmed ? "Disable dimming" : "Enable dimming"}
            </button>
          </article>
        </section>
      </main>
    </>
  );
}

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <TweakerProvider storeId="docs-demo">
      <Demo />
    </TweakerProvider>
  </StrictMode>,
);
