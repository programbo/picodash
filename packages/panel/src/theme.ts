import type { Transition } from 'motion/react'

export const picodashThemeAttribute = 'data-picodash-theme'
export const picodashDefaultTheme = 'dark'

export const picodashLayerTokens = {
  panelBase: 1000,
} as const

export const picodashGeometryTokens = {
  menuCollisionPadding: 8,
  menuSideOffset: 4,
  menuSubmenuOffset: 4,
  rangeThumbRadius: 7,
  selectCollisionPadding: 8,
  selectSideOffset: 4,
  xyLabelGap: 5,
} as const

export const picodashMotionTokens = {
  dragElastic: 0.01,
  featurePanelAnimate: { opacity: 1, scale: 1, y: 0 },
  featurePanelEnter: {
    duration: 0.32,
    ease: [0.22, 1, 0.36, 1],
  } satisfies Transition,
  featurePanelInitial: { opacity: 0, scale: 0.98, y: 16 },
  featureMetricAnimate: { opacity: 1, y: 0 },
  featureMetricEnter: { opacity: 0, y: 6 },
  featureMetricExit: { opacity: 0, y: -6 },
  featureMetricHover: { y: -2 },
  featureRowAnimate: { height: 'auto', opacity: 1 },
  featureRowExit: { height: 0, opacity: 0 },
  featureRowInitial: { height: 0, opacity: 0 },
  featureRow: {
    damping: 34,
    stiffness: 420,
    type: 'spring',
  } satisfies Transition,
  quickFade: {
    duration: 0.16,
  } satisfies Transition,
  reorder: {
    damping: 30,
    mass: 0.55,
    stiffness: 650,
    type: 'spring',
  } satisfies Transition,
  reorderDrag: {
    bounceDamping: 28,
    bounceStiffness: 700,
    power: 0.08,
    restDelta: 0.5,
    restSpeed: 12,
    timeConstant: 120,
  },
  viewerEnter: {
    bounce: 0.12,
    duration: 0.42,
    type: 'spring',
  } satisfies Transition,
  viewerFade: {
    duration: 0.2,
    ease: [0.16, 1, 0.3, 1],
  } satisfies Transition,
  xySpring: {
    damping: 28,
    mass: 0.35,
    stiffness: 380,
  },
  viewerSurfaceAnimate: { opacity: 1, scale: 1 },
  viewerSurfaceExit: {
    opacity: 0,
    scale: 0.97,
    transition: {
      duration: 0.16,
      ease: [0.4, 0, 1, 1],
    },
  },
  viewerSurfaceInitial: { opacity: 0, scale: 0.94 },
  viewerSurfaceReducedExit: { opacity: 0 },
  viewerOverlayAnimate: { opacity: 1 },
  viewerOverlayExit: { opacity: 0 },
  viewerOverlayInitial: { opacity: 0 },
} as const
