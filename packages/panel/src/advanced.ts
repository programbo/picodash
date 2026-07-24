export {
  picodashDefaultTheme,
  picodashGeometryTokens,
  picodashLayerTokens,
  picodashMotionTokens,
  picodashThemeAttribute,
} from './lib/theme/theme.js'
export {
  createValidatedPanelPersistStorage,
  emptyPicodashPersistedState,
  panelLayoutStorageKey,
} from './state/persistence/panel-persistence.js'
export { picodashPersistedStateSchema } from './state/persistence/picodash-persisted-state-schema.js'

export {
  createPicodashStore,
  panelZIndexForState,
  useRegisterPicodashPanel,
  usePicodashProviderSelector,
  usePicodashProviderStoreApi,
} from './state/provider/picodash-provider.js'
export type {
  PicodashPanelRegistration,
  PicodashPanelRegistrationInput,
  PicodashPersistedState,
  PicodashState,
  PicodashStore,
} from './state/provider/picodash-provider.js'

export {
  useRegisterPicodashItem,
  usePicodashPanelSelector,
  usePicodashPanelStoreApi,
} from './components/panel/PicodashPanel.js'
export type {
  PicodashControlStates,
  PicodashControlStateValue,
  PicodashInteractionState,
  PicodashItemKind,
  PicodashItemRegistration,
  PicodashPanelCloseBehavior,
  PicodashPanelCloseDetails,
  PicodashPanelCloseOptions,
  PicodashPanelBoundary,
  PicodashPanelCorner,
  PicodashPanelDefaultPlacement,
  PicodashPanelFixedPosition,
  PicodashPanelPlacement,
  PicodashPanelState,
  PicodashPanelSnapPosition,
  PicodashRepairProposal,
  PicodashReorderItemLayout,
  PicodashReorderItemMotion,
} from './state/panel/picodash-panel-types.js'

export {
  dataAttributesForStates,
  useResolvedPanelProp,
  usePicodashItem,
} from './components/panel/PicodashItem.js'
export {
  bandForItem,
  hasVisibleReorderableSibling,
  itemCanReorder,
  orderedItemIdsForParent,
  orderedItemsForParent,
  orderIndexForItem,
  reorderValuesForPointer,
  useOrderedPicodashChildren,
} from './state/order/picodash-order.js'

export {
  appendPicodashSparklineSamples,
  gradientCssValue,
  enabledMatrix2DOptions,
  findFirstEnabledMatrix2DPosition,
  findMatrix2DValuePosition,
  findNextMatrix2DPosition,
  isPicodashAlignmentValue,
  normalizeAlignmentValue,
  normalizeMatrix2DValue,
  normalizeRangeBounds,
  normalizeRangeValue,
  normalizeSegmentedValue,
  normalizePicodashDropzoneValue,
  normalizePicodashGradient,
  normalizePicodashHexColor,
  normalizePicodashMediaUrl,
  normalizePicodashXYBounds,
  normalizePicodashXYValue,
  normalizeVector3Value,
  normalizeVectorBounds,
  normalizeVectorStep,
  objectFitClassName,
  partitionPicodashFilesByCapacity,
  projectPicodashFileMetadata,
  projectPicodashGradientPosition,
  projectPicodashSparklineBaseline,
  projectPicodashSparklinePath,
  resolvePicodashSparklineBounds,
  projectPicodashXYLabelPosition,
  projectPicodashXYPointer,
  projectPicodashXYValue,
  segmentedOptionDisabled,
  segmentedOptionIcon,
  segmentedOptionLabel,
  segmentedOptionValue,
  picodashAlignmentOptions,
  picodashTextControlKind,
} from './inputs/index.js'
export type {
  PicodashMatrix2DDirection,
  PicodashMatrix2DPosition,
  PicodashRangeNormalizationOptions,
  PicodashXYBounds,
  PicodashXYLabelMetrics,
} from './inputs/index.js'

export {
  analyzePicodashFieldConstraint,
  applyPicodashConstraintRepair,
  jsonCompatibilityError,
  jsonValuesEqual,
  resolvePicodashFieldValue,
} from './validation/picodash-validation.js'
export type {
  PicodashConstraintAnalysis,
  PicodashConstraintRepair,
  PicodashFieldContract,
} from './validation/picodash-validation.js'
