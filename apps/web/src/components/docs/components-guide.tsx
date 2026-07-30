'use client'

import hljs from 'highlight.js/lib/core'
import typescript from 'highlight.js/lib/languages/typescript'
import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { GuidePanelLayout } from '@/components/docs/guide-side-nav'
import { HomeContent, HomeFrame, HomeTextToolbar } from '@/components/home/home-frame'
import { cn } from '@/lib/utils'

hljs.registerLanguage('typescript', typescript)

const providerSource = `import { PicodashProvider } from '@picodash/panel'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <PicodashProvider
      persistLayout
      storageKey="my-app:picodash-layout:v1"
      theme="system"
    >
      {children}
    </PicodashProvider>
  )
}`

const panelSource = `import {
  createPicodashPanelStore,
  PicodashPanel,
} from '@picodash/panel'

const settingsStore = createPicodashPanelStore({
  panelId: 'settings',
  initialValues: { quality: 'balanced' },
})

export function SettingsPanel() {
  return (
    <PicodashPanel
      collapsible
      store={settingsStore}
      title="Settings"
      width={360}
    >
      {/* PicodashGroup and items go here. */}
    </PicodashPanel>
  )
}`

const groupSource = `import {
  PicodashGroup,
  PicodashSelect,
  PicodashSlider,
  PicodashSwitch,
} from '@picodash/panel'

<PicodashGroup
  collapsible
  id="appearance"
  label="Appearance"
  pin="start"
>
  <PicodashSlider
    field="opacity"
    label="Opacity"
    defaultValue={1}
    min={0}
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
    ]}
  />
</PicodashGroup>`

const actionMenuSource = `import {
  ActionMenuItem,
  ActionMenuSeparator,
  CopySubmenu,
  ExportSubmenu,
  PicodashPanel,
} from '@picodash/panel'

<PicodashPanel
  actionMenu={[
    <ActionMenuItem
      key="refresh"
      label="Refresh data"
      onAction={() => refreshData()}
    />,
    <ActionMenuSeparator key="separator" />,
    <CopySubmenu key="copy" />,
    <ExportSubmenu key="export" />,
  ]}
  store={settingsStore}
  title="Settings"
/>`

const compositionSource = `import {
  createPicodashPanelStore,
  PicodashGroup,
  PicodashPanel,
  PicodashProvider,
  PicodashSlider,
  PicodashSwitch,
} from '@picodash/panel'
import '@picodash/panel/style.css'

const panelStore = createPicodashPanelStore({
  panelId: 'display-settings',
  initialValues: { opacity: 1, showGrid: true },
})

export function DisplaySettings() {
  return (
    <PicodashProvider theme="system" persistLayout>
      <PicodashPanel
        collapsible
        store={panelStore}
        title="Display settings"
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
        </PicodashGroup>
      </PicodashPanel>
    </PicodashProvider>
  )
}`

const guideLinks = [
  { href: '#components-provider', label: 'PicodashProvider' },
  { href: '#components-panel', label: 'PicodashPanel' },
  { href: '#components-groups', label: 'PicodashGroup' },
  { href: '#components-actions', label: 'Action menus' },
  { href: '#components-compose', label: 'Put it together' },
] as const

