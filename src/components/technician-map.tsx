"use client";

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamic imports for Leaflet components
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
);

// Create a loading component
const MapLoading = () => (
  <div className="h-full w-full flex items-center justify-center bg-gray-100 rounded-md">
    <div className="text-gray-500">Cargando mapa...</div>
  </div>
);



interface TechnicianLocation {
  name: string;
  project?: string;
  status: string;
  position: [number, number];
  lastUpdate: Date;
}

interface TechnicianMapProps {
  locations: TechnicianLocation[];
  center?: [number, number];
  zoom?: number;
}

export function TechnicianMap({ locations, center = [14.6349, -90.5069], zoom = 12 }: TechnicianMapProps) {
  useEffect(() => {
    // Fix for marker icons in Next.js - dynamically import leaflet and set default icon paths
    (async () => {
      try {
        const L = await import('leaflet');
        // @ts-ignore
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: '/marker-icon-2x.png',
          iconUrl: '/marker-icon.png',
          shadowUrl: '/marker-shadow.png',
        });
      } catch (e) {
        // ignore if leaflet not available at build-time
        console.warn('Leaflet dynamic import failed', e);
      }
    })();
  }, []);

  return (
    <MapContainer 
      center={center} 
      zoom={zoom} 
      style={{ height: '500px', width: '100%', borderRadius: '0.5rem' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {locations.map((loc, idx) => (
        <Marker key={idx} position={loc.position}>
          <Popup>
            <div className="p-2">
              <h3 className="font-bold">{loc.name}</h3>
              {loc.project && <p className="text-sm text-gray-600">Proyecto: {loc.project}</p>}
              <p className="text-sm text-gray-600">Estado: {loc.status}</p>
              <p className="text-xs text-gray-400">
                Última actualización: {loc.lastUpdate.toLocaleTimeString()}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}