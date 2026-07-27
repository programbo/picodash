import type {
  PicodashPanelDockedPosition,
  PicodashPanelHybridDockPosition,
  PicodashPanelPlacement,
  PicodashPanelSnappedPosition,
} from '@picodash/panel'

export function floatingPlacement(position?: PicodashPanelSnappedPosition): PicodashPanelPlacement {
  return {
    disposition: position ? { kind: 'snapped', position } : { kind: 'free' },
    mode: 'floating',
  }
}

export function fixedPlacement(position: PicodashPanelDockedPosition): PicodashPanelPlacement {
  return { disposition: { kind: 'docked', position }, mode: 'fixed' }
}

export function hybridPlacement(
  position?: PicodashPanelHybridDockPosition | 'bottom' | 'top',
): PicodashPanelPlacement {
  return {
    disposition: position
      ? position === 'bottom' || position === 'top'
        ? { kind: 'snapped', position }
        : { kind: 'docked', position }
      : { kind: 'free' },
    mode: 'hybrid',
  }
}

export function positionForPlacement(placement: PicodashPanelPlacement) {
  return placement.disposition.kind === 'free' ? undefined : placement.disposition.position
}
