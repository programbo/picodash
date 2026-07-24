'use client'

import { useMemo } from 'react'
import { darkStyles, JsonView } from 'react-json-view-lite'
import 'react-json-view-lite/dist/index.css'
import { usePicodashPanelStoreSelector } from '@picodash/panel'
import type { PicodashPanelState } from '@picodash/panel/advanced'
import { builtInItemsPanelStore } from '@/components/items/built-in/built-in-items-panel'
import { HomeFrame } from '@/components/home/home-frame'

export function HomeStore() {
  const panelState = usePicodashPanelStoreSelector(builtInItemsPanelStore, (state) => state)
  const panelStoreSnapshot = useMemo(() => snapshotForDisplay(panelState), [panelState])

  return (
    <HomeFrame
      activeTab="store"
      toolbar={
        <span className="flex items-center gap-2 self-end font-mono text-[11px] text-zinc-400 sm:self-auto">
          <span className="size-1.5 animate-pulse bg-emerald-300 motion-reduce:animate-none" />
          Live panel state
        </span>
      }
    >
      <div
        aria-label="Live Built-in Items panel store"
        className="max-h-[calc(100svh-15rem)] min-w-0 overflow-auto p-4 sm:p-5"
        data-live-store-viewer
      >
        <JsonView
          aria-label="Collapsible live panel state"
          clickToExpandNode
          data={panelStoreSnapshot}
          shouldExpandNode={expandStoreNode}
          style={storeJsonStyles}
        />
      </div>
    </HomeFrame>
  )
}

function snapshotForDisplay(state: PicodashPanelState) {
  return {
    panelId: state.panelId,
    values: state.values,
    meta: state.meta,
    order: state.order,
    collapsedGroups: state.collapsedGroups,
    fields: state.fields,
    items: Object.fromEntries(
      Object.entries(state.items).map(([id, item]) => [
        id,
        {
          id: item.id,
          kind: item.kind,
          field: item.field,
          label: item.label,
          parentId: item.parentId,
          pin: item.pin,
          reorderable: item.reorderable,
          hidden: item.hidden,
          collapsible: item.collapsible,
          defaultCollapsed: item.defaultCollapsed,
          valueMode: item.valueMode,
        },
      ]),
    ),
    interaction: state.interaction,
    repairProposal: state.repairProposal,
  }
}

const expandStoreNode = (level: number) => level < 2

const storeJsonStyles = {
  ...darkStyles,
  container: `${darkStyles.container} min-w-max bg-transparent! font-mono text-xs leading-5`,
  label: `${darkStyles.label} text-sky-200!`,
  clickableLabel: `${darkStyles.clickableLabel} rounded-sm outline-none hover:bg-white/6 focus-visible:ring-2 focus-visible:ring-violet-300/60`,
  childFieldsContainer: `${darkStyles.childFieldsContainer} ml-1 border-l border-white/8 pl-3`,
  stringValue: `${darkStyles.stringValue} text-amber-200!`,
  numberValue: `${darkStyles.numberValue} text-rose-200!`,
  booleanValue: `${darkStyles.booleanValue} text-violet-200!`,
  nullValue: `${darkStyles.nullValue} text-zinc-500!`,
  punctuation: `${darkStyles.punctuation} text-zinc-500!`,
  expandIcon: `${darkStyles.expandIcon} text-violet-300!`,
  collapseIcon: `${darkStyles.collapseIcon} text-violet-300!`,
  collapsedContent: `${darkStyles.collapsedContent} text-zinc-500!`,
}
