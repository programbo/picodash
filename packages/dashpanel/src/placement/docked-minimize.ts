import type { DashPanelDockPosition } from './placement.ts'

export type DashPanelDockArrowDirection =
  | 'up'
  | 'up-right'
  | 'right'
  | 'down-right'
  | 'down'
  | 'down-left'
  | 'left'
  | 'up-left'

export interface DashPanelDockedMinimizePresentation {
  readonly exitTransform: string
  readonly minimizeDirection: DashPanelDockArrowDirection
  readonly revealDirection: DashPanelDockArrowDirection
  readonly revealAnchor: {
    readonly inline: 0 | 0.5 | 1
    readonly block: 0 | 1
  }
}

interface DockedMinimizeDefinition {
  readonly direction: DashPanelDockArrowDirection
  readonly x: -1 | 0 | 1
  readonly y: -1 | 0 | 1
  readonly revealAnchor: DashPanelDockedMinimizePresentation['revealAnchor']
}

const dockedMinimizeDefinitions = {
  'top-left': { direction: 'left', x: -1, y: 0, revealAnchor: { inline: 0, block: 0 } },
  'top-right': { direction: 'right', x: 1, y: 0, revealAnchor: { inline: 1, block: 0 } },
  'bottom-right': {
    direction: 'down-right',
    x: 1,
    y: 1,
    revealAnchor: { inline: 1, block: 1 },
  },
  'bottom-left': {
    direction: 'down-left',
    x: -1,
    y: 1,
    revealAnchor: { inline: 0, block: 1 },
  },
  'full-left': { direction: 'left', x: -1, y: 0, revealAnchor: { inline: 0, block: 0 } },
  'center-left': {
    direction: 'left',
    x: -1,
    y: 0,
    revealAnchor: { inline: 0, block: 0 },
  },
  'full-right': { direction: 'right', x: 1, y: 0, revealAnchor: { inline: 1, block: 0 } },
  'center-right': {
    direction: 'right',
    x: 1,
    y: 0,
    revealAnchor: { inline: 1, block: 0 },
  },
  'full-top': { direction: 'up', x: 0, y: -1, revealAnchor: { inline: 0.5, block: 0 } },
  'center-top': { direction: 'up', x: 0, y: -1, revealAnchor: { inline: 0.5, block: 0 } },
  'full-bottom': {
    direction: 'down',
    x: 0,
    y: 1,
    revealAnchor: { inline: 0.5, block: 1 },
  },
  'center-bottom': {
    direction: 'down',
    x: 0,
    y: 1,
    revealAnchor: { inline: 0.5, block: 1 },
  },
} satisfies Readonly<Record<DashPanelDockPosition, DockedMinimizeDefinition>>

function oppositeDirection(direction: DashPanelDockArrowDirection): DashPanelDockArrowDirection {
  switch (direction) {
    case 'up':
      return 'down'
    case 'up-right':
      return 'down-left'
    case 'right':
      return 'left'
    case 'down-right':
      return 'up-left'
    case 'down':
      return 'up'
    case 'down-left':
      return 'up-right'
    case 'left':
      return 'right'
    case 'up-left':
      return 'down-right'
    default: {
      const exhaustive: never = direction
      return exhaustive
    }
  }
}

export function resolveDashPanelDockedMinimizePresentation(
  position: DashPanelDockPosition,
): DashPanelDockedMinimizePresentation {
  const definition = dockedMinimizeDefinitions[position]
  return {
    exitTransform: `translate3d(${definition.x * 100}%, ${definition.y * 100}%, 0)`,
    minimizeDirection: definition.direction,
    revealDirection: oppositeDirection(definition.direction),
    revealAnchor: definition.revealAnchor,
  }
}
