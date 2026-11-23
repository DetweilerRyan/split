import { createContext, useContext } from 'react';

/** The message the room is showing as a toast, or `''` when there is none. */
export const ToastContext = createContext('');

/**
 * Shows the room's toast message. An open modal dialog makes the rest of the page inert and covers
 * it with its backdrop, so `ModalDialog` renders one inside itself, and the room renders its own
 * only while no dialog is open.
 */
export function Toast() {
  const message = useContext(ToastContext);
  if (!message) return null;
  return (
    <div
      className="fixed bottom-4 right-4 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-lg"
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- <output> is for the result of a calculation; this is a notice.
      role="status"
    >
      {message}
    </div>
  );
}
