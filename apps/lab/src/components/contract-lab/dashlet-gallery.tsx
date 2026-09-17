'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPicodashNexus } from '@picodash/nexus'
import {
  PicodashThemeProvider,
  Button,
  type PicodashTheme,
  type PicodashDensity,
} from '@picodash/ui'
import {
  DashList,
  SearchDashlet,
  TextDashlet,
  NumberDashlet,
  SliderDashlet,
  SwitchDashlet,
  RangeDashlet,
  DisplayDashlet,
  MeterDashlet,
  ProgressDashlet,
  StatusDashlet,
  ColorDashlet,
  CheckboxDashlet,
  RadioGroupDashlet,
  ComboboxDashlet,
  SelectDashlet,
  SegmentedDashlet,
  CheckboxGroupDashlet,
  MultiSelectDashlet,
  DateDashlet,
  TimeDashlet,
  DateTimeDashlet,
  DateRangeDashlet,
} from '@picodash/dashlist'
import { GalleryCharts } from './gallery-charts'
import { ContractLab } from './contract-lab'
import { ContractLabDevBridgeConnector } from './dev-bridge-connector'
import {
  styleLabFields,
  styleLabBridgeDisclosure,
  styleLabBridgePermissions,
} from './style-lab-model'

type SampleProps = {
  readonly id: string
  readonly label: string
  readonly layout: 'inline' | 'block' | 'full'
  readonly disabled?: boolean
  readonly readOnly?: boolean
  readonly description?: string
}
const editableVariants: readonly Omit<SampleProps, 'id'>[] = [
  { label: 'Inline', layout: 'inline' },
  { label: 'Read-only', layout: 'inline', readOnly: true },
  { label: 'Disabled', layout: 'inline', disabled: true },
  { label: 'Block', layout: 'block', description: 'A supporting description below the label.' },
  { label: 'Full width', layout: 'full' },
]
const readoutVariants: readonly Omit<SampleProps, 'id'>[] = [
  { label: 'Inline', layout: 'inline' },
  { label: 'Block', layout: 'block' },
  { label: 'Full width', layout: 'full' },
]

export function DashletLab() {
  const [view, setView] = useState<'loading' | 'gallery' | 'contracts'>('loading')
  useEffect(() => {
    // This browser-only Lab restores its view before mounting locale-sensitive examples.
    setView(sessionStorage.getItem('picodash:lab:view') === 'contracts' ? 'contracts' : 'gallery')
  }, [])
  function changeView(next: 'gallery' | 'contracts') {
    sessionStorage.setItem('picodash:lab:view', next)
    setView(next)
  }
  if (view === 'loading')
    return (
      <main className="p-5" aria-busy="true">
        <p role="status">Loading Dashlets…</p>
      </main>
    )
  return view === 'gallery' ? (
    <DashletGallery onOpenContracts={() => changeView('contracts')} />
  ) : (
    <ContractLab onOpenGallery={() => changeView('gallery')} />
  )
}

