'use client'

import { useRouter } from 'next/navigation'
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@picodash/panel/ui'
import { useDemoContext } from '@/components/providers/demo-provider'
import { cn } from '@/lib/utils'

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
      className="relative min-h-svh overflow-x-clip px-4 pt-18 pb-18 sm:px-6 sm:py-5 lg:py-8 lg:pr-[calc(var(--demo-panel-width)+3rem)] lg:pl-8 min-[141rem]:px-8"
      data-interactive-jsx-example
      style={{ '--demo-panel-width': `${builtInExampleConfig.panelWidth}px` } as CSSProperties}
    >
      <div className="grid max-w-6xl min-w-0 gap-5 min-[141rem]:mx-auto">
        <Tabs
          className="min-w-0 gap-0 overflow-clip border border-white/12 bg-zinc-950/78 shadow-2xl shadow-black/35"
          data-interactive-tabs
          selectedKey={activeTab}
          onSelectionChange={(key) => {
            const tab = homeTabs.find((item) => item.id === key)
            if (tab) router.push(tab.href)
          }}
        >
          <div
            className="sticky top-0 z-auto flex flex-col gap-2 border-b border-white/10 bg-transparent px-4 py-2.5 shadow-[0_10px_28px_0_rgba(0,0,0,0.22)] backdrop-blur-xl sm:z-10 sm:flex-row sm:items-center sm:justify-between"
            data-home-toolbar
          >
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

export function HomeContent({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <div
      className={cn(
        'min-h-[calc(100dvh-9rem)] min-w-0 sm:min-h-[calc(100dvh-2.5rem)] lg:min-h-[calc(100dvh-4rem)]',
        className,
      )}
      data-home-content
      {...props}
    />
  )
}
