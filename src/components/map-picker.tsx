'use client';

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

interface MapPickerProps {
    lat: number | null;
    lng: number | null;
    radius: number;
    onChange: (lat: number, lng: number) => void;
}

export default function MapPicker({ lat, lng, radius, onChange }: MapPickerProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);
    const markerRef = useRef<L.Marker | null>(null);
    const circleRef = useRef<L.Circle | null>(null);

    // Default center (Guatemala City)
    const defaultCenter: L.LatLngTuple = [14.6349, -90.5069];

    // Fix icons once globally
    useEffect(() => {
        // @ts-ignore
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
            iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
            iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        });
    }, []);

    // Initialize Map
    useEffect(() => {
        if (!mapContainerRef.current) return;

        // Safety check: if map already initialized on this container, cleanup or skip
        // This is the core fix for "Map container is already initialized"
        if (mapInstanceRef.current) {
            return;
        }

        // Double safety: check if DOM element has leaflet id (vanilla check)
        const container = mapContainerRef.current as any;
        if (container._leaflet_id) {
            console.log("Cleaning up existing leaflet container id to prevent error");
            container._leaflet_id = null;
        }

        console.log("Initializing map...");
        const map = L.map(mapContainerRef.current).setView(
            (lat && lng) ? [lat, lng] : defaultCenter,
            13
        );

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        // Click handler
        map.on('click', (e: L.LeafletMouseEvent) => {
            const { lat, lng } = e.latlng;
            onChange(lat, lng);
        });

        // Save instance
        mapInstanceRef.current = map;

        // Cleanup on unmount
        return () => {
            console.log("Unmounting map...");
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, []); // Run once on mount

    // Handle prop updates (Marker & Circle & View)
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;

        // If we have coordinates, place/move marker
        if (lat && lng) {
            const newPos: L.LatLngTuple = [lat, lng];

            // Update View if completely different? Maybe just pan?
            // Let's pan only if it's the first set or far away? 
            // For now, let's just existing marker logic.

            if (markerRef.current) {
                markerRef.current.setLatLng(newPos);
            } else {
                markerRef.current = L.marker(newPos).addTo(map);
            }

            if (circleRef.current) {
                circleRef.current.setLatLng(newPos);
                circleRef.current.setRadius(radius);
            } else {
                circleRef.current = L.circle(newPos, {
                    color: 'blue',
                    fillColor: 'blue',
                    fillOpacity: 0.2,
                    radius: radius
                }).addTo(map);
            }

            // Optional: Recenter map on update if it's user interaction vs external?
            // Usually good UX to pan to selected point
            // map.setView(newPos); 
        } else {
            // No coords, remove marker/circle if exists?
            if (markerRef.current) {
                markerRef.current.remove();
                markerRef.current = null;
            }
            if (circleRef.current) {
                circleRef.current.remove();
                circleRef.current = null;
            }
        }
    }, [lat, lng, radius]); // Runs when data changes

    const [locating, setLocating] = useState(false);

    const handleLocate = () => {
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                // Update map view
                if (mapInstanceRef.current) {
                    mapInstanceRef.current.setView([latitude, longitude], 15);
                }
                // Trigger change to parent
                onChange(latitude, longitude);
                setLocating(false);
            },
            (err) => {
                console.error("Locate error:", err);
                alert("No se pudo obtener tu ubicación. Revisa los permisos del navegador.");
                setLocating(false);
            }
        );
    };

    return (
        <div className="relative h-[300px] w-full rounded border overflow-hidden z-0">
            <div
                ref={mapContainerRef}
                className="h-full w-full"
                style={{ isolation: 'isolate' }}
            />
            <button
                type="button"
                onClick={handleLocate}
                disabled={locating}
                className="absolute top-2 right-2 z-[1000] bg-white p-2 rounded shadow-md hover:bg-gray-50 border border-gray-300 focus:outline-none"
                title="Usar mi ubicación actual"
            >
                {locating ? (
                    <span className="h-5 w-5 block animate-spin border-2 border-gray-500 border-t-transparent rounded-full" />
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700">
                        <polygon points="3 11 22 2 13 21 11 13 3 11" />
                    </svg>
                )}
            </button>
        </div>
    );
}
