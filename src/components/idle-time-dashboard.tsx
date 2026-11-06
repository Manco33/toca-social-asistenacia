"use client";

import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { calculateTimeStats } from '@/lib/time-calculations';

// Types
type User = {
    id: number;
    usuario: string; // email
    nombre: string;
    role: string;
};

export default function IdleTimeDashboard() {
    const [loading, setLoading] = useState(false);

    // Date filters - default to current month
    const [fromDate, setFromDate] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    });
    const [toDate, setToDate] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    });

    // Data
    const [gpsLogs, setGpsLogs] = useState<any[]>([]);
    const [extrasResults, setExtrasResults] = useState<any[]>([]);

    // UI State
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    // Fetch GLOBAL data when dates change
    useEffect(() => {
        let cancelled = false;

        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch logs for ALL users (empty user param)
                // Note: The API /api/registro-horas handles empty user by returning global data
                const res = await fetch(`/api/registro-horas?from=${fromDate}&to=${toDate}`);
                const data = await res.json();

                if (!cancelled) {
                    if (data && data.gps) {
                        setGpsLogs(data.gps || []);
                        setExtrasResults(data.extras || []);
                    } else {
                        setGpsLogs([]);
                        setExtrasResults([]);
                    }
                }
            } catch (e) {
                console.error("Error fetching global idle dashboard data", e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchData();
        return () => { cancelled = true; };
    }, [fromDate, toDate]);


    // --- Logic Helpers ---

    const formatHoursToMinutes = (hours: number | string) => {
        const h = Number(hours || 0);
        const hrs = Math.floor(h);
        const mins = Math.round((h - hrs) * 60);
        return `${hrs} hrs ${mins} minutos`;
    };

    const formatShort = (hours: number) => {
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h} hrs ${m} min`;
    };

    // --- Process Data ---

    const formattedStats = useMemo(() => {
        // 1. Group by Date
        const logsByDate: Record<string, any[]> = {};
        const extrasByDate: Record<string, any[]> = {}; // Group extras by date too

        gpsLogs.forEach(g => {
            if (!logsByDate[g.fecha]) logsByDate[g.fecha] = [];
            logsByDate[g.fecha].push(g);
        });

        extrasResults.forEach(e => {
            if (!extrasByDate[e.fecha]) extrasByDate[e.fecha] = [];
            extrasByDate[e.fecha].push(e);
        });

        const allDates = new Set([...Object.keys(logsByDate), ...Object.keys(extrasByDate)]);

        const stats = Array.from(allDates).map(date => {
            const dayLogs = logsByDate[date] || [];
            const dayExtras = extrasByDate[date] || [];

            // 2. Group by User within Date
            const logsByUser: Record<string, any[]> = {};
            const extrasByUser: Record<string, any[]> = {};

            dayLogs.forEach(g => {
                const u = g.usuario || 'Desconocido';
                if (!logsByUser[u]) logsByUser[u] = [];
                logsByUser[u].push(g);
            });

            dayExtras.forEach(e => {
                const u = e.usuario || 'Desconocido';
                if (!extrasByUser[u]) extrasByUser[u] = [];
                extrasByUser[u].push(e);
            });

            const allUsers = new Set([...Object.keys(logsByUser), ...Object.keys(extrasByUser)]);

            // 3. Calculate metrics per user using Shared Logic
            const userStats = Array.from(allUsers).map(u => {
                const uLogs = logsByUser[u] || [];
                const uExtras = extrasByUser[u] || [];

                const stats = calculateTimeStats(uLogs, uExtras);

                const productive = stats.totalWorkedMinutes / 60;
                const idle = stats.idleMinutes / 60;
                const lunch = stats.lunchMinutes / 60;
                const overtime = stats.overtimeMinutes / 60;

                // Total for this context: Productive + Idle + Lunch (Full day span approx)
                const total = (stats.totalWorkedMinutes + stats.idleMinutes + stats.lunchMinutes) / 60;

                return { user: u, total, productive, idle, lunch, overtime };
            });

            // 4. Aggregate for the day
            const dayTotal = userStats.reduce((acc, curr) => acc + curr.total, 0);
            const dayProductive = userStats.reduce((acc, curr) => acc + curr.productive, 0);
            const dayIdle = userStats.reduce((acc, curr) => acc + curr.idle, 0);
            const dayLunch = userStats.reduce((acc, curr) => acc + curr.lunch, 0);
            const dayOvertime = userStats.reduce((acc, curr) => acc + curr.overtime, 0);

            // Get Day Name
            let dayName = '';
            if (date) {
                const d = new Date(date + 'T12:00:00');
                dayName = d.toLocaleString('es-ES', { weekday: 'long' });
            }

            return {
                date,
                day: dayName,
                total: dayTotal,
                productive: dayProductive,
                idle: dayIdle,
                lunch: dayLunch,
                overtime: dayOvertime,
                details: userStats
            };
        });

        return stats.sort((a, b) => a.date.localeCompare(b.date));
    }, [gpsLogs, extrasResults]);

    const monthlyTotals = useMemo(() => {
        return formattedStats.reduce((acc, curr) => ({
            productive: acc.productive + curr.productive,
            idle: acc.idle + curr.idle,
            lunch: acc.lunch + curr.lunch,
            overtime: acc.overtime + curr.overtime
        }), { productive: 0, idle: 0, lunch: 0, overtime: 0 });
    }, [formattedStats]);

    // Excel Export
    const exportToExcel = () => {
        const data: any[] = [];
        formattedStats.forEach(s => {
            // Main row
            data.push({
                'Fecha': s.date,
                'Dia': s.day,
                'Usuario': 'TODOS',
                'Horas Productivas': formatShort(s.productive),
                'Horas No Productivas': formatShort(s.idle),
                'Horas Almuerzo': formatShort(s.lunch),
                'Horas Extras': formatShort(s.overtime),
                'Total Trabajado': formatShort(s.total)
            });
            // Details
            s.details.forEach(d => {
                data.push({
                    'Fecha': s.date,
                    'Dia': '',
                    'Usuario': d.user,
                    'Horas Productivas': formatShort(d.productive),
                    'Horas No Productivas': formatShort(d.idle),
                    'Horas Almuerzo': formatShort(d.lunch),
                    'Horas Extras': formatShort(d.overtime),
                    'Total Trabajado': formatShort(d.total)
                });
            });
        });

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Tiempo Muerto Global");
        XLSX.writeFile(workbook, `tiempo-muerto-global-${fromDate}-${toDate}.xlsx`);
    };

    return (
        <div className="p-6">
            {/* Metrics Section */}
            <div className="bg-white shadow rounded p-6 mb-6">
                <h2 className="text-2xl text-center text-[#1e3a5f] font-bold mb-6 bg-blue-50 py-3 rounded">Tiempo muerto</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    {/* Text Metrics */}
                    <div className="space-y-4 text-lg">
                        <div className="flex justify-between border-b pb-2">
                            <span>Tiempo muerto total del mes</span>
                            <span className="font-bold">{formatHoursToMinutes(monthlyTotals.idle)}</span>
                        </div>
                        <div className="flex justify-between border-b pb-2">
                            <span>Tiempo productivo total del mes</span>
                            <span className="font-bold">{formatHoursToMinutes(monthlyTotals.productive)}</span>
                        </div>
                        <div className="flex justify-between border-b pb-2">
                            <span>Tiempo almuerzo total</span>
                            <span className="font-bold">{formatHoursToMinutes(monthlyTotals.lunch)}</span>
                        </div>
                        <div className="flex justify-between border-b pb-2">
                            <span>Horas extras total</span>
                            <span className="font-bold">{formatHoursToMinutes(monthlyTotals.overtime)}</span>
                        </div>
                    </div>

                    {/* Chart */}
                    <div className="border-l pl-8">
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span>Tiempo muerto</span>
                                    <span>{monthlyTotals.idle.toFixed(1)}h</span>
                                </div>
                                <div className="h-10 bg-gray-100 rounded w-full">
                                    <div className="h-full bg-blue-300 rounded" style={{ width: `${Math.min(100, (monthlyTotals.idle / (monthlyTotals.idle + monthlyTotals.productive || 1)) * 100)}%` }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span>Tiempo productivo</span>
                                    <span>{monthlyTotals.productive.toFixed(1)}h</span>
                                </div>
                                <div className="h-10 bg-gray-100 rounded w-full">
                                    <div className="h-full bg-[#1e3a5f] rounded" style={{ width: `${Math.min(100, (monthlyTotals.productive / (monthlyTotals.idle + monthlyTotals.productive || 1)) * 100)}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Breakdown Section: Desgloso */}
            <div className="bg-white shadow rounded p-6">
                <h2 className="text-2xl text-center text-[#1e3a5f] font-bold mb-6 bg-blue-50 py-3 rounded">Desglose</h2>

                {/* Controls */}
                <div className="flex justify-center gap-4 mb-6">
                    <div className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-full">
                        <span className="font-medium text-gray-600">fecha</span>
                        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="bg-[#1e3a5f] text-white px-2 py-1 rounded" />
                        <span>A</span>
                        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="bg-[#1e3a5f] text-white px-2 py-1 rounded" />
                    </div>
                </div>

                {/* Table */}
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left font-bold border-b-2 border-gray-200">
                            <th className="py-3 pl-4">Fecha</th>
                            <th className="py-3">Dia</th>
                            <th className="py-3 text-center">horas productivas</th>
                            <th className="py-3 text-center">horas no productivas</th>
                            <th className="py-3 text-center">horas almuerzo</th>
                            <th className="py-3 text-center">horas extras</th>
                            <th className="py-3 text-center">Desglose</th>
                            <th className="py-3 text-center">Descargar en xlsx</th>
                        </tr>
                    </thead>
                    <tbody>
                        {formattedStats.map((stat) => {
                            const isExpanded = expandedRows.has(stat.date);
                            const toggle = () => {
                                const next = new Set(expandedRows);
                                if (next.has(stat.date)) next.delete(stat.date);
                                else next.add(stat.date);
                                setExpandedRows(next);
                            };

                            return (
                                <React.Fragment key={stat.date}>
                                    <tr className="border-b hover:bg-gray-50 font-medium">
                                        <td className="py-3 pl-4">{stat.date}</td>
                                        <td className="py-3 capitalize">{stat.day}</td>
                                        <td className="py-3 text-center">{formatShort(stat.productive)}</td>
                                        <td className="py-3 text-center">{formatShort(stat.idle)}</td>
                                        <td className="py-3 text-center">{formatShort(stat.lunch)}</td>
                                        <td className="py-3 text-center">{formatShort(stat.overtime)}</td>
                                        <td className="py-3 text-center">
                                            <button onClick={toggle} className="text-[#1e3a5f] font-bold hover:underline flex items-center justify-center gap-1 w-full">
                                                Ver mas <span className={`transform transition ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                                            </button>
                                        </td>
                                        <td className="py-3 text-center">
                                            <button onClick={exportToExcel} className="text-gray-500 hover:text-green-600 text-lg">
                                                📥
                                            </button>
                                        </td>
                                    </tr>

                                    {/* Expandable Detail View - Table of Users */}
                                    {isExpanded && (
                                        <tr className="bg-gray-200">
                                            <td colSpan={8} className="p-4">
                                                <table className="w-full bg-white/50 border border-gray-400 text-center text-xs">
                                                    <thead>
                                                        <tr className="border-b border-gray-400 bg-gray-300">
                                                            <th className="py-1 border-r border-gray-400">usuario</th>
                                                            <th className="py-1 border-r border-gray-400">horas productivas</th>
                                                            <th className="py-1 border-r border-gray-400">horas no productivas</th>
                                                            <th className="py-1 border-r border-gray-400">horas almuerzo</th>
                                                            <th className="py-1 border-r border-gray-400">horas extras</th>
                                                            <th className="py-1">total trabajado</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {stat.details.map((d, idx) => (
                                                            <tr key={idx} className="bg-gray-200/50 border-b border-gray-300">
                                                                <td className="py-2 border-r border-gray-400 font-medium">{d.user}</td>
                                                                <td className="py-2 border-r border-gray-400">{formatShort(d.productive)}</td>
                                                                <td className="py-2 border-r border-gray-400">{formatShort(d.idle)}</td>
                                                                <td className="py-2 border-r border-gray-400">{formatShort(d.lunch)}</td>
                                                                <td className="py-2 border-r border-gray-400">{formatShort(d.overtime)}</td>
                                                                <td className="py-2">{formatShort(d.total)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                        {formattedStats.length === 0 && (
                            <tr>
                                <td colSpan={8} className="text-center py-8 text-gray-500">No hay datos para el rango seleccionado</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
