"use client";

import { useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapWithErrorBoundary } from './MapWithErrorBoundary';

export interface TechnicianLocation {
  name: string;
  project?: string;
  status: string;
  position: [number, number];
  lastUpdate: Date;
}

interface MapComponentProps {
  locations: TechnicianLocation[];
  center: [number, number];
  zoom: number;
}


export function MapComponent({ locations, center, zoom }: MapComponentProps) {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
    try {
      // @ts-ignore
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      // @ts-ignore
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: '/marker-icon-2x.png',
        iconUrl: '/marker-icon.png',
        shadowUrl: '/marker-shadow.png',
      });
    } catch (e) {
      console.warn('Leaflet icon setup failed:', e);
    }
  }, []);

  // use a key to force remount only when center or zoom changes significantly
  const mapKey = `${center[0]}-${center[1]}-${zoom}-${locations.length}`;

  // Show a placeholder in development mode to avoid HMR map errors
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center text-center text-sm text-muted-foreground bg-yellow-50 border border-yellow-300 rounded-md p-8">
        <div className="text-lg font-semibold mb-2">Mapa deshabilitado en modo desarrollo</div>
        <div className="mb-2">El mapa está desactivado en desarrollo por un bug de HMR de Leaflet/React-Leaflet.</div>
        <div className="text-xs text-yellow-700">En producción, el mapa funcionará normalmente.</div>
      </div>
    );
  }

  if (!isClient) {
    return <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">Cargando mapa...</div>;
  }

  return (
    <MapWithErrorBoundary locations={locations} center={center} zoom={zoom} mapKey={mapKey} />
  );
}