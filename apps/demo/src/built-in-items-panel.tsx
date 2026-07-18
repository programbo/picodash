import {
  createTweakerPanelStore,
  TweakerAlignment,
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
  alignment: 'center' as const,
  display: 'Ready',
  droppedFiles: [],
  gradient: [
    { color: '#22d3ee', id: 'cyan', position: 0 },
    { color: '#facc15', id: 'amber', position: 0.58 },
    { color: '#fb7185', id: 'rose', position: 1 },
  ],
  matrix2d: 'top-left',
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

const matrixButtonClassName =
  'flex h-8 items-center justify-center rounded-md border border-tweaker-control bg-tweaker-control px-2 text-xs text-tweaker-muted outline-none transition-colors hover:bg-tweaker-surface-muted hover:text-tweaker-text focus-visible:ring-2 focus-visible:ring-tweaker-focus data-[state=on]:border-tweaker-accent data-[state=on]:bg-tweaker-accent data-[state=on]:text-tweaker-accent-text'

const matrixOptions = [
  [matrixOption('Top left', 'top-left', '1,1'), matrixOption('Top right', 'top-right', '1,2')],
  [
    matrixOption('Bottom left', 'bottom-left', '2,1'),
    matrixOption('Bottom right', 'bottom-right', '2,2'),
  ],
] as const satisfies readonly (readonly TweakerMatrix2DOption<string>[])[]

function matrixOption(label: string, value: string, coordinates: string) {
  return {
    'aria-label': label,
    'data-demo-matrix-cell': coordinates,
    children: label,
    className: matrixButtonClassName,
    title: `${label} (${coordinates})`,
    value,
  }
}

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
          field="matrix2d"
          label="Matrix2D"
          defaultValue={builtInItemDefaults.matrix2d}
          help="TweakerMatrix2D — field, defaultValue, options, and containerProps. The consumer defines every button and the grid layout."
          containerProps={{
            'aria-label': 'Placement matrix',
            className: 'col-span-2 grid grid-cols-2 gap-1',
            'data-demo-matrix': '',
          }}
          options={matrixOptions}
        />
        <TweakerAlignment
          field="alignment"
          label="Alignment"
          defaultValue={builtInItemDefaults.alignment}
          help="TweakerAlignment — field and defaultValue props for the package alignment preset."
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
          field="gradient"
          label="Gradient"
          defaultValue={builtInItemDefaults.gradient}
          help="TweakerGradient — field and defaultValue props."
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