export function ComponentsGuide() {
  return (
    <HomeFrame activeTab="usage" toolbar={<HomeTextToolbar />}>
      <HomeContent data-components-guide>
        <GuidePanelLayout
          ariaLabel="Components guide"
          items={guideLinks}
          panelId="components-navigation"
          title="Components"
        >
          <article className="min-w-0" data-components-article>
            <header className="border-b border-white/10 pb-8">
              <p className="font-mono text-[11px] tracking-widest text-amber-200 uppercase">
                Usage / Components
              </p>
              <h1 className="mt-2 text-2xl font-medium tracking-tight text-zinc-50 sm:text-3xl">
                Compose Picodash components
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
                Build a panel from one provider, one or more panels, collapsible groups, and an
                action menu. These components own layout, accessibility, persistence, and theme
                carriers so your application can focus on its settings and actions.
              </p>
            </header>

            <div className="divide-y divide-white/10">
              <GuideSection
                id="components-provider"
                number="01"
                title="PicodashProvider sets the integration boundary"
              >
                <p>
                  Render one provider around the page that owns your panels. It resolves the active
                  theme, registers panels, coordinates z-order, and optionally persists placement.
                  Use <Code>panelBoundary</Code> for a shared working area and{' '}
                  <Code>portalContainer</Code> when overlays or panels should render into a
                  particular element.
                </p>
                <GuideCodeBlock label="app-shell.tsx" source={providerSource} />
                <GuideCallout>
                  <Code>theme="system"</Code> follows the operating system and reacts to color
                  scheme changes. Named themes can be supplied with a typed provider such as{' '}
                  <Code>PicodashProvider&lt;'brand' | 'contrast'&gt;</Code>.
                </GuideCallout>
              </GuideSection>

              <GuideSection
                id="components-panel"
                number="02"
                title="PicodashPanel owns a movable surface"
              >
                <p>
                  A panel is the compositional surface for groups and items. Prefer an external{' '}
                  <Code>createPicodashPanelStore</Code> when application code also reads or writes
                  the values. For an isolated panel, use its <Code>id</Code> with{' '}
                  <Code>initialValues</Code> instead.
                </p>
                <GuideCodeBlock label="settings-panel.tsx" source={panelSource} />
                <ul className="grid gap-2 text-sm leading-6 text-zinc-300">
                  <ChecklistItem>
                    Use <Code>defaultPlacement</Code>, <Code>placementOptions</Code>, and{' '}
                    <Code>boundary</Code> to control geometry.
                  </ChecklistItem>
                  <ChecklistItem>
                    Use <Code>defaultVisible</Code>, <Code>collapsible</Code>, and{' '}
                    <Code>close</Code> for lifecycle behavior.
                  </ChecklistItem>
                  <ChecklistItem>
                    Use <Code>theme</Code> for a panel-specific theme carrier inside the provider.
                  </ChecklistItem>
                </ul>
              </GuideSection>

              <GuideSection
                id="components-groups"
                number="03"
                title="PicodashGroup organizes related controls"
              >
                <p>
                  Groups provide disclosure, ordering, pinning, visibility, and status for a set of
                  items. Treat every group <Code>id</Code> as a stable identity; persisted
                  disclosure and reorder state use it to recognize the same group after reload.
                  “Groups” in the plural refers to composing several <Code>PicodashGroup</Code>{' '}
                  components in one panel.
                </p>
                <GuideCodeBlock label="appearance-group.tsx" source={groupSource} />
                <GuideCallout>
                  Set <Code>pin="start"</Code> or <Code>pin="end"</Code> for controls that should
                  stay outside the auto-scrolling lane. Set <Code>reorderable={'{false}'}</Code> for
                  a fixed group order.
                </GuideCallout>
              </GuideSection>

              <GuideSection
                id="components-actions"
                number="04"
                title="Action menus expose panel operations"
              >
                <p>
                  The <Code>actionMenu</Code> prop accepts the built-in menu, no menu, a list of
                  action rows, or an <Code>ActionSubmenu</Code> root. Rows compose the public{' '}
                  <Code>ActionMenuItem</Code>, <Code>ActionMenuSeparator</Code>,{' '}
                  <Code>CopySubmenu</Code>, and <Code>ExportSubmenu</Code> components.
                </p>
                <GuideCodeBlock label="panel-actions.tsx" source={actionMenuSource} />
                <div className="grid gap-2 text-sm leading-6 text-zinc-300">
                  <ChecklistItem>
                    Omit <Code>actionMenu</Code> for the default copy, export, import, reset, and
                    group actions.
                  </ChecklistItem>
                  <ChecklistItem>
                    Pass <Code>false</Code> to hide the menu entirely.
                  </ChecklistItem>
                  <ChecklistItem>
                    Pass an <Code>ActionSubmenu</Code> to replace the trigger and root menu
                    together; nested submenus inherit the parent overlay.
                  </ChecklistItem>
                </div>
              </GuideSection>

              <GuideSection
                id="components-compose"
                number="05"
                title="Put the composition together"
              >
                <p>
                  Keep the provider and store stable, then compose the panel tree directly in your
                  application. Items connect to values by their <Code>field</Code> names; the
                  provider owns panel visibility, placement, activation, and layout persistence.
                </p>
                <GuideCodeBlock label="display-settings.tsx" source={compositionSource} />
                <GuideCallout>
                  Add <Code>@picodash/panel/style.css</Code> once at the application root. Custom
                  dashlets can then use the same <Code>@picodash/panel/ui</Code> primitives and{' '}
                  <Code>--picodash-*</Code> semantic tokens as built-in surfaces.
                </GuideCallout>
              </GuideSection>
            </div>
          </article>
        </GuidePanelLayout>
      </HomeContent>
    </HomeFrame>
  )
}

function GuideSection({
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
    <section className="scroll-mt-24 py-9 first:pt-8 sm:scroll-mt-14" id={id}>
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

function GuideCodeBlock({ label, source }: { label: string; source: string }) {
  const [copyStatus, setCopyStatus] = useState<'copied' | 'error' | 'idle'>('idle')
  const highlightedSource = hljs.highlight(source, { language: 'typescript' }).value

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

function GuideCallout({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-l-2 border-amber-200/50 bg-amber-200/5 px-3 py-2.5 text-xs leading-5 text-amber-50">
      {children}
    </p>
  )
}

function ChecklistItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <Check aria-hidden="true" className="mt-1.5 size-3 shrink-0 text-emerald-300" />
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
