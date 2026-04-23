import { useEffect } from 'react';

export default function useEscapeClose(onClose, enabled = true) {
  useEffect(() => {
    if (!enabled || typeof onClose !== 'function') return undefined;
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, enabled]);
}

