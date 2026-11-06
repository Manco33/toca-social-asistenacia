"use client";

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Briefcase, PlusCircle } from 'lucide-react';
import dynamic from 'next/dynamic';

const MapPicker = dynamic(() => import('./map-picker').then(mod => mod.default), {
  ssr: false,
  loading: () => <div className="h-[300px] w-full bg-gray-100 flex items-center justify-center">Cargando mapa...</div>
});

export default function AdminProjects(): JSX.Element {
  const [newId, setNewId] = useState<string>('');
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newContact, setNewContact] = useState('');
  const [newHours, setNewHours] = useState<string>('');
  const [suggestions, setSuggestions] = useState<Array<any>>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [projects, setProjects] = useState<Array<any>>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editReason, setEditReason] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  // Add new state for create form
  const [newLat, setNewLat] = useState<number | null>(null);
  const [newLng, setNewLng] = useState<number | null>(null);
  const [newRadius, setNewRadius] = useState<number>(500);

  useEffect(() => {
    if (!newName || newName.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const key = newName.trim();
    let cancelled = false;
    setSuggestionsLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/projects?search=${encodeURIComponent(key)}&limit=10`);
        const j = await res.json();
        if (!cancelled) setSuggestions((j && j.projects) || []);
      } catch (e) {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setSuggestionsLoading(false);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [newName]);

  // fetch projects list
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingProjects(true);
      try {
        const res = await fetch('/api/projects');
        const j = await res.json();
        if (mounted && res.ok) setProjects(j.projects || []);
      } catch (e) {
        // ignore
      } finally {
        if (mounted) setLoadingProjects(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Debounced search for projects (calls backend /api/projects?search=)
  useEffect(() => {
    const t = setTimeout(() => {
      (async () => {
        try {
          const url = searchQuery ? `/api/projects?search=${encodeURIComponent(searchQuery)}` : '/api/projects';
          const res = await fetch(url);
          const j = await res.json();
          if (res.ok) setProjects(j.projects || []);
        } catch (e) {
          // ignore
        }
      })();
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const renderHighlighted = (text: string, q: string) => {
    if (!q) return <>{text}</>;
    const lower = text.toLowerCase();
    const ql = q.toLowerCase();
    const idx = lower.indexOf(ql);
    if (idx === -1) return <>{text}</>;
    return <>{text.substring(0, idx)}<span className="bg-yellow-200 px-0.5">{text.substring(idx, idx + q.length)}</span>{text.substring(idx + q.length)}</>;
  };

  const handleCreateProject = async () => {
    setCreateMessage(null);
    if (!newName.trim()) { setCreateMessage('El nombre es requerido'); return; }
    setCreateLoading(true);
    try {
      const payload: any = { nombre: newName, ubicacion: newAddress, contactPerson: newContact };
      if (newHours && newHours.trim() !== '') payload.horas_totales = Number(newHours);
      if (newId && newId.trim() !== '') payload.id = newId.trim();

      // Geofencing
      if (newLat && newLng) {
        payload.latitud = newLat;
        payload.longitud = newLng;
        payload.radio = newRadius;
      }

      const res = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await res.json();
      if (!res.ok) {
        if (res.status === 409 && j.exists) {
          setCreateMessage('Ya existe un proyecto con ese nombre o dirección.');
        } else {
          setCreateMessage(j.error || 'Error creando proyecto');
        }
      } else {
        setCreateMessage(`Proyecto creado correctamente (ID: ${j.project?.id || 'auto'})`);
        setNewId(''); setNewName(''); setNewAddress(''); setNewContact(''); setNewHours(''); setSuggestions([]);
        setNewLat(null); setNewLng(null); setNewRadius(500);
        // refresh list
        try { const r2 = await fetch('/api/projects'); const j2 = await r2.json(); if (r2.ok) setProjects(j2.projects || []); } catch (e) { }
        // notify other components (panel) to refresh
        try { window.dispatchEvent(new CustomEvent('projects:updated')); } catch (e) { }
      }
    } catch (e: any) {
      setCreateMessage(String(e));
    } finally {
      setCreateLoading(false);
    }
  };

  const openEdit = (p: any) => { setEditing({ ...p, _originalId: p.id }); };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setEditLoading(true);
    try {
      // Preserve original id so we can support changing the project ID (creates new record + deletes old)
      const originalId = (editing as any)._originalId ?? editing.id;
      const payload: any = {
        id: originalId,
        change_reason: editReason || 'Manual update via admin panel'
      };

      // If the admin changed the project's id in the edit form, send newId so the API can handle it
      if (editing.id && String(editing.id) !== String(originalId)) {
        payload.newId = editing.id;
      }

      // Only include changed fields
      if (editing.horas_totales != null) payload.horas_totales = Number(editing.horas_totales);
      if (editing.horas_usadas_manual != null) payload.horas_usadas_manual = Number(editing.horas_usadas_manual);
      // Include geofencing fields if changed (add them to editing object in UI)
      if (editing.latitud !== undefined) payload.latitud = editing.latitud;
      if (editing.longitud !== undefined) payload.longitud = editing.longitud;
      if (editing.radio !== undefined) payload.radio = editing.radio;

      console.log('[AdminProjects] Guardando proyecto:', editing.id, payload);

      // Use main projects endpoint
      console.log('[AdminProjects] Enviando payload:', payload);
      const res = await fetch(`/api/projects`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const j = await res.json();

      console.log('[AdminProjects] Respuesta:', j);

      if (res.ok) {
        setEditing(null);
        setEditReason('');
        // refresh
        const r2 = await fetch('/api/projects');
        const j2 = await r2.json();
        if (r2.ok) setProjects(j2.projects || []);
        try { window.dispatchEvent(new CustomEvent('projects:updated')); } catch (e) { }
        alert('Proyecto guardado exitosamente ✓');
      } else {
        const errMsg = typeof j.error === 'string' ? j.error : (j.error && j.error.message) ? j.error.message : JSON.stringify(j.error || j);
        alert('Error: ' + (errMsg || 'Error actualizando proyecto'));
      }
    } catch (e: any) {
      console.error('[AdminProjects] Error:', e);
      alert(e?.message || String(e));
    } finally { setEditLoading(false); }
  };

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsProject, setDetailsProject] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsData, setDetailsData] = useState<any | null>(null);

  const viewDetails = async (p: any) => {
    setDetailsProject(p); setDetailsOpen(true); setDetailsLoading(true); setDetailsData(null);
    try {
      const res = await fetch(`/api/projects/details?name=${encodeURIComponent(p.name)}`);
      const j = await res.json();
      if (res.ok) setDetailsData(j);
      else alert(j.error || 'Error cargando detalles');
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally { setDetailsLoading(false); }
  };

  return (
    <div className="space-y-6">
      {/* ── Section Header ───────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
          <Briefcase className="h-5 w-5 text-[#1e3a5f]" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">Administrar Proyectos</h2>
          <p className="text-xs text-slate-400">Crear, editar y gestionar proyectos</p>
        </div>
      </div>

      {/* ── Create Form ──────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100">
          <h4 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
            <PlusCircle className="h-4 w-4 text-emerald-600" />
            Agregar Nuevo Proyecto
          </h4>
        </div>
        <div className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">ID (opcional)</label>
              <input placeholder="Auto-generado" value={newId} onChange={(e) => setNewId(e.target.value)} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-50 focus:outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Nombre</label>
              <input placeholder="Nombre del proyecto" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-50 focus:outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Ubicación</label>
              <input placeholder="Dirección del proyecto" value={newAddress} onChange={(e) => setNewAddress(e.target.value)} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-50 focus:outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Contacto</label>
              <input placeholder="Persona de contacto" value={newContact} onChange={(e) => setNewContact(e.target.value)} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-50 focus:outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Horas Totales</label>
              <input placeholder="Ej. 2000" value={newHours} onChange={(e) => setNewHours(e.target.value)} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-50 focus:outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10 transition-all" />
            </div>
          </div>

          {/* Geofencing Section */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
            <h5 className="font-semibold text-slate-700 text-sm mb-3 flex items-center gap-2">
              📍 Ubicación (Geofencing)
            </h5>
            <div className="flex gap-4 flex-wrap mb-3">
              <div>
                <label className="text-xs text-slate-500 font-medium">Radio (m)</label>
                <input type="number" value={newRadius} onChange={e => setNewRadius(Number(e.target.value))} className="block mt-1 border border-slate-200 rounded-lg p-2 text-sm w-24 bg-white focus:outline-none focus:border-[#1e3a5f] transition-all" />
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium">Latitud</label>
                <input type="number" step="any" value={newLat || ''} onChange={e => setNewLat(parseFloat(e.target.value))} className="block mt-1 border border-slate-200 rounded-lg p-2 text-sm w-32 bg-white focus:outline-none focus:border-[#1e3a5f] transition-all" />
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium">Longitud</label>
                <input type="number" step="any" value={newLng || ''} onChange={e => setNewLng(parseFloat(e.target.value))} className="block mt-1 border border-slate-200 rounded-lg p-2 text-sm w-32 bg-white focus:outline-none focus:border-[#1e3a5f] transition-all" />
              </div>
              <div className="flex items-end pb-1">
                <button onClick={() => navigator.geolocation.getCurrentPosition(p => { setNewLat(p.coords.latitude); setNewLng(p.coords.longitude); })} className="text-xs bg-blue-50 text-[#1e3a5f] px-3 py-2 rounded-lg hover:bg-blue-100 transition-colors font-medium border border-blue-200">📍 Mi ubicación</button>
              </div>
            </div>
            <div className="text-xs text-slate-400 mb-3">
              {newLat && newLng ? `✓ Seleccionado: ${newLat.toFixed(5)}, ${newLng.toFixed(5)}` : 'Haga clic en el mapa para establecer la ubicación'}
            </div>
            <MapPicker
              lat={newLat}
              lng={newLng}
              radius={newRadius}
              onChange={(lat, lng) => { setNewLat(lat); setNewLng(lng); }}
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button onClick={handleCreateProject} disabled={createLoading} className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 active:scale-95 transition-all shadow-sm disabled:opacity-50">
              {createLoading ? 'Creando...' : (<><PlusCircle className="h-4 w-4" />Crear Proyecto</>)}
            </button>
            {createMessage && <div className="text-sm text-slate-600">{createMessage}</div>}
          </div>

          {/* Suggestions */}
          {newName.trim().length >= 2 && (
            <div className="pt-2">
              <div className="text-xs text-slate-400 mb-1.5 font-medium uppercase tracking-wider">Proyectos Similares</div>
              {suggestionsLoading ? <div className="text-xs text-slate-400">Buscando...</div> : (
                suggestions.length === 0 ? <div className="text-xs text-slate-400">No hay coincidencias</div> : (
                  <div className="space-y-1.5 max-h-40 overflow-auto">
                    {suggestions.map((s) => (
                      <div key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-slate-100 bg-slate-50/50 text-sm">
                        <span className="font-medium text-slate-700">{s.name}</span>
                        <span className="text-xs text-slate-400">{s.address || 'Sin dirección'}</span>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Projects List ────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100">
          <h4 className="font-semibold text-slate-800 text-sm">Proyectos Existentes</h4>
          <span className="text-xs text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full font-medium">{projects.length} resultados</span>
        </div>
        <div className="px-4 sm:px-5 py-3 border-b border-slate-100">
          <div className="relative max-w-xs">
            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input placeholder="Buscar proyectos..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10 transition-all" />
          </div>
        </div>
        {loadingProjects ? (
          <div className="flex items-center justify-center py-12 gap-3">
            <div className="h-5 w-5 border-2 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-slate-500">Cargando proyectos...</span>
          </div>
        ) : (
          <>
            {/* Desktop View */}
            <div className="hidden md:overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">ID</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Nombre</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Dirección</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Ubicación</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Contacto</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Horas</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {projects.map(p => (
                    <tr key={p.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs font-bold text-slate-700">{p.id}</td>
                      <td className="py-3 px-4 font-medium text-slate-800">{renderHighlighted(p.name, searchQuery)}</td>
                      <td className="py-3 px-4 text-slate-600 text-xs">{p.address}</td>
                      <td className="py-3 px-4 text-xs">
                        {p.latitud ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600" title={`Radio: ${p.radio}m`}>✅ {p.latitud.toFixed(4)},{p.longitud.toFixed(4)}</span>
                        ) : <span className="text-slate-300">Sin definir</span>}
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-xs">{p.contactPerson}</td>
                      <td className="py-3 px-4 text-xs text-slate-700">{p.horas_totales ?? '-'} <span className="text-slate-400">({p.horas_usadas_manual ?? 0})</span></td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEdit(p)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1e3a5f] bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 hover:border-blue-300 transition-all active:scale-95">Editar</button>
                          <button onClick={() => viewDetails(p)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 hover:border-slate-300 transition-all active:scale-95">Detalles</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View - Card Layout */}
            <div className="md:hidden space-y-3 p-4">
              {projects.map(p => (
                <div key={p.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50 hover:bg-slate-100 transition-colors space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-bold text-slate-500 bg-white px-2 py-1 rounded">{p.id}</span>
                        <h3 className="font-bold text-slate-800 text-sm leading-tight truncate">{renderHighlighted(p.name, searchQuery)}</h3>
                      </div>
                      <p className="text-xs text-slate-500 truncate">{p.address}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 block font-medium mb-0.5">Contacto</span>
                      <span className="text-slate-700 block">{p.contactPerson || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block font-medium mb-0.5">Horas</span>
                      <span className="text-slate-700 block">{p.horas_totales ?? '—'}</span>
                    </div>
                  </div>
                  
                  <div>
                    <span className="text-slate-500 font-medium mb-1 block text-xs">Ubicación</span>
                    {p.latitud ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 text-xs bg-emerald-50 px-2.5 py-1 rounded-md" title={`Radio: ${p.radio}m`}>
                        ✅ {p.latitud.toFixed(4)}, {p.longitud.toFixed(4)}
                      </span>
                    ) : <span className="text-slate-300 text-xs bg-slate-100 px-2.5 py-1 rounded-md inline-block">Sin definir</span>}
                  </div>
                  
                  <div className="flex gap-2 pt-2 border-t border-slate-200">
                    <button onClick={() => openEdit(p)} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-[#1e3a5f] bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 hover:border-blue-300 transition-all active:scale-95">
                      Editar
                    </button>
                    <button onClick={() => viewDetails(p)} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 hover:border-slate-300 transition-all active:scale-95">
                      Detalles
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {editing && (
        <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Proyecto</DialogTitle>
              <DialogDescription>Modificar detalles del proyecto</DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">ID del Proyecto</label>
                  <input type="text" value={editing.id ?? ''} onChange={(e) => setEditing({ ...editing, id: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-50 focus:outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10 transition-all" />
                  <p className="text-xs text-slate-400 mt-1">Identificador único del proyecto</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Horas Totales (Presupuesto)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editing.horas_totales ?? ''}
                    onChange={(e) => setEditing({ ...editing, horas_totales: e.target.value ? Number(e.target.value) : null })}
                    placeholder="Ej. 2000"
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-50 focus:outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10 transition-all"
                  />
                  <p className="text-xs text-slate-400 mt-1">Horas máximas asignadas al proyecto</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Horas Iniciales / Migradas</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editing.horas_usadas_manual ?? ''}
                    onChange={(e) => setEditing({ ...editing, horas_usadas_manual: e.target.value ? Number(e.target.value) : 0 })}
                    placeholder="Ej. 3000"
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-50 focus:outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10 transition-all"
                  />
                  <p className="text-xs text-slate-400 mt-1">Horas trabajadas antes de usar este sistema</p>
                </div>
              </div>
              {/* Map in Edit Mode */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                <h5 className="font-semibold text-slate-700 text-sm mb-3">📍 Ubicación (Geofencing)</h5>
                <div className="flex gap-4 flex-wrap mb-3">
                  <div>
                    <label className="text-xs text-slate-500 font-medium">Radio (m)</label>
                    <input type="number" value={editing.radio !== undefined && editing.radio !== null ? editing.radio : ''} onChange={e => setEditing({ ...editing, radio: e.target.value === '' ? '' : Number(e.target.value) })} className="block mt-1 border border-slate-200 rounded-lg p-2 text-sm w-24 bg-white focus:outline-none focus:border-[#1e3a5f] transition-all" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-medium">Latitud</label>
                    <input type="number" step="any" value={editing.latitud || ''} onChange={e => setEditing({ ...editing, latitud: parseFloat(e.target.value) })} className="block mt-1 border border-slate-200 rounded-lg p-2 text-sm w-32 bg-white focus:outline-none focus:border-[#1e3a5f] transition-all" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-medium">Longitud</label>
                    <input type="number" step="any" value={editing.longitud || ''} onChange={e => setEditing({ ...editing, longitud: parseFloat(e.target.value) })} className="block mt-1 border border-slate-200 rounded-lg p-2 text-sm w-32 bg-white focus:outline-none focus:border-[#1e3a5f] transition-all" />
                  </div>
                </div>
                <MapPicker
                  lat={editing.latitud ? Number(editing.latitud) : null}
                  lng={editing.longitud ? Number(editing.longitud) : null}
                  radius={typeof editing.radio === 'number' ? editing.radio : (Number(editing.radio) || 500)}
                  onChange={(lat, lng) => setEditing({ ...editing, latitud: lat, longitud: lng })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Razón del Cambio</label>
                <textarea
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="Ej. Ajuste por cambio de alcance del proyecto"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-50 focus:outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10 transition-all"
                  rows={2}
                />
                <p className="text-xs text-slate-400 mt-1">Se registrará en el historial de cambios</p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => { setEditing(null); setEditReason(''); }} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-all">Cancelar</button>
                <button onClick={handleSaveEdit} disabled={editLoading} className="px-4 py-2 text-sm font-medium text-white bg-[#1e3a5f] rounded-lg hover:bg-[#264d73] active:scale-95 transition-all disabled:opacity-50">{editLoading ? 'Guardando...' : 'Guardar Cambios'}</button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {detailsOpen && (
        <Dialog open={detailsOpen} onOpenChange={(open) => { if (!open) setDetailsOpen(false); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Detalles — {detailsProject?.name}</DialogTitle>
              <DialogDescription>Resumen por técnico para este proyecto</DialogDescription>
            </DialogHeader>
            <div className="mt-4">
              {detailsLoading ? (
                <div className="flex items-center justify-center py-8 gap-3">
                  <div className="h-5 w-5 border-2 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-slate-500">Cargando...</span>
                </div>
              ) : (
                detailsData ? (
                  <div className="space-y-3">
                    <div className="text-xs text-slate-400">Última actualización: {detailsData.lastUpdated ?? '-'}</div>
                    <div className="rounded-lg border border-slate-200 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="text-left py-2.5 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Técnico</th>
                            <th className="text-left py-2.5 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Horas</th>
                            <th className="text-left py-2.5 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Última Actividad</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(detailsData.technicians || detailsData.details || []).map((t: any, idx: number) => (
                            <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                              <td className="py-2.5 px-4 font-medium text-slate-800">{t.name || t.usuario}</td>
                              <td className="py-2.5 px-4 text-slate-600">{Number(t.total_hours || 0).toFixed(2)}h</td>
                              <td className="py-2.5 px-4 text-xs text-slate-400">{t.lastActivity ? new Date(t.lastActivity).toLocaleString() : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : <div className="text-center py-8 text-slate-400 text-sm">No hay datos</div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
