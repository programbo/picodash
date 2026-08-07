import { createContext, useContext, type ReactElement, type ReactNode } from 'react'
import { UNSAFE_PortalProvider } from 'react-aria'

export interface PicodashOverlayProviderProps {
  children: ReactNode
  portalContainer?: HTMLElement | null
  layerBase?: number
}

export interface PicodashOverlayDefaults {
  readonly portalContainer: HTMLElement | null
  readonly layerBase?: number
}

const PicodashOverlayContext = createContext<PicodashOverlayDefaults | undefined>(undefined)

function defaultPortalContainer(): HTMLElement | null {
  return typeof document !== 'undefined' && document.body ? document.body : null
}

export function validateLayerBase(layerBase: number): number {
  if (!Number.isFinite(layerBase) || !Number.isInteger(layerBase)) {
    throw new TypeError('PicodashOverlayProvider layerBase must be a finite integer')
  }
  return layerBase
}

function resolvedOverlayDefaults(
  props: Pick<PicodashOverlayProviderProps, 'portalContainer' | 'layerBase'>,
  inherited: PicodashOverlayDefaults | undefined,
): PicodashOverlayDefaults {
  const portalContainer =
    props.portalContainer === undefined
      ? inherited
        ? inherited.portalContainer
        : defaultPortalContainer()
      : (props.portalContainer ?? defaultPortalContainer())
  const layerBase =
    props.layerBase === undefined ? inherited?.layerBase : validateLayerBase(props.layerBase)
  return Object.freeze({ portalContainer, layerBase })
}

export function PicodashOverlayProvider({
  children,
  portalContainer,
  layerBase,
}: PicodashOverlayProviderProps): ReactElement {
  const inherited = useContext(PicodashOverlayContext)
  const defaults = resolvedOverlayDefaults({ portalContainer, layerBase }, inherited)
  const bridgeProps =
    defaults.portalContainer === null
      ? { getContainer: null }
      : { getContainer: () => defaults.portalContainer }
  return (
    <PicodashOverlayContext.Provider value={defaults}>
      <UNSAFE_PortalProvider {...bridgeProps}>{children}</UNSAFE_PortalProvider>
    </PicodashOverlayContext.Provider>
  )
}

export function usePicodashOverlayDefaults(): Readonly<PicodashOverlayDefaults> {
  return (
    useContext(PicodashOverlayContext) ??
    Object.freeze({ portalContainer: defaultPortalContainer() })
  )
}
