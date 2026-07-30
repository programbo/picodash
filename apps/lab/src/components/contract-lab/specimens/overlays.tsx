'use client'

import { createPicodashStore, type PicodashStore } from '@picodash/store'
import { PicodashItem, PicodashPanel, PicodashSelect } from '@picodash/panel'
import * as Dashlet from '@picodash/panel/dashlet'
import {
  Button,
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Tooltip,
  TooltipTrigger,
} from '@picodash/panel/ui'

type OverlayValues = {
  themeCarrier: 'nearest-theme' | 'panel-override'
}

export function createOverlayStore() {
  return createPicodashStore<OverlayValues>({
    fields: {
      themeCarrier: { defaultValue: 'nearest-theme' },
    },
    panelId: 'contract-overlays-primary',
  })
}

export function OverlaySpecimen({ store }: { readonly store: PicodashStore<OverlayValues> }) {
  return (
    <PicodashPanel
      close
      collapsible
      data-contract-lab-primary-panel
      defaultPlacement={{
        disposition: { kind: 'snapped', position: 'top-right' },
        mode: 'floating',
      }}
      store={store}
      title="Overlay Contract"
      width={330}
    >
      <PicodashSelect
        field={store.fields.themeCarrier}
        label="Portaled select"
        options={[
          { label: 'Nearest theme', value: 'nearest-theme' },
          { label: 'Panel override', value: 'panel-override' },
        ]}
      />
      <PicodashItem id="overlay-probes" label="Layer probes" contentLayout="full">
        <Dashlet.Frame>
          <Dashlet.Description>
            These package-owned overlays share the Panel portal, z-index, dismissal, focus, and
            theme contracts.
          </Dashlet.Description>
          <Dashlet.Toolbar>
            <Tooltip>
              <TooltipTrigger>
                <Button size="sm" variant="outline">
                  Hover tooltip
                </Button>
              </TooltipTrigger>
            </Tooltip>
            <DialogTrigger>
              <Button size="sm" variant="outline">
                Open confirmation dialog
              </Button>
              <Dialog>
                <DialogHeader>
                  <DialogTitle>Overlay contract</DialogTitle>
                  <DialogDescription>
                    Focus, dismissal, stacking, and inherited theme remain observable.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose>Dismiss</DialogClose>
                </DialogFooter>
              </Dialog>
            </DialogTrigger>
          </Dashlet.Toolbar>
        </Dashlet.Frame>
      </PicodashItem>
    </PicodashPanel>
  )
}
