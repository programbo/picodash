'use client'

import Link from 'next/link'
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from 'react'
import { useDemoContext } from '@/components/providers/demo-provider'
import { cn } from '@/lib/utils'

export type HomeTab = 'code' | 'more-examples' | 'store' | 'themes' | 'usage'

const productNavigation = [
  {
    color: 'bg-cyan-300',
    href: '/',
    label: 'Product',
  },
  {
    color: 'bg-violet-300',
    href: '/docs/get-started/agent',
    label: 'Agent guide',
  },
  {
    color: 'bg-amber-200',
    href: '/docs/reference/dashlet-components',
    label: 'Components',
  },
  {
    color: 'bg-emerald-300',
    href: '/examples',
    label: 'Examples',
  },
] as const satisfies readonly {
  color: string
  href: string
  label: string
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

  return (
    <section
      className="relative min-h-svh overflow-x-clip px-4 pt-18 pb-18 sm:px-6 sm:py-5 lg:py-8 lg:pr-[calc(var(--demo-panel-width)+3rem)] lg:pl-8 min-[141rem]:px-8"
      data-interactive-jsx-example
      style={{ '--demo-panel-width': `${builtInExampleConfig.panelWidth}px` } as CSSProperties}
    >
      <div className="grid max-w-6xl min-w-0 gap-5 min-[141rem]:mx-auto">
        <div
          className="min-w-0 gap-0 overflow-clip border border-white/12 bg-zinc-950/78 shadow-2xl shadow-black/35"
          data-active-view={activeTab}
        >
          <div
            className="sticky top-0 z-auto flex flex-col gap-2 border-b border-white/10 bg-transparent px-4 py-2.5 shadow-[0_10px_28px_0_rgba(0,0,0,0.22)] backdrop-blur-xl sm:z-10 sm:flex-row sm:items-center sm:justify-between"
            data-home-toolbar
          >
            <nav
              aria-label="Product"
              className="flex h-7 max-w-full min-w-0 scrollbar-thin gap-3 overflow-x-auto overflow-y-visible font-mono text-[10px] sm:gap-5 sm:text-xs"
            >
              {productNavigation.map((item) => (
                <Link
                  key={item.href}
                  className="inline-flex h-7 flex-none items-center gap-2 text-zinc-400 transition-colors hover:text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-300"
                  href={item.href}
                >
                  <span aria-hidden="true" className={`size-2 ${item.color}`} />
                  {item.label}
                </Link>
              ))}
            </nav>
            {toolbar}
          </div>

          <div className="min-h-0 min-w-0">{children}</div>
        </div>
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
