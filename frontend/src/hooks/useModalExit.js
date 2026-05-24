/**
 * Shared modal-exit animation helper.
 *
 * The CSS animation `mi-modal-out` (in micro-interactions.css) runs for
 * 180–200ms when the `ds-modal--closing` class is applied to the backdrop.
 * To make the animation actually visible, the modal can't unmount
 * immediately on the user's click — it needs a brief delay so the closing
 * state has time to render before the React tree is torn down.
 *
 * Pattern:
 *
 *   function MyModal({ onClose }) {
 *     const { requestClose, isClosing } = useModalExit(onClose);
 *     return (
 *       <div
 *         className={`ds-modal-backdrop${isClosing ? ' ds-modal--closing' : ''}`}
 *         onClick={requestClose}
 *       >
 *         ...
 *         <button onClick={requestClose}>×</button>
 *       </div>
 *     );
 *   }
 *
 * History: 2026-04-19 (session 29) shipped the exit-animation CSS but the
 * JS trigger was never wired. Closed in session 38 (2026-05-08).
 */
import { useState, useCallback } from 'react';

const DEFAULT_EXIT_MS = 200;

export function useModalExit(onClose, duration = DEFAULT_EXIT_MS) {
  const [isClosing, setIsClosing] = useState(false);

  const requestClose = useCallback(() => {
    if (isClosing) return; // ignore repeat triggers during the close animation
    setIsClosing(true);
    setTimeout(() => {
      if (typeof onClose === 'function') onClose();
    }, duration);
  }, [onClose, duration, isClosing]);

  return { requestClose, isClosing };
}
