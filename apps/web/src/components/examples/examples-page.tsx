'use client'

import Link from 'next/link'
import { ArrowLeft, BookOpen, Boxes } from 'lucide-react'
import { PicodashProvider } from '@picodash/picodash'

import { PicodashLogo } from '@/components/brand/picodash-logo'
import { DeploymentStatusRecipe } from './deployment-status-recipe'
import { MapOverlayRecipe } from './map-overlay-recipe'
import { MediaTransportRecipe } from './media-transport-recipe'
import { PerformanceHealthRecipe } from './performance-health-recipe'

export function ExamplesPage() {
  return (
    <PicodashProvider persistLayout={false} theme="dark">
      <a
        className="fixed top-2 left-2 z-50 -translate-y-16 bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-950 transition-transform focus:translate-y-0 focus:outline-none"
        href="#examples-content"
      >
        Skip to examples
      </a>
      <main
        className="min-h-screen bg-zinc-950 text-zinc-100"
        data-product-route="examples"
        id="examples-content"
      >
        <header className="border-b border-zinc-800">
          <div className="mx-auto flex min-h-14 max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8">
            <Link
              href="/"
              className="group flex items-center gap-2 font-semibold text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-400"
            >
              <PicodashLogo className="h-5 w-auto text-zinc-300 group-hover:text-white" />
              <span>Picodash</span>
            </Link>
            <nav aria-label="Examples">
              <ul className="flex items-center gap-2 text-sm">
                <li>
                  <Link
                    className="inline-flex items-center gap-1.5 px-2 py-1.5 text-zinc-400 hover:text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
                    href="/"
                  >
                    <ArrowLeft aria-hidden="true" className="size-4" />
                    Product
                  </Link>
                </li>
                <li>
                  <Link
                    className="inline-flex items-center gap-1.5 border border-zinc-700 px-3 py-1.5 text-zinc-200 hover:border-zinc-500 hover:bg-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
                    href="/docs/guides/compound-dashlets"
                  >
                    <BookOpen aria-hidden="true" className="size-4" />
                    Build a Dashlet
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
          <section className="grid items-end gap-8 border-b border-zinc-800 pb-10 lg:grid-cols-[minmax(0,1fr)_24rem]">
            <div>
              <div className="mb-5 flex size-10 items-center justify-center border border-violet-300/30 bg-violet-300/10 text-violet-200">
                <Boxes aria-hidden="true" className="size-5" />
              </div>
              <p className="font-mono text-xs tracking-[0.2em] text-violet-300 uppercase">
                Compiled public recipes
              </p>
              <h1 className="mt-3 max-w-4xl text-4xl font-medium tracking-[-0.04em] text-zinc-50 sm:text-6xl">
                Four useful Dashlets.
                <span className="block text-zinc-500">No private shortcuts.</span>
              </h1>
            </div>
            <div className="border-l border-zinc-800 pl-5">
              <p className="text-sm leading-6 text-zinc-300">
                Every example below is rendered from TypeScript against Picodash’s public Store,
                Panel, Dashlet anatomy, and UI exports.
              </p>
              <p className="mt-3 font-mono text-[11px] leading-5 text-zinc-500">
                Interact with each panel, dismiss it, then use its host trigger to restore it.
              </p>
            </div>
          </section>

          <section
            aria-label="Picodash example recipes"
            className="mt-8 grid min-w-0 gap-6 xl:grid-cols-2"
          >
            <PerformanceHealthRecipe />
            <MediaTransportRecipe />
            <DeploymentStatusRecipe />
            <MapOverlayRecipe />
          </section>

          <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-6 text-sm text-zinc-500">
            <p>
              Typed Stores keep application state explicit; compound Dashlets keep behavior
              cohesive.
            </p>
            <Link
              className="text-zinc-300 underline decoration-zinc-700 underline-offset-4 hover:text-white"
              href="/docs/reference/dashlet-components"
            >
              Read the composition reference
            </Link>
          </footer>
        </div>
      </main>
    </PicodashProvider>
  )
}
