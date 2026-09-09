import { describe, expect, it } from 'vite-plus/test'
import { resolveDashPanelDockedMinimizePresentation } from './docked-minimize.ts'

describe('docked Panel minimize presentation', () => {
  it.each([
    ['top-left', 'left', 'right', 'translate3d(-100%, 0%, 0)', 0, 0, ['top', 'left']],
    ['top-right', 'right', 'left', 'translate3d(100%, 0%, 0)', 1, 0, ['top', 'right']],
    [
      'bottom-left',
      'down-left',
      'up-right',
      'translate3d(-100%, 100%, 0)',
      0,
      1,
      ['bottom', 'left'],
    ],
    [
      'bottom-right',
      'down-right',
      'up-left',
      'translate3d(100%, 100%, 0)',
      1,
      1,
      ['bottom', 'right'],
    ],
    ['full-left', 'left', 'right', 'translate3d(-100%, 0%, 0)', 0, 0, ['top', 'left']],
    ['center-left', 'left', 'right', 'translate3d(-100%, 0%, 0)', 0, 0, ['top', 'left']],
    ['full-right', 'right', 'left', 'translate3d(100%, 0%, 0)', 1, 0, ['top', 'right']],
    ['center-right', 'right', 'left', 'translate3d(100%, 0%, 0)', 1, 0, ['top', 'right']],
    ['full-top', 'up', 'down', 'translate3d(0%, -100%, 0)', 0.5, 0, ['top']],
    ['center-top', 'up', 'down', 'translate3d(0%, -100%, 0)', 0.5, 0, ['top']],
    ['full-bottom', 'down', 'up', 'translate3d(0%, 100%, 0)', 0.5, 1, ['bottom']],
    ['center-bottom', 'down', 'up', 'translate3d(0%, 100%, 0)', 0.5, 1, ['bottom']],
  ] as const)(
    'maps %s to its edge exit, inverse reveal, and anchor',
    (
      position,
      minimizeDirection,
      revealDirection,
      exitTransform,
      inline,
      block,
      revealBoundaryContact,
    ) => {
      expect(resolveDashPanelDockedMinimizePresentation(position)).toEqual({
        exitTransform,
        minimizeDirection,
        revealDirection,
        revealAnchor: { inline, block },
        revealBoundaryContact,
      })
    },
  )
})
