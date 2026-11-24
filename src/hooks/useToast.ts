import { useState } from 'react';

/** How long a toast stays up, in milliseconds. */
const TOAST_MS = 2600;

/** The room's toast message, `''` while there is none, and the function that shows one. */
export function useToast() {
  const [message, setMessage] = useState('');

  function showToast(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(''), TOAST_MS);
  }

  return { message, showToast } as const;
}
