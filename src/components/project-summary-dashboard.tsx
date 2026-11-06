"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Briefcase, Download, Calendar, Users, AlertCircle, CheckCircle2, Clock, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ProjectSummaryDashboard() {
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchType, setSearchType] = useState('all'); // 'all', 'name', 'id'
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (dateFrom) params.set('from', dateFrom);
            if (dateTo) params.set('to', dateTo);
            const res = await fetch(`/api/projects/usage?${params.toString()}`);
            const json = await res.json();
            if (json.ok) {
                setProjects(json.projects || []);
            }
        } catch (e) {
            console.error('Error loading project summary', e);
        } finally {
            setLoading(false);
        }
    }, [dateFrom, dateTo]);

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, [loadData]);

    // Listen for manual updates (e.g. after approving overtime)
    useEffect(() => {
        const handleUpdate = () => loadData();
        window.addEventListener('projects:updated', handleUpdate);
        return () => window.removeEventListener('projects:updated', handleUpdate);
    }, [loadData]);

    const filteredProjects = useMemo(() => {
        if (!searchTerm) return projects;
        const lower = searchTerm.toLowerCase();
        return projects.filter(p => {
            if (searchType === 'name') return p.name.toLowerCase().includes(lower);
            if (searchType === 'id') return String(p.id).toLowerCase().includes(lower);
            return p.name.toLowerCase().includes(lower) || String(p.id).toLowerCase().includes(lower);
        });
    }, [projects, searchTerm, searchType]);

    const formatHours = (val: number) => {
        const h = Math.floor(val);
        const m = Math.round((val - h) * 60);
        return `${h}h ${m}m`;
    };

    const exportToExcel = () => {
        const data = filteredProjects.map(p => ({
            ID: p.id,
            Proyecto: p.name,
            'Horas Vendidas': p.horas_totales || 0,
            'Horas Migradas': p.manual_used_hours || 0,
            'Horas Regulares (GPS)': p.regular_computed_hours || 0,
            'Horas Extras Aprobadas': p.overtime_hours || 0,
            'Total Ejecutado': p.used_hours || 0,
            'Restante': p.remaining_hours || 0,
            'Estado': p.overrun ? 'Excedido' : 'En Presupuesto',
            'Personal': (p.technicians || []).map((t: any) => `${t.name} (${formatHours(t.total_hours)})`).join(', ')
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Resumen Proyectos");
        XLSX.writeFile(wb, `Resumen_Proyectos_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    };

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-lg border shadow-sm">
                <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-auto h-9" />
                    <span className="text-muted-foreground">-</span>
                    <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-auto h-9" />
                </div>
                <div className="flex-1 min-w-[200px] flex gap-2">
                    <Select value={searchType} onValueChange={setSearchType}>
                        <SelectTrigger className="w-[110px] h-9">
                            <SelectValue placeholder="Filtro" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="name">Nombre</SelectItem>
                            <SelectItem value="id">ID</SelectItem>
                        </SelectContent>
                    </Select>
                    <div className="relative flex-1">
                        <Briefcase className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar proyecto..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-9 h-9"
                        />
                    </div>
                </div>
                <Button onClick={exportToExcel} variant="outline" size="sm" className="h-9 gap-2">
                    <Download className="h-4 w-4" /> Excel
                </Button>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
                <div className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded-sm bg-green-500" />
                    <span>Horas regulares (GPS)</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded-sm bg-orange-400" />
                    <span>Horas extras aprobadas</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded-sm bg-red-500" />
                    <span>Excedido</span>
                </div>
            </div>

            {/* Project List */}
            <div className="grid gap-4">
                {loading && projects.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">Cargando proyectos...</div>
                ) : filteredProjects.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">No se encontraron proyectos.</div>
                ) : (
                    filteredProjects.map(project => {
                        const isOverrun = project.overrun;
                        const total = project.horas_totales || 0;

                        // Compute segmented bar widths relative to sold budget
                        const regularHours = project.regular_computed_hours || 0;
                        const overtimeHours = project.overtime_hours || 0;
                        const regularPct = total > 0 ? Math.min(100, (regularHours / total) * 100) : 0;
                        const overtimePct = total > 0 ? Math.min(100 - regularPct, (overtimeHours / total) * 100) : 0;
                        const totalPct = regularPct + overtimePct;

                        return (
                            <Card key={project.id} className={`overflow-hidden transition-all hover:shadow-md ${isOverrun ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-green-500'}`}>
                                <CardHeader className="pb-2 bg-slate-50/50">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <CardTitle className="text-lg font-bold text-slate-800">{project.name}</CardTitle>
                                                {isOverrun ? (
                                                    <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> Excedido</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="gap-1 text-green-700 bg-green-50 border-green-200"><CheckCircle2 className="h-3 w-3" /> En Presupuesto</Badge>
                                                )}
                                            </div>
                                            <CardDescription className="flex items-center gap-2 mt-1">
                                                <span className="font-mono text-xs text-slate-500">ID: {project.id}</span>
                                                <span>•</span>
                                                <span className="text-xs">Última act: {project.lastUpdated ? format(new Date(project.lastUpdated), 'dd/MM HH:mm', { locale: es }) : 'N/A'}</span>
                                            </CardDescription>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-2xl font-bold font-mono tracking-tight text-slate-700">
                                                {formatHours(project.used_hours)}
                                                <span className="text-sm font-normal text-muted-foreground ml-1">/ {total > 0 ? formatHours(total) : '∞'}</span>
                                            </div>
                                            <div className="text-xs text-muted-foreground">Total Ejecutado</div>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-4">
                                    {/* Segmented Progress Bar */}
                                    {total > 0 && (
                                        <div className="mb-5">
                                            {/* Bar container */}
                                            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
                                                {/* Regular hours segment (green, or full red if overrun) */}
                                                {regularPct > 0 && (
                                                    <div
                                                        className={`h-full transition-all duration-500 ${isOverrun ? 'bg-red-500' : 'bg-green-500'}`}
                                                        style={{ width: `${regularPct}%` }}
                                                        title={`Horas regulares: ${formatHours(regularHours)}`}
                                                    />
                                                )}
                                                {/* Overtime segment (orange, hidden if overrun since bar is already full red) */}
                                                {overtimePct > 0 && !isOverrun && (
                                                    <div
                                                        className="h-full bg-orange-400 transition-all duration-500"
                                                        style={{ width: `${overtimePct}%` }}
                                                        title={`Horas extras: ${formatHours(overtimeHours)}`}
                                                    />
                                                )}
                                            </div>

                                            {/* Stats row below bar */}
                                            <div className="flex flex-wrap justify-between mt-2 text-xs gap-y-1">
                                                {/* Left: detailed breakdown */}
                                                <div className="flex items-center gap-3 text-slate-600">
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3 text-green-600" />
                                                        <span className="font-medium text-green-700">{formatHours(regularHours)}</span>
                                                        <span className="text-slate-400">reg.</span>
                                                    </span>
                                                    {overtimeHours > 0 && (
                                                        <>
                                                            <span className="text-slate-300">+</span>
                                                            <span className="flex items-center gap-1">
                                                                <Zap className="h-3 w-3 text-orange-500" />
                                                                <span className="font-medium text-orange-600">{formatHours(overtimeHours)}</span>
                                                                <span className="text-slate-400">extras</span>
                                                            </span>
                                                        </>
                                                    )}
                                                    {project.manual_used_hours > 0 && (
                                                        <>
                                                            <span className="text-slate-300">+</span>
                                                            <span className="text-slate-500">{formatHours(project.manual_used_hours)} migradas</span>
                                                        </>
                                                    )}
                                                </div>
                                                {/* Right: remaining / excess */}
                                                <div>
                                                    <span className={`font-semibold ${isOverrun ? 'text-red-600' : totalPct > 90 ? 'text-amber-600' : 'text-slate-600'}`}>
                                                        {formatHours(Math.abs(project.remaining_hours))} {isOverrun ? '⚠️ exceso' : 'restantes'}
                                                    </span>
                                                    <span className="text-slate-400 ml-1">({totalPct.toFixed(1)}%)</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Technicians Accordion */}
                                    <Accordion type="single" collapsible className="w-full border rounded-md bg-white">
                                        <AccordionItem value="technicians" className="border-0">
                                            <AccordionTrigger className="px-4 py-2 hover:bg-slate-50 hover:no-underline text-sm font-medium">
                                                <div className="flex items-center gap-2">
                                                    <Users className="h-4 w-4 text-slate-500" />
                                                    <span>Ver Personal ({project.technicians?.length || 0})</span>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent>
                                                <div className="px-4 pb-4">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow className="hover:bg-transparent">
                                                                <TableHead className="h-8 text-xs">Técnico</TableHead>
                                                                <TableHead className="h-8 text-xs text-right">Horas</TableHead>
                                                                <TableHead className="h-8 text-xs text-right">Último Reg.</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {(project.technicians || []).length === 0 ? (
                                                                <TableRow>
                                                                    <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-4">Sin actividad registrada en este periodo</TableCell>
                                                                </TableRow>
                                                            ) : (
                                                                (project.technicians || []).map((tech: any) => (
                                                                    <TableRow key={tech.usuario} className="hover:bg-slate-50">
                                                                        <TableCell className="py-2 font-medium text-xs">{tech.name}</TableCell>
                                                                        <TableCell className="py-2 text-right font-mono text-xs">{formatHours(tech.total_hours)}</TableCell>
                                                                        <TableCell className="py-2 text-right text-xs text-muted-foreground">
                                                                            {tech.lastActivity ? format(new Date(tech.lastActivity), 'dd/MM HH:mm', { locale: es }) : '-'}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))
                                                            )}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    </Accordion>
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </div>
        </div>
    );
}
