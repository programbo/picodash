import { useLayoutEffect, useRef, useState } from 'react'
import { Button } from '@picodash/ui'
import { useDashPanel } from './panel-controller.tsx'

/** A tap and keyboard alternative to dragging the border. Only edited axes become manual. */
export function PanelSizeEditor({
  name,
  onClose,
}: {
  readonly name: string
  readonly onClose: () => void
}) {
  const controller = useDashPanel()
  const initial = useRef(
    controller.availability === 'available' ? controller.sizing?.desired : undefined,
  )
  const [width, setWidth] = useState(String(Math.round(initial.current?.width ?? 320)))
  const [height, setHeight] = useState(String(Math.round(initial.current?.height ?? 240)))
  const [error, setError] = useState('')
  const widthRef = useRef<HTMLInputElement>(null)
  useLayoutEffect(() => widthRef.current?.focus(), [])
  if (controller.availability === 'unavailable') return null
  return (
    <form
      aria-label={`Resize panel ${name}`}
      data-picodash-panel-size-editor
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          onClose()
        }
      }}
      onSubmit={(event) => {
        event.preventDefault()
        const nextWidth = Number(width)
        const nextHeight = Number(height)
        if (
          !Number.isFinite(nextWidth) ||
          nextWidth <= 0 ||
          !Number.isFinite(nextHeight) ||
          nextHeight <= 0
        ) {
          setError('Enter positive sizes in pixels.')
          return
        }
        const widthChanged = nextWidth !== Math.round(initial.current?.width ?? 320)
        const heightChanged = nextHeight !== Math.round(initial.current?.height ?? 240)
        const size = widthChanged
          ? { width: nextWidth, ...(heightChanged ? { height: nextHeight } : {}) }
          : heightChanged
            ? { height: nextHeight }
            : undefined
        if (size) {
          const result = controller.setSize(size)
          if (result.status !== 'executed' || !result.transaction.ok) {
            setError('The Panel size could not be changed.')
            return
          }
        }
        onClose()
      }}
    >
      <p>Resize panel</p>
      <label>
        Width (px)
        <input
          ref={widthRef}
          inputMode="decimal"
          type="number"
          min="1"
          step="any"
          value={width}
          onChange={(event) => setWidth(event.target.value)}
        />
      </label>
      <label>
        Height (px)
        <input
          inputMode="decimal"
          type="number"
          min="1"
          step="any"
          value={height}
          onChange={(event) => setHeight(event.target.value)}
        />
      </label>
      {error ? <p role="alert">{error}</p> : null}
      <div>
        <Button type="submit" size="sm">
          Apply size
        </Button>
        <Button type="button" variant="ghost" size="sm" onPress={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          isDisabled={!controller.manuallySized}
          onPress={() => {
            controller.restorePreferredSize()
            onClose()
          }}
        >
          Restore preferred size
        </Button>
      </div>
    </form>
  )
}
