"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { format, differenceInMinutes, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { format as formatTz } from 'date-fns-tz';
import { Briefcase, Clock, Truck, Building, Utensils, Activity, Calendar } from 'lucide-react';
import { calculateTimeStats } from '@/lib/time-calculations';
// import { supabaseAdmin as supabase } from '@/lib/supabase'; // REMOVED: Server-side only, causes crash on client

interface TechnicianPerformanceProps {
    user: {
        email: string; // or username
        name: string;
        id?: string;
    };
}

export default function TechnicianPerformance({ user }: TechnicianPerformanceProps) {
    const [logs, setLogs] = useState<any[]>([]);
    const [extras, setExtras] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(formatTz(new Date(), 'yyyy-MM-dd', { timeZone: 'America/Guatemala' }));

    // Fetch logs for the selected date
    useEffect(() => {
        async function fetchLogs() {
            setLoading(true);
            try {
                // We can reuse the daily-report API or similar, but let's just use existing table queries via a new specialized route or just filter client side if we already have data.
                // For simplicity and performance for a single user, we will hit the existing intervals API or similar.
                // Actually, let's just fetch gps logs like IdleTimeDashboard does.

                // Since we are client side, we should use an API route. 
                // Let's use the existing /api/projects/usage logic but filtered? 
                // Or better, let's just build a simple fetcher here.

                // Use the existing 'intervals' API which likely returns parsed intervals? 
                // No, let's look at raw logs to be safe and consistent with IdleDashboard logic.

                // Ensure we pass the username (e.g., 'dlima') instead of the full email ('dlima@aktivacorp.com')
                const username = user.email.includes('@') ? user.email.split('@')[0] : user.email;
                const res = await fetch(`/api/gps-logs?user=${encodeURIComponent(username)}&date=${selectedDate}`);
                const json = await res.json();

                if (json.ok) {
                    setLogs(json.logs || []);
                    setExtras(json.extras || []);
                }
            } catch (e) {
                console.error("Error loading performance data", e);
            } finally {
                setLoading(false);
            }
        }
        fetchLogs();
    }, [user.email, selectedDate]);

    // Logic from IdleTimeDashboard
    const stats = useMemo(() => {
        const {
            totalWorkedMinutes,
            projectMinutes,
            officeMinutes,
            lunchMinutes,
            idleMinutes
        } = calculateTimeStats(logs, extras);

        const totalInterval = projectMinutes + officeMinutes + lunchMinutes + idleMinutes;

        return {
            productive: totalWorkedMinutes,
            idle: idleMinutes,
            office: officeMinutes,
            project: projectMinutes,
            lunch: lunchMinutes,
            total: totalInterval
        };

    }, [logs, extras]);

    const formatHours = (mins: number) => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${h}h ${m}m`;
    };

    const getPercentage = (part: number, total: number) => {
        if (!total) return 0;
        return Math.min(100, (part / total) * 100).toFixed(1);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <Activity className="h-6 w-6 text-blue-600" />
                    Mi Rendimiento
                </h2>
                <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="border rounded px-2 py-1 text-sm bg-white"
                    />
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-4">
                <Card className="shadow-sm border-l-4 border-l-green-500">
                    <CardHeader className="pb-2">
                        <CardDescription>Productivo (Proyectos + Oficina)</CardDescription>
                        <CardTitle className="text-2xl font-bold text-green-700">{formatHours(stats.productive)}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xs text-muted-foreground flex justify-between">
                            <span>Oficina: {formatHours(stats.office)}</span>
                            <span>Proyectos: {formatHours(stats.project)}</span>
                        </div>
                        {/* Progress Bar for Productivity */}
                        <div className="mt-2 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500" style={{ width: `${getPercentage(stats.productive, stats.total - stats.lunch)}%` }}></div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-l-4 border-l-amber-500">
                    <CardHeader className="pb-2">
                        <CardDescription>Tiempo Muerto (Traslados)</CardDescription>
                        <CardTitle className="text-2xl font-bold text-amber-700">{formatHours(stats.idle)}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xs text-muted-foreground flex justify-between">
                            <span>Almuerzo: {formatHours(stats.lunch)} (Excluido)</span>
                        </div>
                        <div className="mt-2 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500" style={{ width: `${getPercentage(stats.idle, stats.total - stats.lunch)}%` }}></div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Timeline */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base font-medium">Línea de Tiempo del Día</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="relative border-l border-gray-200 ml-3 space-y-6 pb-2">
                        {loading ? (
                            <div className="pl-6 py-4 text-gray-500 italic">Cargando actividad...</div>
                        ) : logs.length === 0 ? (
                            <div className="pl-6 py-4 text-gray-500 italic">No hay actividad registrada para este día.</div>
                        ) : (
                            logs.map((log, idx) => {
                                const type = (log.tipo_actividad || '').toLowerCase();
                                let Icon = Clock;
                                let color = "bg-gray-100 text-gray-600";

                                if (type.includes('llegada a oficina')) { Icon = Building; color = "bg-blue-100 text-blue-700"; }
                                else if (type.includes('salida de oficina')) { Icon = Truck; color = "bg-amber-100 text-amber-700"; }
                                else if (type.includes('llegada a proyecto')) { Icon = Briefcase; color = "bg-green-100 text-green-700"; }
                                else if (type.includes('salida de proyecto')) { Icon = Truck; color = "bg-amber-100 text-amber-700"; }
                                else if (type.includes('iniciar almuerzo')) { Icon = Utensils; color = "bg-orange-100 text-orange-700"; }

                                return (
                                    <div key={idx} className="relative pl-6">
                                        <span className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white ${color}`}>
                                            <Icon className="h-3 w-3" />
                                        </span>
                                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
                                            <div>
                                                <p className="text-sm font-semibold text-gray-900">{log.tipo_actividad}</p>
                                                <p className="text-xs text-gray-500">{log.proyecto || 'Sin ubicación específica'}</p>
                                            </div>
                                            <time className="text-sm font-mono text-gray-500 whitespace-nowrap mt-1 sm:mt-0">
                                                {formatTz(new Date(log.created_at || `${log.fecha}T${log.hora_marcaje}`), 'HH:mm', { timeZone: 'America/Guatemala' })}
                                            </time>
                                        </div>
                                    </div>
                                );
                            })
                        )}

                        {/* Extras Timeline Items */}
                        {extras.length > 0 && (
                            <div className="border-t border-gray-100 pt-4 mt-4">
                                <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Horas Extras Aprobadas</h4>
                                {extras.map((ex, idx) => (
                                    <div key={`ex-${idx}`} className="relative pl-6 mb-4">
                                        <span className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white bg-purple-100 text-purple-700`}>
                                            <Briefcase className="h-3 w-3" />
                                        </span>
                                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
                                            <div>
                                                <p className="text-sm font-semibold text-gray-900">Horas Extra Aprobadas</p>
                                                <p className="text-xs text-gray-500">{ex.proyecto || ex.proyecto_id || 'Sin proyecto'}</p>
                                            </div>
                                            <div className="text-right">
                                                <time className="text-sm font-mono text-gray-500 whitespace-nowrap block">
                                                    {ex.hora_inicio} - {ex.hora_fin}
                                                </time>
                                                <span className="text-xs font-bold text-green-600">
                                                    +{Number(ex?.horas || 0).toFixed(2)}h
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
