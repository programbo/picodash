import { useEffect, useLayoutEffect, useId, useState } from 'react'
import {
  findHotkeyConflicts,
  formatForDisplay,
  parseHotkey,
  normalizeHotkey,
  useHotkey,
  useHotkeyRecorder,
  validateHotkey,
} from '@tanstack/react-hotkeys'
import { Button, Tooltip, TooltipContent, TooltipTrigger } from '@picodash/ui'
import { Pencil } from 'lucide-react'
import { useDashPanelHostId } from './runtime/panel-controller.js'
import { useDashPanelRuntime, useDashPanelRuntimeState } from './runtime/panel-runtime-context.js'
import type { PanelRuntime } from './runtime/panel-runtime.js'

type HotkeyContext = { readonly runtime: PanelRuntime; readonly panelId: string }
type Registration = { readonly context?: HotkeyContext; readonly enabled: boolean }
const registrations = new Map<string, Registration>()
const handledEvents = new WeakSet<KeyboardEvent>()

function mayShare(left: Registration, right: Registration) {
  return (
    !!left.context &&
    !!right.context &&
    (left.context.runtime !== right.context.runtime ||
      left.context.panelId !== right.context.panelId)
  )
}
function eligible(registration: Registration) {
  if (!registration.enabled) return false
  const context = registration.context
  if (!context) return true
  const panel = context.runtime.getSnapshot().panels[context.panelId]
  return !!panel?.visible && !panel.collapsed
}
function active(registration: Registration) {
  const context = registration.context
  if (!context) return false
  const snapshot = context.runtime.getSnapshot()
  return (
    [...snapshot.activationOrder].reverse().find((id) => snapshot.panels[id]?.visible) ===
    context.panelId
  )
}
function conflicts(binding: string, identity: string) {
  return findHotkeyConflicts(normalizeHotkey(binding), {
    includeDisabled: true,
    exclude: (item) => item.options.meta?.name === identity,
  })
}

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
  enabled,
  context,
  onToggle,
}: {
  binding: string
  identity: string
  enabled: boolean
  context?: HotkeyContext
  onToggle: () => void
}) {
  useLayoutEffect(() => {
    registrations.set(identity, { enabled, context })
    return () => {
      registrations.delete(identity)
    }
  }, [identity, enabled, context])
  useHotkey(
    normalizeHotkey(binding),
    (event) => {
      if (
        handledEvents.has(event) ||
        event.repeat ||
        event.isComposing ||
        document.querySelector('[aria-modal="true"], dialog[open]')
      )
        return
      const own = registrations.get(identity)
      if (!own || !eligible(own)) return
      const candidates = [{ identity, registration: own }]
      for (const conflict of conflicts(binding, identity)) {
        const name = conflict.registration.options.meta?.name
        const registration = name ? registrations.get(name) : undefined
        // Unknown listeners and overlapping scopes cannot be safely arbitrated.
        if (!name || !registration || !mayShare(own, registration)) return
        if (eligible(registration)) candidates.push({ identity: name, registration })
      }
      const winners =
        candidates.length === 1
          ? candidates
          : candidates.filter((item) => active(item.registration))
      if (winners.length !== 1 || winners[0]?.identity !== identity) return
      // Mark before changing visibility/activation: later callbacks see the same key event.
      handledEvents.add(event)
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

export interface DashPanelContextHotkeyProps {
  binding: string | undefined
  panelName: string
  enabled: boolean
  description?: string
  onCommit: (binding: string | null) => string | undefined
  onToggle: () => void
}

type PanelHotkeyProps = DashPanelContextHotkeyProps & {
  context?: HotkeyContext
  recordingEnabled?: boolean
}

/** Bounded integration seam: eligibility follows the nearest original Panel, not DOM relocation. */
export function DashPanelContextHotkey(props: DashPanelContextHotkeyProps) {
  const runtime = useDashPanelRuntime()
  const panelId = useDashPanelHostId()
  const parent = useDashPanelRuntimeState(panelId ?? '')
  return panelId === undefined ? null : (
    <PanelHotkey
      {...props}
      context={{ runtime, panelId }}
      recordingEnabled={!!parent?.visible && !parent.collapsed}
    />
  )
}

export function PanelHotkey({
  binding,
  panelName,
  enabled,
  context,
  recordingEnabled = true,
  description = 'Set a shortcut to toggle this panel.',
  onCommit,
  onToggle,
}: PanelHotkeyProps) {
  const identity = useId()
  const helpId = useId()
  const [feedback, setFeedback] = useState('')
  const [helpOpen, setHelpOpen] = useState(false)
  const recorder = useHotkeyRecorder({
    detectConflicts: false,
    validate: (candidate) => {
      const error = panelHotkeyError(candidate)
      if (error) return error
      const own = { context, enabled }
      const collision = conflicts(candidate, identity).some((item) => {
        const name = item.registration.options.meta?.name
        const other = name ? registrations.get(name) : undefined
        return !other || !mayShare(own, other)
      })
      return collision ? 'That shortcut is already in use in this context. Try another.' : true
    },
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
    if ((!enabled || !recordingEnabled) && recorder.isRecording) recorder.cancelRecording()
  }, [enabled, recordingEnabled, recorder.isRecording, recorder.cancelRecording])
  const error = binding ? panelHotkeyError(binding) : undefined
  const help = recorder.isRecording
    ? feedback || 'Press a shortcut. Escape cancels; Delete or Backspace removes it.'
    : feedback ||
      error ||
      (binding
        ? `Current shortcut: ${formatForDisplay(binding)}. Activate to change or remove it.`
        : description)
  return (
    <>
      {enabled && binding && !error ? (
        <PanelHotkeyBinding
          binding={binding}
          identity={identity}
          enabled={enabled}
          context={context}
          onToggle={onToggle}
        />
      ) : null}
      <span data-picodash-panel-hotkey hidden={!enabled}>
        <Tooltip
          isOpen={enabled && recordingEnabled && (recorder.isRecording || helpOpen)}
          onOpenChange={setHelpOpen}
        >
          <TooltipTrigger>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Record shortcut for ${panelName}`}
              aria-describedby={helpId}
              aria-pressed={recorder.isRecording}
              isDisabled={!recordingEnabled}
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
              data-empty={(!binding || !!error) && !recorder.isRecording ? true : undefined}
            >
              <span data-picodash-hotkey-face>
                {recorder.isRecording ? (
                  'Press keys…'
                ) : binding && !error ? (
                  <span data-picodash-hotkey-keys aria-hidden="true">
                    {formatForDisplay(binding, { parts: true }).map((part) => (
                      <kbd key={part}>{part}</kbd>
                    ))}
                  </span>
                ) : (
                  <span data-picodash-hotkey-placeholder>Click to record shortcut</span>
                )}
              </span>
              <Pencil aria-hidden="true" data-picodash-hotkey-edit />
            </Button>
          </TooltipTrigger>
          <TooltipContent placement="bottom" offset={8}>
            {help}
          </TooltipContent>
        </Tooltip>
        <span id={helpId} data-picodash-panel-hotkey-help role="status">
          {help}
        </span>
      </span>
    </>
  )
}
