import { z } from 'zod'
import {
  panelDockedPositionValues,
  panelHybridDockPositionValues,
  panelHybridSnapPositionValues,
  panelSnappedPositionValues,
} from './panel-persistence-values.js'

const pointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
})

const freeDispositionSchema = z.object({ kind: z.literal('free') })
const snappedDispositionSchema = z.object({
  kind: z.literal('snapped'),
  position: z.enum(panelSnappedPositionValues),
})
const dockedDispositionSchema = z.object({
  kind: z.literal('docked'),
  position: z.enum(panelDockedPositionValues),
})

const panelPositionSchema = z.object({
  placement: z.discriminatedUnion('mode', [
    z.object({
      disposition: z.union([freeDispositionSchema, snappedDispositionSchema]),
      mode: z.literal('floating'),
    }),
    z.object({
      disposition: dockedDispositionSchema,
      mode: z.literal('fixed'),
    }),
    z.object({
      disposition: z.union([
        freeDispositionSchema,
        z.object({
          kind: z.literal('snapped'),
          position: z.enum(panelHybridSnapPositionValues),
        }),
        z.object({
          kind: z.literal('docked'),
          position: z.enum(panelHybridDockPositionValues),
        }),
      ]),
      mode: z.literal('hybrid'),
    }),
  ]),
  preferredCoordinates: pointSchema,
})

export const picodashPersistedStateSchema = z.object({
  panelLayouts: z.record(z.string(), panelPositionSchema).default({}),
})
