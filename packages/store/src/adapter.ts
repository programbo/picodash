import type { PicodashValidationSource } from './types.js'

export interface PicodashAdapterWriteContext<TValues extends object> {
  readonly panelId: string
  readonly previousValues: Readonly<TValues>
  readonly source: Exclude<PicodashValidationSource, 'adapter' | 'default' | 'initial'>
}

export interface PicodashValueAdapter<TValues extends object> {
  readonly id?: string
  getSnapshot: () => TValues
  setValues: (
    nextValues: TValues,
    context: PicodashAdapterWriteContext<TValues>,
  ) => boolean | undefined | void
  subscribe: (listener: () => void) => () => void
}
