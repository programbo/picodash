import { StrictMode, type CSSProperties, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  TweakerPanel,
  TweakerProvider,
  useTweaker,
  type TweakerCustomControlProps,
  type TweakerSchema,
} from "tweaker";
import "tweaker/style.css";
import "./style.css";

const renderingSchema = {
  speed: { defaultValue: 0.72, min: 0, max: 2, step: 0.01, label: "Speed" },
  exposure: { type: "number", defaultValue: 1, min: 0, max: 4, step: 0.1 },
  bloom: { type: "checkbox", defaultValue: true, label: "Bloom" },
} satisfies TweakerSchema;

const materialSchema = {
  shape: {
    type: "select",
    defaultValue: "orb",
    options: { Orb: "orb", Prism: "prism", Plate: "plate" },
  },
  tint: {
    type: "select",
    defaultValue: "green",
    options: ["green", "amber", "blue"],
    label: "Tint",
  },
  roughness: { type: "slider", defaultValue: 0.34, min: 0, max: 1, step: 0.01 },
  accent: { type: "color", id: "accent", defaultValue: "#9bd16f", label: "Accent" },
} satisfies TweakerSchema;

const buildSchema = {
  channel: {
    type: "select",
    defaultValue: "stable",
    options: ["stable", "canary"],
    label: "Channel",
  },
  telemetry: { defaultValue: true, label: "Telemetry" },
} satisfies TweakerSchema;

function ColorControl({ id, value, setValue }: TweakerCustomControlProps) {
  return (
    <input
      id={id}
      className="color-control"
      type="color"
      value={typeof value === "string" ? value : "#9bd16f"}
      onChange={(event) => setValue(event.target.value)}
    />
  );
}

function Demo() {
  const [dimmed, setDimmed] = useState(true);
  const [rendering, setRendering] = useTweaker(renderingSchema, {
    section: { id: "rendering", label: "Rendering" },
  });
  const [material] = useTweaker(materialSchema, {
    section: { id: "material", label: "Material" },
  });
  const [build] = useTweaker(buildSchema, {
    panel: "build",
    section: { id: "build", label: "Build" },
    reorderable: false,
  });

  const previewStyle = useMemo<CSSProperties>(
    () =>
      ({
        "--demo-speed": `${rendering.speed}s`,
        "--demo-exposure": String(rendering.exposure),
        "--demo-roughness": String(material.roughness),
        "--demo-tint": `var(--tint-${material.tint})`,
        "--demo-accent": String(material.accent),
      }) as CSSProperties,
    [material.accent, material.roughness, material.tint, rendering.exposure, rendering.speed],
  );

  return (
    <>
      <TweakerPanel
        defaultPlacement="top-right"
        title="Scene"
        appearance={{
          surfaceOpacity: dimmed ? 0.55 : 1,
          activeSurfaceOpacity: dimmed ? 0.95 : 1,
          backdropBlur: dimmed ? 0 : 8,
          activeBackdropBlur: 8,
        }}
      />
      <TweakerPanel id="build" defaultPlacement="bottom-right" title="Build" />
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
              <span>Accent {String(material.accent)}</span>
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
  speed: { defaultValue: 0.72, min: 0, max: 2 },
  bloom: { defaultValue: true },
}, {
  section: { id: "rendering", label: "Rendering" },
});`}</code>
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
            <h2>Panel appearance</h2>
            <pre>
              <code>{`const [dimmed, setDimmed] = useState(true);

<TweakerPanel
  appearance={{
    surfaceOpacity: dimmed ? 0.55 : 1,
    activeSurfaceOpacity: dimmed ? 0.95 : 1,
    backdropBlur: dimmed ? 0 : 8,
    activeBackdropBlur: 8,
  }}
/>`}</code>
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
    <TweakerProvider id="docs-demo" controls={{ color: ColorControl }}>
      <Demo />
    </TweakerProvider>
  </StrictMode>,
);
