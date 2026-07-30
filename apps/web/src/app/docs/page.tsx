import type { Metadata } from 'next'
import Link from 'next/link'
import { PicodashLogo } from '@/components/brand/picodash-logo'

export const metadata: Metadata = {
  title: 'Documentation',
  description: 'Documentation for building control panels with Picodash.',
}

const navigation = [
  {
    label: 'Getting started',
    items: [
      { label: 'Introduction', href: '#introduction' },
      { label: 'Installation', href: '#installation' },
      { label: 'Create a panel', href: '#create-a-panel' },
    ],
  },
  {
    label: 'Core concepts',
    items: [
      { label: 'State ownership', href: '#state-ownership' },
      { label: 'Dashlets', href: '#dashlets' },
      { label: 'Panel placement', href: '#panel-placement' },
    ],
  },
  {
    label: 'Guides',
    items: [
      { label: 'Custom Dashlets', href: '#custom-dashlets' },
      { label: 'Themes', href: '#themes' },
      { label: 'Persistence', href: '#persistence' },
    ],
  },
  {
    label: 'Reference',
    items: [
      { label: 'Components', href: '#components' },
      { label: 'Hooks', href: '#hooks' },
      { label: 'Store API', href: '#store-api' },
      { label: 'CSS tokens', href: '#css-tokens' },
    ],
  },
] as const

const panelExample = `import {
  createPicodashPanelStore,
  PicodashPanel,
  PicodashProvider,
  PicodashSlider,
} from '@picodash/panel'
import '@picodash/panel/style.css'

const settings = createPicodashPanelStore({
  panelId: 'settings',
  initialValues: { opacity: 1 },
})

export function App() {
  return (
    <PicodashProvider>
      <PicodashPanel store={settings} title="Settings">
        <PicodashSlider
          field="opacity"
          label="Opacity"
          defaultValue={1}
          min={0}
          max={1}
          step={0.01}
        />
      </PicodashPanel>
    </PicodashProvider>
  )
}`

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100" data-product-route="docs">
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-5 sm:px-8">
          <Link
            href="/"
            className="group flex items-center gap-2 font-semibold text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-400"
          >
            <PicodashLogo className="h-5 w-auto shrink-0 text-zinc-300 group-hover:text-white sm:h-6" />
            <span>Picodash</span>
          </Link>
          <span className="h-5 border-l border-zinc-700" aria-hidden="true" />
          <span className="text-sm text-zinc-400">Docs</span>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl md:grid-cols-[14rem_minmax(0,1fr)]">
        <aside className="border-b border-zinc-800 px-5 py-7 md:border-r md:border-b-0 md:px-8 md:py-10">
          <nav aria-label="Documentation">
            <ul className="grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-4 md:grid-cols-1">
              {navigation.map((section) => (
                <li key={section.label}>
                  <h2 className="mb-2 text-sm font-semibold text-zinc-100">{section.label}</h2>
                  <ul className="space-y-1.5">
                    {section.items.map((item) => (
                      <li key={item.href}>
                        <a
                          href={item.href}
                          className="block text-sm leading-6 text-zinc-400 hover:text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
                        >
                          {item.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <main className="min-w-0 px-5 py-10 sm:px-8 md:px-12 md:py-14 lg:px-16">
          <article className="prose prose-invert prose-zinc prose-headings:scroll-mt-8 prose-a:text-zinc-100 prose-pre:border prose-pre:border-zinc-800 prose-pre:bg-zinc-900 max-w-3xl">
            <h1 id="introduction">Introduction</h1>
            <p>
              Picodash is a React package for building control panels from composable Dashlets. Your
              application owns panel values, while Picodash manages the panel interface and its
              layout.
            </p>

            <h2 id="installation">Installation</h2>
            <pre>
              <code>bun add @picodash/panel</code>
            </pre>
            <p>
              Import the package stylesheet once near the root of your application. It includes the
              complete light and dark themes.
            </p>
            <pre>
              <code>import &apos;@picodash/panel/style.css&apos;</code>
            </pre>

            <h2 id="create-a-panel">Create a panel</h2>
            <p>
              Create a store for the values your application uses, place the provider near the root
              of the interface, and compose a panel from Dashlets.
            </p>
            <pre>
              <code>{panelExample}</code>
            </pre>

            <h2 id="state-ownership">State ownership</h2>
            <p>
              The panel store is explicit and application-owned. Read values with selectors and use
              them directly in your application. Provider state covers visibility, activation,
              placement, z-order, and optional layout persistence.
            </p>

            <h2 id="dashlets">Dashlets</h2>
            <p>
              A Dashlet is a composable unit inside a panel. Built-in Dashlets cover common inputs
              and visualizations. Custom Dashlets can use the same theme-aware UI primitives.
            </p>

            <h2 id="panel-placement">Panel placement</h2>
            <p>
              Panels can be floating, fixed, or hybrid. Placement can be relative to the viewport, a
              shared provider boundary, or a boundary set on an individual panel.
            </p>

            <hr />

            <h2 id="custom-dashlets">Custom Dashlets</h2>
            <p>
              Explain how to compose application-specific controls and visualizations from the
              public UI primitives.
            </p>

            <h2 id="themes">Themes</h2>
            <p>
              Document the built-in themes, system color-scheme behavior, and the semantic CSS
              tokens used to define custom themes.
            </p>

            <h2 id="persistence">Persistence</h2>
            <p>
              Cover persisted layout, storage keys, canonical placement records, and the boundary
              between persisted layout and transient visibility.
            </p>

            <h2 id="components">Components</h2>
            <p>
              Reference the provider, panel, groups, built-in Dashlets, and action-menu components.
            </p>

            <h2 id="hooks">Hooks</h2>
            <p>Reference panel controls, value selectors, and advanced provider access.</p>

            <h2 id="store-api">Store API</h2>
            <p>Reference store creation, validated writes, subscriptions, and value constraints.</p>

            <h2 id="css-tokens">CSS tokens</h2>
            <p>
              List the semantic color, spacing, radius, and shadow tokens available to consumers.
            </p>
          </article>
        </main>
      </div>
    </div>
  )
}
