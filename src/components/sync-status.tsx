import React from 'react';
import { CheckCircle2, AlertCircle, Loader2, WifiOff, Wifi } from 'lucide-react';
import { useOfflineStatus } from '@/hooks/use-offline';
import { useSyncManager } from '@/hooks/use-sync';

interface SyncStatusIndicatorProps {
  userId?: string;
  showDetails?: boolean;
}

/**
 * Componente para mostrar el estado de sincronización
 * Indica si está online/offline, sincronizando, y items pendientes
 */
export function SyncStatusIndicator({ userId, showDetails = false }: SyncStatusIndicatorProps) {
  const { isOnline } = useOfflineStatus();
  const { pending, syncing, lastSync, lastError } = useSyncManager(userId);

  if (!userId) {
    return null;
  }

  // Estado: offline
  if (!isOnline) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-50 border border-yellow-200">
        <WifiOff className="h-4 w-4 text-yellow-600" />
        <span className="text-sm font-medium text-yellow-800">Modo offline</span>
        {pending > 0 && (
          <span className="ml-auto text-xs bg-yellow-200 px-2 py-1 rounded text-yellow-900">
            {pending} pendiente
          </span>
        )}
      </div>
    );
  }

  // Estado: sincronizando
  if (syncing) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
        <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
        <span className="text-sm font-medium text-blue-800">Sincronizando...</span>
        {pending > 0 && (
          <span className="ml-auto text-xs bg-blue-200 px-2 py-1 rounded text-blue-900">
            {pending} de {pending + 1}
          </span>
        )}
      </div>
    );
  }

  // Estado: error
  if (lastError) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200">
        <AlertCircle className="h-4 w-4 text-red-600" />
        <span className="text-sm font-medium text-red-800">Error de sincronización</span>
        {showDetails && (
          <span className="ml-auto text-xs text-red-700 max-w-xs truncate">
            {lastError}
          </span>
        )}
      </div>
    );
  }

  // Estado: sincronizado
  if (lastSync) {
    const timeAgo = getTimeAgo(lastSync);

    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <span className="text-sm font-medium text-green-800">Sincronizado</span>
        {showDetails && (
          <span className="ml-auto text-xs text-green-700">{timeAgo}</span>
        )}
      </div>
    );
  }

  // Estado: online (por defecto)
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200">
      <Wifi className="h-4 w-4 text-green-600" />
      <span className="text-sm font-medium text-green-800">Online</span>
    </div>
  );
}

/**
 * Componente de banner para el estado de sincronización
 * Se muestra en la parte superior de la aplicación
 */
export function SyncStatusBanner({ userId }: { userId?: string }) {
  const { isOnline } = useOfflineStatus();
  const { pending, syncing, lastSync, lastError, sync } = useSyncManager(userId);

  if (!userId || (isOnline && !pending && !syncing && !lastError)) {
    return null;
  }

  let bgColor = 'bg-gray-100';
  let textColor = 'text-gray-800';
  let icon = null;
  let message = '';

  if (!isOnline) {
    bgColor = 'bg-yellow-100';
    textColor = 'text-yellow-800';
    icon = <WifiOff className="h-5 w-5 text-yellow-600" />;
    message = `Modo offline - ${pending} cambios sin sincronizar`;
  } else if (syncing) {
    bgColor = 'bg-blue-100';
    textColor = 'text-blue-800';
    icon = <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
    message = 'Sincronizando cambios...';
  } else if (lastError) {
    bgColor = 'bg-red-100';
    textColor = 'text-red-800';
    icon = <AlertCircle className="h-5 w-5 text-red-600" />;
    message = `Error: ${lastError}`;
  } else if (pending > 0) {
    bgColor = 'bg-orange-100';
    textColor = 'text-orange-800';
    icon = <AlertCircle className="h-5 w-5 text-orange-600" />;
    message = `${pending} cambios pendientes de sincronizar`;
  }

  return (
    <div className={`${bgColor} ${textColor} px-4 py-3 flex items-center gap-3 border-b border-opacity-25`}>
      {icon}
      <span className="flex-1 text-sm font-medium">{message}</span>
      {pending > 0 && isOnline && !syncing && (
        <button
          onClick={() => sync()}
          className="text-xs bg-white text-gray-900 bg-opacity-60 hover:bg-opacity-100 transition-colors px-3 py-1.5 rounded-md font-medium shadow-sm"
        >
          Sincronizar ahora
        </button>
      )}
      {lastSync && (
        <span className="text-xs opacity-75 hidden md:inline-block">
          Última sincronización: {getTimeAgo(lastSync)}
        </span>
      )}
    </div>
  );
}

/**
 * Utilidad para obtener el tiempo transcurrido en formato legible
 */
function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

  if (seconds < 60) {
    return 'hace unos segundos';
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `hace ${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `hace ${hours}h`;
  }

  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}
