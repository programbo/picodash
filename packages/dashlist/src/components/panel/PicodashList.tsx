'use client'

import type { ComponentPropsWithoutRef } from 'react'
import type { PicodashStore } from '@picodash/store'
import {
  PicodashThemeContextProvider,
  useResolvedPicodashTheme,
} from '../../lib/theme/picodash-theme-context.js'
import { rootGroupId } from '../../state/order/picodash-order.js'
import { PicodashPanelContextProvider } from '../../state/panel/picodash-panel-context.js'
import { PicodashListScopeProvider } from '../../state/panel/picodash-list-scope-context.js'
import { cn } from '../../utilities/utils.js'
import { TooltipProvider } from '../overlays/Tooltip.js'
import { PicodashReorderList } from './reorder/PicodashReorderList.js'

export interface PicodashListProps<TValues extends object = Record<string, never>> extends Omit<
  ComponentPropsWithoutRef<'div'>,
  'children'
> {
  children?: ComponentPropsWithoutRef<'div'>['children']
  store: PicodashStore<TValues>
  theme?: string
}

/** Renders a configurable Dashlet list without Panel chrome or placement behavior. */
export function PicodashList<TValues extends object>({
  children,
  className,
  store,
  theme: themeProp,
  ...props
}: PicodashListProps<TValues>) {
  const theme = useResolvedPicodashTheme(themeProp)

  return (
    <PicodashThemeContextProvider theme={theme}>
      <PicodashPanelContextProvider store={store}>
        <PicodashListScopeProvider store={store}>
          <div
            {...props}
            className={cn(
              'rounded-picodash-surface border-picodash-border bg-picodash-surface text-picodash-text min-h-0 overflow-hidden border',
              className,
            )}
            data-picodash-list=""
            data-picodash-theme={theme}
          >
            <TooltipProvider>
              <PicodashReorderList className="h-full min-h-0 overflow-auto" parentId={rootGroupId}>
                {children}
              </PicodashReorderList>
            </TooltipProvider>
          </div>
        </PicodashListScopeProvider>
      </PicodashPanelContextProvider>
    </PicodashThemeContextProvider>
  )
}
