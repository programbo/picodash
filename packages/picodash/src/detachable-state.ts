export type DetachableState = 'inline' | 'detaching' | 'detached' | 'return-preview'
export type DetachableEvent =
  | 'detach'
  | 'pull'
  | 'settle'
  | 'enter-home'
  | 'leave-home'
  | 'return'
  | 'cancel'
export function transitionGroup(state: DetachableState, event: DetachableEvent): DetachableState {
  switch (event) {
    case 'detach':
      return state === 'inline' ? 'detached' : state
    case 'pull':
      return state === 'inline' ? 'detaching' : state
    case 'settle':
      return state === 'detaching' ? 'detached' : state
    case 'enter-home':
      return state === 'detached' ? 'return-preview' : state
    case 'leave-home':
      return state === 'return-preview' ? 'detached' : state
    case 'return':
      return 'inline'
    case 'cancel':
      return state === 'detaching' ? 'inline' : state === 'return-preview' ? 'detached' : state
  }
}
