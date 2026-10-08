'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  PicodashThemeProvider,
  Button,
  type PicodashTheme,
  type PicodashDensity,
} from '@picodash/ui'
import {
  DashStack,
  DashGroup,
  SearchDashlet,
  TextDashlet,
  NumberDashlet,
  SwitchDashlet,
  DisplayDashlet,
  StatusDashlet,
  ColorDashlet,
  RadioGroupDashlet,
  ComboboxDashlet,
  SelectDashlet,
  SegmentedDashlet,
  CheckboxGroupDashlet,
  MultiSelectDashlet,
} from '@picodash/dashstack'
import { GalleryCharts } from './gallery-charts'
import { ContractLab } from './contract-lab'
import { ContractLabDevBridgeConnector } from './dev-bridge-connector'
import { styleLabBridgeDisclosure, styleLabBridgePermissions } from './style-lab-model'

import { createGalleryNexus } from './gallery-model'
import {
  LinkedSlider,
  LinkedRange,
  ComputedReadout,
  LinkedTemporal,
  type GallerySampleProps as SampleProps,
} from './gallery-linked-controls'

const temporalSamples = new Set([
  'DateDashlet',
  'TimeDashlet',
  'DateTimeDashlet',
  'DateRangeDashlet',
])

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
  const [readOnly, setReadOnly] = useState(false)
  const [disabled, setDisabled] = useState(false)
  const [reorderable, setReorderable] = useState(true)
  const nexus = useMemo(createGalleryNexus, [])
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
            readOnly={readOnly}
            disabled={disabled}
            id="multiline"
            label="Multiline"
            field={nexus.fields.notes}
            multiline
            layout="block"
            minRows={3}
          />
          <TextDashlet
            readOnly={readOnly}
            disabled={disabled}
            id="validation"
            label="Validation"
            field={nexus.fields.requiredText}
            description="Clear this field to inspect its error state."
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
      additional: (
        <NumberDashlet
          id="number-unit"
          label="Distance"
          field={nexus.fields.number}
          readOnly={readOnly}
          disabled={disabled}
          formatOptions={{
            style: 'unit',
            unit: 'meter',
            unitDisplay: 'short',
            maximumFractionDigits: 2,
          }}
        />
      ),
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
      readout: false,
      render: (props) => <LinkedSlider key={props.id} {...props} nexus={nexus} />,
      additional: (
        <LinkedSlider
          id="unmarked"
          label="With marks"
          layout="inline"
          nexus={nexus}
          marks
          readOnly={readOnly}
          disabled={disabled}
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
      render: (props) => <LinkedRange key={props.id} {...props} nexus={nexus} />,
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
      render: (props) => <ComputedReadout key={props.id} {...props} nexus={nexus} kind="meter" />,
    },
    {
      name: 'ProgressDashlet',
      readout: true,
      render: (props) => (
        <ComputedReadout key={props.id} {...props} nexus={nexus} kind="progress" />
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
      additional: (['hexa', 'hsla', 'hsba'] as const).map((format) => (
        <ColorDashlet
          key={format}
          id={format}
          label={format.toUpperCase()}
          field={nexus.fields.color}
          format={format}
        />
      )),
      readout: false,
      render: (props: SampleProps) => (
        <ColorDashlet key={props.id} {...props} field={nexus.fields.color} format="rgba" />
      ),
    },
    {
      name: 'RadioGroupDashlet',
      additional: (
        <RadioGroupDashlet
          readOnly={readOnly}
          disabled={disabled}
          id="vertical"
          label="Vertical"
          field={nexus.fields.choice}
          options={['Option A', 'Option B', 'Option C']}
          orientation="vertical"
        />
      ),
      readout: false,
      render: (props: SampleProps) => (
        <RadioGroupDashlet
          key={props.id}
          {...props}
          field={nexus.fields.choice}
          options={['Option A', 'Option B', 'Option C']}
          orientation="vertical"
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
          field={nexus.fields.choice}
          options={['Option A', 'Option B', 'Option C']}
          placeholder="Select an option"
        />
      ),
    },
    {
      name: 'SelectDashlet',
      additional: (
        <SelectDashlet
          readOnly={readOnly}
          disabled={disabled}
          id="disabled-option"
          label="Disabled option"
          field={nexus.fields.choice}
          options={['Option A', 'Option B', { value: 'Option C', disabled: true }]}
        />
      ),
      readout: false,
      render: (props: SampleProps) => (
        <SelectDashlet
          key={props.id}
          {...props}
          field={nexus.fields.choice}
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
          field={nexus.fields.choice}
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
          field={nexus.fields.selections}
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
          field={nexus.fields.selections}
          options={['Option A', 'Option B', 'Option C']}
          placeholder="Select options"
        />
      ),
    },
    {
      name: 'DateDashlet',
      readout: false,
      render: (props) => <LinkedTemporal key={props.id} {...props} nexus={nexus} kind="date" />,
    },
    {
      name: 'TimeDashlet',
      readout: false,
      render: (props) => <LinkedTemporal key={props.id} {...props} nexus={nexus} kind="time" />,
      additional: (
        <LinkedTemporal
          id="seconds"
          label="12-hour / seconds"
          layout="inline"
          nexus={nexus}
          kind="time"
          seconds
          readOnly={readOnly}
          disabled={disabled}
        />
      ),
    },
    {
      name: 'DateTimeDashlet',
      readout: false,
      render: (props) => <LinkedTemporal key={props.id} {...props} nexus={nexus} kind="dateTime" />,
      additional: (
        <LinkedTemporal
          id="hidden-zone"
          label="Without time zone"
          layout="inline"
          nexus={nexus}
          kind="dateTime"
          hideTimeZone
          readOnly={readOnly}
          disabled={disabled}
        />
      ),
    },
    {
      name: 'DateRangeDashlet',
      readout: false,
      render: (props) => <LinkedTemporal key={props.id} {...props} nexus={nexus} kind="range" />,
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
        <div className="mx-auto max-w-80">
          <header className="mb-5">
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-xl font-semibold tracking-tight">Dashlet Lab</h1>
              <Button variant="ghost" onPress={onOpenContracts}>
                Contract tools
              </Button>
            </div>
            <p className="mt-1 text-sm text-(--picodash-color-text-muted)">
              Shared rows. Real controls.
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
              <Button
                variant="outline"
                aria-pressed={readOnly}
                onPress={() => setReadOnly(!readOnly)}
              >
                Read-only
              </Button>
              <Button
                variant="outline"
                aria-pressed={disabled}
                onPress={() => setDisabled(!disabled)}
              >
                Disabled
              </Button>
              <Button
                variant="outline"
                aria-pressed={reorderable}
                onPress={() => setReorderable(!reorderable)}
              >
                Reorder
              </Button>
            </div>
          </header>
          <div className="rounded-xl bg-(--picodash-color-surface) py-2">
            <DashStack
              nexus={nexus}
              id="gallery-controls"
              aria-label="Dashlet gallery"
              reorderable={reorderable}
            >
              {samples
                .filter((sample) => !temporalSamples.has(sample.name))
                .map((sample) =>
                  sample.render({
                    id: sample.name,
                    label: sample.name.replace('Dashlet', ''),
                    layout: 'inline',
                    readOnly,
                    disabled,
                  }),
                )}
              <DashGroup
                id="date-time"
                label="Date & time"
                labelColor={theme === 'dark' ? '#e9b95b' : '#886000'}
                readOnly={readOnly}
                disabled={disabled}
              >
                {samples
                  .filter((sample) => temporalSamples.has(sample.name))
                  .map((sample) =>
                    sample.render({
                      id: sample.name,
                      label: sample.name.replace('Dashlet', ''),
                      layout: 'inline',
                      readOnly,
                      disabled,
                    }),
                  )}
              </DashGroup>
              <DashGroup
                id="additional"
                label="More examples"
                reorderable={false}
                pin="end"
                readOnly={readOnly}
                disabled={disabled}
              >
                {samples.map((sample) => sample.additional)}
              </DashGroup>
            </DashStack>
            <GalleryCharts nexus={nexus} />
          </div>
        </div>
      </main>
    </PicodashThemeProvider>
  )
}
