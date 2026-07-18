import { TextAlignCenter, TextAlignEnd, TextAlignStart, type LucideIcon } from 'lucide-react'
import {
  createTweakerPanelStore,
  TweakerDisplay,
  TweakerDropzone,
  TweakerGradient,
  TweakerGroup,
  TweakerMatrix2D,
  TweakerMediaPreview,
  TweakerNumber,
  TweakerPanel,
  TweakerRange,
  TweakerSegmented,
  TweakerSelect,
  TweakerSlider,
  TweakerSwitch,
  TweakerText,
  TweakerVector3,
  TweakerXYPad,
  type TweakerMatrix2DOption,
} from 'panel'

export const builtInItemsPanelId = 'built-in-items'

const builtInItemDefaults = {
  alignment: 'middle-center' as const,
  display: 'Ready',
  droppedFiles: [],
  gradient: [
    { color: '#22d3ee', id: 'cyan', position: 0 },
    { color: '#facc15', id: 'amber', position: 0.58 },
    { color: '#fb7185', id: 'rose', position: 1 },
  ],
  gradientRotation: 135,
  multilineText: 'A text area grows with its contents.',
  number: 24,
  previewAsset: '/favicon.svg',
  range: [24, 76] as [number, number],
  segmented: 'balanced',
  select: 'balanced',
  slider: 48,
  sliderMarks: 0.5,
  switch: true,
  text: 'Studio',
  vector3: { x: 1.25, y: -0.5, z: 3 },
  xyPad: { x: 0.68, y: 0.32 },
}

export const builtInItemsPanelStore = createTweakerPanelStore({
  initialValues: builtInItemDefaults,
  panelId: builtInItemsPanelId,
})

const alignmentRows = [
  { className: 'items-start', label: 'Top', value: 'top' },
  { className: 'items-center', label: 'Middle', value: 'middle' },
  { className: 'items-end', label: 'Bottom', value: 'bottom' },
] as const

const alignmentColumns = [
  { className: 'justify-start', Icon: TextAlignStart, label: 'left', value: 'left' },
  { className: 'justify-center', Icon: TextAlignCenter, label: 'center', value: 'center' },
  { className: 'justify-end', Icon: TextAlignEnd, label: 'right', value: 'right' },
] as const satisfies readonly {
  className: string
  Icon: LucideIcon
  label: string
  value: string
}[]

type AlignmentValue =
  `${(typeof alignmentRows)[number]['value']}-${(typeof alignmentColumns)[number]['value']}`

const alignmentOptions = alignmentRows.map((row, rowIndex) =>
  alignmentColumns.map((column, columnIndex) => ({
    'aria-label': `${row.label} ${column.label}`,
    children: (
      <column.Icon aria-hidden="true" className="size-(--tweaker-icon-sm)" strokeWidth={2} />
    ),
    className: [
      'relative flex size-(--tweaker-control-height-md) p-(--tweaker-space-1) text-tweaker-muted transition-colors duration-(--tweaker-duration-fast) hover:bg-tweaker-surface-muted hover:text-tweaker-text data-[state=on]:bg-tweaker-accent data-[state=on]:text-tweaker-accent-text',
      columnIndex === 0 ? '' : 'border-l border-tweaker-control',
      rowIndex === 0 ? '' : 'border-t border-tweaker-control',
      row.className,
      column.className,
    ]
      .filter(Boolean)
      .join(' '),
    'data-alignment-index': rowIndex * alignmentColumns.length + columnIndex,
    title: `${row.label} ${column.label}`,
    value: `${row.value}-${column.value}` as AlignmentValue,
  })),
) satisfies readonly (readonly TweakerMatrix2DOption<AlignmentValue>[])[]

