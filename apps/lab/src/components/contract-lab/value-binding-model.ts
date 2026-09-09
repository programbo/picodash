import { createPicodashNexus } from '@picodash/nexus'

export function createValueBindingNexus() {
  return createPicodashNexus({
    valueOwner: 'nexus',
    fields: {
      name: {
        defaultValue: 'Studio',
        validate: (value: string) =>
          value.trim().length > 0 ? [] : [{ message: 'Enter a workspace name.' }],
      },
      interval: {
        defaultValue: 30,
        validate: (value: number) =>
          Number.isFinite(value) && value >= 1 && value <= 60
            ? []
            : [{ message: 'Choose an interval from 1 to 60 seconds.' }],
      },
      enabled: { defaultValue: true },
    },
  })
}

export type ValueBindingNexus = ReturnType<typeof createValueBindingNexus>
