import { useEffect, useRef, type ReactNode } from 'react';
import { Toast } from './Toast';

interface ModalDialogProps {
  /** The id of the heading that names the dialog. */
  readonly labelledBy: string;
  /** Classes added to the `modal-card` ones. */
  readonly className?: string;
  /** Called when the person closes the dialog with Escape or by tapping outside it. */
  readonly onClose: () => void;
  readonly children: ReactNode;
}

/**
 * A modal `<dialog>`, open while it's rendered. The browser keeps focus inside it and makes the
 * page behind it inert; `closedby="any"` closes it on Escape or a tap outside, through the polyfill
 * that `src/polyfills/dialogClosedBy.ts` loads where the browser lacks it.
 */
export function ModalDialog({ labelledBy, className = '', onClose, children }: ModalDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    // Calling it again on an open modal dialog does nothing, so React's development-mode double
    // effect is harmless.
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className={`modal-card ${className}`}
      aria-labelledby={labelledBy}
      closedby="any"
      onClose={onClose}
    >
      {children}
      <Toast />
    </dialog>
  );
}
