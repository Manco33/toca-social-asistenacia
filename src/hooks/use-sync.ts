import { useEffect, useState, useCallback } from 'react';
import {
  getSyncQueue,
  removeSyncQueueItem,
  markAsSynced,
} from '@/lib/offline-db';
import { useToast } from '@/hooks/use-toast';
import { useConnectionChange } from './use-offline';

interface SyncStats {
  pending: number;
  syncing: boolean;
  lastSync: Date | null;
  lastError: string | null;
}

/**
 * Hook para manejar sincronización automática de datos offline
 * Se dispara cuando regresa online y sincroniza cambios pendientes
 */
export function useSyncManager(userId: string | undefined) {
  const { toast } = useToast();
  const [stats, setStats] = useState<SyncStats>({
    pending: 0,
    syncing: false,
    lastSync: null,
    lastError: null,
  });

  // Sincronizar cuando regresa online
  useConnectionChange(
    () => {
      if (userId) {
        triggerSync();
      }
    },
    () => {
      // Usuario fue desconectado
      console.log('[Sync] User went offline');
    }
  );

  /**
   * Obtiene el número de items pendientes de sincronizar
   */
  const getPendingCount = useCallback(async () => {
    if (!userId) return;

    try {
      const queue = await getSyncQueue(userId);
      setStats((prev) => ({
        ...prev,
        pending: queue.length,
      }));
    } catch (error) {
      console.error('[Sync] Error getting pending count:', error);
    }
  }, [userId]);

  /**
   * Sincroniza un item de la cola
   */
  const syncQueueItem = useCallback(
    async (item: any): Promise<boolean> => {
      try {
        // Determinar el endpoint según el tipo de acción
        let endpoint = '/api/sync';

        // Llamar a la API para sincronizar
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: item.action,
            data: item.data,
            userId: item.userId,
            originalTimestamp: item.timestamp,
          }),
        });

        if (!response.ok) {
          throw new Error(`Sync failed: ${response.statusText}`);
        }

        // Marcar como sincronizado
        await removeSyncQueueItem(item.id);

        // Si es un time entry, marcarlo como synced
        if (item.action === 'create' && item.data?.id) {
          await markAsSynced(item.data.id);
        }

        return true;
      } catch (error) {
        console.error('[Sync] Error syncing item:', error);
        return false;
      }
    },
    []
  );

  /**
   * Realiza la sincronización completa
   */
  const triggerSync = useCallback(async () => {
    if (!userId || stats.syncing) return;

    setStats((prev) => ({
      ...prev,
      syncing: true,
      lastError: null,
    }));

    try {
      const queue = await getSyncQueue(userId);

      if (queue.length === 0) {
        console.log('[Sync] No pending items to sync');
        setStats((prev) => ({
          ...prev,
          syncing: false,
          lastSync: new Date(),
        }));
        return;
      }

      console.log(`[Sync] Starting sync of ${queue.length} items`);

      let successCount = 0;
      let failureCount = 0;

      // Sincronizar items en paralelo (máximo 5 simultáneamente)
      const batchSize = 5;
      for (let i = 0; i < queue.length; i += batchSize) {
        const batch = queue.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map((item) => syncQueueItem(item))
        );

        successCount += results.filter((r) => r).length;
        failureCount += results.filter((r) => !r).length;
      }

      // Actualizar estadísticas
      const pendingQueue = await getSyncQueue(userId);
      setStats((prev) => ({
        ...prev,
        syncing: false,
        lastSync: new Date(),
        pending: pendingQueue.length,
      }));

      // Mostrar notificación
      if (failureCount === 0) {
        toast({
          title: 'Sincronización completada',
          description: `${successCount} cambios sincronizados exitosamente`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Sincronización parcial',
          description: `${successCount} éxitos, ${failureCount} fallos`,
        });
      }

      console.log(
        `[Sync] Sync completed: ${successCount} success, ${failureCount} failed`
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[Sync] Sync error:', error);

      setStats((prev) => ({
        ...prev,
        syncing: false,
        lastError: errorMsg,
      }));

      toast({
        variant: 'destructive',
        title: 'Error de sincronización',
        description: errorMsg,
      });
    }
  }, [userId, stats.syncing, syncQueueItem, toast]);

  /**
   * Sincronización inicial al montar
   */
  useEffect(() => {
    getPendingCount();

    // Trigger sync if online and there are pending items
    if (userId && typeof navigator !== 'undefined' && navigator.onLine) {
      getSyncQueue(userId)
        .then((queue) => {
          if (queue.length > 0) {
            console.log('[Sync] Startup: Found pending items, triggering sync...');
            setTimeout(() => triggerSync(), 2000); // Dar un respiro inicial antes de enviar red
          }
        })
        .catch(console.error);
    }

    // Escuchar eventos de sincronización desde Service Worker
    const handleSyncStart = () => {
      setStats((prev) => ({
        ...prev,
        syncing: true,
      }));
    };

    const handleSyncComplete = () => {
      getPendingCount();
      setStats((prev) => ({
        ...prev,
        syncing: false,
        lastSync: new Date(),
      }));
    };

    window.addEventListener('message', (event) => {
      if (event.data.type === 'SYNC_START') {
        handleSyncStart();
      } else if (event.data.type === 'SYNC_COMPLETE') {
        handleSyncComplete();
      }
    });

    return () => {
      // Cleanup
    };
  }, [getPendingCount]);

  return {
    ...stats,
    sync: triggerSync,
    getPendingCount,
  };
}
