import {
  createPicodashDiagnostic,
  PICODASH_ERROR_CODES,
  type PicodashDiagnostic,
  type PicodashStore,
} from '@picodash/store'

export function createDismissiblePanelWithoutTriggerDiagnostic(
  panelId: string,
): PicodashDiagnostic {
  return createPicodashDiagnostic({
    code: PICODASH_ERROR_CODES.DISMISSIBLE_WITHOUT_TRIGGER,
    correction: 'Render PicodashPanelTrigger or include this panel store in PicodashPanelLauncher.',
    expectedContract: 'Every dismissible panel has a registered reopening affordance.',
    identity: {
      component: '@picodash/dashpanel/PicodashPanel',
      panelId,
    },
    summary: `Dismissible panel "${panelId}" has no registered reopening affordance.`,
  })
}

export function publishDismissiblePanelWithoutTriggerDiagnostic<TValues extends object>(
  store: PicodashStore<TValues>,
): PicodashDiagnostic {
  return store.diagnostics.publish(
    createDismissiblePanelWithoutTriggerDiagnostic(store.getState().panelId),
  )
}
