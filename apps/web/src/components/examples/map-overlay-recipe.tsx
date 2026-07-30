'use client'

import { useRef } from 'react'
import { Layers, RotateCcw } from 'lucide-react'
import { PicodashItem, PicodashPanel } from '@picodash/panel'
import * as Dashlet from '@picodash/panel/dashlet'
import {
  Button,
  Label,
  Slider,
  SliderFill,
  SliderThumb,
  SliderTrack,
  Switch,
  ToggleGroup,
  ToggleGroupItem,
} from '@picodash/panel/ui'

import { mapOverlayStore } from './example-stores'
import { RecipeShell } from './recipe-shell'

const palettes = ['traffic', 'terrain', 'thermal'] as const

export function MapOverlayRecipe() {
  const boundaryRef = useRef<HTMLDivElement>(null)

  return (
    <RecipeShell
      boundaryRef={boundaryRef}
      description="A domain-specific map overlay editor built from lower-level UI foundations with four writable typed fields."
      eyebrow="Compose"
      store={mapOverlayStore}
      title="Application-specific controls"
    >
      <PicodashPanel
        boundary={boundaryRef}
        close
        collapsible
        defaultPlacement={{
          disposition: { kind: 'snapped', position: 'top-right' },
          mode: 'floating',
        }}
        store={mapOverlayStore}
        title="Map overlay"
        width={350}
      >
        <PicodashItem
          contentLayout="full"
          fields={{
            labelsVisible: mapOverlayStore.fields.labelsVisible,
            opacity: mapOverlayStore.fields.opacity,
            palette: mapOverlayStore.fields.palette,
            threshold: mapOverlayStore.fields.threshold,
          }}
          id="map-overlay"
          label="Map overlay"
        >
          {({ fields, reset }) => {
            const labelsVisible = fields.labelsVisible.value ?? false
            const opacity = fields.opacity.value ?? 0
            const palette = fields.palette.value ?? 'traffic'
            const threshold = fields.threshold.value ?? 0

            return (
              <Dashlet.Frame>
                <Dashlet.Header>
                  <Dashlet.Heading>Congestion overlay</Dashlet.Heading>
                  <Dashlet.Description>
                    One semantic control with one reset and ordering boundary.
                  </Dashlet.Description>
                  <Dashlet.Actions>
                    <Layers aria-hidden="true" className="size-(--picodash-icon-md)" />
                  </Dashlet.Actions>
                </Dashlet.Header>

                <Dashlet.Body className="grid gap-(--picodash-space-4)">
                  <div className="grid gap-(--picodash-space-2)">
                    <Label id={fields.palette.labelId}>Palette</Label>
                    <ToggleGroup
                      aria-labelledby={fields.palette.labelId}
                      disallowEmptySelection
                      selectedKeys={[palette]}
                      selectionMode="single"
                      spacing={0}
                      variant="outline"
                      onSelectionChange={(keys) => {
                        const palette = keys.values().next().value
                        if (
                          palette === 'traffic' ||
                          palette === 'terrain' ||
                          palette === 'thermal'
                        ) {
                          fields.palette.setInput(palette)
                        }
                      }}
                    >
                      {palettes.map((palette) => (
                        <ToggleGroupItem id={palette} key={palette} size="sm">
                          {palette[0].toUpperCase() + palette.slice(1)}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </div>

                  <CompoundSlider
                    inputId={fields.opacity.inputId}
                    labelId={fields.opacity.labelId}
                    label="Overlay opacity"
                    maxValue={100}
                    value={opacity}
                    onChange={fields.opacity.setInput}
                  />

                  <CompoundSlider
                    inputId={fields.threshold.inputId}
                    labelId={fields.threshold.labelId}
                    label="Congestion threshold"
                    maxValue={100}
                    value={threshold}
                    onChange={fields.threshold.setInput}
                  />

                  <div className="flex min-h-(--picodash-control-height-lg) items-center justify-between gap-(--picodash-space-3)">
                    <Label id={fields.labelsVisible.labelId} htmlFor={fields.labelsVisible.inputId}>
                      Show street labels
                    </Label>
                    <Switch
                      aria-labelledby={fields.labelsVisible.labelId}
                      id={fields.labelsVisible.inputId}
                      isSelected={labelsVisible}
                      onChange={fields.labelsVisible.setInput}
                    />
                  </div>

                  <Dashlet.Surface className="h-20" size="field">
                    <div
                      aria-label={`${palette} map overlay preview at ${opacity}% opacity`}
                      className="relative size-full overflow-hidden"
                      role="img"
                      style={{ opacity: opacity / 100 }}
                    >
                      <div className="absolute inset-x-0 top-1/2 h-px rotate-[-8deg] bg-(--picodash-color-data-3)" />
                      <div className="absolute inset-y-0 left-1/3 w-px rotate-12 bg-(--picodash-color-data-1)" />
                      <div className="absolute top-4 right-5 size-8 rounded-full bg-(--picodash-color-data-2)/35" />
                      <div className="absolute bottom-3 left-5 h-5 w-24 bg-(--picodash-color-data-4)/25" />
                    </div>
                  </Dashlet.Surface>
                </Dashlet.Body>

                <Dashlet.Footer>
                  <Dashlet.DataList className="grow" density="compact">
                    <Dashlet.DataRow>
                      <Dashlet.DataLabel>Rule</Dashlet.DataLabel>
                      <Dashlet.DataValue>
                        {threshold}+ · {palette}
                      </Dashlet.DataValue>
                    </Dashlet.DataRow>
                  </Dashlet.DataList>
                  <Button size="xs" variant="ghost" onPress={reset}>
                    <RotateCcw aria-hidden="true" />
                    Reset overlay
                  </Button>
                </Dashlet.Footer>
              </Dashlet.Frame>
            )
          }}
        </PicodashItem>
      </PicodashPanel>
    </RecipeShell>
  )
}

function CompoundSlider({
  inputId,
  label,
  labelId,
  maxValue,
  onChange,
  value,
}: {
  inputId: string
  label: string
  labelId: string
  maxValue: number
  onChange: (value: number) => void
  value: number
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-(--picodash-space-3) gap-y-(--picodash-space-2)">
      <Label id={labelId}>{label}</Label>
      <output
        aria-labelledby={labelId}
        className="text-picodash-text text-(length:--picodash-font-size-lg) tabular-nums"
      >
        {value}%
      </output>
      <Slider<number>
        aria-labelledby={labelId}
        className="col-span-2"
        maxValue={maxValue}
        minValue={0}
        step={1}
        value={value}
        onChange={onChange}
      >
        <SliderTrack className="relative h-(--picodash-icon-md) w-full">
          <div className="bg-picodash-control absolute inset-x-0 top-1/2 h-(--picodash-space-1) -translate-y-1/2 overflow-hidden rounded-full">
            <SliderFill className="bg-picodash-accent h-full" />
          </div>
          <SliderThumb
            id={inputId}
            className="border-picodash-accent bg-picodash-canvas data-focus-visible:ring-picodash-focus absolute top-1/2 size-(--picodash-icon-md) -translate-y-1/2 rounded-full border outline-none data-focus-visible:ring-2"
          />
        </SliderTrack>
      </Slider>
    </div>
  )
}
