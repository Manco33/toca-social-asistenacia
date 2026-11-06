"use client";
import { useState, useEffect } from 'react';
import { ClientOnlyMap } from './ClientOnlyMap';
import type { TechnicianLocation } from './map-component';

export function MapWithErrorBoundary(
  { locations, center, zoom, mapKey }: {
    locations: TechnicianLocation[];
    center: [number, number];
    zoom: number;
    mapKey: string;
  }
) {
  const [error, setError] = useState<Error | null>(null);
  const [instanceKey, setInstanceKey] = useState(() => `${mapKey}-${Math.random().toString(36).slice(2)}`);
  const [canRender, setCanRender] = useState(false);

  useEffect(() => {
    // Esperar un ciclo de renderizado para asegurar que el DOM anterior se destruya
    const t = setTimeout(() => setCanRender(true), 0);
    return () => clearTimeout(t);
  }, [instanceKey]);

  if (error) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center text-sm text-muted-foreground">
        <div>No se pudo cargar el mapa.<br />{error.message}</div>
        <button className="mt-2 px-3 py-1 rounded bg-primary text-white" onClick={() => window.location.reload()}>
          Recargar página
        </button>
      </div>
    );
  }

  if (!canRender) {
    return <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">Cargando mapa...</div>;
  }

  return (
    <ErrorCatcher onError={setError}>
      <ClientOnlyMap locations={locations} center={center} zoom={zoom} mapKey={instanceKey} />
    </ErrorCatcher>
  );
}

function ErrorCatcher({ children, onError }: { children: React.ReactNode, onError: (e: Error) => void }) {
  try {
    return <>{children}</>;
  } catch (e: any) {
    onError(e);
    return null;
  }
}
