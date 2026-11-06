"use client";

import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search as SearchIcon, ChevronDown, Download, Loader2, LayoutGrid, BarChart as BarChartIcon } from 'lucide-react';
import * as XLSX from 'xlsx';
import { calculateTimeStats } from '@/lib/time-calculations';

type User = { id?: number | string; usuario?: string; nombre?: string; numero_celular?: string; rol?: string };

export default function AdminDashboardPanel(): JSX.Element {
  // Search / selection
  const [techQuery, setTechQuery] = useState('');
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Dates (default to current month)
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState<string>(firstOfMonth);
  const [toDate, setToDate] = useState<string>(todayStr);

  // Registro data
  const [registroRows, setRegistroRows] = useState<any[]>([]);
  const [gpsLogs, setGpsLogs] = useState<any[]>([]);
  const [extrasResults, setExtrasResults] = useState<any[]>([]); // New state for extras
  const [totalsMap, setTotalsMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  // UI filter type (Proyecto / Fecha) - visual only for now but included per design
  const [filterType, setFilterType] = useState<'proyecto' | 'fecha'>('proyecto');

  // Track expanded rows for desglose
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Project search filter
  const [projectQuery, setProjectQuery] = useState('');
  const [projectSuggestions, setProjectSuggestions] = useState<string[]>([]);

  // Debounced suggestions for technician search
  useEffect(() => {
    if (!techQuery || techQuery.trim().length < 1) { setSuggestions([]); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/users?search=${encodeURIComponent(techQuery.trim())}`);
        const j = await res.json();
        if (!cancelled && res.ok) {
          let users = j.users || [];
          // Also filter locally by id/usuario to handle numeric searches
          const query = techQuery.trim().toLowerCase();
          users = users.filter((u: User) =>
            (u.nombre && u.nombre.toLowerCase().includes(query)) ||
            (u.usuario && String(u.usuario).toLowerCase().includes(query)) ||
            (u.id && String(u.id).toLowerCase().includes(query))
          );
          setSuggestions(users);
        }
      } catch (e) {
        if (!cancelled) setSuggestions([]);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [techQuery]);

  // Refs for click-outside behavior
  const techInputRef = useRef<HTMLInputElement | null>(null);
  const techSuggestionsRef = useRef<HTMLUListElement | null>(null);
  const projectInputRef = useRef<HTMLInputElement | null>(null);
  const projectSuggestionsRef = useRef<HTMLDivElement | null>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (techSuggestionsRef.current && techInputRef.current && !techSuggestionsRef.current.contains(target) && !techInputRef.current.contains(target)) {
        setSuggestions([]);
      }
      if (projectSuggestionsRef.current && projectInputRef.current && !projectSuggestionsRef.current.contains(target) && !projectInputRef.current.contains(target)) {
        setProjectSuggestions([]);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // Fetch registro-horas when selected user or date range changes
  useEffect(() => {
    if (!selectedUser) { setRegistroRows([]); setGpsLogs([]); setTotalsMap({}); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const userParam = selectedUser.id ?? selectedUser.usuario ?? '';
        const url = `/api/registro-horas?user=${encodeURIComponent(String(userParam))}&from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`;
        const res = await fetch(url);
        const j = await res.json();
        if (!cancelled && res.ok) {
          setRegistroRows(j.registro || []);
          setGpsLogs(j.gps || []);
          setExtrasResults(j.extras || []); // Save extras
          setTotalsMap(j.totals || {});
        } else if (!cancelled) {
          setRegistroRows([]);
          setGpsLogs([]);
          setTotalsMap({});
        }
      } catch (e) {
        if (!cancelled) {
          setRegistroRows([]);
          setGpsLogs([]);
          setTotalsMap({});
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedUser, fromDate, toDate]);

  // Helper to calculate daily total using Shared Logic
  const calculateDailyTotal = (date: string) => {
    const logs = (gpsLogs || []).filter((g: any) => g.fecha === date);
    // Find extras for this date? Not easily available in `extrasResults` unless we filter.
    // However, `extrasResults` contains approved extras in range.
    const dateExtras = (extrasResults || []).filter((e: any) => e.fecha === date);

    // We use calculateTimeStats to get Total Worked (Productive + Office)
    const { totalWorkedMinutes } = calculateTimeStats(logs, dateExtras);

    // Convert minutes to hours
    return totalWorkedMinutes / 60;
  };

  // Calculate overall stats for the selected range (Use Shared Logic)
  const overallStats = useMemo(() => {
    return calculateTimeStats(gpsLogs || [], extrasResults || []);
  }, [gpsLogs, extrasResults]);

  const totalWorked = overallStats.totalWorkedMinutes / 60;


  // Calculate project summaries with accurate duration from GPS logs
  const projectSummary = useMemo(() => {
    type SummaryEntry = { project: string; projectId?: number | null; horasExtras: number; tiempoEnProyecto: number; tiempoTrabajado: number; logs: number; usuarios: Set<string> };
    const summary: Record<string, SummaryEntry> = {};

    // Group logs by User to feed into calculateTimeStats correctly
    const logsByUser: Record<string, any[]> = {};
    (gpsLogs || []).forEach((g: any) => {
      const u = g.usuario || 'unknown';
      logsByUser[u] = logsByUser[u] || [];
      logsByUser[u].push(g);
    });

    const extrasByUser: Record<string, any[]> = {};
    (extrasResults || []).forEach((e: any) => {
      const u = e.usuario || 'unknown';
      extrasByUser[u] = extrasByUser[u] || [];
      extrasByUser[u].push(e);
    });

    const allUsers = new Set([...Object.keys(logsByUser), ...Object.keys(extrasByUser)]);

    allUsers.forEach(user => {
      const logs = logsByUser[user] || [];
      const extras = extrasByUser[user] || [];

      const { projectBreakdown } = calculateTimeStats(logs, extras);

      Object.keys(projectBreakdown).forEach(pNameKey => {
        // Recover original name case (approximation)
        const sampleLog = logs.find(l => String(l.proyecto || '').trim().toLowerCase() === pNameKey);
        const sampleExtra = extras.find(e => String(e.proyecto || '').trim().toLowerCase() === pNameKey);
        const originalName = (sampleLog && sampleLog.proyecto) || (sampleExtra && sampleExtra.proyecto) || pNameKey;

        const hours = projectBreakdown[pNameKey] / 60; // minutes to hours

        if (!summary[pNameKey]) {
          summary[pNameKey] = {
            project: originalName,
            projectId: null,
            horasExtras: 0,
            tiempoEnProyecto: 0,
            tiempoTrabajado: 0,
            logs: 0,
            usuarios: new Set()
          };
        }
        summary[pNameKey].tiempoTrabajado += hours;
        summary[pNameKey].tiempoEnProyecto += hours;
        summary[pNameKey].usuarios.add(user);
        // Approximate log count
        summary[pNameKey].logs += logs.filter(l => String(l.proyecto || '').toLowerCase().includes(pNameKey)).length;
      });
    });

    // Populate explicit "Horas Extras" column sum
    (extrasResults || []).forEach((r: any) => {
      const pName = String(r.proyecto || '').trim();
      const pId = r.proyecto_id;
      const h = Number(r.horas || 0);

      if (pName) {
        const key = pName.toLowerCase();
        if (summary[key]) {
          summary[key].horasExtras += h;
        } else {
          // Edge case: Project only in extras
          summary[key] = {
            project: pName,
            projectId: pId || null,
            horasExtras: h,
            tiempoEnProyecto: 0,
            tiempoTrabajado: 0,
            logs: 0,
            usuarios: new Set([r.usuario])
          };
        }
      }
    });

    // Convert to array
    return Object.values(summary)
      .map(p => ({
        ...p,
        usuarios: p.usuarios.size,
      }))
      .sort((a, b) => b.tiempoTrabajado - a.tiempoTrabajado);
  }, [registroRows, gpsLogs, extrasResults]);

  // Update project suggestions when query changes
  useEffect(() => {
    if (!projectQuery.trim()) {
      setProjectSuggestions([]);
      return;
    }
    const query = projectQuery.toLowerCase();
    const isNumeric = /^\d+$/.test(projectQuery.trim());
    const suggestions = projectSummary
      .filter(p => {
        if (isNumeric && p.projectId) return p.projectId === Number(projectQuery.trim());
        return p.project.toLowerCase().includes(query);
      })
      .map(p => p.project);
    setProjectSuggestions(suggestions);
  }, [projectQuery, projectSummary]);

  // Filter projects based on search query and date range
  const filteredProjectSummary = useMemo(() => {
    let filtered = projectSummary;

    // Filter by project query
    if (projectQuery.trim()) {
      const queryRaw = projectQuery.trim();
      const query = queryRaw.toLowerCase();
      const isNumeric = /^\d+$/.test(queryRaw);
      filtered = filtered.filter(p => {
        if (isNumeric && p.projectId) return p.projectId === Number(queryRaw);
        return p.project.toLowerCase().includes(query);
      });
    }

    // Filter by date range (when in proyecto view)
    if (filterType === 'proyecto' && (fromDate || toDate)) {
      filtered = filtered.map(p => {
        // Filter GPS logs for this project within range
        const projectLogsInRange = (gpsLogs || []).filter((g: any) => {
          const gFecha = g.fecha;
          // Case insensitive match
          const gProy = String(g.proyecto || '').trim().toLowerCase();
          const pProy = String(p.project || '').trim().toLowerCase();

          return (!fromDate || gFecha >= fromDate) && (!toDate || gFecha <= toDate) && gProy === pProy;
        });

        // Filter Extras for this project within range
        const projectExtrasInRange = (extrasResults || []).filter((r: any) => {
          const rFecha = r.fecha;
          if (fromDate && rFecha < fromDate) return false;
          if (toDate && rFecha > toDate) return false;

          const rProyId = r.proyecto_id ? Number(r.proyecto_id) : null;
          const pProyId = p.projectId ? Number(p.projectId) : null;

          if (rProyId && pProyId && rProyId === pProyId) return true;

          const rProy = String(r.proyecto || '').trim().toLowerCase();
          const pProy = String(p.project || '').trim().toLowerCase();
          return rProy === pProy;
        });

        const logsInRange = projectLogsInRange.length;

        // Group by user for accurate calculation
        const logsByUser: Record<string, any[]> = {};
        projectLogsInRange.forEach((g: any) => {
          const u = g.usuario || 'unknown';
          logsByUser[u] = logsByUser[u] || [];
          logsByUser[u].push(g);
        });

        const extrasByUser: Record<string, any[]> = {};
        (projectExtrasInRange || []).forEach((e: any) => {
          const u = e.usuario || 'unknown';
          extrasByUser[u] = extrasByUser[u] || [];
          extrasByUser[u].push(e);
        });

        const distinctUsers = new Set([...Object.keys(logsByUser), ...Object.keys(extrasByUser)]);
        let totalProjectMinutes = 0;
        let totalOvertimeMinutes = 0;

        distinctUsers.forEach(u => {
          const logs = logsByUser[u] || [];
          const extras = extrasByUser[u] || [];
          const { projectMinutes, overtimeMinutes } = calculateTimeStats(logs, extras);
          totalProjectMinutes += projectMinutes;
          totalOvertimeMinutes += overtimeMinutes; // distinct
        });

        const totalWorkedHours = (totalProjectMinutes + totalOvertimeMinutes) / 60;
        const totalOvertimeHours = totalOvertimeMinutes / 60;

        return {
          ...p,
          logs: logsInRange,
          tiempoTrabajado: totalWorkedHours,
          horasExtras: totalOvertimeHours
        };
      });
    }

    return filtered;
  }, [projectQuery, projectSummary, filterType, fromDate, toDate, registroRows, gpsLogs, extrasResults]);

  // Function to export table to CSV (Excel compatible)
  // Helper to get day name using local timezone (avoid UTC shifts)
  const getDayName = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = String(dateStr).split('-');
    if (parts.length < 3) return '';
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleString('es-ES', { weekday: 'long' });
  };

  const exportTableToExcel = () => {
    const data: any[] = [];

    if (Object.keys(totalsMap).length) {
      Object.keys(totalsMap).sort().forEach(dateKey => {
        const t = totalsMap[dateKey];
        const registroForDate = (registroRows || []).filter(r => r.fecha === dateKey);

        const calculated = calculateDailyTotal(dateKey);
        const horasTrab = calculated > 0 ? formatHoursToMinutes(calculated) : '-';

        const horasExtraForDate = registroForDate.reduce((acc, r) => acc + Number(r.horas_extras || 0), 0);
        const dayName = getDayName(dateKey);

        data.push({
          'Fecha': dateKey,
          'Día': dayName,
          'Horas trabajadas': horasTrab,
          'Horas extra': `${horasExtraForDate} HRS`
        });
      });
    } else {
      (registroRows || []).forEach((r: any) => {
        const dayName = getDayName(String(r.fecha));
        const calculated = calculateDailyTotal(r.fecha);
        data.push({
          'Fecha': r.fecha,
          'Día': dayName,
          'Horas trabajadas': calculated > 0 ? formatHoursToMinutes(calculated) : '0 horas 0 minutos',
          'Horas extra': `${r.horas_extras || 0} HRS`
        });
      });
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Resumen Diario");

    XLSX.writeFile(workbook, `resumen-${selectedUser?.usuario || 'tecnico'}-${fromDate}-${toDate}.xlsx`);
  };

  const exportProjectToExcel = () => {
    // Prepare data for Excel
    const data = filteredProjectSummary.map((p: any) => {
      // tiempoTrabajado is now Regular Project Time.
      const tiempoSinExtras = p.tiempoTrabajado;
      const totalHourSum = p.tiempoTrabajado + p.horasExtras;

      return {
        'Proyecto': p.project,
        'Tiempo sin extras': formatHoursToMinutes(tiempoSinExtras),
        'Horas extras': `${Number(p.horasExtras).toFixed(2)} hrs`,
        'Total': formatHoursToMinutes(totalHourSum),
        'Usuarios': p.usuarios
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Proyectos");

    // Generate Excel file
    XLSX.writeFile(workbook, `reporte-proyectos-${fromDate}-${toDate}.xlsx`);
  };

  const horasExtra = useMemo(() => {
    return (registroRows || []).reduce((acc: number, r: any) => acc + Number(r.horas_extras || 0), 0);
  }, [registroRows]);

  // Small helpers
  const onSelectSuggestion = (u: User) => {
    setSelectedUser(u);
    setTechQuery(u.nombre || String(u.id || u.usuario));
    setSuggestions([]);
  };

  const formatHoursToMinutes = (hours: number | string) => {
    const h = Number(hours || 0);
    const hrs = Math.floor(h);
    const mins = Math.round((h - hrs) * 60);
    return `${hrs} horas ${mins} minutos`;
  };




  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* ── Search Bar ─────────────────────────────────── */}
      <div className="rounded-xl bg-gradient-to-r from-[#1e3a5f] to-[#264d73] p-4 sm:p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
            <input
              ref={techInputRef}
              value={techQuery}
              onChange={(e) => setTechQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && suggestions && suggestions.length > 0) {
                  e.preventDefault();
                  onSelectSuggestion(suggestions[0]);
                }
              }}
              placeholder="Buscar técnico por ID o nombre..."
              className="w-full py-2.5 pl-10 pr-4 rounded-lg bg-white/10 backdrop-blur text-white placeholder-white/40 border border-white/15 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15 transition-all text-sm"
            />
            {suggestions.length > 0 && (
              <ul ref={techSuggestionsRef} className="absolute left-0 right-0 bg-white rounded-lg border border-slate-200 shadow-xl mt-2 max-h-48 overflow-auto z-40">
                {suggestions.map(s => (
                  <li key={String(s.id ?? s.usuario)} className="px-4 py-3 hover:bg-blue-50 cursor-pointer text-slate-800 text-sm font-medium transition-colors first:rounded-t-lg last:rounded-b-lg" onMouseDown={() => onSelectSuggestion(s)}>
                    <span className="text-slate-900">{s.nombre}</span>
                    <span className="text-slate-400 ml-2 text-xs">({s.usuario ?? s.id})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur rounded-lg px-4 py-2.5 border border-white/15 shrink-0">
            <div className="text-white/60 text-xs font-medium uppercase tracking-wider">Total</div>
            <div className="text-white font-semibold text-sm">{formatHoursToMinutes(totalWorked)}</div>
          </div>
        </div>
      </div>

      {/* ── Stat Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Monthly Summary Card */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-shadow hover:shadow-md">
          <div className="flex items-center gap-3 p-4 sm:p-5 border-b border-slate-100">
            <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <BarChartIcon className="h-5 w-5 text-[#1e3a5f]" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">Resumen del Período</h3>
              <p className="text-xs text-slate-400">Desglose de horas por categoría</p>
            </div>
          </div>
          <div className="p-4 sm:p-5 space-y-3">
            {[
              { label: 'Horas en oficina', value: formatHoursToMinutes(overallStats.officeMinutes / 60), color: 'bg-blue-500' },
              { label: 'Horas en proyecto', value: formatHoursToMinutes(overallStats.projectMinutes / 60), color: 'bg-emerald-500' },
              { label: 'Horas extra', value: formatHoursToMinutes(overallStats.overtimeMinutes / 60), color: 'bg-amber-500' },
              { label: 'Horas de movilización', value: formatHoursToMinutes(overallStats.idleMinutes / 60), color: 'bg-slate-400' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2.5">
                  <div className={`w-2 h-2 rounded-full ${item.color}`} />
                  <span className="text-sm text-slate-600">{item.label}</span>
                </div>
                <span className="text-sm font-semibold text-slate-800">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Technician Info Card */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-shadow hover:shadow-md">
          <div className="flex items-center gap-3 p-4 sm:p-5 border-b border-slate-100">
            <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
              <LayoutGrid className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">Información del Técnico</h3>
              <p className="text-xs text-slate-400">Datos personales y horario</p>
            </div>
          </div>
          <div className="p-4 sm:p-5 space-y-3">
            {[
              { label: 'Nombre', value: selectedUser?.nombre || '—' },
              { label: 'No. Telefónico', value: selectedUser?.numero_celular || '—' },
              { label: 'Rol', value: selectedUser?.rol || '—' },
              { label: 'Hora de entrada', value: '—' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between py-1.5">
                <span className="text-sm text-slate-500">{item.label}</span>
                <span className="text-sm font-medium text-slate-800">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Section Header: Desglose ───────────────────── */}
      <div className="flex items-center gap-3">
        <div className="h-8 w-1 rounded-full bg-[#1e3a5f]" />
        <h2 className="text-lg font-bold text-slate-800">Desglose</h2>
      </div>

      {/* ── Filter Controls ────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <div className="flex items-center bg-slate-50 rounded-lg border border-slate-200 px-3 py-2 gap-2 transition-colors focus-within:border-[#1e3a5f] focus-within:ring-2 focus-within:ring-[#1e3a5f]/10">
            <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)} className="bg-transparent text-sm font-medium text-slate-700 cursor-pointer focus:outline-none pr-1">
              <option value="proyecto">Proyecto</option>
              <option value="fecha">Fecha</option>
            </select>
            <div className="w-px h-5 bg-slate-200" />
            <SearchIcon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <input
              ref={projectInputRef}
              value={filterType === 'proyecto' ? projectQuery : ''}
              onChange={(e) => filterType === 'proyecto' && setProjectQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && projectSuggestions && projectSuggestions.length > 0) {
                  e.preventDefault();
                  setProjectQuery(projectSuggestions[0]);
                  setProjectSuggestions([]);
                }
              }}
              placeholder={filterType === 'proyecto' ? 'Buscar proyecto...' : 'Buscar por fecha...'}
              className="bg-transparent outline-none flex-1 text-sm text-slate-700 placeholder-slate-400"
            />
          </div>
          {filterType === 'proyecto' && projectQuery && projectSuggestions.length > 0 && (
            <div ref={projectSuggestionsRef} className="absolute left-0 right-0 bg-white rounded-lg border border-slate-200 shadow-xl mt-2 max-h-48 overflow-auto z-40">
              {projectSuggestions.map((proj, idx) => (
                <div
                  key={idx}
                  onMouseDown={() => {
                    setProjectQuery(proj);
                    setProjectSuggestions([]);
                  }}
                  className="px-4 py-3 hover:bg-blue-50 cursor-pointer text-sm text-slate-700 font-medium transition-colors first:rounded-t-lg last:rounded-b-lg"
                >
                  {proj}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-700 focus:outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10 transition-all" />
          <span className="text-xs text-slate-400 font-medium">a</span>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-700 focus:outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10 transition-all" />
          <button onClick={() => { if (selectedUser) { setFromDate(fromDate); } }} className="px-4 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#264d73] active:scale-95 transition-all shadow-sm">Aplicar</button>
        </div>

        <div className="sm:ml-auto">
          {filterType === 'fecha' && <button onClick={exportTableToExcel} className="inline-flex items-center gap-2 px-4 py-2 border border-emerald-200 text-emerald-700 bg-emerald-50 rounded-lg text-sm font-medium hover:bg-emerald-100 hover:border-emerald-300 transition-all active:scale-95"><Download className="h-4 w-4" /> Excel</button>}
          {filterType === 'proyecto' && <button onClick={exportProjectToExcel} className="inline-flex items-center gap-2 px-4 py-2 border border-emerald-200 text-emerald-700 bg-emerald-50 rounded-lg text-sm font-medium hover:bg-emerald-100 hover:border-emerald-300 transition-all active:scale-95"><Download className="h-4 w-4" /> Excel</button>}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-[#1e3a5f]" />
          <span className="text-sm text-slate-500">Cargando datos...</span>
        </div>
      )}

      {/* ── Vista por Fecha ───────────────────────────── */}
      {!loading && filterType === 'fecha' && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">Fecha</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">Día</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">Horas trabajadas</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">Horas extra</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">Desglose</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">xlsx</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(Object.keys(totalsMap).length ? Object.keys(totalsMap).sort().map(dateKey => {
                  const t = totalsMap[dateKey];
                  const registroForDate = (registroRows || []).filter(r => r.fecha === dateKey);
                  const calculated = calculateDailyTotal(dateKey);
                  const horasTrab = calculated > 0 ? `${formatHoursToMinutes(calculated)} (${calculated.toFixed(2)}h)` : '-';
                  const horasExtraForDate = registroForDate.reduce((acc, r) => acc + Number(r.horas_extras || 0), 0);
                  const dayName = getDayName(dateKey);
                  const isExpanded = expandedRows.has(dateKey);
                  const toggleExpand = () => {
                    const newSet = new Set(expandedRows);
                    if (newSet.has(dateKey)) newSet.delete(dateKey);
                    else newSet.add(dateKey);
                    setExpandedRows(newSet);
                  };
                  return (
                    <React.Fragment key={dateKey}>
                      <tr className="hover:bg-blue-50/40 transition-colors">
                        <td className="py-3 px-4 font-medium text-slate-800">{dateKey}</td>
                        <td className="py-3 px-4 capitalize text-slate-600">{dayName}</td>
                        <td className="py-3 px-4 text-slate-700">{horasTrab}</td>
                        <td className="py-3 px-4"><Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">{horasExtraForDate} HRS</Badge></td>
                        <td className="py-3 px-4">
                          <button onClick={toggleExpand} className="inline-flex items-center gap-1.5 text-[#1e3a5f] hover:text-[#264d73] text-xs font-medium transition-colors">
                            Ver más <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button onClick={() => window.open(`/api/export/registro-horas?user=${encodeURIComponent(selectedUser?.id ?? selectedUser?.usuario ?? '')}&start=${encodeURIComponent(dateKey)}&end=${encodeURIComponent(dateKey)}`)} className="text-slate-400 hover:text-[#1e3a5f] transition-colors"><Download className="h-4 w-4" /></button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${dateKey}-detail`}>
                          <td colSpan={6} className="p-0">
                            <div className="bg-blue-50/30 border-t border-b border-blue-100 px-6 py-4">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-blue-200/50">
                                    <th className="text-left py-2 px-3 text-slate-500 font-semibold uppercase tracking-wider">Hora</th>
                                    <th className="text-left py-2 px-3 text-slate-500 font-semibold uppercase tracking-wider">Tipo de Actividad</th>
                                    <th className="text-left py-2 px-3 text-slate-500 font-semibold uppercase tracking-wider">Proyecto</th>
                                    <th className="text-left py-2 px-3 text-slate-500 font-semibold uppercase tracking-wider">Coordenadas</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-blue-100/50">
                                  {(gpsLogs || []).filter((g: any) => g.fecha === dateKey).sort((a: any, b: any) => String(a.hora_marcaje || '').localeCompare(String(b.hora_marcaje || ''))).map((g: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-blue-100/30 transition-colors">
                                      <td className="py-2 px-3 text-slate-700 font-medium">{g.hora_marcaje || '-'}</td>
                                      <td className="py-2 px-3 text-slate-600">{g.tipo_actividad || '-'}</td>
                                      <td className="py-2 px-3 text-slate-600">{g.proyecto || '-'}</td>
                                      <td className="py-2 px-3 text-slate-400 font-mono text-[10px]">{g.coordenadas || '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                }) : (
                  (registroRows || []).map((r: any, idx: number) => {
                    const dayName = getDayName(String(r.fecha));
                    const isExpanded = expandedRows.has(r.fecha);
                    const toggleExpand = () => {
                      const newSet = new Set(expandedRows);
                      if (newSet.has(r.fecha)) newSet.delete(r.fecha);
                      else newSet.add(r.fecha);
                      setExpandedRows(newSet);
                    };
                    return (
                      <React.Fragment key={idx}>
                        <tr className="hover:bg-blue-50/40 transition-colors">
                          <td className="py-3 px-4 font-medium text-slate-800">{r.fecha}</td>
                          <td className="py-3 px-4 capitalize text-slate-600">{dayName}</td>
                          <td className="py-3 px-4 text-slate-700">
                            {(() => {
                              const c = calculateDailyTotal(r.fecha);
                              return c > 0 ? `${formatHoursToMinutes(c)} (${c.toFixed(2)}h)` : '0 horas 0 minutos';
                            })()}
                          </td>
                          <td className="py-3 px-4"><Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">{(r.horas_extras || 0)} HRS</Badge></td>
                          <td className="py-3 px-4">
                            <button onClick={toggleExpand} className="inline-flex items-center gap-1.5 text-[#1e3a5f] hover:text-[#264d73] text-xs font-medium transition-colors">
                              Ver más <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button onClick={() => window.open(`/api/export/registro-horas?user=${encodeURIComponent(selectedUser?.id ?? selectedUser?.usuario ?? '')}&start=${encodeURIComponent(r.fecha)}&end=${encodeURIComponent(r.fecha)}`)} className="text-slate-400 hover:text-[#1e3a5f] transition-colors"><Download className="h-4 w-4" /></button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={6} className="p-0">
                              <div className="bg-blue-50/30 border-t border-b border-blue-100 px-6 py-4">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-blue-200/50">
                                      <th className="text-left py-2 px-3 text-slate-500 font-semibold uppercase tracking-wider">Hora</th>
                                      <th className="text-left py-2 px-3 text-slate-500 font-semibold uppercase tracking-wider">Tipo de Actividad</th>
                                      <th className="text-left py-2 px-3 text-slate-500 font-semibold uppercase tracking-wider">Proyecto</th>
                                      <th className="text-left py-2 px-3 text-slate-500 font-semibold uppercase tracking-wider">Coordenadas</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-blue-100/50">
                                    {(gpsLogs || []).filter((g: any) => g.fecha === r.fecha).sort((a: any, b: any) => String(a.hora_marcaje || '').localeCompare(String(b.hora_marcaje || ''))).map((g: any, idx: number) => (
                                      <tr key={idx} className="hover:bg-blue-100/30 transition-colors">
                                        <td className="py-2 px-3 text-slate-700 font-medium">{g.hora_marcaje || '-'}</td>
                                        <td className="py-2 px-3 text-slate-600">{g.tipo_actividad || '-'}</td>
                                        <td className="py-2 px-3 text-slate-600">{g.proyecto || '-'}</td>
                                        <td className="py-2 px-3 text-slate-400 font-mono text-[10px]">{g.coordenadas || '-'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Vista por Proyecto ─────────────────────────── */}
      {!loading && filterType === 'proyecto' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Summary Card */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 p-4 sm:p-5 border-b border-slate-100">
                <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <BarChartIcon className="h-4 w-4 text-[#1e3a5f]" />
                </div>
                <h3 className="font-semibold text-slate-800 text-sm">Resumen por Proyecto</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left py-2.5 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Proyecto</th>
                      <th className="text-right py-2.5 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Hrs. Extras</th>
                      <th className="text-right py-2.5 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Tiempo en Proyecto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProjectSummary.map((p: any, idx: number) => (
                      <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                        <td className="py-2.5 px-4 font-medium text-slate-800">{p.project}</td>
                        <td className="text-right py-2.5 px-4"><Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">{p.horasExtras} hrs</Badge></td>
                        <td className="text-right py-2.5 px-4 text-slate-600">{formatHoursToMinutes(p.tiempoTrabajado)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Chart Card */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 p-4 sm:p-5 border-b border-slate-100">
                <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                  <BarChartIcon className="h-4 w-4 text-emerald-600" />
                </div>
                <h3 className="font-semibold text-slate-800 text-sm">Gráfico por Tiempo</h3>
              </div>
              <div className="p-4 sm:p-5 space-y-4">
                {filteredProjectSummary.map((p: any, idx: number) => {
                  const maxHours = Math.max(...filteredProjectSummary.map(pp => pp.tiempoTrabajado), 1);
                  const percentage = (p.tiempoTrabajado / maxHours) * 100;
                  const gradients = [
                    'bg-gradient-to-r from-blue-400 to-blue-600',
                    'bg-gradient-to-r from-emerald-400 to-emerald-600',
                    'bg-gradient-to-r from-[#1e3a5f] to-[#2d5a8a]',
                    'bg-gradient-to-r from-purple-400 to-purple-600',
                    'bg-gradient-to-r from-amber-400 to-amber-600',
                  ];
                  const barGradient = gradients[idx % gradients.length];
                  return (
                    <div key={idx}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="font-medium text-slate-700 truncate mr-3">{p.project}</span>
                        <span className="text-slate-500 shrink-0">{formatHoursToMinutes(p.tiempoTrabajado)}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                        <div className={`${barGradient} h-full rounded-full transition-all duration-700 ease-out`} style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Projects Detail Table */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 p-4 sm:p-5 border-b border-slate-100">
              <div className="h-9 w-9 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                <LayoutGrid className="h-4 w-4 text-purple-600" />
              </div>
              <h3 className="font-semibold text-slate-800 text-sm">Detalle por Proyecto</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Proyecto</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Sin extras</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Hrs. extras</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Total</th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Usuarios</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Desglose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProjectSummary.map((p: any, idx: number) => {
                    const projKey = `proyecto-${idx}`;
                    const isExpanded = expandedRows.has(projKey);
                    const toggleExpand = () => {
                      const newSet = new Set(expandedRows);
                      if (newSet.has(projKey)) newSet.delete(projKey);
                      else newSet.add(projKey);
                      setExpandedRows(newSet);
                    };
                    const projectLogs = (gpsLogs || []).filter((g: any) => {
                      const inRange = (!fromDate || g.fecha >= fromDate) && (!toDate || g.fecha <= toDate);
                      return g.proyecto === p.project && inRange;
                    }).sort((a: any, b: any) => String(a.hora_marcaje || '').localeCompare(String(b.hora_marcaje || '')));

                    return (
                      <React.Fragment key={idx}>
                        <tr className="hover:bg-blue-50/40 transition-colors">
                          <td className="py-3 px-4 font-medium text-slate-800">{p.project}</td>
                          <td className="py-3 px-4 text-slate-600">{formatHoursToMinutes(Math.max(0, p.tiempoTrabajado - p.horasExtras))}</td>
                          <td className="py-3 px-4"><Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">{p.horasExtras} HRS</Badge></td>
                          <td className="py-3 px-4 font-bold text-slate-800">{formatHoursToMinutes(p.tiempoTrabajado)}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-slate-100 text-xs font-semibold text-slate-600">{p.usuarios}</span>
                          </td>
                          <td className="py-3 px-4">
                            <button onClick={toggleExpand} className="inline-flex items-center gap-1.5 text-[#1e3a5f] hover:text-[#264d73] text-xs font-medium transition-colors">
                              Ver más <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={6} className="p-0">
                              <div className="bg-blue-50/30 border-t border-b border-blue-100 px-6 py-4">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-blue-200/50">
                                      <th className="text-left py-2 px-3 text-slate-500 font-semibold uppercase tracking-wider">Logs</th>
                                      <th className="text-left py-2 px-3 text-slate-500 font-semibold uppercase tracking-wider">Hora</th>
                                      <th className="text-left py-2 px-3 text-slate-500 font-semibold uppercase tracking-wider">Fecha</th>
                                      <th className="text-left py-2 px-3 text-slate-500 font-semibold uppercase tracking-wider">Coordenadas</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-blue-100/50">
                                    {projectLogs.length > 0 ? projectLogs.map((g: any, logIdx: number) => (
                                      <tr key={logIdx} className="hover:bg-blue-100/30 transition-colors">
                                        <td className="py-2 px-3 text-slate-600">{g.tipo_actividad || '-'}</td>
                                        <td className="py-2 px-3 text-slate-700 font-medium">{g.hora_marcaje || '-'}</td>
                                        <td className="py-2 px-3 text-slate-600">{g.fecha || '-'}</td>
                                        <td className="py-2 px-3 text-slate-400 font-mono text-[10px]">{g.coordenadas || '-'}</td>
                                      </tr>
                                    )) : (
                                      <tr>
                                        <td colSpan={4} className="py-4 px-3 text-center text-slate-400 text-xs">Sin registros</td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
