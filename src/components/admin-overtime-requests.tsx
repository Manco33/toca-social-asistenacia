"use client";
import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { getProjects } from "@/app/actions";
import { Clock, RefreshCw, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminOvertimeRequests() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [projectsMap, setProjectsMap] = useState<Record<string, string>>({});

  const fetchRequests = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/horas-extras?estado=pendiente");
      const j = await res.json();
      if (j.ok) setRequests(j.solicitudes || []);
      else setError(j.error || "Error");
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    getProjects().then(projs => {
      const map: Record<string, string> = {};
      projs.forEach((p: any) => { map[String(p.id)] = p.name; });
      setProjectsMap(map);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    const id = setInterval(() => { fetchRequests(); }, 8000);
    return () => clearInterval(id);
  }, []);

  const handleAction = async (id: number, aceptado: boolean) => {
    try {
      const res = await fetch("/api/horas-extras", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, aceptado }),
      });
      const j = await res.json();
      if (j.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== id));
        try { window.dispatchEvent(new CustomEvent('projects:updated')); } catch (e) { }
      } else {
        alert(j.error || "Error");
      }
    } catch (e) {
      alert("Error actualizando solicitud");
    }
  };

  return (
    <div className="rounded-xl bg-white shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
            <Clock className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 text-base">Solicitudes de Horas Extra</h3>
            <p className="text-xs text-slate-400">
              {requests.length > 0
                ? <span className="text-orange-500 font-medium">{requests.length} pendiente{requests.length > 1 ? 's' : ''}</span>
                : 'Sin solicitudes pendientes'
              }
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchRequests}
          disabled={loading}
          className="h-9 gap-1.5 text-slate-500 hover:text-[#1e3a5f] hover:bg-blue-50 rounded-lg"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline text-xs">Actualizar</span>
        </Button>
      </div>

      {error ? (
        <div className="border-t px-5 py-4">
          <div className="flex items-center gap-2 text-red-600 text-sm">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        </div>
      ) : requests.length === 0 ? (
        <div className="border-t px-5 py-6 text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-slate-50 mb-2">
            <CheckCircle2 className="h-5 w-5 text-slate-300" />
          </div>
          <p className="text-sm text-slate-400">No hay solicitudes pendientes.</p>
        </div>
      ) : (
        <div className="border-t divide-y divide-slate-100">
          {requests.map((r) => (
            <div key={r.id} className="p-4 sm:p-5 hover:bg-slate-50/50 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Left: Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-semibold text-slate-800 text-sm">{r.usuario}</span>
                    <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200 text-xs px-2 py-0">
                      {r.horas}h
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>{r.fecha ? new Date(r.fecha).toLocaleDateString("es-ES", { weekday: 'short', day: 'numeric', month: 'short' }) : '-'}</span>
                    {r.hora_inicio && <span>{r.hora_inicio} – {r.hora_fin}</span>}
                    <span className="font-medium text-slate-600">{r.proyecto || projectsMap[String(r.proyecto_id)] || r.proyecto_id || '-'}</span>
                  </div>
                  {(r.motivo || r.nota || r.tareas) && (
                    <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">
                      {r.motivo}{r.nota || r.tareas ? ` — ${r.nota || r.tareas}` : ''}
                    </p>
                  )}
                </div>

                {/* Right: Action Buttons */}
                <div className="flex gap-2 shrink-0 w-full sm:w-auto">
                  <button
                    onClick={() => handleAction(r.id, true)}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 px-3 sm:px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs sm:text-sm font-medium hover:bg-emerald-100 hover:border-emerald-300 transition-all active:scale-95"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>Autorizar</span>
                  </button>
                  <button
                    onClick={() => handleAction(r.id, false)}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 px-3 sm:px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs sm:text-sm font-medium hover:bg-red-100 hover:border-red-300 transition-all active:scale-95"
                  >
                    <XCircle className="h-4 w-4 shrink-0" />
                    <span>Rechazar</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
