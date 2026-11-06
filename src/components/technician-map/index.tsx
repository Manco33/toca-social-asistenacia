"use client";

import { useEffect } from 'react';
import dynamic from 'next/dynamic';

const MapComponent = dynamic(
  () => import('./map-component').then((mod) => mod.MapComponent),
  {
    loading: () => (
      <div className="h-full w-full flex items-center justify-center bg-gray-100 rounded-md">
        <div className="text-gray-500">Cargando mapa...</div>
      </div>
    ),
    ssr: false,
  }
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

export function TechnicianMap({ 
  locations, 
  center = [14.6349, -90.5069], 
  zoom = 12 
}: TechnicianMapProps) {
  return <MapComponent locations={locations} center={center} zoom={zoom} />;
}