function DashletGallery({ onOpenContracts }: { readonly onOpenContracts: () => void }) {
  const [theme, setTheme] = useState<PicodashTheme>('dark')
  const [density, setDensity] = useState<PicodashDensity>('regular')
  const nexus = useMemo(
    () =>
      createPicodashNexus({
        valueOwner: 'nexus',
        nexusId: 'dashlet-gallery',
        schemaVersion: 1,
        fields: {
          ...styleLabFields,
          notes: { defaultValue: 'A quiet workspace.\nA second line to check spacing.' },
          requiredText: {
            defaultValue: 'Studio',
            validate: (value: string) =>
              value.trim() ? [] : [{ message: 'Enter a workspace name.' }],
          },
          structured: { defaultValue: { connected: true, refreshSeconds: 30 } },
        },
      }),
    [],
  )
  const samples: readonly {
    name: string
    readout: boolean
    render: (props: SampleProps) => ReactNode
    additional?: ReactNode
  }[] = [
    {
      name: 'SearchDashlet',
      readout: false,
      render: (props: SampleProps) => (
        <SearchDashlet key={props.id} {...props} field={nexus.fields.search} placeholder="Search" />
      ),
    },
    {
      name: 'TextDashlet',
      additional: (
        <>
          <TextDashlet
            id="multiline"
            label="Multiline"
            field={nexus.fields.notes}
            multiline
            minRows={3}
            layout="block"
          />
          <TextDashlet
            id="validation"
            label="Validation"
            field={nexus.fields.requiredText}
            description="Clear this field to inspect its error state."
            layout="block"
          />
        </>
      ),
      readout: false,
      render: (props: SampleProps) => (
        <TextDashlet key={props.id} {...props} field={nexus.fields.text} />
      ),
    },
    {
      name: 'NumberDashlet',
      readout: false,
      render: (props: SampleProps) => (
        <NumberDashlet
          key={props.id}
          {...props}
          field={nexus.fields.number}
          min={1}
          max={96}
          formatOptions={{ maximumFractionDigits: 3 }}
          help="The displayed value is rounded without changing the canonical number."
        />
      ),
    },
    {
      name: 'SliderDashlet',
      additional: (
        <SliderDashlet
          id="unmarked"
          layout="block"
          label="Without marks"
          description="Drag or use the arrow keys."
          field={nexus.fields.slider}
          min={0}
          max={100}
        />
      ),
      readout: false,
      render: (props: SampleProps) => (
        <SliderDashlet
          key={props.id}
          {...props}
          field={nexus.fields.slider}
          min={0}
          max={100}
          marks={[
            { value: 0, label: '0%' },
            { value: 50, label: '50%' },
            { value: 100, label: '100%' },
          ]}
          formatValue={(value) => `${value}%`}
        />
      ),
    },
    {
      name: 'SwitchDashlet',
      readout: false,
      render: (props: SampleProps) => (
        <SwitchDashlet key={props.id} {...props} field={nexus.fields.switchValue} />
      ),
    },
    {
      name: 'RangeDashlet',
      readout: false,
      render: (props: SampleProps) => (
        <RangeDashlet
          key={props.id}
          {...props}
          field={nexus.fields.range}
          min={0}
          max={100}
          formatValue={({ start, end }) => `${start}–${end}`}
        />
      ),
    },
    {
      name: 'DisplayDashlet',
      additional: (
        <DisplayDashlet
          id="structured"
          label="Structured value"
          field={nexus.fields.structured}
          layout="block"
        />
      ),
      readout: true,
      render: (props: SampleProps) => (
        <DisplayDashlet key={props.id} {...props} field={nexus.fields.display} />
      ),
    },
    {
      name: 'MeterDashlet',
      readout: true,
      render: (props: SampleProps) => (
        <MeterDashlet
          key={props.id}
          {...props}
          field={nexus.fields.meter}
          min={0}
          max={100}
          formatValue={(value) => `${value}%`}
        />
      ),
    },
    {
      name: 'ProgressDashlet',
      readout: true,
      render: (props: SampleProps) => (
        <ProgressDashlet
          key={props.id}
          {...props}
          field={nexus.fields.progress}
          min={0}
          max={100}
          formatValue={(value) => `${value}%`}
        />
      ),
    },
    {
      name: 'StatusDashlet',
      readout: true,
      render: (props: SampleProps) => (
        <StatusDashlet
          key={props.id}
          {...props}
          field={nexus.fields.status}
          options={[
            { value: 'ready', label: 'Ready', tone: 'success' },
            { value: 'syncing', label: 'Syncing', tone: 'info' },
            { value: 'attention', label: 'Needs attention', tone: 'warning' },
          ]}
        />
      ),
    },
    {
      name: 'ColorDashlet',
      additional: (['hex', 'hexa', 'rgb', 'hsl', 'hsla', 'hsb', 'hsba'] as const).map((format) => (
        <ColorDashlet
          key={format}
          id={format}
          label={format.toUpperCase()}
          field={nexus.fields.color}
          format={format}
          layout="block"
        />
      )),
      readout: false,
      render: (props: SampleProps) => (
        <ColorDashlet key={props.id} {...props} field={nexus.fields.color} format="rgba" />
      ),
    },
    {
      name: 'CheckboxDashlet',
      readout: false,
      render: (props: SampleProps) => (
        <CheckboxDashlet key={props.id} {...props} field={nexus.fields.checkbox} />
      ),
    },
    {
      name: 'RadioGroupDashlet',
      additional: (
        <RadioGroupDashlet
          id="vertical"
          label="Vertical"
          field={nexus.fields.radioGroup}
          options={['Option A', 'Option B', 'Option C']}
          orientation="vertical"
          layout="block"
        />
      ),
      readout: false,
      render: (props: SampleProps) => (
        <RadioGroupDashlet
          key={props.id}
          {...props}
          field={nexus.fields.radioGroup}
          options={['Option A', 'Option B', 'Option C']}
          orientation="horizontal"
        />
      ),
    },
    {
      name: 'ComboboxDashlet',
      readout: false,
      render: (props: SampleProps) => (
        <ComboboxDashlet
          key={props.id}
          {...props}
          field={nexus.fields.combobox}
          options={['Option A', 'Option B', 'Option C']}
          placeholder="Select an option"
        />
      ),
    },
    {
      name: 'SelectDashlet',
      additional: (
        <SelectDashlet
          id="disabled-option"
          label="Disabled option"
          field={nexus.fields.select}
          options={['Option A', 'Option B', { value: 'Option C', disabled: true }]}
        />
      ),
      readout: false,
      render: (props: SampleProps) => (
        <SelectDashlet
          key={props.id}
          {...props}
          field={nexus.fields.select}
          options={['Option A', 'Option B', 'Option C']}
        />
      ),
    },
    {
      name: 'SegmentedDashlet',
      readout: false,
      render: (props: SampleProps) => (
        <SegmentedDashlet
          key={props.id}
          {...props}
          field={nexus.fields.segmented}
          options={['Option A', 'Option B', 'Option C']}
        />
      ),
    },
    {
      name: 'CheckboxGroupDashlet',
      readout: false,
      render: (props: SampleProps) => (
        <CheckboxGroupDashlet
          key={props.id}
          {...props}
          field={nexus.fields.checkboxGroup}
          options={['Option A', 'Option B', 'Option C']}
        />
      ),
    },
    {
      name: 'MultiSelectDashlet',
      readout: false,
      render: (props: SampleProps) => (
        <MultiSelectDashlet
          key={props.id}
          {...props}
          field={nexus.fields.multiSelect}
          options={['Option A', 'Option B', 'Option C']}
          placeholder="Select options"
        />
      ),
    },
    {
      name: 'DateDashlet',
      readout: false,
      render: (props: SampleProps) => (
        <DateDashlet key={props.id} {...props} field={nexus.fields.date} locale="en-AU" />
      ),
    },
    {
      name: 'TimeDashlet',
      additional: (
        <TimeDashlet
          id="seconds"
          label="12-hour / seconds"
          field={nexus.fields.time}
          locale="en-AU"
          hourCycle={12}
          granularity="second"
          layout="block"
        />
      ),
      readout: false,
      render: (props: SampleProps) => (
        <TimeDashlet
          key={props.id}
          {...props}
          field={nexus.fields.time}
          locale="en-AU"
          hourCycle={24}
        />
      ),
    },
    {
      name: 'DateTimeDashlet',
      additional: (
        <DateTimeDashlet
          id="hidden-zone"
          label="Without time zone"
          field={nexus.fields.dateTime}
          timeZone="Australia/Perth"
          locale="en-AU"
          hideTimeZone
          layout="block"
        />
      ),
      readout: false,
      render: (props: SampleProps) => (
        <DateTimeDashlet
          key={props.id}
          {...props}
          field={nexus.fields.dateTime}
          timeZone="Australia/Perth"
          locale="en-AU"
          hourCycle={24}
        />
      ),
    },
    {
      name: 'DateRangeDashlet',
      readout: false,
      render: (props: SampleProps) => (
        <DateRangeDashlet key={props.id} {...props} field={nexus.fields.dateRange} locale="en-AU" />
      ),
    },
  ]

  return (
    <PicodashThemeProvider theme={theme} density={density}>
      <ContractLabDevBridgeConnector
        nexus={nexus}
        registrationId="dashlet-gallery"
        label="Dashlet gallery"
        disclosure={styleLabBridgeDisclosure}
        permissions={styleLabBridgePermissions}
      />
      <main
        data-dashlet-gallery
        className="min-h-svh bg-(--picodash-color-canvas) px-3 py-5 text-(--picodash-color-text) sm:px-6 sm:py-8"
      >
        <div className="mx-auto max-w-2xl">
          <header className="mb-5">
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-xl font-semibold tracking-tight">Dashlet Lab</h1>
              <Button variant="ghost" onPress={onOpenContracts}>
                Contract tools
              </Button>
            </div>
            <p className="mt-1 text-sm text-(--picodash-color-text-muted)">
              Every Dashlet, with its variations together.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="outline"
                onPress={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {theme === 'dark' ? 'Light theme' : 'Dark theme'}
              </Button>
              <Button
                variant="outline"
                aria-pressed={density === 'compact'}
                onPress={() => setDensity(density === 'regular' ? 'compact' : 'regular')}
              >
                Compact
              </Button>
            </div>
          </header>
          <div className="divide-y divide-(--picodash-color-border) rounded-xl border border-(--picodash-color-border) bg-(--picodash-color-surface)">
            {samples.map((sample) => (
              <section
                key={sample.name}
                aria-label={sample.name}
                className="min-w-0 px-3 py-5 sm:px-5"
              >
                <h2 className="mb-3 font-mono text-sm font-medium">{sample.name}</h2>
                <DashList
                  nexus={nexus}
                  id={`gallery-${sample.name}`}
                  aria-label={`${sample.name} variations`}
                  reorderable={false}
                >
                  {(sample.readout ? readoutVariants : editableVariants).map((variant) =>
                    sample.render({ ...variant, id: variant.label }),
                  )}
                  {sample.additional}
                </DashList>
              </section>
            ))}
            <GalleryCharts nexus={nexus} />
          </div>
        </div>
      </main>
    </PicodashThemeProvider>
  )
}
