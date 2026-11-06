'use client';

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { cn } from '@/lib/utils'; // Keep for utility usage if needed, though we use inline/tailwind classes mostly

interface TechnicianMapViewProps {
    projectLat: number;
    projectLng: number;
    projectRadius: number;
    projectName: string;
    onLocationUpdate: (isInRange: boolean, distance: number, coords: { lat: number, lng: number }) => void;
}

export default function TechnicianMapView({
    projectLat,
    projectLng,
    projectRadius,
    projectName,
    onLocationUpdate
}: TechnicianMapViewProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);
    const userMarkerRef = useRef<L.Marker | null>(null);
    const accuracyCircleRef = useRef<L.Circle | null>(null);
    const projectCircleRef = useRef<L.Circle | null>(null);
    const watchIdRef = useRef<number | null>(null);

    // Interpolation State
    const targetPosRef = useRef<{ lat: number, lng: number, accuracy: number } | null>(null);
    const currentPosRef = useRef<{ lat: number, lng: number } | null>(null);
    const frameRef = useRef<number>(0);
    const [displayDistance, setDisplayDistance] = useState<number | null>(null);
    const [isInside, setIsInside] = useState(false);
    const [gpsAccuracy, setGpsAccuracy] = useState<number>(0);

    // Initial fix for icons
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
        if (mapInstanceRef.current) return;

        const container = mapContainerRef.current as any;
        if (container._leaflet_id) container._leaflet_id = null;

        const map = L.map(mapContainerRef.current, {
            zoomControl: false, // Cleaner UI
            attributionControl: false
        }).setView([projectLat, projectLng], 18);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

        // Project Zone (Static)
        const circle = L.circle([projectLat, projectLng], {
            color: 'red',
            fillColor: 'red',
            fillOpacity: 0.15,
            weight: 2,
            radius: projectRadius
        }).addTo(map);
        projectCircleRef.current = circle;

        L.marker([projectLat, projectLng])
            .bindPopup(`<b>${projectName}</b><br>Meta: ${projectRadius}m`)
            .addTo(map);

        mapInstanceRef.current = map;

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, [projectLat, projectLng, projectRadius, projectName]);

    // Request Animation Frame Loop for Smoothness
    useEffect(() => {
        const loop = () => {
            if (targetPosRef.current && mapInstanceRef.current) {
                // Initialize current if null
                if (!currentPosRef.current) {
                    currentPosRef.current = { ...targetPosRef.current };
                }

                // Lerp factor (0.05 = smooth/slow, 0.2 = fast/responsive)
                // 0.1 at 60fps covers distance quickly but smoothly
                const factor = 0.08;

                const lat = currentPosRef.current.lat + (targetPosRef.current.lat - currentPosRef.current.lat) * factor;
                const lng = currentPosRef.current.lng + (targetPosRef.current.lng - currentPosRef.current.lng) * factor;

                currentPosRef.current = { lat, lng };

                // Calculate display distance based on SMOOTHED position
                const R = 6371e3;
                const φ1 = lat * Math.PI / 180;
                const φ2 = projectLat * Math.PI / 180;
                const Δφ = (projectLat - lat) * Math.PI / 180;
                const Δλ = (projectLng - lng) * Math.PI / 180;

                const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                const d = R * c;

                setDisplayDistance(d);
                const inZone = d <= projectRadius;
                setIsInside(inZone);

                // Update Parent with REAL TARGET (for validation safety) or SMOOTHED?
                // Parent logic is "Can I click button?". Button should match Visuals.
                // So we send smoothed data to parent for consistent UX.
                onLocationUpdate(inZone, d, { lat, lng });

                // Update Leaflet Markers
                const userPos: L.LatLngTuple = [lat, lng];

                if (userMarkerRef.current) {
                    userMarkerRef.current.setLatLng(userPos);
                } else {
                    const blueIcon = new L.Icon({
                        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                        iconSize: [25, 41],
                        iconAnchor: [12, 41],
                        popupAnchor: [1, -34],
                        shadowSize: [41, 41]
                    });
                    userMarkerRef.current = L.marker(userPos, { icon: blueIcon, zIndexOffset: 1000 }).addTo(mapInstanceRef.current);
                }

                if (accuracyCircleRef.current) {
                    accuracyCircleRef.current.setLatLng(userPos);
                    accuracyCircleRef.current.setRadius(targetPosRef.current.accuracy);
                } else {
                    accuracyCircleRef.current = L.circle(userPos, {
                        color: '#3b82f6',
                        weight: 1,
                        fillOpacity: 0.1,
                        radius: targetPosRef.current.accuracy
                    }).addTo(mapInstanceRef.current);
                }

                // Update Zone Color
                if (projectCircleRef.current) {
                    projectCircleRef.current.setStyle({
                        color: inZone ? 'green' : 'red',
                        fillColor: inZone ? 'green' : 'red'
                    });
                }
            }
            frameRef.current = requestAnimationFrame(loop);
        };
        loop();
        return () => cancelAnimationFrame(frameRef.current);
    }, [projectLat, projectLng, projectRadius]);


    // GPS Input Handler
    useEffect(() => {
        const handlePosition = (pos: GeolocationPosition) => {
            const { latitude, longitude, accuracy } = pos.coords;
            setGpsAccuracy(accuracy);
            // Update target for interpolation
            targetPosRef.current = { lat: latitude, lng: longitude, accuracy };

            // Auto-center map on first fix
            if (mapInstanceRef.current && !currentPosRef.current) {
                mapInstanceRef.current.setView([latitude, longitude], 18);
            }
        };

        const handleError = (err: GeolocationPositionError) => console.error("GPS Error", err);

        watchIdRef.current = navigator.geolocation.watchPosition(
            handlePosition, handleError,
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );

        const intervalId = setInterval(() => {
            navigator.geolocation.getCurrentPosition(
                handlePosition,
                () => { },
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
            );
        }, 1000); // 1s interval is enough if we interpolate

        return () => {
            if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
            clearInterval(intervalId);
        };
    }, []);

    return (
        <div className="relative h-full w-full bg-slate-100 flex flex-col">
            <div
                ref={mapContainerRef}
                className="flex-1 w-full z-0"
                style={{ isolation: 'isolate' }}
            />

            {/* Overlay Status UI - Moved inside map for fast updates */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/95 px-4 py-2 rounded-full shadow-lg z-[500] whitespace-nowrap border border-gray-200">
                {displayDistance !== null ? (
                    <div className="flex flex-col items-center">
                        <span className="text-xs text-gray-500 font-mono">GPS: ±{gpsAccuracy.toFixed(0)}m</span>
                        <div className="flex items-baseline gap-1">
                            <span className={cn("text-xl font-bold font-mono transition-colors", isInside ? "text-green-600" : "text-red-600")}>
                                {displayDistance.toFixed(0)}m
                            </span>
                            <span className="text-xs text-muted-foreground">de la meta</span>
                        </div>
                    </div>
                ) : (
                    <span className="animate-pulse">Buscando satélites...</span>
                )}
            </div>
        </div>
    );
}
