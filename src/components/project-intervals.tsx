"use client";

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { format as formatTz } from 'date-fns-tz';
import { es } from 'date-fns/locale';

type Interval = {
  user: string;
  date: string;
  flow: string;
  start_ts: string;
  end_ts: string;
  minutes: number;
  hhmm: string;
  project?: string | null;
  start_tipo?: string;
  end_tipo?: string;
};

const formatToGuatemala = (value: string | Date | undefined | null, fmt = "yyyy-MM-dd HH:mm:ss") => {
  if (!value) return 'N/A';
  try {
    let d: Date;
    if (typeof value === 'string') {
      let datePart = '';
      let timePart = '';
      if (value.includes('T')) {
        [datePart, timePart] = value.split('T');
        timePart = timePart.replace('Z', '');
      } else if (value.includes(' ')) {
        [datePart, timePart] = value.split(' ');
      } else {
        d = new Date(String(value));
        return formatTz(d, fmt, { timeZone: 'America/Guatemala', locale: es });
      }
      const [y, mo, da] = datePart.split('-').map(Number);
      const [hh = 0, mm = 0, ss = 0] = (timePart || '00:00:00').split(':').map(Number);
      d = new Date(Date.UTC(y, (mo || 1) - 1, da || 1, (hh || 0) + 6, mm || 0, ss || 0));
    } else {
      d = value as Date;
    }
    return formatTz(d, fmt, { timeZone: 'America/Guatemala', locale: es });
  } catch (e) {
    return 'N/A';
  }
};

const sumMinutes = (items: Interval[]) => items.reduce((s, it) => s + (it.minutes || 0), 0);

export default function ProjectIntervals(): JSX.Element {
  const [user, setUser] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [intervals, setIntervals] = useState<Interval[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchIntervals = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (user) params.set('user', user);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const q = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`/api/intervals${q}`);
      const json = await res.json();
      if (json.ok) {
        setIntervals(json.intervals || []);
      } else {
        setIntervals([]);
      }
    } catch (e) {
      console.error('fetch intervals', e);
      setIntervals([]);
    } finally {
      setLoading(false);
    }
  };

  const grouped = React.useMemo(() => {
    const map = new Map<string, Interval[]>();
    intervals.forEach(it => {
      const key = (it.project || 'N/A') as string;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    });
    return Array.from(map.entries()).map(([project, items]) => ({ project, items }));
  }, [intervals]);

  // Build project summary and per-user breakdown
  const projectsSummary = React.useMemo(() => {
    return grouped.map(({ project, items }) => {
      const total = sumMinutes(items);
      // per-user aggregation
      const perUser = items.reduce((acc: Record<string, { minutes: number; count: number }>, it) => {
        const u = it.user || 'unknown';
        if (!acc[u]) acc[u] = { minutes: 0, count: 0 };
        acc[u].minutes += it.minutes || 0;
        acc[u].count += 1;
        return acc;
      }, {} as Record<string, { minutes: number; count: number }>);
      return { project, totalMinutes: total, perUser };
    });
  }, [grouped]);

  // Chart data (simple horizontal bars)
  const chartData = React.useMemo(() => {
    const max = Math.max(1, ...projectsSummary.map(p => p.totalMinutes));
    return projectsSummary.map(p => ({ project: p.project, minutes: p.totalMinutes, pct: p.totalMinutes / max }));
  }, [projectsSummary]);

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Lapsos por Proyecto</h2>
      <div className="flex items-center gap-3">
        <Input placeholder="Usuario (opcional)" value={user} onChange={(e) => setUser(e.target.value)} />
        <div className="flex items-center gap-2">
          <label className="text-sm">Desde:</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border rounded p-1" />
          <label className="text-sm">Hasta:</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border rounded p-1" />
        </div>
        <button onClick={fetchIntervals} className="px-3 py-1 bg-blue-600 text-white rounded">Buscar</button>
      </div>

      {loading ? <div className="text-sm text-muted-foreground">Cargando...</div> : (
        <div className="space-y-4">
          {grouped.length === 0 ? (
            <div className="text-muted-foreground">No se encontraron lapsos.</div>
          ) : (
            <>
              {/* Top: projects summary table */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded p-3 bg-white">
                  <h3 className="font-semibold mb-2">Resumen por Proyecto</h3>
                  <table className="w-full table-auto">
                    <thead className="text-left"><tr><th>Proyecto</th><th>Tiempo total</th><th>Usuarios</th></tr></thead>
                    <tbody>
                      {projectsSummary.map((p) => (
                        <tr key={p.project} className="border-t">
                          <td className="py-2">{p.project}</td>
                          <td className="py-2">{Math.floor(p.totalMinutes/60)}:{String(p.totalMinutes%60).padStart(2,'0')} ({p.totalMinutes}m)</td>
                          <td className="py-2">{Object.keys(p.perUser).length}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Chart */}
                <div className="border rounded p-3 bg-white">
                  <h3 className="font-semibold mb-2">Gráfico: Tiempo por Proyecto</h3>
                  <div className="space-y-2">
                    {chartData.map((c) => (
                      <div key={c.project} className="flex items-center gap-3">
                        <div className="w-1/4 text-sm">{c.project}</div>
                        <div className="flex-1 bg-gray-100 h-6 rounded overflow-hidden">
                          <div style={{ width: `${Math.max(4, Math.round(c.pct * 100))}%` }} className="h-6 bg-blue-500"></div>
                        </div>
                        <div className="w-24 text-sm text-right">{c.minutes}m</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Per-project detailed cards */}
              {grouped.map(({ project, items }) => (
                <div key={project} className="border rounded p-3 bg-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{project}</div>
                      <div className="text-sm text-muted-foreground">{items.length} lapsos • Total: {Math.floor(sumMinutes(items) / 60)}:{String(sumMinutes(items) % 60).padStart(2, '0')} ({sumMinutes(items)}m)</div>
                    </div>
                    <div className="text-sm">
                      Usuarios: {Object.keys(projectsSummary.find(p => p.project === project)!.perUser).map(u => (`${u} `))}
                    </div>
                  </div>
                  <div className="mt-3">
                    <h4 className="font-medium mb-2">Detalle por usuario</h4>
                    <table className="w-full table-auto">
                      <thead className="text-left"><tr><th>Usuario</th><th>Tiempo invertido</th><th>Veces</th></tr></thead>
                      <tbody>
                        {Object.entries(projectsSummary.find(p => p.project === project)!.perUser).map(([u, info]) => (
                          <tr key={`${project}-${u}`} className="border-t"><td className="py-2">{u}</td><td className="py-2">{Math.floor(info.minutes/60)}:{String(info.minutes%60).padStart(2,'0')} ({info.minutes}m)</td><td className="py-2">{info.count}</td></tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="mt-3">
                      <h4 className="font-medium mb-1">Lapsos</h4>
                      <table className="w-full table-auto">
                        <thead className="text-left"><tr><th>Usuario</th><th>Fecha</th><th>Duración</th><th>Inicio Tipo</th><th>Fin Tipo</th></tr></thead>
                        <tbody>
                          {items.map((it, idx) => (
                            <tr key={`${project}-${idx}`} className="border-t">
                              <td className="py-2">{it.user}</td>
                              <td className="py-2">{it.date}</td>
                              <td className="py-2">{it.hhmm} ({it.minutes}m)</td>
                              <td className="py-2">{it.start_tipo}</td>
                              <td className="py-2">{it.end_tipo}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
