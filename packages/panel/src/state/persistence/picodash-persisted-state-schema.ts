import { z } from 'zod'
import {
  panelDockHorizontalValues,
  panelDockVerticalValues,
  panelFixedPositionValues,
  panelFloatingPositionValues,
  panelMagneticPositionValues,
} from './panel-persistence-values.js'

const panelPositionSchema = z.object({
  dock: z
    .object({
      horizontal: z.enum(panelDockHorizontalValues).optional(),
      vertical: z.enum(panelDockVerticalValues).optional(),
    })
    .nullable()
    .default(null),
  placement: z
    .discriminatedUnion('mode', [
      z.object({
        mode: z.literal('floating'),
        position: z.enum(panelFloatingPositionValues).optional(),
      }),
      z.object({
        mode: z.literal('magnetic'),
        position: z.enum(panelMagneticPositionValues),
      }),
      z.object({
        mode: z.literal('fixed'),
        position: z.enum(panelFixedPositionValues),
      }),
    ])
    .optional(),
  x: z.number().finite(),
  y: z.number().finite(),
})

export const picodashPersistedStateSchema = z.object({
  panelLayouts: z.record(z.string(), panelPositionSchema).default({}),
})
