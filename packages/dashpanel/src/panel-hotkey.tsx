import { useEffect, useId, useState } from 'react'
import {
  findHotkeyConflicts,
  formatForDisplay,
  parseHotkey,
  normalizeHotkey,
  useHotkey,
  useHotkeyRecorder,
  validateHotkey,
} from '@tanstack/react-hotkeys'
import { Button } from '@picodash/ui'

/** Keep browser navigation and text editing out of panel visibility shortcuts. */
export function panelHotkeyError(binding: string): string | undefined {
  if (!validateHotkey(binding).valid) return 'Choose a valid keyboard shortcut.'
  const parsed = parseHotkey(binding)
  if (!parsed.ctrl && !parsed.meta && !parsed.alt)
    return 'Include Control, Command, or Alt with the key.'
  const key = (parsed.code ?? parsed.key).replace(/^Key/, '').toUpperCase()
  if (
    ['TAB', 'ESCAPE', 'ENTER', 'SPACE', 'BACKSPACE', 'DELETE'].includes(key) ||
    ((parsed.ctrl || parsed.meta) &&
      !parsed.alt &&
      [
        'A',
        'C',
        'V',
        'X',
        'Z',
        'Y',
        'L',
        'T',
        'W',
        'N',
        'Q',
        'R',
        'S',
        'P',
        'F',
        'D',
        'H',
        'J',
        'O',
        'U',
      ].includes(key)) ||
    (parsed.alt && ['F4', 'ARROWLEFT', 'ARROWRIGHT', 'HOME'].includes(key))
  )
    return 'That shortcut is reserved for editing or browser navigation. Try another.'
  return undefined
}

function PanelHotkeyBinding({
  binding,
  identity,
  onToggle,
}: {
  binding: string
  identity: string
  onToggle: () => void
}) {
  useHotkey(
    normalizeHotkey(binding),
    (event) => {
      // Do not close tools behind a modal or fire two panels restored with the same binding.
      if (
        event.repeat ||
        event.isComposing ||
        document.querySelector('[aria-modal="true"], dialog[open]') ||
        findHotkeyConflicts(normalizeHotkey(binding), {
          includeDisabled: true,
          exclude: (item) => item.options.meta?.name === identity,
        }).length
      )
        return
      event.preventDefault()
      event.stopPropagation()
      onToggle()
    },
    {
      ignoreInputs: true,
      requireReset: true,
      preventDefault: false,
      stopPropagation: false,
      conflictBehavior: 'allow',
      meta: { name: identity },
    },
  )
  return null
}

export function PanelHotkey({
  binding,
  panelName,
  enabled,
  onCommit,
  onToggle,
}: {
  binding: string | undefined
  panelName: string
  enabled: boolean
  onCommit: (binding: string | null) => string | undefined
  onToggle: () => void
}) {
  const identity = useId()
  const helpId = useId()
  const [feedback, setFeedback] = useState('')
  const recorder = useHotkeyRecorder({
    detectConflicts: {
      includeDisabled: true,
      exclude: (item) => item.options.meta?.name === identity,
    },
    validate: (candidate) => panelHotkeyError(candidate) ?? true,
    onReject: (rejection) =>
      setFeedback(
        rejection.reason === 'conflict'
          ? 'That shortcut is already in use. Try another.'
          : rejection.message,
      ),
    onRecord: (candidate) =>
      setFeedback(onCommit(candidate) ?? `Shortcut set: ${formatForDisplay(candidate)}.`),
    onClear: () => setFeedback(onCommit(null) ?? 'Shortcut removed.'),
    onCancel: () => setFeedback('Recording cancelled.'),
  })
  useEffect(() => {
    if (!enabled && recorder.isRecording) recorder.cancelRecording()
  }, [enabled, recorder.isRecording, recorder.cancelRecording])
  const error = binding ? panelHotkeyError(binding) : undefined
  return (
    <>
      {enabled && binding && !error ? (
        <PanelHotkeyBinding binding={binding} identity={identity} onToggle={onToggle} />
      ) : null}
      <span data-picodash-panel-hotkey hidden={!enabled}>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Record shortcut for ${panelName}`}
          aria-describedby={helpId}
          aria-pressed={recorder.isRecording}
          onPress={() => {
            if (recorder.isRecording) recorder.cancelRecording()
            else {
              setFeedback('')
              recorder.startRecording()
            }
          }}
          onBlur={() => {
            if (recorder.isRecording) recorder.cancelRecording()
          }}
          data-recording={recorder.isRecording || undefined}
        >
          {recorder.isRecording ? (
            'Press keys…'
          ) : binding && !error ? (
            formatForDisplay(binding)
          ) : (
            <span aria-hidden="true">⌨</span>
          )}
        </Button>
        <span id={helpId} data-picodash-panel-hotkey-help role="status">
          {recorder.isRecording
            ? feedback || 'Press a shortcut. Escape cancels; Delete or Backspace removes it.'
            : feedback ||
              error ||
              (binding
                ? `Current shortcut: ${formatForDisplay(binding)}. Activate to change or remove it.`
                : 'Set a shortcut to minimize or reveal this docked panel.')}
        </span>
      </span>
    </>
  )
}
