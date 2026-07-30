import { createPicodashStore } from '@picodash/store'

export type PerformanceHealthValues = {
  frameBudgetMs: number
  frameRate: number
  longFrames: number
  sampling: boolean
}

export const performanceHealthStore = createPicodashStore<PerformanceHealthValues>({
  panelId: 'example-performance-health',
  fields: {
    frameBudgetMs: { defaultValue: 16.7 },
    frameRate: { defaultValue: 59.8 },
    longFrames: { defaultValue: 2 },
    sampling: { defaultValue: true },
  },
})

export type MediaTransportValues = {
  currentTime: number
  duration: number
  loop: boolean
  mode: 'preview' | 'review'
  playing: boolean
}

export const mediaTransportStore = createPicodashStore<MediaTransportValues>({
  panelId: 'example-media-transport',
  fields: {
    currentTime: { defaultValue: 42 },
    duration: { defaultValue: 138 },
    loop: { defaultValue: false },
    mode: { defaultValue: 'preview' },
    playing: { defaultValue: false },
  },
})

export type DeploymentStatusValues = {
  completedSteps: number
  failedStep: string
  region: string
  status: 'failed' | 'recovering' | 'ready'
  totalSteps: number
}

export const deploymentStatusStore = createPicodashStore<DeploymentStatusValues>({
  panelId: 'example-deployment-status',
  fields: {
    completedSteps: { defaultValue: 3 },
    failedStep: { defaultValue: 'Health check' },
    region: { defaultValue: 'syd1' },
    status: { defaultValue: 'failed' },
    totalSteps: { defaultValue: 5 },
  },
})

export type MapOverlayValues = {
  labelsVisible: boolean
  opacity: number
  palette: 'thermal' | 'terrain' | 'traffic'
  threshold: number
}

export const mapOverlayStore = createPicodashStore<MapOverlayValues>({
  panelId: 'example-map-overlay',
  fields: {
    labelsVisible: { defaultValue: true },
    opacity: { defaultValue: 72 },
    palette: { defaultValue: 'traffic' },
    threshold: { defaultValue: 38 },
  },
})
