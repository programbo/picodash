'use client'

import { useMemo, type RefObject } from 'react'
import { createPicodashStore } from '@picodash/store'
import { DashGroup, DashList, DashPanel, Dashlet, PicodashProvider } from '@picodash/picodash'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@picodash/picodash/ui'
import type { ContractLabPreset } from '@lab/lib/contract-lab'

export interface ContractLabSpecimenProps {
  readonly boundary: RefObject<HTMLElement | null>
  readonly onCollapsedChange: (collapsed: boolean) => void
  readonly preset: ContractLabPreset
}

export function ContractLabSpecimen({
  boundary,
  onCollapsedChange,
  preset,
}: ContractLabSpecimenProps) {
  const store = useMemo(() => createPicodashStore({ valueOwner: 'store', fields: {} }), [])

  return (
    <PicodashProvider store={store} boundary={boundary} theme="dark">
      <DashPanel
        id="contract-lab-specimen-panel"
        title="Primary Panel"
        collapsible
        onCollapsedChange={onCollapsedChange}
      >
        <DashList aria-label="Primary Panel List">
          <Dashlet id="specimen-summary" label="Specimen summary" layout="full">
            <p className="text-muted-foreground text-sm leading-6">
              The current preset is <strong className="text-foreground">{preset.label}</strong>.
              This specimen renders the accepted Panel and List composition without simulating
              planned behavior.
            </p>
          </Dashlet>
          <DashGroup id="specimen-group" label="Static DashGroup">
            <Dashlet id="specimen-metric" label="Static metric">
              <span className="text-2xl font-semibold" data-contract-lab-static-value>
                24
              </span>
            </Dashlet>
            <Dashlet id="specimen-alert" label="Shared AlertDialog">
              <AlertDialog>
                <AlertDialogTrigger aria-label="Open shared AlertDialog">
                  Open shared AlertDialog
                </AlertDialogTrigger>
                <AlertDialogOverlay>
                  <AlertDialogContent aria-label="Contract Lab confirmation">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Shared AlertDialog</AlertDialogTitle>
                      <AlertDialogDescription>
                        This is the shared UI confirmation primitive.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialogOverlay>
              </AlertDialog>
            </Dashlet>
          </DashGroup>
        </DashList>
      </DashPanel>
    </PicodashProvider>
  )
}
