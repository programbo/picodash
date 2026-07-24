'use client'

import { useRouter } from 'next/navigation'
import type { CSSProperties, ReactNode } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@picodash/panel/ui'
import { useDemoContext } from '@/components/providers/demo-provider'

export type HomeTab = 'code' | 'more-examples' | 'store' | 'themes' | 'usage'

const homeTabs = [
  {
    color: 'bg-cyan-300',
    href: '/',
    id: 'code',
    label: 'Code',
    selectedClassName: 'data-selected:text-cyan-200',
  },
  {
    color: 'bg-violet-300',
    href: '/store',
    id: 'store',
    label: 'Store',
    selectedClassName: 'data-selected:text-violet-200',
  },
  {
    color: 'bg-amber-200',
    href: '/usage',
    id: 'usage',
    label: 'Usage',
    selectedClassName: 'data-selected:text-amber-200',
  },
  {
    color: 'bg-amber-200',
    href: '/more-examples',
    id: 'more-examples',
    label: 'More examples',
    selectedClassName: 'data-selected:text-amber-200',
  },
  {
    color: 'bg-emerald-300',
    href: '/themes',
    id: 'themes',
    label: 'Themes',
    selectedClassName: 'data-selected:text-emerald-200',
  },
] as const satisfies readonly {
  color: string
  href: string
  id: HomeTab
  label: string
  selectedClassName: string
}[]

export function HomeFrame({
  activeTab,
  children,
  toolbar,
}: {
  activeTab: HomeTab
  children: ReactNode
  toolbar: ReactNode
}) {
  const { builtInExampleConfig } = useDemoContext()
  const router = useRouter()

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
          onSelectionChange={(key) => {
            const tab = homeTabs.find((item) => item.id === key)
            if (tab) router.push(tab.href)
          }}
        >
          <div className="flex flex-col gap-2 border-b border-white/10 bg-white/4 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <TabsList
              aria-label="Interactive example views"
              className="h-7 max-w-full min-w-0 scrollbar-thin gap-2 overflow-x-auto overflow-y-visible rounded-none p-0 sm:gap-4"
              variant="line"
            >
              {homeTabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  className={`h-7 flex-none rounded-none px-0 font-mono text-[10px] text-zinc-400 sm:text-xs ${tab.selectedClassName}`}
                  id={tab.id}
                >
                  <span className={`size-2 ${tab.color}`} />
                  {tab.label}
                </TabsTrigger>
              ))}
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

export function HomeTextToolbar() {
  return (
    <span className="self-end font-mono text-[11px] text-zinc-500 sm:self-auto">
      React + TypeScript
    </span>
  )
}
