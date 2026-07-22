import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import typescript from 'highlight.js/lib/languages/typescript'
import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { GuideSideNav } from '@/guide-side-nav'
import { cn } from '@/lib/utils'

hljs.registerLanguage('bash', bash)
hljs.registerLanguage('typescript', typescript)

const installSource = `bun add @picodash/panel`

const stylesheetSource = `import '@picodash/panel/style.css'`

const storeSource = `import { createPicodashPanelStore } from '@picodash/panel'

export const settingsStore = createPicodashPanelStore({
  panelId: 'site-settings',
  initialValues: {
    opacity: 1,
    showGrid: true,
    quality: 'balanced',
  },
})`

const selectorSource = `const opacity = usePicodashPanelStoreSelector(
  settingsStore,
  (state) =>
    typeof state.values.opacity === 'number'
      ? state.values.opacity
      : 1,
)

const showGrid = usePicodashPanelStoreSelector(
  settingsStore,
  (state) => state.values.showGrid === true,
)`

const controllerSource = `function SettingsPanelActions() {
  const panel = usePicodashPanel('site-settings')

  return (
    <div>
      <button onClick={() => panel?.toggle()}>
        {panel?.visible ? 'Hide settings' : 'Show settings'}
      </button>
      <button onClick={() => panel?.activate()}>
        Open in front
      </button>
    </div>
  )
}

<PicodashPanel
  close={{ behavior: 'deregister' }}
  store={settingsStore}
  title="Site settings"
  defaultVisible={false}
  onClose={({ panelId, behavior }) => {
    // Observe the built-in close behavior and unmount if needed.
  }}
>
  {/* Items remain mounted and registered while hidden. */}
</PicodashPanel>`

const boundarySource = `const canvasStore = createPicodashPanelStore({
  panelId: 'canvas-tools',
})

function BoundedPanels() {
  const mainRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  return (
    <PicodashProvider panelBoundary={mainRef} persistLayout>
      <main ref={mainRef}>
        <div ref={canvasRef}>{/* Canvas */}</div>
      </main>

      <PicodashPanel
        store={settingsStore}
        collapsible
        defaultPlacement={{ mode: 'fixed', position: 'left' }}
      >
        <PicodashGroup id="session" label="Session" pin="start">
          {/* Always-visible items */}
        </PicodashGroup>
        {/* The auto lane scrolls */}
        <PicodashGroup id="status" label="Status" pin="end">
          {/* Always-visible items */}
        </PicodashGroup>
      </PicodashPanel>

      <PicodashPanel
        store={canvasStore}
        boundary={canvasRef}
        defaultPlacement={{ mode: 'fixed', position: 'bottom-right' }}
      />
    </PicodashProvider>
  )
}

function PlacementActions() {
  const panel = usePicodashPanel('site-settings')

  return (
    <button
      onClick={() =>
        panel?.setPlacement({ mode: 'fixed', position: 'right' })
      }
    >
      Dock right
    </button>
  )
}`

const panelSource = `<PicodashProvider
  persistLayout
  storageKey="my-site:picodash-layout:v1"
  theme="system"
>
  <main
    data-grid={showGrid ? 'true' : 'false'}
    style={{ opacity }}
  >
    {/* Your website */}
  </main>

  <PicodashPanel
    store={settingsStore}
    title="Site settings"
    width={360}
    collapsible
  >
    <PicodashGroup id="appearance" label="Appearance">
      <PicodashSlider
        field="opacity"
        label="Opacity"
        defaultValue={1}
        min={0.2}
        max={1}
        step={0.01}
      />
      <PicodashSwitch
        field="showGrid"
        label="Show grid"
        defaultValue
      />
      <PicodashSelect
        field="quality"
        label="Quality"
        defaultValue="balanced"
        options={[
          { label: 'Draft', value: 'draft' },
          { label: 'Balanced', value: 'balanced' },
          { label: 'Final', value: 'final' },
        ]}
      />
    </PicodashGroup>
  </PicodashPanel>
</PicodashProvider>`

