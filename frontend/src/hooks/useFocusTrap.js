import { useEffect, useRef } from 'react';

/**
 * Focus trap hook for modals and overlays.
 * Traps keyboard focus within the modal element and cycles through focusable elements.
 *
 * Usage:
 *   const trapRef = useFocusTrap(isModalOpen);
 *   <div ref={trapRef} role="dialog" aria-modal="true">...</div>
 */
export function useFocusTrap(isOpen) {
  const ref = useRef(null);

  useEffect(() => {
    if (!isOpen || !ref.current) return;

    const el = ref.current;
    const focusable = el.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    // Focus first focusable element when modal opens
    if (first) first.focus();

    function handleKeyDown(e) {
      // Escape is handled by parent (not trapped)
      if (e.key === 'Escape') {
        return;
      }

      // Only trap Tab key
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift+Tab backwards
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        // Tab forwards
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }

    el.addEventListener('keydown', handleKeyDown);
    return () => el.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return ref;
}
