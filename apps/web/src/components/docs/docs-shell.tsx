import Link from 'next/link'
import type { ReactNode } from 'react'

import { PicodashLogo } from '@/components/brand/picodash-logo'

import { docsTopNavSections } from '@/components/docs/docs-content'

export function DocsShell({
  children,
  description,
  title,
  withProductRoute = false,
}: {
  children: ReactNode
  description?: string
  title: string
  withProductRoute?: boolean
}) {
  return (
    <div
      className="min-h-screen bg-zinc-950 text-zinc-100"
      data-product-route={withProductRoute ? 'docs' : undefined}
    >
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
          <span className="text-sm text-zinc-400">Documentation</span>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[16rem_minmax(0,1fr)] md:px-8 md:py-10">
        <aside className="border-b border-zinc-800 px-5 py-7 md:border-r md:border-b-0 md:py-10">
          <nav aria-label="Documentation">
            <ul className="grid gap-7 sm:grid-cols-2 md:grid-cols-1">
              {docsTopNavSections.map((section) => (
                <li key={section.label}>
                  <h2 className="mb-2 text-sm font-semibold text-zinc-100">{section.label}</h2>
                  <ul className="grid gap-2">
                    {section.items.map((item) => (
                      <li key={item.href}>
                        <a
                          className="group block rounded-sm border border-transparent p-2 text-sm leading-6 text-zinc-400 transition hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-100 focus-visible:border-zinc-700 focus-visible:bg-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
                          href={item.href}
                        >
                          <span className="text-zinc-100 group-hover:text-zinc-50">
                            {item.label}
                          </span>
                          <p className="mt-1 text-[11px] leading-4 text-zinc-500">
                            {item.description}
                          </p>
                        </a>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <main className="min-w-0 px-5 py-10 sm:px-8 md:px-0">
          <article className="prose prose-invert prose-zinc prose-headings:scroll-mt-8 prose-a:text-zinc-100 prose-li:my-0 prose-p:text-zinc-300 max-w-3xl">
            <header className="mb-8 border-b border-zinc-800 pb-6">
              <p className="text-sm text-zinc-400">Picodash documentation</p>
              <h1 className="mt-1 text-3xl font-medium tracking-tight text-zinc-100">{title}</h1>
              {description ? (
                <p className="mt-2 max-w-2xl text-sm text-zinc-400">{description}</p>
              ) : null}
            </header>
            {children}
          </article>
        </main>
      </div>
    </div>
  )
}

export function DocsCodeBlock({ label, source }: { label: string; source: string }) {
  return (
    <div className="mt-3 border border-zinc-800 bg-black/40">
      <div className="border-b border-zinc-800 px-3 py-2 font-mono text-xs text-zinc-500">
        {label}
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-6 text-zinc-200 sm:p-4">
        <code className="block min-w-max font-mono break-words whitespace-pre-wrap">{source}</code>
      </pre>
    </div>
  )
}
