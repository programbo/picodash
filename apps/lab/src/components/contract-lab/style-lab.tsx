'use client'

import { useMemo, type RefObject } from 'react'
import { createPicodashNexus } from '@picodash/nexus'
import {
  CheckboxDashlet,
  CheckboxGroupDashlet,
  ColorDashlet,
  ComboboxDashlet,
  DashGroup,
  DashList,
  DashPanel,
  DateDashlet,
  DateRangeDashlet,
  DateTimeDashlet,
  DisplayDashlet,
  MeterDashlet,
  MultiSelectDashlet,
  NumberDashlet,
  PicodashProvider,
  ProgressDashlet,
  RadioGroupDashlet,
  RangeDashlet,
  SearchDashlet,
  SegmentedDashlet,
  SelectDashlet,
  SliderDashlet,
  StatusDashlet,
  SwitchDashlet,
  TextDashlet,
  TimeDashlet,
} from '@picodash/picodash'
import type {
  PicodashDevBridgeDisclosure,
  PicodashDevBridgePermissions,
} from '@picodash/dev-bridge'
import { ContractLabDevBridgeConnector } from './dev-bridge-connector'

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

const styleLabFields: StyleLabFields = {
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

const styleLabBridgeDisclosure: PicodashDevBridgeDisclosure = {
  valueFields: ['switchValue', 'number'],
  scopeIds: [],
  diagnostics: false,
}
const styleLabBridgePermissions: PicodashDevBridgePermissions = { writableFields: ['number'] }

export interface DashletStyleLabProps {
  readonly boundary: RefObject<HTMLElement | null>
}

export function DashletStyleLab({ boundary }: DashletStyleLabProps) {
  const nexus = useMemo(
    () =>
      createPicodashNexus({
        valueOwner: 'nexus',
        nexusId: 'dashlet-style-lab',
        schemaVersion: 1,
        fields: styleLabFields,
      }),
    [],
  )

  return (
    <PicodashProvider
      nexus={nexus}
      providerId="dashlet-style-lab-provider"
      boundary={boundary}
      boundaryInset={16}
      layerBase={100}
    >
      <ContractLabDevBridgeConnector
        nexus={nexus}
        registrationId="dashlet-style-lab"
        label="Contract Lab Style Lab"
        disclosure={styleLabBridgeDisclosure}
        permissions={styleLabBridgePermissions}
      />
      <DashPanel
        id="style-lab-basics-panel"
        title="Basics & readout"
        collapsible
        showCloseButton={false}
        width="min(24rem, calc(50dvw - 2.5rem))"
        defaultLayout={{
          placement: {
            mode: 'hybrid',
            disposition: { kind: 'docked', position: 'bottom-right' },
          },
        }}
        data-style-lab-panel="basics-readout"
      >
        <DashList aria-label="Basics and readout Dashlets" reorderable>
          <SearchDashlet
            id="style-lab-search"
            field={nexus.fields.search}
            label="SearchDashlet"
            placeholder="Search"
            pin="start"
            layout="block"
            data-style-lab-lane="start"
          />

          <DashGroup id="style-lab-basics" label="Basics">
            <TextDashlet id="style-lab-text" field={nexus.fields.text} label="TextDashlet" />
            <NumberDashlet
              id="style-lab-number"
              field={nexus.fields.number}
              label="NumberDashlet"
              min={1}
              max={96}
              formatOptions={{ maximumFractionDigits: 3 }}
              help="The displayed value is rounded without changing the canonical number."
            />
            <SliderDashlet
              id="style-lab-slider"
              field={nexus.fields.slider}
              label="SliderDashlet"
              min={0}
              max={100}
              readOnly
              marks={[
                { value: 0, label: '0%' },
                { value: 50, label: '50%' },
                { value: 100, label: '100%' },
              ]}
              formatValue={(value) => `${value}%`}
            />
            <SwitchDashlet
              id="style-lab-switch"
              field={nexus.fields.switchValue}
              label="SwitchDashlet"
            />
            <RangeDashlet
              id="style-lab-range"
              field={nexus.fields.range}
              label="RangeDashlet"
              min={0}
              max={100}
              readOnly
              formatValue={({ start, end }) => `${start}–${end}`}
            />
          </DashGroup>

          <DashGroup id="style-lab-readout" label="Readout">
            <DisplayDashlet
              id="style-lab-display"
              field={nexus.fields.display}
              label="DisplayDashlet"
            />
            <MeterDashlet
              id="style-lab-meter"
              field={nexus.fields.meter}
              label="MeterDashlet"
              min={0}
              max={100}
              formatValue={(value) => `${value}%`}
            />
            <ProgressDashlet
              id="style-lab-progress"
              field={nexus.fields.progress}
              label="ProgressDashlet"
              min={0}
              max={100}
              formatValue={(value) => `${value}%`}
            />
            <StatusDashlet
              id="style-lab-status"
              field={nexus.fields.status}
              label="StatusDashlet"
              options={[
                { value: 'ready', label: 'Ready', tone: 'success' },
                { value: 'syncing', label: 'Syncing', tone: 'info' },
                { value: 'attention', label: 'Needs attention', tone: 'warning' },
              ]}
            />
          </DashGroup>
        </DashList>
      </DashPanel>

      <DashPanel
        id="style-lab-choices-panel"
        title="Choices & temporal"
        collapsible
        showCloseButton={false}
        width="min(24rem, calc(50dvw - 2.5rem))"
        defaultLayout={{
          placement: {
            mode: 'hybrid',
            disposition: { kind: 'docked', position: 'top-right' },
          },
        }}
        data-style-lab-panel="choices-temporal"
      >
        <DashList aria-label="Choices and temporal Dashlets" reorderable>
          <ColorDashlet
            id="style-lab-color"
            field={nexus.fields.color}
            label="ColorDashlet"
            format="rgba"
            layout="block"
            data-style-lab-lane="auto"
          />

          <DashGroup id="style-lab-choices" label="Choices">
            <CheckboxDashlet
              id="style-lab-checkbox"
              field={nexus.fields.checkbox}
              label="CheckboxDashlet"
            />
            <RadioGroupDashlet
              id="style-lab-radio-group"
              field={nexus.fields.radioGroup}
              label="RadioGroupDashlet"
              options={['Option A', 'Option B', 'Option C']}
              orientation="horizontal"
            />
            <ComboboxDashlet
              id="style-lab-combobox"
              field={nexus.fields.combobox}
              label="ComboboxDashlet"
              options={['Option A', 'Option B', 'Option C']}
              placeholder="Select an option"
            />
            <SelectDashlet
              id="style-lab-select"
              field={nexus.fields.select}
              label="SelectDashlet"
              options={['Option A', 'Option B', 'Option C']}
            />
            <SegmentedDashlet
              id="style-lab-segmented"
              field={nexus.fields.segmented}
              label="SegmentedDashlet"
              options={['Option A', 'Option B', 'Option C']}
              layout="block"
            />
            <CheckboxGroupDashlet
              id="style-lab-checkbox-group"
              field={nexus.fields.checkboxGroup}
              label="CheckboxGroupDashlet"
              options={['Option A', 'Option B', 'Option C']}
            />
            <MultiSelectDashlet
              id="style-lab-multi-select"
              field={nexus.fields.multiSelect}
              label="MultiSelectDashlet"
              options={['Option A', 'Option B', 'Option C']}
              placeholder="Select options"
            />
          </DashGroup>

          <DashGroup id="style-lab-temporal" label="Temporal">
            <DateDashlet
              id="style-lab-date"
              field={nexus.fields.date}
              label="DateDashlet"
              locale="en-AU"
            />
            <TimeDashlet
              id="style-lab-time"
              field={nexus.fields.time}
              label="TimeDashlet"
              locale="en-AU"
              hourCycle={24}
            />
            <DateTimeDashlet
              id="style-lab-date-time"
              field={nexus.fields.dateTime}
              label="DateTimeDashlet"
              timeZone="Australia/Perth"
              locale="en-AU"
              hourCycle={24}
            />
            <DateRangeDashlet
              id="style-lab-date-range"
              field={nexus.fields.dateRange}
              label="DateRangeDashlet"
              locale="en-AU"
            />
          </DashGroup>
        </DashList>
      </DashPanel>
    </PicodashProvider>
  )
}