const completeSource = `import {
  createPicodashPanelStore,
  PicodashGroup,
  PicodashPanel,
  PicodashProvider,
  PicodashSelect,
  PicodashSlider,
  PicodashSwitch,
  usePicodashPanelStoreSelector,
} from '@picodash/panel'
import '@picodash/panel/style.css'

const settingsStore = createPicodashPanelStore({
  panelId: 'site-settings',
  initialValues: {
    opacity: 1,
    showGrid: true,
    quality: 'balanced',
  },
})

export function SitePreview() {
  const opacity = usePicodashPanelStoreSelector(
    settingsStore,
    (state) =>
      typeof state.values.opacity === 'number'
        ? state.values.opacity
        : 1,
  )
  const showGrid = usePicodashPanelStoreSelector(
    settingsStore,
    (state) => state.values.showGrid === true,
  )

  return (
    <PicodashProvider
      persistLayout
      storageKey="my-site:picodash-layout:v1"
      theme="system"
    >
      <main
        data-grid={showGrid ? 'true' : 'false'}
        style={{ opacity }}
      >
        {/* Your website */}
      </main>

      <PicodashPanel
        store={settingsStore}
        title="Site settings"
        width={360}
        collapsible
      >
        <PicodashGroup id="appearance" label="Appearance">
          <PicodashSlider
            field="opacity"
            label="Opacity"
            defaultValue={1}
            min={0.2}
            max={1}
            step={0.01}
          />
          <PicodashSwitch
            field="showGrid"
            label="Show grid"
            defaultValue
          />
          <PicodashSelect
            field="quality"
            label="Quality"
            defaultValue="balanced"
            options={[
              { label: 'Draft', value: 'draft' },
              { label: 'Balanced', value: 'balanced' },
              { label: 'Final', value: 'final' },
            ]}
          />
        </PicodashGroup>
      </PicodashPanel>
    </PicodashProvider>
  )
}`

const programmaticSource = `const result = settingsStore.getState().setFieldValues({
  opacity: 0.8,
  quality: 'final',
})

if (!result.success) {
  console.error(result.errors)
}`

const reactiveSource = `<PicodashSwitch
  field="extendedRange"
  label="Extended range"
  defaultValue={false}
/>

<PicodashSlider
  field="exposure"
  label="Exposure"
  defaultValue={1}
  min={0}
  max={(state) =>
    state.values.extendedRange === true ? 2 : 1
  }
  visible={(state) => state.values.quality !== 'draft'}
/>`

const isolatedSource = `<PicodashPanel
  id="debug-tools"
  title="Debug tools"
  initialValues={{ outlines: false }}
>
  <PicodashSwitch
    field="outlines"
    label="Show outlines"
    defaultValue={false}
  />
</PicodashPanel>`

const guideLinks = [
  { href: '#usage-install', label: 'Install and import CSS' },
  { href: '#usage-store', label: 'Create the store' },
  { href: '#usage-select', label: 'Read values in React' },
  { href: '#usage-render', label: 'Render the panel' },
  { href: '#usage-verify', label: 'Verify the integration' },
] as const

