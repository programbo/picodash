;(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

if (typeof window !== 'undefined') {
  // jsdom has no animation timeline. Rendered motion is verified in the Contract Lab.
  if (typeof Element.prototype.getAnimations !== 'function') {
    Object.defineProperty(Element.prototype, 'getAnimations', {
      configurable: true,
      value: () => [],
    })
  }

  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent: () => true,
      }),
    })
  }

  const css = globalThis.CSS ?? {}
  if (typeof css.escape !== 'function') {
    Object.defineProperty(css, 'escape', {
      configurable: true,
      writable: true,
      value: (value: string) => value,
    })
  }
  if (!globalThis.CSS) {
    Object.defineProperty(globalThis, 'CSS', {
      configurable: true,
      writable: true,
      value: css,
    })
  }
}
