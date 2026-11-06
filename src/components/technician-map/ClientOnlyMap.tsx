"use client";
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import type { TechnicianLocation } from './map-component';

export function ClientOnlyMap({ locations, center, zoom, mapKey }: {
  locations: TechnicianLocation[];
  center: [number, number];
  zoom: number;
  mapKey: string;
}) {
  return (
    <MapContainer
      id={`map-${mapKey}`}
      key={mapKey}
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
              <p className="text-xs text-gray-400">Última actualización: {loc.lastUpdate.toLocaleTimeString()}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
