'use client'

import { Dialog, DialogTrigger, OverlayArrow } from 'react-aria-components'
import {
  Button,
  Popover,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  PicodashOverlayProvider,
} from '@picodash/ui'

/** Shared help primitives exercised over the surrounding live controls. */
export function HelpOverlayLab() {
  return (
    <div className="flex flex-wrap gap-2" data-contract-lab-help-overlays>
      <PicodashOverlayProvider layerBase={400}>
        <Tooltip>
          <TooltipTrigger>
            <Button aria-label="Help summary">Summary</Button>
          </TooltipTrigger>
          <TooltipContent placement="bottom">
            Readouts display the canonical value. Formatting changes its presentation without
            writing a new value.
          </TooltipContent>
        </Tooltip>
      </PicodashOverlayProvider>
      {['Precision', 'Range'].map((name) => (
        <DialogTrigger key={name}>
          <Button aria-label={`Help ${name}`}>{name}</Button>
          <Popover variant="help" placement="top" aria-label={`Help ${name}`}>
            <OverlayArrow className="pointer-events-none h-[calc(var(--picodash-space-2-5)*0.75)] w-[calc(var(--picodash-space-2-5)*1.5)] data-[placement=bottom]:[&>svg]:rotate-180">
              <svg
                width="15"
                height={7.5}
                viewBox="0 0 12 6"
                className="block size-full overflow-visible fill-[color-mix(in_oklab,var(--picodash-color-surface-raised)_60%,transparent)] stroke-(--picodash-color-border)"
              >
                <path d="M0 0L6 6L12 0" />
              </svg>
            </OverlayArrow>
            <Dialog aria-label={`Help ${name}`} className="space-y-3 outline-none">
              <p>
                <strong>{name === 'Precision' ? 'Display precision' : 'Range limits'}</strong>{' '}
                changes how this readout is presented. The value remains owned by Nexus.
              </p>
              <p>
                {name === 'Precision'
                  ? 'Rounding a number for display does not replace its canonical value. Other bound controls continue to read the original number.'
                  : 'A range can constrain a proposed change. Rejected changes leave the previous canonical value and the other bound controls intact.'}
              </p>
              <p>
                Use the controls behind this explanation to inspect the relationship between the
                displayed number and the canonical value.
              </p>
            </Dialog>
          </Popover>
        </DialogTrigger>
      ))}
    </div>
  )
}
