import { StrictMode, type CSSProperties, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Monitor, Moon, Sun } from 'lucide-react'
import {
  TweakerPanel,
  TweakerProvider,
  defineTweakerControl,
  mergeTweakerControls,
  useTweaker,
  type JsonValue,
  type PanelTheme,
  type TweakerControlProps,
  type TweakerSchema,
} from 'tweaker'
import 'tweaker/style.css'
import './style.css'

const renderingSchema = {
  speed: {
    defaultValue: 0.72,
    min: 0,
    max: 2,
    step: 0.01,
    label: 'Speed',
    status: 'info',
    help: 'Adjusts the preview animation speed.',
  },
  exposure: {
    type: 'number',
    defaultValue: 1,
    min: 0,
    max: 4,
    step: 0.1,
    status: 'alert',
  },
  bloom: { type: 'checkbox', defaultValue: true, label: 'Bloom', status: 'error' },
} satisfies TweakerSchema

const cameraSchema = {
  focalLength: {
    type: 'number',
    defaultValue: 35,
    min: 14,
    max: 200,
    step: 1,
    label: 'Focal length',
    formatOptions: {
      style: 'unit',
      unit: 'millimeter',
      unitDisplay: 'short',
      maximumFractionDigits: 0,
    },
  },
  aperture: {
    type: 'number',
    defaultValue: 2.8,
    min: 1.4,
    max: 22,
    step: 0.1,
    label: 'Aperture',
    formatOptions: { maximumFractionDigits: 1, minimumFractionDigits: 1 },
  },
  zoom: {
    type: 'number',
    defaultValue: 1,
    min: 0,
    max: 1,
    step: 0.05,
    label: 'Zoom',
    formatOptions: { style: 'percent', maximumFractionDigits: 0 },
  },
  rotation: {
    type: 'number',
    defaultValue: 0,
    min: -180,
    max: 180,
    step: 1,
    label: 'Rotation',
    readOnly: true,
    formatOptions: {
      style: 'unit',
      unit: 'degree',
      unitDisplay: 'narrow',
      maximumFractionDigits: 0,
    },
  },
} satisfies TweakerSchema

const materialSchema = {
  shape: {
    type: 'select',
    defaultValue: 'orb',
    options: { Orb: 'orb', Prism: 'prism', Plate: 'plate' },
  },
  tint: {
    type: 'select',
    defaultValue: 'green',
    options: ['green', 'amber', 'blue'],
    label: 'Tint',
    help: 'Changes the material color palette.',
  },
  roughness: { type: 'slider', defaultValue: 0.34, min: 0, max: 1, step: 0.01 },
  sheen: {
    type: 'slider',
    defaultValue: 0.42,
    min: 0,
    max: 1,
    step: 0.001,
    formatOptions: { style: 'percent', maximumFractionDigits: 1 },
  },
  accent: { type: 'color', id: 'accent', defaultValue: '#9bd16f', label: 'Accent' },
} satisfies TweakerSchema

const buildSchema = {
  channel: {
    type: 'select',
    defaultValue: 'stable',
    options: ['stable', 'canary'],
    label: 'Channel',
  },
  telemetry: { defaultValue: true, label: 'Telemetry' },
} satisfies TweakerSchema

const dynamicBaseSchema = {
  advanced: { type: 'checkbox', defaultValue: false, label: 'Advanced' },
} satisfies TweakerSchema

const advancedSummarySchema = {
  summary: { type: 'display', defaultValue: 'Ready', label: 'Summary' },
} satisfies TweakerSchema

function useDynamicDependentSchema(advanced: boolean) {
  return useMemo<TweakerSchema>(
    () => ({
      intensity: {
        type: 'number',
        defaultValue: 50,
        min: 0,
        max: advanced ? 200 : 50,
        step: 1,
        label: 'Intensity',
        readOnly: !advanced,
      },
    }),
    [advanced],
  )
}

function ColorControl({ id, value, setValue }: TweakerControlProps<string>) {
  return (
    <input
      id={id}
      className="color-control"
      type="color"
      value={typeof value === 'string' ? value : '#9bd16f'}
      onChange={(event) => setValue(event.target.value)}
    />
  )
}

