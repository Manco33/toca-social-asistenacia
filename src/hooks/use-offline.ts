import { useState, useEffect, useCallback } from 'react';

export interface OfflineStatus {
  isOnline: boolean;
  wasOffline: boolean;
  syncInProgress: boolean;
}

/**
 * Hook para detectar estado online/offline y manejar sincronización
 */
export function useOfflineStatus(): OfflineStatus {
  const [status, setStatus] = useState<OfflineStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    wasOffline: false,
    syncInProgress: false,
  });

  const handleOnline = useCallback(() => {
    setStatus((prev) => ({
      ...prev,
      isOnline: true,
      wasOffline: true, // Indica que estuvo offline recientemente
    }));

    // Disparar evento de sincronización
    window.dispatchEvent(new CustomEvent('app:online'));
  }, []);

  const handleOffline = useCallback(() => {
    setStatus((prev) => ({
      ...prev,
      isOnline: false,
    }));

    // Disparar evento de desconexión
    window.dispatchEvent(new CustomEvent('app:offline'));
  }, []);

  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  return status;
}

/**
 * Hook para escuchar cambios de conexión
 */
export function useConnectionChange(
  onOnline?: () => void,
  onOffline?: () => void
): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      onOnline?.();
    }

    function handleOffline() {
      setIsOnline(false);
      onOffline?.();
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [onOnline, onOffline]);

  return isOnline;
}