export function UsageGuide() {
  return (
    <div
      className="max-h-[calc(100svh-15rem)] min-w-0 overflow-y-auto overscroll-contain scroll-smooth motion-reduce:scroll-auto"
      data-usage-guide
    >
      <div className="mx-auto grid max-w-5xl gap-8 p-4 sm:p-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10 lg:p-8">
        <GuideSideNav
          ariaLabel="Usage guide steps"
          description="Examples use React, TypeScript, and an application-owned panel store."
          links={guideLinks}
          title="Usage"
        />

        <article className="min-w-0">
          <header className="border-b border-white/10 pb-8">
            <h1 className="text-2xl font-medium tracking-tight text-zinc-50 sm:text-3xl">
              Add a reactive Picodash panel
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
              Create one stable store, select the values your page uses, and render field components
              inside a panel. Changes made in the panel update subscribed React components
              immediately.
            </p>
          </header>

          <div className="divide-y divide-white/10">
            <GuideStep
              id="usage-install"
              number="01"
              title="Install the package and import its stylesheet"
            >
              <p>
                Add <Code>picodash</Code> with your project&apos;s package manager. Import the
                package stylesheet once from your application entry point.
              </p>
              <CodeBlock language="bash" label="Install Picodash" source={installSource} />
              <CodeBlock
                language="typescript"
                label="Application entry"
                source={stylesheetSource}
              />
            </GuideStep>

            <GuideStep id="usage-store" number="02" title="Create a stable panel store">
              <p>
                Create the store at module scope, outside the React component. The{' '}
                <Code>panelId</Code> and field names are stable identities used by the panel and its
                actions.
              </p>
              <CodeBlock language="typescript" label="settings-store.ts" source={storeSource} />
              <Callout>
                <Code>initialValues</Code> seeds the accepted application state. Each item&apos;s{' '}
                <Code>defaultValue</Code> is its reset value. Keep both JSON-compatible.
              </Callout>
            </GuideStep>

            <GuideStep id="usage-select" number="03" title="Read panel values in React">
              <p>
                Subscribe to the smallest value each component needs. The selector rerenders that
                component when its selected value changes; no effect or mirrored local state is
                required.
              </p>
              <CodeBlock language="typescript" label="React selectors" source={selectorSource} />
            </GuideStep>

            <GuideStep id="usage-render" number="04" title="Render the provider and panel">
              <p>
                Place one <Code>PicodashProvider</Code> around the page and its panels. Pass the
                store to <Code>PicodashPanel</Code>, then add groups and field-backed items.
              </p>
              <CodeBlock language="typescript" label="Panel composition" source={panelSource} />
              <Callout>
                The same <Code>field</Code> connects an item to the corresponding store value. Use
                stable field names so reset, import, export, and programmatic writes address the
                same setting.
              </Callout>
            </GuideStep>

            <GuideStep id="usage-verify" number="05" title="Verify the integration">
              <ul className="grid gap-2 text-sm leading-6 text-zinc-300">
                <CheckItem>Move a control and confirm the page updates immediately.</CheckItem>
                <CheckItem>Reload and confirm the panel position restores.</CheckItem>
                <CheckItem>Use the panel reset action and confirm item defaults return.</CheckItem>
                <CheckItem>
                  Navigate every control with the keyboard at narrow and wide viewports.
                </CheckItem>
              </ul>
              <Callout>
                <Code>persistLayout</Code> stores panel position and placement only. Persist field
                values through your application&apos;s own storage layer when required.
              </Callout>
            </GuideStep>
          </div>

          <section className="border-t border-white/10 pt-9" id="usage-complete-example">
            <SectionHeading
              eyebrow="Complete example"
              title="One file, with application-owned state"
            />
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
              This is the smallest complete composition that lets both the website and the panel
              access the same values.
            </p>
            <div className="mt-5">
              <CodeBlock language="typescript" label="site-preview.tsx" source={completeSource} />
            </div>
          </section>

          <section className="border-t border-white/10 pt-9" id="usage-recipes">
            <SectionHeading eyebrow="Recipes" title="Common integration patterns" />
            <div className="mt-6 grid gap-5">
              <Recipe title="Update several fields from application code">
                <p>
                  Use one strict batch write when a preset, route, or server response changes
                  several fields. The store validates the whole batch and commits it atomically.
                </p>
                <CodeBlock
                  language="typescript"
                  label="Apply a preset"
                  source={programmaticSource}
                />
              </Recipe>

              <Recipe title="Derive item behavior from other fields">
                <p>
                  Props such as <Code>min</Code>, <Code>max</Code>, <Code>disabled</Code>, and{' '}
                  <Code>visible</Code> can read the current panel state. Keep these rules beside the
                  item that owns the constraint.
                </p>
                <CodeBlock
                  language="typescript"
                  label="Reactive item props"
                  source={reactiveSource}
                />
              </Recipe>

              <Recipe title="Use an internal store for an isolated panel">
                <p>
                  Omit the external store only when surrounding application code does not need
                  direct access to the values. Internal-store mode requires a stable <Code>id</Code>
                  and accepts <Code>initialValues</Code>.
                </p>
                <CodeBlock language="typescript" label="Isolated panel" source={isolatedSource} />
              </Recipe>

              <Recipe title="Control panel visibility from application UI">
                <p>
                  Call <Code>usePicodashPanel</Code> beneath the provider with a stable panel ID. It
                  returns <Code>null</Code> until registration, then exposes reactive visibility and
                  methods to show, hide, toggle, or activate the panel. Activation also raises a
                  hidden panel to the front. Add <Code>close</Code> for a header button that hides
                  through the provider, or select the <Code>deregister</Code> behavior when the host
                  should unmount after the registration and portal are removed.
                </p>
                <CodeBlock
                  language="typescript"
                  label="Panel visibility controls"
                  source={controllerSource}
                />
              </Recipe>

              <Recipe title="Constrain and fix panels to an application surface">
                <p>
                  Panels use the viewport by default. Pass an Element or React ref to{' '}
                  <Code>panelBoundary</Code> for a provider-wide working area, then use{' '}
                  <Code>boundary</Code> only when one panel needs a different surface. A fixed panel
                  overlays that boundary; it does not inset the application layout. The portal
                  container remains an independent rendering choice.
                </p>
                <p>
                  Full-edge left and right panels fill the boundary height. Their start and end
                  lanes remain visible while the auto lane scrolls with the bundled scroll fade. Use
                  the controller&apos;s reactive <Code>placement</Code> and{' '}
                  <Code>setPlacement</Code> to change modes at runtime.
                </p>
                <CodeBlock
                  language="typescript"
                  label="Fixed panels and boundary inheritance"
                  source={boundarySource}
                />
                <Callout>
                  Set <Code>boundary={'{null}'}</Code> to opt a panel back into viewport bounds. CSS
                  selectors are not accepted; resolve a selector to an Element yourself or use a
                  ref.
                </Callout>
              </Recipe>

              <Recipe title="Keep responsibilities separate">
                <ul className="grid gap-2">
                  <CheckItem>
                    Use selectors for rendering and store methods for application writes.
                  </CheckItem>
                  <CheckItem>
                    Use <Code>setFieldInput</Code> only for custom interactive editors that must
                    retain invalid drafts.
                  </CheckItem>
                  <CheckItem>
                    Use <Code>setFieldValue</Code> or <Code>setFieldValues</Code> for strict
                    programmatic writes.
                  </CheckItem>
                  <CheckItem>Keep file data and composite values JSON-compatible.</CheckItem>
                </ul>
              </Recipe>
            </div>
          </section>

          <section className="border-t border-white/10 pt-9" id="usage-agent-checklist">
            <SectionHeading eyebrow="Agent checklist" title="Implementation constraints" />
            <ol className="mt-5 grid gap-3 text-sm leading-6 text-zinc-300">
              <ConstraintItem>
                Import only from <Code>picodash</Code> unless a low-level advanced API is explicitly
                required.
              </ConstraintItem>
              <ConstraintItem>
                Create application-owned stores once at module scope; do not recreate them during
                render.
              </ConstraintItem>
              <ConstraintItem>
                Give every panel, group, item, and field a stable identity.
              </ConstraintItem>
              <ConstraintItem>
                Hoist custom parser and validator functions or stabilize them with{' '}
                <Code>useCallback</Code>.
              </ConstraintItem>
              <ConstraintItem>
                In a Next.js App Router project, add <Code>&apos;use client&apos;</Code> to modules
                that render Picodash components.
              </ConstraintItem>
              <ConstraintItem>
                Keep panel values JSON-compatible and keep high-frequency visual samples outside the
                panel store.
              </ConstraintItem>
              <ConstraintItem>
                Test the real page after adding the panel, including keyboard controls, portals,
                narrow viewports, reset behavior, and any application persistence.
              </ConstraintItem>
            </ol>
          </section>
        </article>
      </div>
    </div>
  )
}

