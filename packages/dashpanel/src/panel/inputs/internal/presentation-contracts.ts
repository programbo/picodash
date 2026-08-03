import type { PicodashPresentationContract } from '@picodash/store'
import type { PicodashValue } from '../../state/panel/picodash-panel-types.js'
import type { PicodashDropzoneValue } from '../dropzone.js'
import type { PicodashGradientValue } from '../gradient.js'
import type { PicodashRangeValue } from '../range.js'
import type { PicodashVector3Value } from '../vector3.js'
import type { PicodashXYValue } from '../xy-pad.js'

function presentation<TValue>(
  component: string,
  id: string,
  accepts: PicodashPresentationContract<TValue>['accepts'],
): PicodashPresentationContract<TValue> {
  return Object.freeze({
    accepts: Object.freeze(accepts),
    component: `@picodash/dashpanel/${component}`,
    id: `${id}:v1`,
  }) as PicodashPresentationContract<TValue>
}

export function picodashPresentationForValue<TValue extends PicodashValue>(
  component: string,
  id: string,
  value: TValue | undefined,
): PicodashPresentationContract<TValue> {
  const accepts =
    typeof value === 'boolean'
      ? { kind: 'boolean' as const }
      : typeof value === 'number'
        ? { finite: true, kind: 'number' as const }
        : typeof value === 'string'
          ? { kind: 'string' as const }
          : value === null
            ? { kind: 'null' as const }
            : Array.isArray(value)
              ? { kind: 'array' as const }
              : { kind: 'object' as const }
  return presentation(component, id, accepts as PicodashPresentationContract<TValue>['accepts'])
}

export const picodashBooleanPresentation = presentation<boolean>('Switch', 'switch:boolean', {
  kind: 'boolean',
})

export const picodashNumberPresentation = presentation<number>('Number', 'number:finite', {
  finite: true,
  kind: 'number',
})

export const picodashSliderPresentation = presentation<number>('Slider', 'slider:finite', {
  finite: true,
  kind: 'number',
})

export const picodashStringPresentation = presentation<string>('Text', 'text:string', {
  kind: 'string',
})

export const picodashSelectPresentation = presentation<string>('Select', 'select:string', {
  kind: 'string',
})

export const picodashSegmentedPresentation = presentation<string>('Segmented', 'segmented:string', {
  kind: 'string',
})

export const picodashRangePresentation = presentation<PicodashRangeValue>(
  'Range',
  'range:tuple-2',
  { kind: 'tuple', length: 2 },
)

export const picodashVector3Presentation = presentation<PicodashVector3Value>(
  'Vector3',
  'vector3:object',
  { kind: 'object' },
)

export const picodashXYPresentation = presentation<PicodashXYValue>('XYPad', 'xy-pad:object', {
  kind: 'object',
})

export const picodashGradientPresentation = presentation<PicodashGradientValue>(
  'Gradient',
  'gradient:array',
  { kind: 'array' },
)

export const picodashDropzonePresentation = presentation<PicodashDropzoneValue>(
  'Dropzone',
  'dropzone:array',
  { kind: 'array' },
)

export const picodashMediaPresentation = presentation<string>(
  'MediaPreview',
  'media-preview:string',
  { allowUnset: true, kind: 'string' },
)
