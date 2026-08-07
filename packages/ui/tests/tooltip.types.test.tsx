import type { ReactElement } from 'react'
import { describe, it } from 'vite-plus/test'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  type TooltipContentProps,
  type TooltipProps,
  type TooltipProviderProps,
  type TooltipTriggerProps,
} from '../src/index.tsx'

describe('@picodash/ui Tooltip types', () => {
  it('accepts the exact public surface and rejects retired props', () => {
    const trigger: ReactElement = <button type="button">Help</button>
    const providerProps: TooltipProviderProps = { children: null }
    const tooltipProps: TooltipProps = { children: null }
    const triggerProps: TooltipTriggerProps = { children: trigger }
    const contentProps: TooltipContentProps = { children: null }

    void Tooltip
    void TooltipProvider
    void TooltipTrigger
    void TooltipContent
    void providerProps
    void tooltipProps
    void triggerProps
    void contentProps

    // @ts-expect-error TooltipTrigger is wrapperless and accepts one ReactElement only.
    const invalidTrigger: TooltipTriggerProps = { children: 'Help' }
    void invalidTrigger

    // @ts-expect-error Retired Radix-style delayDuration is not part of the contract.
    const invalidTooltip: TooltipProps = { children: null, delayDuration: 10 }
    void invalidTooltip

    const invalidContent: TooltipContentProps = {
      children: null,
      // @ts-expect-error The unstable React Aria portal prop is intentionally omitted.
      UNSTABLE_portalContainer: null as unknown as HTMLElement,
    }
    void invalidContent
  })
})