function GuideStep({
  children,
  id,
  number,
  title,
}: {
  children: React.ReactNode
  id: string
  number: string
  title: string
}) {
  return (
    <section className="scroll-mt-6 py-9 first:pt-8" id={id}>
      <div className="grid items-baseline gap-4 sm:grid-cols-[2.5rem_minmax(0,1fr)]">
        <span className="font-mono text-xs text-amber-200/70">{number}</span>
        <div className="min-w-0">
          <h2 className="text-lg font-medium text-zinc-100">{title}</h2>
          <div className="mt-3 grid gap-4 text-sm leading-6 text-zinc-400">{children}</div>
        </div>
      </div>
    </section>
  )
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <header>
      <p className="font-mono text-[11px] tracking-widest text-amber-200 uppercase">{eyebrow}</p>
      <h2 className="mt-2 text-xl font-medium text-zinc-100">{title}</h2>
    </header>
  )
}

function Recipe({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <article className="border border-white/10 bg-white/3 p-4 sm:p-5">
      <h3 className="text-sm font-medium text-zinc-100">{title}</h3>
      <div className="mt-3 grid gap-4 text-sm leading-6 text-zinc-400">{children}</div>
    </article>
  )
}

function CodeBlock({
  label,
  language,
  source,
}: {
  label: string
  language: 'bash' | 'typescript'
  source: string
}) {
  const [copyStatus, setCopyStatus] = useState<'copied' | 'error' | 'idle'>('idle')
  const highlightedSource = hljs.highlight(source, { language }).value

  const copySource = async () => {
    try {
      await navigator.clipboard.writeText(source)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('error')
    }
    window.setTimeout(() => setCopyStatus('idle'), 1600)
  }

  return (
    <div className="min-w-0 border border-white/10 bg-black/25">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="font-mono text-[11px] text-zinc-500">{label}</span>
        <button
          aria-label={`Copy ${label}`}
          className="flex h-7 items-center gap-1.5 border border-white/10 bg-white/4 px-2 font-mono text-[11px] text-zinc-400 transition-colors hover:bg-white/8 hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:outline-none"
          data-copy-code={label}
          type="button"
          onClick={copySource}
        >
          {copyStatus === 'copied' ? (
            <Check aria-hidden="true" className="size-3 text-amber-200" />
          ) : (
            <Copy
              aria-hidden="true"
              className={cn('size-3', copyStatus === 'error' && 'text-red-300')}
            />
          )}
          <span aria-live="polite">
            {copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Copy failed' : 'Copy'}
          </span>
        </button>
      </div>
      <pre className="min-w-0 overflow-x-auto p-3 font-mono text-xs leading-6 text-zinc-300 sm:p-4">
        <code
          className={cn(
            'block min-w-max',
            '[&_.hljs-attr]:text-sky-200 [&_.hljs-built_in]:text-cyan-200',
            '[&_.hljs-comment]:text-zinc-600 [&_.hljs-keyword]:text-violet-300',
            '[&_.hljs-literal]:text-rose-300 [&_.hljs-number]:text-rose-200',
            '[&_.hljs-string]:text-amber-200 [&_.hljs-title.function_]:text-cyan-200',
            '[&_.hljs-type]:text-cyan-200',
          )}
          dangerouslySetInnerHTML={{ __html: highlightedSource }}
        />
      </pre>
    </div>
  )
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-l-2 border-amber-200/50 bg-amber-200/5 px-3 py-2.5 text-xs leading-5 text-zinc-400">
      {children}
    </p>
  )
}

function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <Check aria-hidden="true" className="mt-1.5 size-3 shrink-0 text-emerald-300" />
      <span>{children}</span>
    </li>
  )
}

function ConstraintItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2 border-b border-white/8 pb-3 last:border-0">
      <span className="font-mono text-xs text-amber-200/70">—</span>
      <span>{children}</span>
    </li>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="border border-white/8 bg-white/5 px-1 py-0.5 font-mono text-[0.82em] text-zinc-200">
      {children}
    </code>
  )
}