export const colorControl = defineTweakerControl<string>({
  type: 'color',
  component: ColorControl,
  sanitize: (value, control) => {
    const isHexColor = (candidate: unknown): candidate is string =>
      typeof candidate === 'string' && /^#[0-9a-fA-F]{6}$/.test(candidate)
    if (isHexColor(value)) return value
    return isHexColor(control.defaultValue) ? control.defaultValue : '#9bd16f'
  },
})

export const color = colorControl.config

function telemetrySamples(value: JsonValue) {
  return Array.isArray(value)
    ? value.filter(
        (sample): sample is number => typeof sample === 'number' && Number.isFinite(sample),
      )
    : []
}

function telemetryPath(samples: number[]) {
  if (samples.length === 0) return ''
  const max = Math.max(1, ...samples.map((sample) => Math.abs(sample)))
  return samples
    .map((sample, index) => {
      const x = samples.length === 1 ? 0 : (index / (samples.length - 1)) * 100
      const y = 24 - (sample / max) * 20
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}

function TelemetryGraphControl({ value, control, labelId }: TweakerControlProps) {
  const samples = telemetrySamples(value)

  return (
    <svg
      id={control.domId}
      className="telemetry-graph"
      viewBox="0 0 100 48"
      role="img"
      aria-labelledby={labelId}
      preserveAspectRatio="none"
    >
      <path className="telemetry-graph__midline" d="M 0 24 L 100 24" />
      <path className="telemetry-graph__line" d={telemetryPath(samples)} />
    </svg>
  )
}

const telemetryGraphControl = defineTweakerControl<JsonValue>({
  type: '@tweaker-demo/telemetryGraph',
  valueMode: 'transient',
  layout: 'block',
  component: TelemetryGraphControl,
  sanitize: (value) => telemetrySamples(value).slice(-48),
})

const demoControls = mergeTweakerControls(colorControl, telemetryGraphControl)

function createTelemetrySamples(speed: number, exposure: number): JsonValue {
  return Array.from({ length: 36 }, (_, index) => {
    const phase = index / 5
    return Math.sin(phase * speed * 1.6) * exposure + Math.cos(phase * 0.7) * 0.2
  })
}

function themeFromLocation(): PanelTheme {
  const theme = new URLSearchParams(window.location.search).get('theme')
  return theme === 'light' || theme === 'system' ? theme : 'dark'
}

const themeOptions = [
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'system', label: 'System', icon: Monitor },
] satisfies Array<{ value: PanelTheme; label: string; icon: typeof Moon }>

function Demo() {
  const [dimmed, setDimmed] = useState(true)
  const [panelTheme, setPanelTheme] = useState<PanelTheme>(() => themeFromLocation())
  const [rendering, setRendering] = useTweaker(renderingSchema, {
    section: { id: 'rendering', label: 'Rendering' },
  })
  const [material] = useTweaker(materialSchema, {
    section: { id: 'material', label: 'Material' },
  })
  const cameraSchemaWithDescription = useMemo<TweakerSchema>(
    () => ({
      ...cameraSchema,
      focalLength: {
        ...cameraSchema.focalLength,
        description: (
          <span>
            Linked to speed <strong>{Number(rendering.speed).toFixed(2)}</strong>
          </span>
        ),
      },
    }),
    [rendering.speed],
  )
  const [camera] = useTweaker(cameraSchemaWithDescription, {
    section: { id: 'camera', label: '' },
  })
  // Derived display: a 35mm-equivalent focal length computed from focalLength.
  const equivalent = Math.round(Number(camera.focalLength) * 1.5)
  useTweaker(
    {
      equivalent: {
        type: 'display',
        defaultValue: equivalent,
        label: '35mm equiv.',
        formatOptions: { style: 'unit', unit: 'millimeter', maximumFractionDigits: 0 },
      },
    },
    { section: { id: 'camera', label: '' } },
  )
  const [dynamic] = useTweaker(dynamicBaseSchema, {
    section: { id: 'dynamic', label: 'Dynamic' },
  })
  const advanced = Boolean(dynamic.advanced)
  const dependentSchema = useDynamicDependentSchema(advanced)
  // The Advanced section is shown/hidden as a whole via its SectionConfig,
  // independent of the controls it contains.
  const [advancedValues] = useTweaker(dependentSchema, {
    section: { id: 'advanced', label: 'Advanced', hidden: !advanced },
  })
  useTweaker(advancedSummarySchema, {
    section: { id: 'advanced-summary', label: 'Advanced summary', hidden: !advanced },
  })
  const intensity = Number(advancedValues.intensity ?? 50)
  const [build] = useTweaker(buildSchema, {
    panel: 'build',
    section: { id: 'build', label: 'Build' },
    reorderable: false,
  })
  const telemetryGraph = useMemo(
    () => createTelemetrySamples(Number(rendering.speed), Number(rendering.exposure)),
    [rendering.exposure, rendering.speed],
  )
  useTweaker(
    {
      forceGraph: {
        type: '@tweaker-demo/telemetryGraph',
        defaultValue: telemetryGraph,
        label: 'Force graph',
        height: 74,
      },
    },
    { section: { id: 'extensions', label: 'Extensions' }, reorderable: false },
  )

  const previewStyle = useMemo<CSSProperties>(
    () =>
      ({
        '--demo-speed': `${rendering.speed}s`,
        '--demo-exposure': String(rendering.exposure),
        '--demo-roughness': String(material.roughness),
        '--demo-tint': `var(--tint-${material.tint})`,
        '--demo-accent': String(material.accent),
      }) as CSSProperties,
    [material.accent, material.roughness, material.tint, rendering.exposure, rendering.speed],
  )

  function selectTheme(theme: PanelTheme) {
    setPanelTheme(theme)
    const url = new URL(window.location.href)
    if (theme === 'dark') {
      url.searchParams.delete('theme')
    } else {
      url.searchParams.set('theme', theme)
    }
    window.history.replaceState(null, '', url)
  }

  return (
    <>
      <TweakerPanel
        defaultPlacement="top-right"
        theme={panelTheme}
        title="Scene"
        width={360}
        appearance={{
          surfaceOpacity: dimmed ? 0.55 : 1,
          activeSurfaceOpacity: dimmed ? 0.95 : 1,
          backdropBlur: dimmed ? 0 : 8,
          activeBackdropBlur: 8,
        }}
      />
      <TweakerPanel id="build" defaultPlacement="bottom-left" theme={panelTheme} title="Build" />
      <main className="site-shell">
        <section className="hero">
          <div className="hero__copy">
            <p className="eyebrow">React config panel</p>
            <h1>Tweaker</h1>
            <p>
              A compact Leva-inspired floating panel with typed controls, persisted values,
              section-local reordering, magnetic docking, and named panels.
            </p>
            <div className="theme-switcher" aria-label="Panel theme">
              {themeOptions.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  className="theme-switcher__button"
                  type="button"
                  aria-pressed={panelTheme === value}
                  onClick={() => selectTheme(value)}
                >
                  <Icon aria-hidden size={15} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="preview" style={previewStyle}>
            <div
              className={`preview__object preview__object--${material.shape} ${rendering.bloom ? 'has-bloom' : ''}`}
            />
            <div className="preview__readout">
              <span>Speed {Number(rendering.speed).toFixed(2)}</span>
              <span>Exposure {Number(rendering.exposure).toFixed(1)}</span>
              <span>Roughness {Number(material.roughness).toFixed(2)}</span>
              <span>Accent {String(material.accent)}</span>
              <span>Focal {camera.focalLength}mm</span>
              <span>Channel {build.channel}</span>
              <span>
                Intensity {intensity}
                {advanced ? ' (advanced)' : ''}
              </span>
            </div>
          </div>
        </section>

        <section className="docs-grid" aria-label="Usage examples">
          <article>
            <h2>Install</h2>
            <pre>
              <code>{`bun add tweaker
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
              onClick={() => setRendering('speed', 1.25)}
            >
              Set speed to 1.25
            </button>
          </article>

          <article>
            <h2>Panel appearance</h2>
            <pre>
              <code>{`const [theme, setTheme] = useState("dark");

<TweakerPanel theme={theme} />

const [dimmed, setDimmed] = useState(true);

<TweakerPanel
  width={360}
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
              {dimmed ? 'Disable dimming' : 'Enable dimming'}
            </button>
          </article>
        </section>
      </main>
    </>
  )
}

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <TweakerProvider id="docs-demo" controls={demoControls}>
      <Demo />
    </TweakerProvider>
  </StrictMode>,
)
