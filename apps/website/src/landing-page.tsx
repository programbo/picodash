import { motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import {
  createTweakerPanelStore,
  TweakerDisplay,
  TweakerGroup,
  TweakerPanel,
  TweakerProvider,
  TweakerSelect,
  TweakerSlider,
  TweakerSwitch,
} from 'tweaker'
import { useTweakerPanelStoreSelector } from 'tweaker'

type LandingQuality = 'preview' | 'balanced' | 'sharp'

const landingPanelStore = createTweakerPanelStore({
  initialValues: {
    exposure: 1.08,
    liveSync: true,
    quality: 'balanced' as LandingQuality,
    sampleDensity: 0.62,
  },
  panelId: 'landing-showcase',
})

const qualityRates: Record<LandingQuality, number> = {
  balanced: 1,
  preview: 0.72,
  sharp: 1.25,
}

export function LandingPage() {
  const [landingPanelPortalContainer, setLandingPanelPortalContainer] =
    useState<HTMLElement | null>(null)
  const exposure = useTweakerPanelStoreSelector(landingPanelStore, (state) =>
    typeof state.values.exposure === 'number' ? state.values.exposure : 1,
  )
  const liveSync = useTweakerPanelStoreSelector(
    landingPanelStore,
    (state) => state.values.liveSync === true,
  )
  const rawQuality = useTweakerPanelStoreSelector(
    landingPanelStore,
    (state) => state.values.quality,
  )
  const sampleDensity = useTweakerPanelStoreSelector(landingPanelStore, (state) =>
    typeof state.values.sampleDensity === 'number' ? state.values.sampleDensity : 0.6,
  )
  const quality =
    rawQuality === 'preview' || rawQuality === 'balanced' || rawQuality === 'sharp'
      ? rawQuality
      : 'balanced'
  const prefersReducedMotion = useReducedMotion()
  const sampleColumns = buildSampleColumns({ exposure, liveSync, sampleDensity, quality })

  return (
    <main
      className="bg-background text-foreground relative mx-auto min-h-svh max-w-7xl px-4 py-12 sm:px-6 lg:px-8"
      data-landing-page
    >
      <a href="#landing-showcase" className="sr-only focus-visible:not-sr-only">
        Skip to interactive showcase
      </a>
      <TweakerProvider theme="system" portalContainer={landingPanelPortalContainer}>
        <div className="mx-auto flex max-w-7xl flex-col gap-8">
          <header>
            <div className="flex items-center justify-between gap-4">
              <p className="font-heading text-lg tracking-wide">Tweaker</p>
              <nav
                aria-label="Product navigation"
                className="flex items-center gap-2 text-sm font-medium"
              >
                <a
                  href="/gallery"
                  className="border-border bg-muted hover:bg-muted/80 focus-visible:ring-ring focus-visible:ring-offset-background rounded-full border px-3 py-1.5 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  Gallery
                </a>
                <a
                  href="/state-lab"
                  className="border-border bg-muted/50 hover:bg-muted/70 focus-visible:ring-ring focus-visible:ring-offset-background rounded-full border px-3 py-1.5 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  State Lab
                </a>
              </nav>
            </div>
            <div className="border-border mt-3 border-b pb-4">
              <h1 className="max-w-2xl text-4xl leading-tight font-medium tracking-tight">
                A composable React inspector panel library for technical tooling
              </h1>
              <p className="text-muted-foreground mt-4 max-w-2xl text-base leading-7">
                Build tools around live values. Let users fine-tune rendering, data, and behavior
                in-place with reusable controls that keep layout, state, and constraints in sync.
              </p>
            </div>
          </header>

          <section
            className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]"
            aria-labelledby="landing-hero"
          >
            <div>
              <div className="grid gap-3">
                <h2 id="landing-hero" className="text-sm font-semibold tracking-[0.16em] uppercase">
                  Live demo
                </h2>
                <p className="text-muted-foreground text-sm leading-6">
                  Browse real examples and implementation patterns on the gallery, or open the
                  technical state lab for the full live inspector pipeline.
                </p>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  href="/gallery"
                  className="bg-primary text-primary-foreground focus-visible:ring-ring focus-visible:ring-offset-background rounded-lg px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  data-landing-primary-cta
                >
                  Open gallery
                </a>
                <a
                  href="/state-lab"
                  className="border-border hover:bg-muted focus-visible:ring-ring focus-visible:ring-offset-background rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  Open state lab
                </a>
              </div>
              <pre className="bg-muted/60 text-muted-foreground mt-6 max-w-xl rounded-lg border p-3 text-xs">
                <code>bun add tweaker</code>
              </pre>
            </div>

            <article
              className="relative"
              id="landing-showcase"
              data-landing-showcase
              data-landing-panel-host
              ref={setLandingPanelPortalContainer}
            >
              <div className="border-border bg-tweaker-surface overflow-hidden rounded-xl border p-4">
                <div className="grid gap-3">
                  <p className="text-tweaker-text-muted text-xs font-semibold tracking-[0.16em] uppercase">
                    Signal surface
                  </p>
                  <div className="border-tweaker-border bg-tweaker-surface-muted relative h-44 rounded-lg border p-3">
                    <motion.div
                      aria-hidden="true"
                      className="bg-tweaker-accent/55 absolute inset-x-0 top-0 h-[2px] opacity-0"
                      animate={
                        !prefersReducedMotion
                          ? { opacity: [0.2, 0.7, 0.2], x: ['-45%', '45%', '-45%'] }
                          : { opacity: 0.25, x: '0%' }
                      }
                      transition={
                        !prefersReducedMotion
                          ? { duration: 4, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }
                          : { duration: 0.01, repeat: 0 }
                      }
                    />
                    <div className="grid h-full grid-cols-16 gap-1" data-landing-surface>
                      {sampleColumns.map((height, index) => (
                        <span
                          key={`${quality}-${index}`}
                          aria-hidden="true"
                          className="bg-tweaker-accent/55 relative overflow-hidden rounded-sm"
                          style={{
                            opacity: 0.3 + Number(liveSync) * 0.1 + sampleDensity * 0.4,
                            height: `${height}%`,
                          }}
                          data-landing-column={index}
                        >
                          <span
                            className="bg-tweaker-accent absolute inset-x-0 bottom-0 block rounded-b-sm"
                            style={{ height: `${Math.max(height, 4)}%` }}
                          />
                        </span>
                      ))}
                    </div>
                    <div className="text-tweaker-text-muted mt-2 flex items-center justify-between text-xs">
                      <span>quality</span>
                      <span>{quality}</span>
                    </div>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    The control values above are tied to the same panel API you use in production
                    product code.
                  </p>
                </div>
              </div>
            </article>
          </section>
          <section className="mt-2 grid gap-6 lg:grid-cols-[1fr_1fr]">
            <TweakerPanel
              store={landingPanelStore}
              title="Landing showcase"
              width={320}
              className="relative"
              data-landing-panel
            >
              <TweakerGroup id="showcase-controls" label="Live controls">
                <TweakerSelect
                  field="quality"
                  label="Quality"
                  defaultValue="balanced"
                  options={[
                    { label: 'Preview', value: 'preview' },
                    { label: 'Balanced', value: 'balanced' },
                    { label: 'Sharp', value: 'sharp' },
                  ]}
                />
                <TweakerSlider
                  field="exposure"
                  label="Exposure"
                  defaultValue={1.08}
                  min={0.6}
                  max={1.6}
                  step={0.02}
                  formatOptions={{ maximumFractionDigits: 2 }}
                />
                <TweakerSlider
                  field="sampleDensity"
                  label="Sample density"
                  defaultValue={0.62}
                  min={0.22}
                  max={1}
                  step={0.01}
                />
                <TweakerSwitch field="liveSync" label="Live signal sync" defaultValue />
                <TweakerDisplay
                  id="frame-target"
                  label="Frame target"
                  value={(state) =>
                    `~${Math.round(
                      (typeof state.values.exposure === 'number' ? state.values.exposure : 1) *
                        60 *
                        qualityRates[
                          state.values.quality === 'preview' || state.values.quality === 'sharp'
                            ? state.values.quality
                            : 'balanced'
                        ],
                    )} fps`
                  }
                />
              </TweakerGroup>
            </TweakerPanel>

            <div className="border-border bg-muted/40 rounded-lg border p-5">
              <h2 className="text-muted-foreground text-sm font-semibold tracking-[0.16em] uppercase">
                Why use this instead of a config page
              </h2>
              <ul className="text-muted-foreground mt-3 list-disc space-y-2 pl-4 text-sm">
                <li>Keep tool controls and their validation contracts close to runtime state.</li>
                <li>Surface the same controls in a panel, not a copied static form.</li>
                <li>Store state in place and ship consistent values to your app layer.</li>
              </ul>
            </div>
          </section>
        </div>
      </TweakerProvider>
    </main>
  )
}

function buildSampleColumns(panelValues: {
  exposure: number
  liveSync: boolean
  quality: LandingQuality
  sampleDensity: number
}) {
  const rows = 16
  const multiplier = qualityRates[panelValues.quality]
  const syncOffset = panelValues.liveSync ? 1.2 : 1

  return Array.from({ length: rows }, (_, index) => {
    const phase = (index / rows) * Math.PI * 2
    const base = Math.sin(phase + panelValues.exposure) * 0.45 + 0.55
    const density = Math.max(
      18,
      Math.min(96, base * multiplier * syncOffset * panelValues.sampleDensity * 95),
    )
    return Math.round(density)
  })
}

export default LandingPage