export function BuiltInItemsPanel() {
  return (
    <TweakerPanel
      store={builtInItemsPanelStore}
      title="Built-in Items"
      collapsible
      defaultPlacement="top-left"
      width="23rem"
      className="top-4 left-4 w-92 max-w-[calc(100dvw-2rem)] lg:top-8 lg:left-8"
    >
      <TweakerGroup id="common-items" label="Common inputs">
        <TweakerText
          field="text"
          label="Text"
          defaultValue={builtInItemDefaults.text}
          help="TweakerText — field, defaultValue, and placeholder props."
          placeholder="Enter text"
        />
        <TweakerText
          field="multilineText"
          label="Text"
          defaultValue={builtInItemDefaults.multilineText}
          description="Setting minRows greater than 1 switches the wrapped input to an auto-growing Textarea."
          help="TweakerText — field, defaultValue, placeholder, and minRows={3} props."
          minRows={3}
          placeholder="Enter longer text"
        />
        <TweakerNumber
          field="number"
          label="Number"
          defaultValue={builtInItemDefaults.number}
          help="TweakerNumber — field, defaultValue, min, max, and step props."
          min={0}
          max={100}
          step={1}
        />
        <TweakerSwitch
          field="switch"
          label="Switch"
          defaultValue={builtInItemDefaults.switch}
          help="TweakerSwitch — field and defaultValue props."
        />
        <TweakerSelect
          field="select"
          label="Select"
          defaultValue={builtInItemDefaults.select}
          help="TweakerSelect — field, defaultValue, and options props."
          options={[
            { label: 'Compact', value: 'compact' },
            { label: 'Balanced', value: 'balanced' },
            { label: 'Comfortable', value: 'comfortable' },
          ]}
        />
        <TweakerSlider
          field="slider"
          label="Slider"
          defaultValue={builtInItemDefaults.slider}
          help="TweakerSlider — field, defaultValue, min, max, and step props."
          min={0}
          max={100}
          step={1}
        />
        <TweakerSlider
          field="sliderMarks"
          label="Slider"
          defaultValue={builtInItemDefaults.sliderMarks}
          description="The marks prop adds optional reference points along the slider track."
          help="TweakerSlider — field, defaultValue, min, max, step, marks, and formatOptions props."
          min={0}
          max={1}
          step={0.01}
          marks={[0, 0.5, 1]}
          formatOptions={{ style: 'percent' }}
        />
        <TweakerRange
          field="range"
          label="Range"
          defaultValue={builtInItemDefaults.range}
          help="TweakerRange — field, defaultValue, min, max, and step props."
          min={0}
          max={100}
          step={1}
        />
        <TweakerSegmented
          field="segmented"
          label="Segmented"
          defaultValue={builtInItemDefaults.segmented}
          help="TweakerSegmented — field, defaultValue, and options props."
          options={[
            { label: 'Tight', value: 'compact' },
            { label: 'Balanced', value: 'balanced' },
            { label: 'Open', value: 'comfortable' },
          ]}
        />
      </TweakerGroup>

      <TweakerGroup id="spatial-items" label="Direct manipulation">
        <TweakerVector3
          field="vector3"
          label="Vector3"
          defaultValue={builtInItemDefaults.vector3}
          help="TweakerVector3 — field, defaultValue, min, max, and step props."
          max={10}
          min={-10}
          step={0.25}
        />
        <TweakerMatrix2D
          field="alignment"
          label="Alignment"
          defaultValue={builtInItemDefaults.alignment}
          help="TweakerMatrix2D — field, defaultValue, options, containerProps, selectionRole, and validationMessage. The consumer defines every button and the grid layout."
          containerProps={{
            'aria-label': 'Alignment',
            className:
              'border-tweaker-control shadow-tweaker-sm rounded-tweaker-control overflow-hidden border bg-(--_tweaker-choice-background) p-(--tweaker-space-0-5)',
          }}
          options={alignmentOptions}
          selectionRole="radio"
          validationMessage="Alignment must be one of the nine supported positions."
        />
        <TweakerXYPad
          field="xyPad"
          label="XYPad"
          defaultValue={builtInItemDefaults.xyPad}
          help="TweakerXYPad — field, defaultValue, axis bounds, and step props."
          step={0.01}
          xMax={1}
          xMin={0}
          yMax={1}
          yMin={0}
        />
        <TweakerGradient
          contentLayout="block"
          defaultRotation={builtInItemDefaults.gradientRotation}
          description="Drag stops or use arrow keys. Double-click the gradient to add a stop."
          field="gradient"
          label="Background Gradient"
          defaultValue={builtInItemDefaults.gradient}
          help="TweakerGradient — field, defaultValue, defaultRotation, and rotationField props."
          rotationField="gradientRotation"
        />
      </TweakerGroup>

      <TweakerGroup id="media-items" label="Media and files">
        <TweakerMediaPreview
          alt="Tweaker mark"
          field="previewAsset"
          label="MediaPreview"
          help="TweakerMediaPreview — field, src, alt, and objectFit props."
          src="/favicon.svg"
        />
        <TweakerDropzone
          accept={{ 'image/*': ['.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp'] }}
          field="droppedFiles"
          label="Dropzone"
          help="TweakerDropzone — field, accept, maxFiles, maxSize, and showPreviews props."
          maxFiles={3}
          maxSize={5_000_000}
          showPreviews
        />
      </TweakerGroup>

      <TweakerGroup id="visualization-items" label="Display variants">
        <TweakerDisplay
          id="displayFallback"
          label="Display"
          description="The fallback prop supplies optional content when value is unset."
          fallback="Waiting"
          help="TweakerDisplay — id and the optional fallback prop."
        />
      </TweakerGroup>

      <TweakerDisplay
        id="display"
        label="Display"
        help="TweakerDisplay — id and value props for a read-only item."
        value={builtInItemDefaults.display}
      />
    </TweakerPanel>
  )
}
