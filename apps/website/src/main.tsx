import { StrictMode, type CSSProperties, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { TweakerPanel, TweakerProvider, useTweaker, type TweakerSchema } from "tweaker";
import "tweaker/style.css";
import "./style.css";

const renderingSchema = {
  speed: { value: 0.72, min: 0, max: 2, step: 0.01, label: "Speed" },
  exposure: { type: "number", value: 1, min: 0, max: 4, step: 0.1 },
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
  const [rendering, setRendering] = useTweaker(renderingSchema, {
    section: "Rendering",
  });
  const [material] = useTweaker(materialSchema, { section: "Material" });
  const [build] = useTweaker(buildSchema, {
    section: "Build",
    sortable: false,
    opacity: 0.62,
    hoverOpacity: 1,
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
              className={`preview__object preview__object--${material.shape} ${
                rendering.bloom ? "has-bloom" : ""
              }`}
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
  speed: { value: 0.72, min: 0, max: 2 },
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
