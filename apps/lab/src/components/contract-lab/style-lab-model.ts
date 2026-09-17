import type {
  PicodashDevBridgeDisclosure,
  PicodashDevBridgePermissions,
} from '@picodash/dev-bridge'

type Choice = 'Option A' | 'Option B' | 'Option C'

interface StyleLabValues {
  search: string
  text: string
  number: number
  switchValue: boolean
  slider: number
  range: { start: number; end: number }
  display: string
  meter: number
  progress: number
  status: 'ready' | 'syncing' | 'attention'
  checkbox: boolean
  radioGroup: Choice
  combobox: Choice
  select: Choice
  segmented: Choice
  checkboxGroup: readonly Choice[]
  multiSelect: readonly Choice[]
  color: string
  date: string
  time: string
  dateTime: string
  dateRange: { start: string; end: string }
}

type StyleLabFields = {
  readonly [Key in keyof StyleLabValues]: {
    readonly defaultValue: StyleLabValues[Key]
  }
}

export const styleLabFields: StyleLabFields = {
  search: { defaultValue: '' },
  text: { defaultValue: 'Text' },
  number: { defaultValue: 1.234567 },
  switchValue: { defaultValue: true },
  slider: { defaultValue: 48 },
  range: { defaultValue: { start: 24, end: 76 } },
  display: { defaultValue: 'Display value' },
  meter: { defaultValue: 64 },
  progress: { defaultValue: 82 },
  status: { defaultValue: 'ready' },
  checkbox: { defaultValue: false },
  radioGroup: { defaultValue: 'Option B' },
  combobox: { defaultValue: 'Option B' },
  select: { defaultValue: 'Option B' },
  segmented: { defaultValue: 'Option B' },
  checkboxGroup: { defaultValue: ['Option A', 'Option B'] },
  multiSelect: { defaultValue: ['Option A', 'Option B'] },
  color: { defaultValue: 'rgba(125, 211, 252, 0.5)' },
  date: { defaultValue: '2026-08-20' },
  time: { defaultValue: '09:30' },
  dateTime: { defaultValue: '2026-08-20T09:30:00+08:00' },
  dateRange: { defaultValue: { start: '2026-08-18', end: '2026-08-24' } },
}

export const styleLabBridgeDisclosure: PicodashDevBridgeDisclosure = {
  valueFields: ['switchValue', 'number'],
  scopeIds: [],
  diagnostics: false,
}
export const styleLabBridgePermissions: PicodashDevBridgePermissions = {
  writableFields: ['number'],
}
