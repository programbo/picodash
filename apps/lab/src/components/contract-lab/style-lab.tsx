'use client'

import { useMemo, type RefObject } from 'react'
import { createPicodashNexus } from '@picodash/nexus'
import {
  CheckboxDashlet,
  CheckboxGroupDashlet,
  ColorDashlet,
  ComboboxDashlet,
  DashGroup,
  DashStack,
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
import {
  styleLabFields,
  styleLabBridgeDisclosure,
  styleLabBridgePermissions,
} from './style-lab-model'
import { ContractLabDevBridgeConnector } from './dev-bridge-connector'

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
        recordableHotkey
        showCloseButton
        width="min(24rem, calc(100dvw - 2rem))"
        defaultLayout={{
          placement: {
            mode: 'hybrid',
            disposition: { kind: 'docked', position: 'bottom-right' },
          },
        }}
        data-style-lab-panel="basics-readout"
      >
        <DashStack aria-label="Basics and readout Dashlets" reorderable>
          <DashGroup
            id="style-lab-search-pinned"
            aria-label="style-lab-search pinned controls"
            pin="start"
          >
            <SearchDashlet
              id="style-lab-search"
              field={nexus.fields.search}
              label="SearchDashlet"
              placeholder="Search"
              layout="block"
              data-style-lab-lane="start"
            />
          </DashGroup>

          <DashGroup id="style-lab-basics" label="Basics" detachable recordableHotkey>
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

          <DashGroup id="style-lab-readout" label="Readout" pin="end" data-style-lab-lane="end">
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
        </DashStack>
      </DashPanel>

      <DashPanel
        id="style-lab-choices-panel"
        title="Choices & temporal"
        collapsible={false}
        recordableHotkey
        showCloseButton
        width="min(24rem, calc(100dvw - 2rem))"
        defaultLayout={{
          placement: {
            mode: 'hybrid',
            disposition: { kind: 'docked', position: 'top-right' },
          },
        }}
        data-style-lab-panel="choices-temporal"
      >
        <DashStack aria-label="Choices and temporal Dashlets" reorderable>
          <ColorDashlet
            id="style-lab-color"
            field={nexus.fields.color}
            label="ColorDashlet"
            format="rgba"
            layout="block"
            data-style-lab-lane="auto"
          />

          <DashGroup id="style-lab-choices" label="Choices" detachable recordableHotkey>
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
        </DashStack>
      </DashPanel>
    </PicodashProvider>
  )
}
