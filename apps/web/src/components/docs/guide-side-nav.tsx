'use client'

import {
  createPicodashPanelStore,
  PicodashDisplay,
  PicodashGroup,
  PicodashPanel,
} from '@picodash/panel'
import { useRef, useState, type ReactNode } from 'react'
import { floatingPlacement } from '../../lib/panel-placement'

export type GuideSideNavItem = {
  content?: ReactNode
  description?: ReactNode
  href?: string
  id?: string
  label: string
  meta?: string
  rowLabel?: ReactNode
}

export type GuideSideNavGroup = {
  id: string
  items: readonly GuideSideNavItem[]
  label: string
}

export function GuidePanelLayout({
  ariaLabel,
  children,
  groups,
  items = [],
  panelId,
  title,
}: {
  ariaLabel: string
  children: ReactNode
  groups?: readonly GuideSideNavGroup[]
  items?: readonly GuideSideNavItem[]
  panelId: string
  title: string
}) {
  const boundaryRef = useRef<HTMLDivElement>(null)
  const [store] = useState(() => createPicodashPanelStore({ panelId }))

  return (
    <div className="relative mx-auto max-w-5xl min-w-0">
      <div
        ref={boundaryRef}
        className="pointer-events-none sticky top-18 h-[calc(100dvh-5.5rem)] sm:top-12 sm:h-[calc(100dvh-4rem)]"
        data-guide-navigation-boundary={panelId}
      />
      <PicodashPanel
        actionMenu={false}
        aria-label={ariaLabel}
        boundary={boundaryRef}
        className="max-h-64 lg:max-h-[min(32rem,calc(100dvh-8rem))] [&_[data-picodash-reorder-list]>div]:grid-cols-[auto_minmax(1.5rem,max-content)_minmax(0,1fr)_max-content] [&_[id$=':description']]:text-right"
        data-guide-navigation-panel={panelId}
        defaultPlacement={floatingPlacement('top-left')}
        role="navigation"
        store={store}
        theme="sidenav"
        title={title}
        width={272}
      >
        {groups
          ? groups.map((group, groupIndex) => {
              const indexOffset = groups
                .slice(0, groupIndex)
                .reduce((total, precedingGroup) => total + precedingGroup.items.length, 0)

              return (
                <PicodashGroup
                  key={group.id}
                  id={`${panelId}-${group.id}`}
                  label={group.label}
                  reorderable={false}
                >
                  {renderGuideItems(panelId, group.items, indexOffset)}
                </PicodashGroup>
              )
            })
          : renderGuideItems(panelId, items)}
      </PicodashPanel>

      <div className="-mt-[calc(100dvh-5.5rem)] px-4 pt-72 pb-4 sm:-mt-[calc(100dvh-4rem)] sm:px-6 sm:pt-72 sm:pb-6 lg:p-8">
        <div className="min-w-0 lg:ml-74" data-guide-content={panelId}>
          {children}
        </div>
      </div>
    </div>
  )
}

function renderGuideItems(panelId: string, items: readonly GuideSideNavItem[], indexOffset = 0) {
  return items.map((item, index) => {
    const itemIndex = indexOffset + index

    return (
      <PicodashDisplay
        key={item.id ?? item.href ?? item.label}
        description={item.description}
        id={`${panelId}-${item.id ?? itemIndex + 1}`}
        label={item.rowLabel ?? String(itemIndex + 1).padStart(2, '0')}
        reorderable={false}
        value={
          item.content ?? (
            <a
              className="text-picodash-text hover:text-picodash-strong focus-visible:ring-picodash-focus block min-w-0 truncate whitespace-nowrap transition-colors outline-none focus-visible:ring-2"
              href={item.href}
            >
              <span className="block truncate">{item.label}</span>
              {item.meta ? (
                <span className="text-picodash-muted block truncate font-mono text-[10px]">
                  {item.meta}
                </span>
              ) : null}
            </a>
          )
        }
      />
    )
  })
}
