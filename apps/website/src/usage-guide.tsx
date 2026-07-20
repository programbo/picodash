import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import typescript from 'highlight.js/lib/languages/typescript'
import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

hljs.registerLanguage('bash', bash)
hljs.registerLanguage('typescript', typescript)

const installSource = `bun add tweaker`

const stylesheetSource = `import 'tweaker/style.css'`

const storeSource = `import { createTweakerPanelStore } from 'tweaker'

export const settingsStore = createTweakerPanelStore({
  panelId: 'site-settings',
  initialValues: {
    opacity: 1,
    showGrid: true,
    quality: 'balanced',
  },
})`

const selectorSource = `const opacity = useTweakerPanelStoreSelector(
  settingsStore,
  (state) =>
    typeof state.values.opacity === 'number'
      ? state.values.opacity
      : 1,
)

const showGrid = useTweakerPanelStoreSelector(
  settingsStore,
  (state) => state.values.showGrid === true,
)`

const panelSource = `<TweakerProvider
  persistLayout
  storageKey="my-site:tweaker-layout:v1"
  theme="system"
>
  <main
    data-grid={showGrid ? 'true' : 'false'}
    style={{ opacity }}
  >
    {/* Your website */}
  </main>

  <TweakerPanel
    store={settingsStore}
    title="Site settings"
    width={360}
    collapsible
  >
    <TweakerGroup id="appearance" label="Appearance">
      <TweakerSlider
        field="opacity"
        label="Opacity"
        defaultValue={1}
        min={0.2}
        max={1}
        step={0.01}
      />
      <TweakerSwitch
        field="showGrid"
        label="Show grid"
        defaultValue
      />
      <TweakerSelect
        field="quality"
        label="Quality"
        defaultValue="balanced"
        options={[
          { label: 'Draft', value: 'draft' },
          { label: 'Balanced', value: 'balanced' },
          { label: 'Final', value: 'final' },
        ]}
      />
    </TweakerGroup>
  </TweakerPanel>
</TweakerProvider>`

const completeSource = `import {
  createTweakerPanelStore,
  TweakerGroup,
  TweakerPanel,
  TweakerProvider,
  TweakerSelect,
  TweakerSlider,
  TweakerSwitch,
  useTweakerPanelStoreSelector,
} from 'tweaker'
import 'tweaker/style.css'

const settingsStore = createTweakerPanelStore({
  panelId: 'site-settings',
  initialValues: {
    opacity: 1,
    showGrid: true,
    quality: 'balanced',
  },
})

export function SitePreview() {
  const opacity = useTweakerPanelStoreSelector(
    settingsStore,
    (state) =>
      typeof state.values.opacity === 'number'
        ? state.values.opacity
        : 1,
  )
  const showGrid = useTweakerPanelStoreSelector(
    settingsStore,
    (state) => state.values.showGrid === true,
  )

  return (
    <TweakerProvider
      persistLayout
      storageKey="my-site:tweaker-layout:v1"
      theme="system"
    >
      <main
        data-grid={showGrid ? 'true' : 'false'}
        style={{ opacity }}
      >
        {/* Your website */}
      </main>

      <TweakerPanel
        store={settingsStore}
        title="Site settings"
        width={360}
        collapsible
      >
        <TweakerGroup id="appearance" label="Appearance">
          <TweakerSlider
            field="opacity"
            label="Opacity"
            defaultValue={1}
            min={0.2}
            max={1}
            step={0.01}
          />
          <TweakerSwitch
            field="showGrid"
            label="Show grid"
            defaultValue
          />
          <TweakerSelect
            field="quality"
            label="Quality"
            defaultValue="balanced"
            options={[
              { label: 'Draft', value: 'draft' },
              { label: 'Balanced', value: 'balanced' },
              { label: 'Final', value: 'final' },
            ]}
          />
        </TweakerGroup>
      </TweakerPanel>
    </TweakerProvider>
  )
}`

const programmaticSource = `const result = settingsStore.getState().setFieldValues({
  opacity: 0.8,
  quality: 'final',
})

if (!result.success) {
  console.error(result.errors)
}`

const reactiveSource = `<TweakerSwitch
  field="extendedRange"
  label="Extended range"
  defaultValue={false}
/>

<TweakerSlider
  field="exposure"
  label="Exposure"
  defaultValue={1}
  min={0}
  max={(state) =>
    state.values.extendedRange === true ? 2 : 1
  }
  visible={(state) => state.values.quality !== 'draft'}
/>`

const isolatedSource = `<TweakerPanel
  id="debug-tools"
  title="Debug tools"
  initialValues={{ outlines: false }}
>
  <TweakerSwitch
    field="outlines"
    label="Show outlines"
    defaultValue={false}
  />
</TweakerPanel>`

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
      className="max-h-[calc(100svh-15rem)] min-w-0 overflow-y-auto overscroll-contain"
      data-usage-guide
    >
      <div className="mx-auto grid max-w-5xl gap-8 p-4 sm:p-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10 lg:p-8">
        <aside className="lg:sticky lg:top-8 lg:self-start">
          <p className="font-mono text-[11px] tracking-widest text-amber-200 uppercase">Usage</p>
          <nav aria-label="Usage guide steps" className="mt-4">
            <ol className="grid gap-px border border-white/10 bg-white/10">
              {guideLinks.map((link, index) => (
                <li key={link.href}>
                  <a
                    className="group flex gap-3 bg-zinc-950 px-3 py-2.5 text-xs leading-5 text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:outline-none"
                    href={link.href}
                  >
                    <span className="font-mono text-amber-200/70">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span>{link.label}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <p className="mt-4 text-xs leading-5 text-zinc-500">
            Examples use React, TypeScript, and an application-owned panel store.
          </p>
        </aside>

        <article className="min-w-0">
          <header className="border-b border-white/10 pb-8">
            <h1 className="text-2xl font-medium tracking-tight text-zinc-50 sm:text-3xl">
              Add a reactive Tweaker panel
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
                Add <Code>tweaker</Code> with your project&apos;s package manager. Import the
                package stylesheet once from your application entry point.
              </p>
              <CodeBlock language="bash" label="Install Tweaker" source={installSource} />
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
                Place one <Code>TweakerProvider</Code> around the page and its panels. Pass the
                store to <Code>TweakerPanel</Code>, then add groups and field-backed items.
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
                <Code>persistLayout</Code> stores panel position and docking only. Persist field
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
                Import only from <Code>tweaker</Code> unless a low-level advanced API is explicitly
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
      <div className="grid gap-4 sm:grid-cols-[2.5rem_minmax(0,1fr)]">
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
  const [copied, setCopied] = useState(false)
  const highlightedSource = hljs.highlight(source, { language }).value

  const copySource = async () => {
    await navigator.clipboard.writeText(source)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="min-w-0 border border-white/10 bg-black/25">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="font-mono text-[11px] text-zinc-500">{label}</span>
        <button
          aria-label={`Copy ${label}`}
          className="flex h-7 items-center gap-1.5 border border-white/10 bg-white/4 px-2 font-mono text-[11px] text-zinc-400 transition-colors hover:bg-white/8 hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:outline-none"
          type="button"
          onClick={copySource}
        >
          {copied ? (
            <Check aria-hidden="true" className="size-3 text-amber-200" />
          ) : (
            <Copy aria-hidden="true" className="size-3" />
          )}
          <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
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
