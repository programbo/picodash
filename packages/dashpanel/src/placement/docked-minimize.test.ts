import { describe, expect, it } from 'vite-plus/test'
import { resolveDashPanelDockedMinimizePresentation } from './docked-minimize.ts'

describe('docked Panel minimize presentation', () => {
  it.each([
    ['top-left', 'left', 'right', 'translate3d(-100%, 0%, 0)', 0, 0],
    ['top-right', 'right', 'left', 'translate3d(100%, 0%, 0)', 1, 0],
    ['bottom-left', 'down-left', 'up-right', 'translate3d(-100%, 100%, 0)', 0, 1],
    ['bottom-right', 'down-right', 'up-left', 'translate3d(100%, 100%, 0)', 1, 1],
    ['full-left', 'left', 'right', 'translate3d(-100%, 0%, 0)', 0, 0],
    ['center-left', 'left', 'right', 'translate3d(-100%, 0%, 0)', 0, 0],
    ['full-right', 'right', 'left', 'translate3d(100%, 0%, 0)', 1, 0],
    ['center-right', 'right', 'left', 'translate3d(100%, 0%, 0)', 1, 0],
    ['full-top', 'up', 'down', 'translate3d(0%, -100%, 0)', 0.5, 0],
    ['center-top', 'up', 'down', 'translate3d(0%, -100%, 0)', 0.5, 0],
    ['full-bottom', 'down', 'up', 'translate3d(0%, 100%, 0)', 0.5, 1],
    ['center-bottom', 'down', 'up', 'translate3d(0%, 100%, 0)', 0.5, 1],
  ] as const)(
    'maps %s to its edge exit, inverse reveal, and anchor',
    (position, minimizeDirection, revealDirection, exitTransform, inline, block) => {
      expect(resolveDashPanelDockedMinimizePresentation(position)).toEqual({
        exitTransform,
        minimizeDirection,
        revealDirection,
        revealAnchor: { inline, block },
      })
    },
  )
})
