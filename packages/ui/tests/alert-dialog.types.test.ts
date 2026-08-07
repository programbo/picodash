import type { RefObject } from 'react'
import type {
  AlertDialogActionProps,
  AlertDialogCancelProps,
  AlertDialogContentProps,
  AlertDialogDescriptionProps,
  AlertDialogFooterProps,
  AlertDialogHeaderProps,
  AlertDialogMediaProps,
  AlertDialogOverlayProps,
  AlertDialogTitleProps,
  AlertDialogTriggerProps,
} from '../src/index.tsx'
import { describe, it } from 'vite-plus/test'

describe('@picodash/ui AlertDialog types', () => {
  it('accepts and rejects the documented ref surface', () => {
    const buttonRef = {} as RefObject<HTMLButtonElement>
    const divRef = {} as RefObject<HTMLDivElement>

    const trigger: AlertDialogTriggerProps = { ref: buttonRef }
    const action: AlertDialogActionProps = { ref: buttonRef, closeOnPress: false }
    const cancel: AlertDialogCancelProps = { ref: buttonRef }
    const header: AlertDialogHeaderProps = { ref: divRef }
    const footer: AlertDialogFooterProps = { ref: divRef }
    const media: AlertDialogMediaProps = { ref: divRef }
    void trigger
    void action
    void cancel
    void header
    void footer
    void media

    // @ts-expect-error AlertDialogOverlay does not expose a ref.
    const overlay: AlertDialogOverlayProps = { ref: divRef, children: null }
    // @ts-expect-error AlertDialogTitle does not expose a ref.
    const title: AlertDialogTitleProps = { ref: {} as RefObject<HTMLHeadingElement> }
    // @ts-expect-error Overlay state belongs to AlertDialog.
    const overlayState: AlertDialogOverlayProps = { children: null, isOpen: true }
    // @ts-expect-error Overlay dismissal cannot be enabled.
    const overlayDismissable: AlertDialogOverlayProps = { children: null, isDismissable: true }
    const overlayPortal: AlertDialogOverlayProps = {
      children: null,
      // @ts-expect-error Overlay portal bridge prop is private.
      UNSTABLE_portalContainer: null,
    }
    // @ts-expect-error Content owns the accessible name and role.
    const contentA11y: AlertDialogContentProps = { children: null, 'aria-label': 'Nope' }
    // @ts-expect-error Description fixes its element type and slot.
    const descriptionShape: AlertDialogDescriptionProps = { elementType: 'span', slot: 'x' }
    // @ts-expect-error Action slot is fixed by closeOnPress.
    const actionSlot: AlertDialogActionProps = { slot: 'close' }
    // @ts-expect-error Trigger slot is supplied by DialogTrigger.
    const triggerSlot: AlertDialogTriggerProps = { slot: 'close' }
    void overlay
    void title
    void overlayState
    void overlayDismissable
    void overlayPortal
    void contentA11y
    void descriptionShape
    void actionSlot
    void triggerSlot
  })
})
