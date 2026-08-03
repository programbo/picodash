'use client'

import { useEffect, useRef } from 'react'
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react'
import { PicodashItem, PicodashPanel } from '@picodash/picodash'
import * as Dashlet from '@picodash/picodash/dashlet'
import {
  Button,
  ProgressBar,
  ProgressFill,
  ProgressTrack,
  ToggleGroup,
  ToggleGroupItem,
} from '@picodash/picodash/ui'
import { usePicodashStoreSelector } from '@picodash/store/react'

import { mediaTransportStore } from './example-stores'
import { RecipeShell } from './recipe-shell'

export function MediaTransportRecipe() {
  const boundaryRef = useRef<HTMLDivElement>(null)
  const playing = usePicodashStoreSelector(mediaTransportStore, (state) => state.values.playing)

  useEffect(() => {
    if (!playing) return

    const interval = window.setInterval(() => {
      const state = mediaTransportStore.getState()
      const { currentTime, duration, loop } = state.values
      const nextTime = currentTime + 1 >= duration ? (loop ? 0 : duration) : currentTime + 1
      state.setFieldValues({
        currentTime: nextTime,
        playing: nextTime < duration || loop,
      })
    }, 1000)

    return () => window.clearInterval(interval)
  }, [playing])

  return (
    <RecipeShell
      boundaryRef={boundaryRef}
      description="A compact transport combines mode, progress, current state, and actions under one reset and ordering boundary."
      eyebrow="Operate"
      store={mediaTransportStore}
      title="Media transport"
    >
      <PicodashPanel
        boundary={boundaryRef}
        close
        collapsible
        defaultPlacement={{
          disposition: { kind: 'snapped', position: 'top-right' },
          mode: 'floating',
        }}
        store={mediaTransportStore}
        title="Media transport"
        width={350}
      >
        <PicodashItem
          contentLayout="full"
          fields={{
            currentTime: mediaTransportStore.fields.currentTime,
            duration: { field: mediaTransportStore.fields.duration, mode: 'display' },
            loop: mediaTransportStore.fields.loop,
            mode: mediaTransportStore.fields.mode,
            playing: mediaTransportStore.fields.playing,
          }}
          id="media-transport"
          label="Media transport"
        >
          {({ fields, reset }) => {
            const currentTime = fields.currentTime.value ?? 0
            const duration = fields.duration.value ?? 1
            const loop = fields.loop.value ?? false
            const mode = fields.mode.value ?? 'preview'
            const isPlaying = fields.playing.value ?? false
            const progress = (currentTime / duration) * 100

            return (
              <Dashlet.Frame>
                <Dashlet.Header>
                  <Dashlet.Heading>Interview edit</Dashlet.Heading>
                  <Dashlet.Description>01:14 — product walkthrough</Dashlet.Description>
                  <Dashlet.Actions>
                    <Dashlet.Status tone={isPlaying ? 'success' : 'neutral'}>
                      <Dashlet.StatusIndicator tone={isPlaying ? 'success' : 'neutral'} />
                      {isPlaying ? 'Playing' : 'Paused'}
                    </Dashlet.Status>
                  </Dashlet.Actions>
                </Dashlet.Header>

                <Dashlet.Body className="grid gap-(--picodash-space-3)">
                  <ToggleGroup
                    aria-label="Transport mode"
                    disallowEmptySelection
                    selectedKeys={[mode]}
                    selectionMode="single"
                    spacing={0}
                    variant="outline"
                    onSelectionChange={(keys) => {
                      const mode = keys.values().next().value
                      if (mode === 'preview' || mode === 'review') fields.mode.setInput(mode)
                    }}
                  >
                    <ToggleGroupItem id="preview" size="sm">
                      Preview
                    </ToggleGroupItem>
                    <ToggleGroupItem id="review" size="sm">
                      Review
                    </ToggleGroupItem>
                  </ToggleGroup>

                  <ProgressBar
                    aria-label="Playback progress"
                    maxValue={duration}
                    value={currentTime}
                  >
                    <div className="flex justify-between text-(length:--picodash-font-size-md) tabular-nums">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                    <ProgressTrack>
                      <ProgressFill />
                    </ProgressTrack>
                  </ProgressBar>

                  <Dashlet.Toolbar aria-label="Playback controls">
                    <Button
                      aria-label="Back 10 seconds"
                      size="icon-xs"
                      variant="outline"
                      onPress={() => fields.currentTime.setInput(Math.max(0, currentTime - 10))}
                    >
                      <SkipBack aria-hidden="true" />
                    </Button>
                    <Button
                      aria-label={isPlaying ? 'Pause playback' : 'Start playback'}
                      size="icon-sm"
                      onPress={() => fields.playing.setInput(!isPlaying)}
                    >
                      {isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                    </Button>
                    <Button
                      aria-label="Forward 10 seconds"
                      size="icon-xs"
                      variant="outline"
                      onPress={() =>
                        fields.currentTime.setInput(Math.min(duration, currentTime + 10))
                      }
                    >
                      <SkipForward aria-hidden="true" />
                    </Button>
                    <Button
                      aria-pressed={loop}
                      size="xs"
                      variant={loop ? 'secondary' : 'ghost'}
                      onPress={() => fields.loop.setInput(!loop)}
                    >
                      Loop
                    </Button>
                  </Dashlet.Toolbar>
                </Dashlet.Body>

                <Dashlet.Footer>
                  <span>{Math.round(progress)}% complete</span>
                  <Button size="xs" variant="ghost" onPress={reset}>
                    <RotateCcw aria-hidden="true" />
                    Reset transport
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

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remainder = Math.floor(seconds % 60)
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}
