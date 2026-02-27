import { useState, useCallback } from 'react';

let toastId = 0;

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((type, title, message, duration = 4000) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const success = useCallback((title, msg) => addToast('success', title, msg), [addToast]);
  const error = useCallback((title, msg) => addToast('error', title, msg), [addToast]);
  const warning = useCallback((title, msg) => addToast('warning', title, msg), [addToast]);
  const info = useCallback((title, msg) => addToast('info', title, msg), [addToast]);

  const remove = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, success, error, warning, info, remove, add: addToast };
}
