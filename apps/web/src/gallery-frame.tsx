'use client'

import { useRouter } from 'next/navigation'
import type { CSSProperties, ReactNode } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@picodash/panel/ui'
import { useDemoContext } from '@/demo-provider'

export type GalleryTab = 'code' | 'more-examples' | 'store' | 'usage'

export function GalleryFrame({
  activeTab,
  children,
  toolbar,
}: {
  activeTab: GalleryTab
  children: ReactNode
  toolbar: ReactNode
}) {
  const router = useRouter()
  const { builtInExampleConfig } = useDemoContext()

  return (
    <section
      className="relative min-h-svh overflow-x-hidden px-4 pt-18 pb-5 sm:px-6 sm:py-5 lg:py-8 lg:pr-[calc(var(--demo-panel-width)+3rem)] lg:pl-8 min-[141rem]:px-8"
      data-interactive-jsx-example
      style={{ '--demo-panel-width': `${builtInExampleConfig.panelWidth}px` } as CSSProperties}
    >
      <div className="grid max-w-6xl min-w-0 gap-5 min-[141rem]:mx-auto">
        <Tabs
          className="min-w-0 gap-0 overflow-hidden border border-white/12 bg-zinc-950/78 shadow-2xl shadow-black/35 backdrop-blur-xl"
          data-interactive-tabs
          selectedKey={activeTab}
          onSelectionChange={(key) =>
            router.push(withCurrentSearch(pathForGalleryTab(String(key))))
          }
        >
          <div className="flex flex-col gap-2 border-b border-white/10 bg-white/4 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <TabsList
              aria-label="Interactive example views"
              className="h-7 gap-2 rounded-none p-0 sm:gap-4"
              variant="line"
            >
              <TabsTrigger
                className="h-7 flex-none rounded-none px-0 font-mono text-[10px] text-zinc-400 data-selected:text-cyan-200 sm:text-xs"
                id="code"
              >
                <span className="size-2 bg-cyan-300" />
                Code
              </TabsTrigger>
              <TabsTrigger
                className="h-7 flex-none rounded-none px-0 font-mono text-[10px] text-zinc-400 data-selected:text-violet-200 sm:text-xs"
                id="store"
              >
                <span className="size-2 bg-violet-300" />
                Store
              </TabsTrigger>
              <TabsTrigger
                className="h-7 flex-none rounded-none px-0 font-mono text-[10px] text-zinc-400 data-selected:text-amber-200 sm:text-xs"
                id="usage"
              >
                <span className="size-2 bg-amber-200" />
                Usage
              </TabsTrigger>
              <TabsTrigger
                className="h-7 flex-none rounded-none px-0 font-mono text-[10px] text-zinc-400 data-selected:text-amber-200 sm:text-xs"
                id="more-examples"
              >
                <span className="size-2 bg-amber-200" />
                More examples
              </TabsTrigger>
            </TabsList>
            {toolbar}
          </div>

          <TabsContent className="min-h-0" id={activeTab}>
            {children}
          </TabsContent>
        </Tabs>
      </div>
    </section>
  )
}

export function GalleryTextToolbar() {
  return (
    <span className="self-end font-mono text-[11px] text-zinc-500 sm:self-auto">
      React + TypeScript
    </span>
  )
}

function pathForGalleryTab(tab: string) {
  switch (tab) {
    case 'store':
      return '/store'
    case 'usage':
      return '/usage'
    case 'more-examples':
      return '/more-examples'
    default:
      return '/'
  }
}

function withCurrentSearch(pathname: string) {
  return `${pathname}${window.location.search}`
}
