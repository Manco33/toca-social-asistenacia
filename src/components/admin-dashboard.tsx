"use client";

import * as React from 'react';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ProjectStatus } from '@/components/project-status';
import { usePolling } from '@/hooks/use-polling';
import { useAuth } from '@/hooks/use-auth';
import { getEmployees, getTodaysEntries, getProjects, getRegistroHoras } from '@/app/actions';
import { format as formatTz } from 'date-fns-tz';
import { es } from 'date-fns/locale';
import ProjectIntervals from '@/components/project-intervals';
import AdminProjects from '@/components/admin-projects';
import AdminOvertimeRequests from '@/components/admin-overtime-requests';
import { AdminInvoices } from '@/components/admin-invoices';
import AdminDashboardPanel from '@/components/admin-dashboard-panel';
import IdleTimeDashboard from '@/components/idle-time-dashboard';
import ProjectSummaryDashboard from '@/components/project-summary-dashboard';
import { LayoutGrid, Briefcase, Users as UsersIcon, Search, MapPin, Loader2, Clock, BarChart, Timer, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { InstallPrompt } from '@/components/install-prompt';

type RegistroRow = { id: number; usuario: string; nombre?: string; fecha: string; horas_trabajadas: number; horas_extras: number };

export default function AdminDashboard(): JSX.Element {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'projects' | 'accounting'>('overview');
  const [employees, setEmployees] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [registroSearch, setRegistroSearch] = useState('');
  const [registroResults, setRegistroResults] = useState<RegistroRow[]>([]);
  const [registroFrom, setRegistroFrom] = useState<string>('');
  const [registroTo, setRegistroTo] = useState<string>('');
  const [gpsResults, setGpsResults] = useState<any[]>([]);
  const [totals, setTotals] = useState<Record<string, any>>({});

  const fetchInitial = useCallback(async () => {
    setLoading(true);
    try {
      const [emps, todays, projs] = await Promise.all([getEmployees(user?.id), getTodaysEntries(user?.id), getProjects()]);
      setEmployees(emps || []);
      setEntries(todays || []);
      setProjects(projs || []);
    } catch (e) {
      console.error('Error fetching initial admin data', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInitial(); }, [fetchInitial]);

  usePolling('/api/time-entries/today', 30000, (data: any) => {
    if (!data || !data.ok) return;
    setEntries(data.entries || []);
  });

  const technicians = React.useMemo(() => (employees || []).filter(e => e.role === 'technician'), [employees]);

  const buildStatus = useCallback(() => {
    const list = (technicians || []).map((tech: any) => {
      const techEntries = (entries || []).filter((en: any) => String(en.userId) === String(tech.id));
      const last = techEntries.length ? techEntries[techEntries.length - 1] : null;
      const status = last ? last.tipo : 'Offline';
      const proyecto = last ? last.proyecto : undefined;

      // Parse 'lat,lng' string from DB into a proper object for Google Maps link
      let location: { latitude: number; longitude: number } | null = null;
      if (last?.coordenadas && last.coordenadas !== 'N/A') {
        const parts = String(last.coordenadas).split(',').map((s: string) => parseFloat(s.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          location = { latitude: parts[0], longitude: parts[1] };
        }
      }

      return {
        userId: String(tech.id),
        name: tech.name,
        username: tech.email,
        avatarUrl: tech.avatarUrl,
        status,
        currentProject: proyecto,
        location,
      };
    });
    return list;
  }, [technicians, entries]);

  const statusList = buildStatus();

  const filteredTechnicians = statusList.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()) || (t.currentProject || '').toLowerCase().includes(searchTerm.toLowerCase()));

  const projectsWithTechnicians = (projects || []).map((p: any) => ({ id: p.id, name: p.name || p.nombre, address: p.address || p.ubicacion_del_proyecto, technicians: statusList.filter((t: any) => t.currentProject === (p.name || p.nombre) && t.status !== 'Offline').map((t: any) => ({ id: t.userId, name: t.name, avatarUrl: t.avatarUrl, status: t.status, since: new Date() })) }));

  const doRegistroSearch = async () => {
    try {
      const params = new URLSearchParams();
      if (registroSearch) params.set('user', registroSearch);
      if (registroFrom) params.set('from', registroFrom);
      if (registroTo) params.set('to', registroTo);

      const q = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`/api/registro-horas${q}`);
      const json = await res.json();
      if (json.ok) {
        setRegistroResults(json.registro || []);
        setGpsResults(json.gps || []);
        setTotals(json.totals || {});
      } else {
        setRegistroResults([]);
        setGpsResults([]);
      }
    } catch (e) {
      console.error('registro fetch', e);
      setRegistroResults([]);
    }
  };

  const [intervals, setIntervals] = React.useState<any[]>([]);
  const [intervalsLoading, setIntervalsLoading] = React.useState(false);
  const [intervalsUser, setIntervalsUser] = React.useState('');
  const [intervalsFrom, setIntervalsFrom] = React.useState('');
  const [intervalsTo, setIntervalsTo] = React.useState('');

  const fetchIntervals = async () => {
    try {
      setIntervalsLoading(true);
      const params = new URLSearchParams();
      if (intervalsUser) params.set('user', intervalsUser);
      if (intervalsFrom) params.set('from', intervalsFrom);
      if (intervalsTo) params.set('to', intervalsTo);
      const q = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`/api/intervals${q}`);
      const json = await res.json();
      if (json.ok) setIntervals(json.intervals || []);
      else setIntervals([]);
    } catch (e) {
      console.error('intervals fetch', e);
      setIntervals([]);
    } finally {
      setIntervalsLoading(false);
    }
  };

  const [summaryFrom, setSummaryFrom] = useState('');
  const [summaryTo, setSummaryTo] = useState('');
  const [summarySearch, setSummarySearch] = useState('');
  const [projectSummary, setProjectSummary] = useState<Array<{ project: string; minutes: number; users: number }>>([]);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const [projectUsage, setProjectUsage] = useState<any[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);

  const loadProjectUsage = useCallback(async () => {
    try {
      setUsageLoading(true);
      const res = await fetch('/api/projects/usage');
      const json = await res.json().catch(() => ({}));
      let projects = [];
      if (Array.isArray(json)) projects = json;
      else if (json && Array.isArray(json.projects)) projects = json.projects;
      else projects = json?.projects || [];
      setProjectUsage(projects);
    } catch (e) {
      console.error('loadProjectUsage error:', e);
      setProjectUsage([]);
    } finally {
      setUsageLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjectUsage();
  }, [loadProjectUsage]);

  const loadProjectSummary = async () => {
    try {
      setLoadingSummary(true);
      const projectsRes = await fetch('/api/projects');
      const projectsJson = await projectsRes.json();
      const allProjects = (projectsJson.ok ? projectsJson.projects : []) || [];
      const params = new URLSearchParams();
      if (summaryFrom) params.set('from', summaryFrom);
      if (summaryTo) params.set('to', summaryTo);
      const q = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`/api/intervals${q}`);
      const json = await res.json();
      if (!json.ok) {
        setProjectSummary([]);
        return;
      }
      const ints = json.intervals || [];
      const map = new Map<string, { minutes: number; users: Set<string> }>();
      ints.forEach((it: any) => {
        const p = it.project || 'N/A';
        if (!map.has(p)) map.set(p, { minutes: 0, users: new Set() });
        const entry = map.get(p)!;
        entry.minutes += Number(it.minutes || 0);
        if (it.user) entry.users.add(it.user);
      });
      allProjects.forEach((proj: any) => {
        const projName = proj.name || proj.nombre;
        if (projName && !map.has(projName)) {
          map.set(projName, { minutes: 0, users: new Set() });
        }
      });
      const list = Array.from(map.entries()).map(([project, v]) => ({ project, minutes: v.minutes, users: v.users.size }));
      list.sort((a, b) => b.minutes - a.minutes);
      setProjectSummary(list);
    } catch (e) {
      console.error('loadProjectSummary', e);
      setProjectSummary([]);
    } finally {
      setLoadingSummary(false);
    }
  };

  const filteredProjectSummary = useMemo(() => {
    if (!summarySearch) return projectSummary;
    return projectSummary.filter(p => p.project && p.project.toLowerCase().includes(summarySearch.toLowerCase()));
  }, [projectSummary, summarySearch]);

  const getInitials = (name: string) => {
    if (!name) return '';
    const parts = name.split(' ');
    if (parts.length > 1) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  };

  const formatToGuatemala = (value: string | Date | undefined | null, fmt = "yyyy-MM-dd HH:mm:ss") => {
    if (!value) return 'N/A';
    try {
      let d: Date;
      if (typeof value === 'string') {
        // Try native Date parsing first (handles ISO strings with timezone info correctly)
        d = new Date(value);
        if (isNaN(d.getTime())) return 'N/A';
      } else {
        d = value as Date;
      }
      return formatTz(d, fmt, { timeZone: 'America/Guatemala', locale: es });
    } catch (e) {
      return 'N/A';
    }
  };

  // Duplicate state removed from here (line 256)

  return (
    <div className="space-y-6">
      {/* ── Hero Header ─────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1e3a5f] via-[#264d73] to-[#1a3352] p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/3" />
        <div className="relative z-10">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Panel de Administración</h1>
          <p className="text-white/60 mt-1 text-sm sm:text-base">Gestiona proyectos, usuarios y registros de tiempo.</p>
        </div>
      </div>

      {/* ── Install Prompt ───────────────────────────────────── */}
      <InstallPrompt />

      {/* ── Tab Navigation ───────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 gap-2 bg-transparent p-0 h-auto border border-slate-200 rounded-xl">
          <TabsTrigger
            value="overview"
            className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap
              data-[state=active]:bg-[#1e3a5f] data-[state=active]:text-white data-[state=active]:shadow-lg
              data-[state=inactive]:bg-white data-[state=inactive]:text-slate-600 data-[state=inactive]:border border-slate-200 data-[state=inactive]:hover:bg-slate-50
              transition-all duration-200"
          >
            <LayoutGrid className="h-4 w-4 flex-shrink-0" />
            <span className="hidden sm:inline">Resumen</span>
            <span className="sm:hidden">Resumen</span>
          </TabsTrigger>

          <TabsTrigger
            value="projects"
            className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap
              data-[state=active]:bg-[#1e3a5f] data-[state=active]:text-white data-[state=active]:shadow-lg
              data-[state=inactive]:bg-white data-[state=inactive]:text-slate-600 data-[state=inactive]:border border-slate-200 data-[state=inactive]:hover:bg-slate-50
              transition-all duration-200"
          >
            <Briefcase className="h-4 w-4 flex-shrink-0" />
            <span>Proyectos</span>
          </TabsTrigger>


          <TabsTrigger
            value="accounting"
            className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap
              data-[state=active]:bg-[#1e3a5f] data-[state=active]:text-white data-[state=active]:shadow-lg
              data-[state=inactive]:bg-white data-[state=inactive]:text-slate-600 data-[state=inactive]:border border-slate-200 data-[state=inactive]:hover:bg-slate-50
              transition-all duration-200"
          >
            <BarChart className="h-4 w-4 flex-shrink-0" />
            <span>Contabilidad</span>
          </TabsTrigger>
        </TabsList>

        {/* ── Content ──────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-5">
          {/* Solicitudes de Horas Extra */}
          <AdminOvertimeRequests />

          {/* Estado de los Técnicos */}
          <Collapsible className="rounded-xl bg-white shadow-sm border border-slate-200 overflow-hidden transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                  <UsersIcon className="h-5 w-5 text-[#1e3a5f]" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 text-base">Estado de los Técnicos</h3>
                  <p className="text-xs text-slate-400">Seguimiento en tiempo real</p>
                </div>
              </div>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-slate-500 hover:text-[#1e3a5f] hover:bg-blue-50 rounded-lg">
                  <ChevronDown className="h-4 w-4" />
                  <span className="hidden sm:inline text-xs">Ver</span>
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="border-t p-4 sm:p-5 bg-slate-50/50">
              <div className="flex gap-4 mb-4">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Buscar técnico..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 bg-white"
                  />
                </div>
              </div>
              <div className="rounded-lg border bg-white overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="font-semibold text-slate-700">Técnico</TableHead>
                      <TableHead className="font-semibold text-slate-700">Estado</TableHead>
                      <TableHead className="font-semibold text-slate-700">Proyecto Actual</TableHead>
                      <TableHead className="font-semibold text-slate-700">Ubicación</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTechnicians.map((tech: any, i: number) => (
                      <TableRow key={`${tech.userId}-${i}`} className="hover:bg-blue-50/50 transition-colors">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 ring-2 ring-white shadow-sm">
                              <AvatarImage src={tech.avatarUrl} />
                              <AvatarFallback className="bg-[#1e3a5f] text-white text-xs">{getInitials(tech.name)}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{tech.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={tech.status === 'Offline' ? 'secondary' : 'default'} className={`${tech.status === 'Offline' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700 border-emerald-200'} text-xs px-2.5 py-0.5`}>
                            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${tech.status === 'Offline' ? 'bg-slate-400' : 'bg-emerald-500 animate-pulse'}`} />
                            {tech.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">{tech.currentProject || <span className="text-slate-300">—</span>}</TableCell>
                        <TableCell>
                          {tech.location ? (
                            <a href={`https://www.google.com/maps/search/?api=1&query=${tech.location.latitude},${tech.location.longitude}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[#1e3a5f] hover:underline text-sm font-medium">
                              <MapPin className="h-3.5 w-3.5" /> Ver mapa
                            </a>
                          ) : <span className="text-slate-300">—</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredTechnicians.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-slate-400">
                          No se encontraron técnicos
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Resumen Rápido por Proyecto */}
          <Collapsible className="rounded-xl bg-white shadow-sm border border-slate-200 overflow-hidden transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                  <Briefcase className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 text-base">Resumen por Proyecto</h3>
                  <p className="text-xs text-slate-400">Horas vendidas vs ejecutadas</p>
                </div>
              </div>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg">
                  <ChevronDown className="h-4 w-4" />
                  <span className="hidden sm:inline text-xs">Ver</span>
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="border-t p-4 sm:p-5 bg-slate-50/50">
              <ProjectSummaryDashboard />
            </CollapsibleContent>
          </Collapsible>

          {/* Desglose Detallado Panel */}
          <Collapsible className="rounded-xl bg-white shadow-sm border border-slate-200 overflow-hidden transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                  <BarChart className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 text-base">Desglose Detallado</h3>
                  <p className="text-xs text-slate-400">Horas por técnico y proyecto</p>
                </div>
              </div>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg">
                  <ChevronDown className="h-4 w-4" />
                  <span className="hidden sm:inline text-xs">Ver</span>
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="border-t p-0">
              <AdminDashboardPanel />
            </CollapsibleContent>
          </Collapsible>

          {/* Tiempo Muerto Panel (Global) */}
          <Collapsible className="rounded-xl bg-white shadow-sm border border-slate-200 overflow-hidden transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
                  <Timer className="h-5 w-5 text-rose-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 text-base">Tiempo Muerto</h3>
                  <p className="text-xs text-slate-400">Reporte global de productividad</p>
                </div>
              </div>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-slate-500 hover:text-rose-500 hover:bg-rose-50 rounded-lg">
                  <ChevronDown className="h-4 w-4" />
                  <span className="hidden sm:inline text-xs">Ver</span>
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="border-t p-0">
              <IdleTimeDashboard />
            </CollapsibleContent>
          </Collapsible>

        </TabsContent>

        <TabsContent value="projects">
          <AdminProjects />
        </TabsContent>

        <TabsContent value="accounting">
          <AdminInvoices />
        </TabsContent>
      </Tabs>
    </div>
  );
}
