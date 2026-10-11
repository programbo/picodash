export type DetachableState =
  | 'inline'
  | 'detaching'
  | 'detaching-away'
  | 'detaching-return-preview'
  | 'detached'
  | 'return-preview'
  | 'returning'

export function isDetaching(state: DetachableState): boolean {
  return state === 'detaching' || state === 'detaching-away' || state === 'detaching-return-preview'
}
export function isReturnPreview(state: DetachableState): boolean {
  return state === 'return-preview' || state === 'detaching-return-preview' || state === 'returning'
}
export type DetachableEvent =
  | 'detach'
  | 'pull'
  | 'settle'
  | 'enter-home'
  | 'leave-home'
  | 'begin-return'
  | 'return'
  | 'cancel'
export function transitionGroup(state: DetachableState, event: DetachableEvent): DetachableState {
  switch (event) {
    case 'detach':
      return state === 'inline' ? 'detached' : state
    case 'pull':
      return state === 'inline' ? 'detaching' : state
    case 'settle':
      return isDetaching(state) ? 'detached' : state
    case 'enter-home':
      return state === 'detaching-away'
        ? 'detaching-return-preview'
        : state === 'detached'
          ? 'return-preview'
          : state
    case 'leave-home':
      return isDetaching(state) ? 'detaching-away' : state === 'return-preview' ? 'detached' : state
    case 'begin-return':
      return state === 'inline' ? state : 'returning'
    case 'return':
      return 'inline'
    case 'cancel':
      return isDetaching(state) ? 'inline' : state === 'return-preview' ? 'detached' : state
  }
}
