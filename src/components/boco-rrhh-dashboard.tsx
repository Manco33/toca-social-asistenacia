"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  obtenerUsuariosBoco,
  crearUsuarioBoco,
  toggleActivarUsuarioBoco,
  asignarLiderColaborador,
  transferirEquipoAsignador,
  obtenerSedesBoco,
  obtenerPuestosBoco,
  obtenerMarcajesBoco,
  obtenerMonitoreoHoyEquipo,
  actualizarUsuarioBoco,
  crearCursoLMSRRHH,
  obtenerTrackerLMSRRHH,
  type ItemTrackerLMS,
} from "@/app/boco-actions";
import { exportarReporteCompletoBoco } from "@/lib/excel-export";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Users,
  Building2,
  FileSpreadsheet,
  BookOpen,
  PlusCircle,
  Download,
  Loader2,
  CheckCircle,
  XCircle,
  Sparkles,
  MapPin,
  Clock,
  ShieldCheck,
  CheckCircle2,
  ArrowRightLeft,
  LogOut as LogOutIcon,
  GraduationCap,
  RefreshCw,
  MessageCircle,
  Search,
  Filter,
  Award,
  ChevronRight,
  AlertTriangle,
  Radio,
  UserCheck,
  AlertOctagon,
  Coffee,
} from "lucide-react";
import type { UsuarioBoco, SedeZona, DepartamentoPuesto, MarcajeAsistencia } from "@/lib/types";
import { BocoLogo } from "@/components/boco-brand";

export function BocoRrhhDashboard() {
  const { user, login } = useAuth();
  const { toast } = useToast();

  const [usuarios, setUsuarios] = useState<UsuarioBoco[]>([]);
  const [sedes, setSedes] = useState<SedeZona[]>([]);
  const [puestos, setPuestos] = useState<DepartamentoPuesto[]>([]);
  const [marcajes, setMarcajes] = useState<MarcajeAsistencia[]>([]);
  const [monitoreoHoy, setMonitoreoHoy] = useState<any[]>([]);
  const [editandoCodigoId, setEditandoCodigoId] = useState<string | null>(null);
  const [codigoTemp, setCodigoTemp] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Formulario nuevo usuario
  const [nuevoUsername, setNuevoUsername] = useState("");
  const [nuevoCodigo, setNuevoCodigo] = useState("BC-");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoEmail, setNuevoEmail] = useState("");
  const [nuevoPass, setNuevoPass] = useState("Boco2026#");
  const [nuevoTelefono, setNuevoTelefono] = useState("");
  const [nuevoRol, setNuevoRol] = useState<"rrhh" | "asignador" | "colaborador">("colaborador");
  const [nuevoPuestoId, setNuevoPuestoId] = useState("");
  const [nuevaSedeId, setNuevaSedeId] = useState("");
  const [nuevoAsignadorId, setNuevoAsignadorId] = useState("");
  const [creandoUser, setCreandoUser] = useState(false);

  // Transferencia masiva de equipo (Cambio o renuncia de asignador)
  const [mostrarTransferencia, setMostrarTransferencia] = useState(false);
  const [asigOrigen, setAsigOrigen] = useState("");
  const [asigDestino, setAsigDestino] = useState("");
  const [transfiriendo, setTransfiriendo] = useState(false);

  // Formulario nuevo curso LMS (Solo RRHH)
  const [cursoTitulo, setCursoTitulo] = useState("");
  const [cursoDesc, setCursoDesc] = useState("");
  const [cursoContenido, setCursoContenido] = useState("");
  const [cursoVideoUrl, setCursoVideoUrl] = useState("");
  const [cursoTiempoMin, setCursoTiempoMin] = useState(120);
  const [cursoPuestoId, setCursoPuestoId] = useState("");
  const [creandoCurso, setCreandoCurso] = useState(false);

  // Tracker y Seguimiento LMS
  const [trackerLms, setTrackerLms] = useState<ItemTrackerLMS[]>([]);
  const [cursosLms, setCursosLms] = useState<any[]>([]);
  const [statsLms, setStatsLms] = useState({
    totalAsignaciones: 0,
    totalAprobados: 0,
    totalEnProgreso: 0,
    totalPendientes: 0,
    tasaAprobacion: 0,
  });
  const [cargandoTracker, setCargandoTracker] = useState(false);
  const [subPestañaLms, setSubPestañaLms] = useState<"tracker" | "crear" | "catalogo">("tracker");
  const [filtroCursoId, setFiltroCursoId] = useState<string>("todos");
  const [filtroEstadoLms, setFiltroEstadoLms] = useState<string>("todos");
  const [busquedaLms, setBusquedaLms] = useState<string>("");
  const [filtroTracker, setFiltroTracker] = useState<string>("todos");
  const [busquedaTracker, setBusquedaTracker] = useState<string>("");

  // RRHH solo administra su propia sucursal (null = sin sucursal asignada: no ve nada)
  const alcanceSedeId = user?.sede_id || null;

  useEffect(() => {
    if (!user) return;
    setNuevaSedeId(user.sede_id || "");
    cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      // Sincronizar primero la sede actual del usuario RRHH desde la BD (por si el Super Admin se la asignó recientemente)
      let sedeEfectiva = user?.sede_id || null;
      const todos = await obtenerUsuariosBoco();
      const miUsuarioBd = todos.find(
        (x) => (user?.id && x.id === user.id) || (user?.username && x.username === user.username)
      );
      if (miUsuarioBd) {
        sedeEfectiva = miUsuarioBd.sede_id || null;
        if (user && (user.sede_id !== miUsuarioBd.sede_id || user.sede?.nombre !== miUsuarioBd.sede?.nombre)) {
          login(miUsuarioBd);
        }
      }

      const [u, s, p, m, lmsRes] = await Promise.all([
        obtenerUsuariosBoco(sedeEfectiva),
        obtenerSedesBoco(sedeEfectiva),
        obtenerPuestosBoco(),
        obtenerMarcajesBoco({ sedeId: sedeEfectiva }),
        obtenerTrackerLMSRRHH(sedeEfectiva),
      ]);
      setUsuarios(u);
      setSedes(s);
      setPuestos(p);
      setMarcajes(m);
      if (lmsRes.success && lmsRes.tracker) {
        setTrackerLms(lmsRes.tracker);
        setCursosLms(lmsRes.cursos || []);
        if (lmsRes.estadisticas) setStatsLms(lmsRes.estadisticas);
      }

      // Cargar estados de asistencia de hoy para los colaboradores de esta sucursal
      const colabIds = u.filter((c) => c.rol === "colaborador").map((c) => c.id);
      if (colabIds.length > 0) {
        const monRes = await obtenerMonitoreoHoyEquipo(colabIds);
        if (monRes.success && monRes.monitoreo) {
          setMonitoreoHoy(monRes.monitoreo);
        }
      } else {
        setMonitoreoHoy([]);
      }
    } catch (e) {
      console.warn("Error cargando datos:", e);
    } finally {
      setLoading(false);
    }
  };

  const cargarTrackerLMS = async () => {
    setCargandoTracker(true);
    try {
      const lmsRes = await obtenerTrackerLMSRRHH(alcanceSedeId);
      if (lmsRes.success && lmsRes.tracker) {
        setTrackerLms(lmsRes.tracker);
        setCursosLms(lmsRes.cursos || []);
        if (lmsRes.estadisticas) setStatsLms(lmsRes.estadisticas);
      }
    } catch (e) {
      console.warn("Error cargando tracker LMS:", e);
    } finally {
      setCargandoTracker(false);
    }
  };

  const enviarRecordatorioWhatsAppLMS = (item: ItemTrackerLMS) => {
    if (!item.telefono) {
      toast({
        title: "Sin teléfono registrado",
        description: `El colaborador ${item.usuario_nombre} no tiene número de teléfono registrado en su ficha.`,
        variant: "destructive",
      });
      return;
    }
    const cleanPhone = item.telefono.replace(/\D/g, "");
    const texto = `Hola ${item.usuario_nombre}, te saludamos de Recursos Humanos de BOCO. Te recordamos que tienes pendiente completar tu curso "${item.curso_titulo}" en la Academia BOCO. Por favor ingresa a tu portal para certificar tu puesto. ¡Gracias por tu compromiso!`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(texto)}`;
    window.open(url, "_blank");
  };

  const handleCrearUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoUsername.trim() || !nuevoNombre.trim()) {
      toast({
        title: "Campos Requeridos",
        description: "El nombre de usuario y el nombre completo son obligatorios.",
        variant: "destructive",
      });
      return;
    }

    setCreandoUser(true);
    try {
      const res = await crearUsuarioBoco(
        {
          username: nuevoUsername.trim().toLowerCase(),
          codigo_rrhh: nuevoCodigo.trim(),
          nombre_completo: nuevoNombre.trim(),
          email: nuevoEmail.trim() || undefined,
          password_hash: nuevoPass,
          telefono: nuevoTelefono.trim(),
          rol: nuevoRol,
          puesto_id: nuevoPuestoId || undefined,
          sede_id: nuevaSedeId || undefined,
          asignador_id: nuevoAsignadorId || undefined,
        },
        user?.id
      );

      if (res.success) {
        toast({
          title: "Colaborador Registrado",
          description: `Se creó el usuario "${nuevoUsername}" (${nuevoNombre}).`,
        });
        setNuevoUsername("");
        setNuevoNombre("");
        setNuevoEmail("");
        setNuevoCodigo(`BC-${Math.floor(100 + Math.random() * 900)}#${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`);
        cargarDatos();
      } else {
        toast({
          title: "Error al crear",
          description: res.error,
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCreandoUser(false);
    }
  };

  const handleToggleActivo = async (uId: string, activoActual: boolean) => {
    const res = await toggleActivarUsuarioBoco(uId, !activoActual, user?.id);
    if (!res.success) {
      toast({ title: "No se pudo actualizar", description: res.error, variant: "destructive" });
      return;
    }
    if (res.success) {
      toast({
        title: "Estado Actualizado",
        description: `Usuario ${!activoActual ? "Activado" : "Desactivado"} correctamente.`,
      });
      cargarDatos();
    }
  };

  const handleTransferirEquipo = async () => {
    if (!asigOrigen || !asigDestino) {
      toast({
        title: "Campos Requeridos",
        description: "Selecciona el asignador saliente y el nuevo asignador.",
        variant: "destructive",
      });
      return;
    }
    if (asigOrigen === asigDestino) {
      toast({
        title: "Asignadores Iguales",
        description: "El asignador saliente y el nuevo asignador deben ser diferentes.",
        variant: "destructive",
      });
      return;
    }

    setTransfiriendo(true);
    try {
      const res = await transferirEquipoAsignador(asigOrigen, asigDestino);
      if (res.success) {
        toast({
          title: "Equipo Transferido Exitosamente",
          description: `Se reasignaron ${res.totalTransferidos} colaboradores al nuevo asignador.`,
        });
        setMostrarTransferencia(false);
        setAsigOrigen("");
        setAsigDestino("");
        cargarDatos();
      } else {
        toast({
          title: "Error al transferir",
          description: res.error,
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setTransfiriendo(false);
    }
  };

  const handleCrearCursoLMS = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cursoTitulo.trim() || !cursoContenido.trim()) {
      toast({
        title: "Contenido Requerido",
        description: "El título y material formativo son obligatorios.",
        variant: "destructive",
      });
      return;
    }

    setCreandoCurso(true);
    try {
      const res = await crearCursoLMSRRHH({
        creado_por: user?.id || "admin",
        titulo: cursoTitulo.trim(),
        descripcion: cursoDesc.trim(),
        contenido_texto: cursoContenido.trim(),
        video_url: cursoVideoUrl.trim() || undefined,
        tiempo_minimo_lectura_segundos: Number(cursoTiempoMin) || 120,
        puntuacion_minima_aprobacion: 80,
        asignarA: cursoPuestoId ? { tipo: "puesto", puesto_id: cursoPuestoId } : undefined,
      });

      if (res.success) {
        toast({
          title: "¡Curso y Evaluación Creados!",
          description: "La IA generó automáticamente el cuestionario con justificaciones para este material.",
        });
        setCursoTitulo("");
        setCursoDesc("");
        setCursoContenido("");
        setCursoVideoUrl("");
      } else {
        toast({ title: "Error", description: res.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCreandoCurso(false);
    }
  };

  const handleDescargarExcel = () => {
    exportarReporteCompletoBoco({
      colaboradores: usuarios,
      marcajes: marcajes,
      nombreArchivo: `Reporte_Oficial_BOCO_${new Date().toISOString().slice(0, 10)}.xlsx`,
    });
    toast({
      title: "Excel Descargado",
      description: "El archivo contiene las hojas formateadas para Recursos Humanos y Nómina.",
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* HEADER DE RECURSOS HUMANOS (BOCO NAVY & ACCENTS) */}
      <div className="bg-brand-dark rounded-3xl p-6 sm:p-7 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-slate-800">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-brand-primary/20 via-brand-accent/15 to-transparent rounded-full blur-3xl -z-0 pointer-events-none" />

        <div className="relative z-10 space-y-2">
          <span className="text-[11px] uppercase font-bold tracking-widest text-brand-accent">
            Dirección de Personas & Organización
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Gestión Integral BOCO
          </h1>
          <p className="text-xs text-slate-300 max-w-2xl">
            {user?.sede ? `${user.sede.marca?.nombre ? user.sede.marca.nombre + " · " : ""}${user.sede.nombre}: ` : ""}colaboradores, capacitación institucional LMS y reportes de nómina en Excel.
          </p>
        </div>

        <Button
          onClick={handleDescargarExcel}
          className="relative z-10 bg-brand-accent hover:bg-brand-accent-hover text-slate-950 rounded-2xl h-11 px-5 font-bold shadow-lg shadow-brand-accent/20 flex items-center gap-2 self-start md:self-auto"
        >
          <FileSpreadsheet className="h-5 w-5 text-slate-950" />
          Descargar Reporte Excel (.xlsx)
        </Button>
      </div>

      {/* PESTAÑAS DE ADMINISTRACIÓN (SIN EMOJIS) */}
      <Tabs defaultValue="usuarios" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 max-w-3xl bg-slate-200/80 p-1.5 rounded-2xl gap-1">
          <TabsTrigger value="usuarios" className="text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 py-2">
            <Users className="h-3.5 w-3.5 text-brand-primary" />
            Colaboradores
          </TabsTrigger>
          <TabsTrigger value="tracker" className="text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 py-2">
            <Radio className="h-3.5 w-3.5 text-rose-500 animate-pulse" />
            Tracker en Vivo
          </TabsTrigger>
          <TabsTrigger value="sedes" className="text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 py-2">
            <MapPin className="h-3.5 w-3.5 text-[#F5A623]" />
            Sedes & Geocercas
          </TabsTrigger>
          <TabsTrigger value="lms" className="text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 py-2">
            <BookOpen className="h-3.5 w-3.5 text-brand-accent" />
            Academia LMS
          </TabsTrigger>
          <TabsTrigger value="reportes" className="text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 py-2">
            <FileSpreadsheet className="h-3.5 w-3.5 text-slate-600" />
            Reportes & Nómina
          </TabsTrigger>
        </TabsList>

        {/* 1. ESTADOS DE COLABORADORES DE LA SUCURSAL */}
        <TabsContent value="usuarios" className="mt-6 space-y-6">
          {/* SEMÁFORO DE ASISTENCIA EN VIVO DE LA SUCURSAL */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 block">
                En Turno / Puntuales Hoy
              </span>
              <span className="text-2xl font-extrabold text-emerald-600 mt-1 block">
                {monitoreoHoy.filter((m) => m.estado === "puntual" || m.estado === "finalizado" || m.estado === "en_almuerzo").length}
              </span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 block">
                Con Retardo Hoy
              </span>
              <span className="text-2xl font-extrabold text-amber-600 mt-1 block">
                {monitoreoHoy.filter((m) => m.estado === "retardo").length}
              </span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-rose-200 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wide text-rose-600 block">
                Sin Marcar (En Rojo)
              </span>
              <span className="text-2xl font-extrabold text-rose-600 mt-1 block">
                {monitoreoHoy.filter((m) => m.estado === "sin_marcar").length}
              </span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 block">
                Descanso / Sin Turno Hoy
              </span>
              <span className="text-2xl font-extrabold text-slate-700 mt-1 block">
                {monitoreoHoy.filter((m) => m.estado === "descanso" || m.estado === "sin_turno" || m.estado === "turno_proximo").length}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {/* TABLA DE COLABORADORES Y ESTADOS DE LA SUCURSAL */}
            <Card className="rounded-3xl border-slate-200 shadow-sm bg-white overflow-hidden">
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 p-5 border-b border-slate-100 gap-3">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900">
                    Colaboradores de mi Sucursal ({usuarios.filter((u) => u.rol !== "superadmin").length})
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Monitoreo en tiempo real de estado de asistencia hoy, ID de nómina RRHH, asignación de líderes y biometría.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={cargarDatos}
                    className="text-xs border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
                    Actualizar Estados
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setMostrarTransferencia(!mostrarTransferencia)}
                    className="text-xs border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl"
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5 mr-1 text-brand-primary" />
                    {mostrarTransferencia ? "Cerrar Transferencia" : "Reasignar Equipo por Renuncia"}
                  </Button>
                </div>
              </CardHeader>

              {mostrarTransferencia && (
                <div className="mx-5 my-4 p-5 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-3">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <ArrowRightLeft className="h-4 w-4 text-brand-primary" />
                    Reasignación Masiva de Equipo por Renuncia o Contratación
                  </h4>
                  <p className="text-[11px] text-slate-600">
                    Si un Asignador renuncia o deja la empresa, puedes transferir todos sus colaboradores al nuevo supervisor con un solo clic. El historial de turnos y marcajes pasados se conserva intacto.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Asignador Saliente (Anterior)
                      </label>
                      <select
                        value={asigOrigen}
                        onChange={(e) => setAsigOrigen(e.target.value)}
                        className="w-full text-xs rounded-xl border border-slate-300 p-2 bg-white"
                      >
                        <option value="">Selecciona asignador anterior...</option>
                        {usuarios
                          .filter((u) => u.rol === "asignador")
                          .map((a) => {
                            const conteo = usuarios.filter((u) => u.asignador_id === a.id).length;
                            return (
                              <option key={a.id} value={a.id}>
                                {a.nombre_completo} ({conteo} a cargo)
                              </option>
                            );
                          })}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Nuevo Asignador (Contratado)
                      </label>
                      <select
                        value={asigDestino}
                        onChange={(e) => setAsigDestino(e.target.value)}
                        className="w-full text-xs rounded-xl border border-slate-300 p-2 bg-white"
                      >
                        <option value="">Selecciona nuevo asignador...</option>
                        {usuarios
                          .filter((u) => u.rol === "asignador" && u.activo && u.id !== asigOrigen)
                          .map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.nombre_completo} ({a.codigo_rrhh})
                            </option>
                          ))}
                      </select>
                    </div>

                    <Button
                      type="button"
                      disabled={transfiriendo || !asigOrigen || !asigDestino}
                      onClick={handleTransferirEquipo}
                      className="bg-brand-dark hover:bg-brand-dark-hover text-white text-xs font-bold h-10 rounded-xl"
                    >
                      {transfiriendo ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                      Transferir Todo el Equipo
                    </Button>
                  </div>
                </div>
              )}
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-500 border-y">
                      <tr>
                        <th className="p-3">ID RRHH</th>
                        <th className="p-3">Nombre / Usuario</th>
                        <th className="p-3">Rol / Puesto</th>
                        <th className="p-3">Estado Hoy (Turno)</th>
                        <th className="p-3">Líder Asignador</th>
                        <th className="p-3">Rostro</th>
                        <th className="p-3">Estado</th>
                        <th className="p-3 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {usuarios
                        .filter((u) => u.rol !== "superadmin")
                        .map((u) => {
                          const mon = monitoreoHoy.find((m) => m.usuario_id === u.id);
                          return (
                            <tr key={u.id} className="hover:bg-slate-50/80">
                              <td className="p-3 font-mono font-bold text-brand-primary whitespace-nowrap">
                                {editandoCodigoId === u.id ? (
                                  <div className="flex items-center gap-1">
                                    <Input
                                      value={codigoTemp}
                                      onChange={(e) => setCodigoTemp(e.target.value)}
                                      className="h-7 w-28 text-xs font-mono px-2 rounded-lg"
                                    />
                                    <Button
                                      size="sm"
                                      className="h-7 px-2 text-[10px] bg-brand-dark text-white rounded-lg"
                                      onClick={async () => {
                                        if (!user) return;
                                        const res = await actualizarUsuarioBoco(user.id, u.id, { codigo_rrhh: codigoTemp });
                                        if (res.success) {
                                          toast({ title: "ID RRHH actualizado", description: `${u.nombre_completo}: ${codigoTemp}` });
                                          setEditandoCodigoId(null);
                                          cargarDatos();
                                        } else {
                                          toast({ title: "Error", description: res.error, variant: "destructive" });
                                        }
                                      }}
                                    >
                                      OK
                                    </Button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditandoCodigoId(u.id);
                                      setCodigoTemp(u.codigo_rrhh || "");
                                    }}
                                    className="hover:underline text-left"
                                    title="Clic para editar ID de RRHH"
                                  >
                                    {u.codigo_rrhh || "Asignar ID"}
                                  </button>
                                )}
                              </td>
                              <td className="p-3">
                                <span className="font-semibold text-slate-900 block">{u.nombre_completo}</span>
                                <span className="font-mono text-[10px] text-slate-400">@{u.username || "-"}</span>
                              </td>
                              <td className="p-3">
                                <span className="block font-bold uppercase text-[10px] text-slate-700">{u.rol}</span>
                                <span className="text-slate-500 text-[11px]">{u.puesto?.nombre || "Sin puesto"}</span>
                              </td>
                              <td className="p-3">
                                {u.rol === "colaborador" && mon ? (
                                  <div className="space-y-0.5">
                                    {mon.estado_vivo === "en_turno_puntual" && (
                                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[10px]">
                                        A Tiempo ({mon.hora_entrada_real})
                                      </Badge>
                                    )}
                                    {mon.estado_vivo === "en_turno_retardo" && (
                                      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-[10px]">
                                        Retardo +{mon.minutos_retraso}m ({mon.hora_entrada_real})
                                      </Badge>
                                    )}
                                    {mon.estado_vivo === "ausente_sin_marcar" && (
                                      <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 text-[10px]">
                                        No ha marcado ({mon.turno_entrada})
                                      </Badge>
                                    )}
                                    {mon.estado_vivo === "jornada_completada" && (
                                      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 text-[10px]">
                                        Salida ({mon.hora_salida_real})
                                      </Badge>
                                    )}
                                    {mon.estado_vivo === "dia_libre" && (
                                      <Badge variant="outline" className="text-[10px] text-slate-600">
                                        Día Libre / OFF
                                      </Badge>
                                    )}
                                    {mon.estado_vivo === "pendiente_iniciar" && (
                                      <Badge variant="outline" className="text-[10px] text-blue-700 border-blue-200">
                                        Entra a las {mon.turno_entrada}
                                      </Badge>
                                    )}
                                    {mon.estado_vivo === "sin_turno" && (
                                      <span className="text-[10px] text-slate-400">Sin turno asignado hoy</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">-</span>
                                )}
                              </td>
                              <td className="p-3">
                                {u.rol === "colaborador" ? (
                                  <select
                                    value={u.asignador_id || ""}
                                    onChange={async (e) => {
                                      const asignadorNuevoId = e.target.value || null;
                                      const res = await asignarLiderColaborador(u.id, asignadorNuevoId, user?.id);
                                      if (res.success) {
                                        toast({
                                          title: "Líder Actualizado",
                                          description: `Se actualizó el supervisor de ${u.nombre_completo}.`,
                                        });
                                        cargarDatos();
                                      } else {
                                        toast({
                                          title: "Error al asignar líder",
                                          description: res.error,
                                          variant: "destructive",
                                        });
                                      }
                                    }}
                                    className="text-[11px] font-semibold rounded-lg border border-slate-300 bg-white p-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-primary"
                                  >
                                    <option value="">Sin Asignador</option>
                                    {usuarios
                                      .filter((a) => a.rol === "asignador")
                                      .map((a) => (
                                        <option key={a.id} value={a.id}>
                                          {a.nombre_completo}
                                        </option>
                                      ))}
                                  </select>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">No aplica</span>
                                )}
                              </td>
                              <td className="p-3">
                                {u.facial_enrolled ? (
                                  <Badge className="bg-brand-accent text-slate-950 font-bold text-[10px] hover:bg-brand-accent">
                                    <CheckCircle2 className="h-3 w-3 mr-1 inline" />
                                    Enrolado
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-slate-500 text-[10px]">Sin Enrolar</Badge>
                                )}
                              </td>
                              <td className="p-3">
                                {u.activo ? (
                                  <Badge className="bg-emerald-50 text-emerald-700 text-[10px]">Activo</Badge>
                                ) : (
                                  <Badge className="bg-rose-50 text-rose-700 text-[10px]">Inactivo</Badge>
                                )}
                              </td>
                              <td className="p-3 text-right">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleToggleActivo(u.id, u.activo)}
                                  className={`text-[11px] h-7 rounded-lg ${u.activo ? "text-rose-600 hover:bg-rose-50" : "text-emerald-600 hover:bg-emerald-50"}`}
                                >
                                  {u.activo ? "Desactivar" : "Activar"}
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 1B. TRACKER DE ASISTENCIA EN VIVO (IGUAL AL ASIGNADOR, PARA TODA LA SUCURSAL) */}
        <TabsContent value="tracker" className="mt-6 space-y-6">
          {(() => {
            const colabsSucursal = usuarios.filter((u) => u.rol === "colaborador");
            const totalEquipo = colabsSucursal.length;
            const puntualCount = monitoreoHoy.filter(
              (m) => m.estado === "puntual" || m.estado === "finalizado" || m.estado === "en_almuerzo"
            ).length;
            const retardoCount = monitoreoHoy.filter((m) => m.estado === "retardo").length;
            const sinMarcarCount = monitoreoHoy.filter((m) => m.estado === "sin_marcar").length;
            const proximoCount = monitoreoHoy.filter((m) => m.estado === "turno_proximo").length;
            const descansoCount = monitoreoHoy.filter(
              (m) => m.estado === "descanso" || m.estado === "sin_turno"
            ).length;

            const q = busquedaTracker.trim().toLowerCase();
            const filtrados = colabsSucursal.filter((colab) => {
              if (
                q &&
                !colab.nombre_completo.toLowerCase().includes(q) &&
                !(colab.puesto?.nombre || "").toLowerCase().includes(q) &&
                !(colab.username || "").toLowerCase().includes(q)
              ) {
                return false;
              }
              const info = monitoreoHoy.find((m) => m.usuario_id === colab.id);
              const est = info?.estado || "sin_turno";
              if (filtroTracker === "todos") return true;
              if (filtroTracker === "sin_marcar") return est === "sin_marcar";
              if (filtroTracker === "retardo") return est === "retardo";
              if (filtroTracker === "puntual") return est === "puntual" || est === "finalizado" || est === "en_almuerzo";
              if (filtroTracker === "proximo") return est === "turno_proximo";
              if (filtroTracker === "descanso") return est === "descanso" || est === "sin_turno";
              return true;
            });

            return (
              <>
                {/* ENCABEZADO DEL TRACKER EN VIVO */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                      <Radio className="h-5 w-5 text-rose-500 animate-pulse" />
                      Tracker de Asistencia en Tiempo Real
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Control de entradas, retardos, salidas y descansos de toda tu sucursal hoy.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 self-end sm:self-auto">
                    <div className="relative">
                      <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <Input
                        value={busquedaTracker}
                        onChange={(e) => setBusquedaTracker(e.target.value)}
                        placeholder="Buscar nombre o puesto..."
                        className="pl-8 h-9 w-48 text-xs rounded-xl border-slate-200"
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={cargarDatos}
                      disabled={loading}
                      className="h-9 rounded-xl border-slate-200 text-xs font-semibold hover:bg-slate-50"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin text-brand-primary" : "text-slate-600"}`} />
                      Actualizar en Vivo
                    </Button>
                  </div>
                </div>

                {/* 5 KPI CARDS RESUMEN */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider">Total Sucursal</span>
                      <Users className="h-4 w-4 text-brand-primary" />
                    </div>
                    <div className="text-2xl font-black text-slate-900">{totalEquipo}</div>
                    <span className="text-[11px] text-slate-500 font-medium">Colaboradores</span>
                  </div>

                  <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200 shadow-sm">
                    <div className="flex items-center justify-between text-emerald-700 mb-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider">En Sede / Puntuales</span>
                      <UserCheck className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="text-2xl font-black text-emerald-800">{puntualCount}</div>
                    <span className="text-[11px] text-emerald-700 font-medium">Marcajes confirmados</span>
                  </div>

                  <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200 shadow-sm">
                    <div className="flex items-center justify-between text-amber-700 mb-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider">Con Retardo</span>
                      <Clock className="h-4 w-4 text-amber-600" />
                    </div>
                    <div className="text-2xl font-black text-amber-800">{retardoCount}</div>
                    <span className="text-[11px] text-amber-700 font-medium">Llegaron fuera de horario</span>
                  </div>

                  <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-300 shadow-sm relative overflow-hidden">
                    {sinMarcarCount > 0 && <div className="absolute top-0 right-0 w-2 h-full bg-rose-500 animate-pulse" />}
                    <div className="flex items-center justify-between text-rose-700 mb-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider">¡Sin Marcar!</span>
                      <AlertOctagon className="h-4 w-4 text-rose-600 animate-pulse" />
                    </div>
                    <div className="text-2xl font-black text-rose-800">{sinMarcarCount}</div>
                    <span className="text-[11px] text-rose-700 font-medium">Turno iniciado sin entrada</span>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider">Turno Tarde / OFF</span>
                      <Coffee className="h-4 w-4 text-slate-500" />
                    </div>
                    <div className="text-2xl font-black text-slate-800">{proximoCount + descansoCount}</div>
                    <span className="text-[11px] text-slate-500 font-medium">{proximoCount} prox. / {descansoCount} OFF</span>
                  </div>
                </div>

                {/* FILTROS POR SEMÁFORO */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  <Button
                    size="sm"
                    variant={filtroTracker === "todos" ? "default" : "outline"}
                    onClick={() => setFiltroTracker("todos")}
                    className={`rounded-xl text-xs h-8 ${filtroTracker === "todos" ? "bg-brand-dark text-white" : "border-slate-200 text-slate-600"}`}
                  >
                    Todos ({totalEquipo})
                  </Button>
                  <Button
                    size="sm"
                    variant={filtroTracker === "sin_marcar" ? "default" : "outline"}
                    onClick={() => setFiltroTracker("sin_marcar")}
                    className={`rounded-xl text-xs h-8 ${filtroTracker === "sin_marcar" ? "bg-rose-600 text-white hover:bg-rose-700" : "border-rose-200 text-rose-700 hover:bg-rose-50"}`}
                  >
                    <AlertOctagon className="h-3 w-3 mr-1" />
                    Rojo: Sin Marcar ({sinMarcarCount})
                  </Button>
                  <Button
                    size="sm"
                    variant={filtroTracker === "retardo" ? "default" : "outline"}
                    onClick={() => setFiltroTracker("retardo")}
                    className={`rounded-xl text-xs h-8 ${filtroTracker === "retardo" ? "bg-amber-600 text-white hover:bg-amber-700" : "border-amber-200 text-amber-700 hover:bg-amber-50"}`}
                  >
                    <Clock className="h-3 w-3 mr-1" />
                    Amarillo: Con Retardo ({retardoCount})
                  </Button>
                  <Button
                    size="sm"
                    variant={filtroTracker === "puntual" ? "default" : "outline"}
                    onClick={() => setFiltroTracker("puntual")}
                    className={`rounded-xl text-xs h-8 ${filtroTracker === "puntual" ? "bg-emerald-600 text-white hover:bg-emerald-700" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"}`}
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Verde: Puntuales ({puntualCount})
                  </Button>
                  <Button
                    size="sm"
                    variant={filtroTracker === "proximo" ? "default" : "outline"}
                    onClick={() => setFiltroTracker("proximo")}
                    className={`rounded-xl text-xs h-8 ${filtroTracker === "proximo" ? "bg-slate-700 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                  >
                    Turno Próximo ({proximoCount})
                  </Button>
                  <Button
                    size="sm"
                    variant={filtroTracker === "descanso" ? "default" : "outline"}
                    onClick={() => setFiltroTracker("descanso")}
                    className={`rounded-xl text-xs h-8 ${filtroTracker === "descanso" ? "bg-purple-700 text-white" : "border-purple-200 text-purple-700 hover:bg-purple-50"}`}
                  >
                    Día OFF / Sin Turno ({descansoCount})
                  </Button>
                </div>

                {/* LISTADO DE TARJETAS DEL TRACKER */}
                {filtrados.length === 0 ? (
                  <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80">
                    <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-bold text-slate-700">No hay colaboradores en esta categoría</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {filtrados.map((colab) => {
                      const info = monitoreoHoy.find((m) => m.usuario_id === colab.id);
                      const estado = info?.estado || "sin_turno";
                      const esRojo = estado === "sin_marcar";
                      const esAmarillo = estado === "retardo";
                      const esVerde = estado === "puntual" || estado === "finalizado" || estado === "en_almuerzo";
                      const esDescanso = estado === "descanso" || estado === "sin_turno";
                      const esProximo = estado === "turno_proximo";

                      return (
                        <Card
                          key={colab.id}
                          className={`rounded-3xl transition-all duration-200 overflow-hidden border ${
                            esRojo
                              ? "border-rose-300 bg-rose-50/30 shadow-md ring-1 ring-rose-200"
                              : esAmarillo
                              ? "border-amber-300 bg-amber-50/20 shadow-sm"
                              : esVerde
                              ? "border-emerald-200 bg-white shadow-sm"
                              : "border-slate-200 bg-white shadow-sm"
                          }`}
                        >
                          <div className="p-5 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="h-11 w-11 rounded-2xl bg-brand-dark text-white flex items-center justify-center font-bold text-sm shrink-0">
                                  {colab.nombre_completo.split(" ").slice(0, 2).map((n) => n[0]).join("")}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-extrabold text-slate-900 text-sm">{colab.nombre_completo}</span>
                                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-bold border border-slate-200">
                                      @{colab.username}
                                    </span>
                                  </div>
                                  <div className="text-xs text-slate-500 mt-0.5">
                                    {colab.puesto?.nombre || "Colaborador"} • {colab.sede?.nombre || "Sucursal"}
                                  </div>
                                </div>
                              </div>

                              <div className="self-start sm:self-auto shrink-0">
                                {esRojo && (
                                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 text-white font-extrabold text-xs animate-pulse">
                                    <AlertOctagon className="h-4 w-4" />
                                    <span>ROJO: SIN MARCAR</span>
                                  </div>
                                )}
                                {esAmarillo && (
                                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 text-white font-extrabold text-xs">
                                    <Clock className="h-4 w-4" />
                                    <span>AMARILLO: RETARDO</span>
                                  </div>
                                )}
                                {esVerde && (
                                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-accent text-brand-dark font-extrabold text-xs">
                                    <CheckCircle2 className="h-4 w-4" />
                                    <span>{estado === "finalizado" ? "FINALIZADO" : estado === "en_almuerzo" ? "EN ALMUERZO" : "EN SEDE · PUNTUAL"}</span>
                                  </div>
                                )}
                                {esProximo && (
                                  <Badge variant="outline" className="text-slate-600 border-slate-300 text-xs">
                                    Turno Próximo
                                  </Badge>
                                )}
                                {esDescanso && (
                                  <Badge variant="outline" className="text-purple-700 border-purple-200 bg-purple-50 text-xs">
                                    {estado === "descanso" ? "Día OFF" : "Sin Turno Hoy"}
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50/80 p-3 rounded-2xl border border-slate-100 text-xs">
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase block">Turno Programado Hoy</span>
                                <span className="font-mono font-bold text-slate-800">
                                  {info?.turnoHoy
                                    ? info.turnoHoy.es_dia_descanso
                                      ? info.turnoHoy.notas || "OFF / Descanso"
                                      : `${info.turnoHoy.hora_entrada?.slice(0, 5)} - ${info.turnoHoy.hora_salida?.slice(0, 5)}`
                                    : "Sin turno asignado"}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase block">Marcaje de Entrada</span>
                                <span className="font-mono font-bold text-slate-800">
                                  {info?.marcajeHoy?.hora_entrada
                                    ? new Date(info.marcajeHoy.hora_entrada).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                    : "—"}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase block">Estado / Salida</span>
                                <span className="font-semibold text-slate-700">
                                  {info?.mensajeEstado || "Sin actividad registrada"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}
        </TabsContent>

        {/* 2. SEDES Y GEOCERCAS */}
        <TabsContent value="sedes" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* LISTA DE SEDES REGISTRADAS */}
            <Card className="lg:col-span-3 rounded-2xl border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold text-slate-800">
                  Sedes y Geocercas Activas ({sedes.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Zonas donde el personal asignado tiene autorización geográfica para marcar entrada, almuerzos y salida.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sedes.map((s) => (
                    <div key={s.id} className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-teal-400 transition-all space-y-2">
                      <div className="flex items-start justify-between">
                        <span className="text-sm font-bold text-slate-800 block">{s.nombre}</span>
                        <Badge className="bg-emerald-50 text-emerald-800 text-[10px]">Activa</Badge>
                      </div>
                      <p className="text-xs text-slate-500">{s.direccion || "Dirección comercial BOCO"}</p>
                      <div className="pt-2 text-xs text-slate-600 space-y-1">
                        <p>
                          Coordenadas: <span className="font-mono">{s.latitud}, {s.longitud}</span>
                        </p>
                        <Badge className="bg-teal-50 text-teal-800 font-bold text-[10px]">
                          🎯 Geocerca: Radio de {s.radio_metros} metros
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 3. ACADEMIA LMS & TRACKER DE CAPACITACIONES (EXCLUSIVO RRHH) */}
        <TabsContent value="lms" className="mt-6 space-y-6">
          {/* SELECTOR DE VISTA DENTRO DE ACADEMIA LMS */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Academia y Capacitaciones BOCO
                </h2>
                <p className="text-xs text-slate-500">
                  Control de cumplimiento normativo, cursos creados por IA y seguimiento de colaboradores certificados.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 self-end sm:self-auto">
              <Button
                size="sm"
                variant={subPestañaLms === "tracker" ? "default" : "ghost"}
                onClick={() => setSubPestañaLms("tracker")}
                className={`text-xs rounded-xl h-8 font-bold ${
                  subPestañaLms === "tracker"
                    ? "bg-brand-dark text-white"
                    : "text-slate-600 hover:bg-white"
                }`}
              >
                <Award className="h-3.5 w-3.5 mr-1 text-brand-accent" />
                Tracker & Certificados ({trackerLms.length})
              </Button>
              <Button
                size="sm"
                variant={subPestañaLms === "catalogo" ? "default" : "ghost"}
                onClick={() => setSubPestañaLms("catalogo")}
                className={`text-xs rounded-xl h-8 font-bold ${
                  subPestañaLms === "catalogo"
                    ? "bg-brand-dark text-white"
                    : "text-slate-600 hover:bg-white"
                }`}
              >
                <BookOpen className="h-3.5 w-3.5 mr-1 text-brand-primary" />
                Cursos ({cursosLms.length})
              </Button>
              <Button
                size="sm"
                variant={subPestañaLms === "crear" ? "default" : "ghost"}
                onClick={() => setSubPestañaLms("crear")}
                className={`text-xs rounded-xl h-8 font-bold ${
                  subPestañaLms === "crear"
                    ? "bg-brand-dark text-white"
                    : "text-slate-600 hover:bg-white"
                }`}
              >
                <PlusCircle className="h-3.5 w-3.5 mr-1 text-purple-600" />
                Nuevo Curso con IA
              </Button>
            </div>
          </div>

          {/* VISTA 1: TRACKER Y CERTIFICACIONES (QUIÉNES ACABARON CURSOS) */}
          {subPestañaLms === "tracker" && (
            <div className="space-y-6">
              {/* KPIS DE CUMPLIMIENTO LMS */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Total Asignaciones</span>
                    <Users className="h-4 w-4 text-brand-primary" />
                  </div>
                  <div className="text-2xl font-black text-slate-900">{statsLms.totalAsignaciones}</div>
                  <span className="text-[10px] text-slate-500 font-medium">Capacitaciones activas</span>
                </div>

                <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 shadow-sm">
                  <div className="flex items-center justify-between text-emerald-700 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Aprobados / Certificados</span>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="text-2xl font-black text-emerald-800">{statsLms.totalAprobados}</div>
                  <span className="text-[10px] text-emerald-700 font-medium">Exámenes superados</span>
                </div>

                <div className="bg-blue-50/70 p-4 rounded-2xl border border-blue-200 shadow-sm">
                  <div className="flex items-center justify-between text-blue-700 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider">En Progreso / Lectura</span>
                    <Clock className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="text-2xl font-black text-blue-800">{statsLms.totalEnProgreso}</div>
                  <span className="text-[10px] text-blue-700 font-medium">Estudiando material</span>
                </div>

                <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 shadow-sm">
                  <div className="flex items-center justify-between text-amber-700 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Pendientes por Iniciar</span>
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  </div>
                  <div className="text-2xl font-black text-amber-800">{statsLms.totalPendientes}</div>
                  <span className="text-[10px] text-amber-700 font-medium">Sin comenzar lectura</span>
                </div>

                <div className="bg-purple-50/70 p-4 rounded-2xl border border-purple-200 shadow-sm">
                  <div className="flex items-center justify-between text-purple-700 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Tasa Aprobación</span>
                    <Award className="h-4 w-4 text-purple-600" />
                  </div>
                  <div className="text-2xl font-black text-purple-800">{statsLms.tasaAprobacion}%</div>
                  <span className="text-[10px] text-purple-700 font-medium">Efectividad global</span>
                </div>
              </div>

              {/* FILTROS Y BÚSQUEDA DEL TRACKER */}
              <Card className="rounded-3xl border-slate-200/90 shadow-sm overflow-hidden bg-white">
                <div className="p-4 bg-slate-50 border-b border-slate-200/80 flex flex-col md:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2 w-full md:w-auto flex-1 max-w-md">
                    <div className="relative w-full">
                      <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                      <Input
                        value={busquedaLms}
                        onChange={(e) => setBusquedaLms(e.target.value)}
                        placeholder="Buscar por colaborador, código, puesto o curso..."
                        className="pl-9 text-xs rounded-xl bg-white border-slate-300"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full md:w-auto flex-wrap justify-end">
                    <select
                      value={filtroCursoId}
                      onChange={(e) => setFiltroCursoId(e.target.value)}
                      className="text-xs rounded-xl border border-slate-300 p-2 bg-white font-medium"
                    >
                      <option value="todos">Todos los Cursos</option>
                      {cursosLms.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.titulo}
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
                      <Button
                        size="sm"
                        variant={filtroEstadoLms === "todos" ? "default" : "ghost"}
                        onClick={() => setFiltroEstadoLms("todos")}
                        className={`text-[11px] h-7 px-2.5 rounded-lg ${filtroEstadoLms === "todos" ? "bg-brand-dark text-white" : "text-slate-600"}`}
                      >
                        Todos
                      </Button>
                      <Button
                        size="sm"
                        variant={filtroEstadoLms === "aprobado" ? "default" : "ghost"}
                        onClick={() => setFiltroEstadoLms("aprobado")}
                        className={`text-[11px] h-7 px-2.5 rounded-lg ${filtroEstadoLms === "aprobado" ? "bg-emerald-600 text-white" : "text-emerald-700"}`}
                      >
                        Aprobados
                      </Button>
                      <Button
                        size="sm"
                        variant={filtroEstadoLms === "en_progreso" ? "default" : "ghost"}
                        onClick={() => setFiltroEstadoLms("en_progreso")}
                        className={`text-[11px] h-7 px-2.5 rounded-lg ${filtroEstadoLms === "en_progreso" ? "bg-blue-600 text-white" : "text-blue-700"}`}
                      >
                        En Lectura
                      </Button>
                      <Button
                        size="sm"
                        variant={filtroEstadoLms === "pendiente" ? "default" : "ghost"}
                        onClick={() => setFiltroEstadoLms("pendiente")}
                        className={`text-[11px] h-7 px-2.5 rounded-lg ${filtroEstadoLms === "pendiente" ? "bg-amber-600 text-white" : "text-amber-700"}`}
                      >
                        Pendientes
                      </Button>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={cargarTrackerLMS}
                      disabled={cargandoTracker}
                      className="h-8 rounded-xl border-slate-300 text-xs font-semibold"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 mr-1 ${cargandoTracker ? "animate-spin text-brand-primary" : "text-slate-600"}`} />
                      Actualizar
                    </Button>
                  </div>
                </div>

                {/* TABLA DEL TRACKER DE CAPACITACIONES */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-500 border-b">
                      <tr>
                        <th className="p-3.5">Colaborador</th>
                        <th className="p-3.5">Puesto & Sede</th>
                        <th className="p-3.5">Curso Asignado</th>
                        <th className="p-3.5">Tiempo de Lectura</th>
                        <th className="p-3.5">Calificación</th>
                        <th className="p-3.5">Estado</th>
                        <th className="p-3.5 text-right">Acción / Recordatorio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {trackerLms
                        .filter((item) => {
                          if (filtroCursoId !== "todos" && item.curso_id !== filtroCursoId) return false;
                          if (filtroEstadoLms !== "todos" && item.estado !== filtroEstadoLms) return false;
                          if (busquedaLms.trim()) {
                            const q = busquedaLms.toLowerCase().trim();
                            const matchNombre = item.usuario_nombre.toLowerCase().includes(q);
                            const matchCodigo = item.codigo_rrhh.toLowerCase().includes(q);
                            const matchPuesto = item.puesto_nombre.toLowerCase().includes(q);
                            const matchCurso = item.curso_titulo.toLowerCase().includes(q);
                            if (!matchNombre && !matchCodigo && !matchPuesto && !matchCurso) return false;
                          }
                          return true;
                        })
                        .map((item, idx) => {
                          const esAprobado = item.estado === "aprobado";
                          const esReprobado = item.estado === "reprobado";
                          const esEnProgreso = item.estado === "en_progreso";
                          const esPendiente = item.estado === "pendiente";

                          return (
                            <tr key={`${item.curso_id}_${item.usuario_id}_${idx}`} className="hover:bg-slate-50/80 transition-colors">
                              <td className="p-3.5">
                                <div className="flex items-center gap-2.5">
                                  <div className="h-8 w-8 rounded-xl bg-brand-dark text-white flex items-center justify-center font-bold text-xs shrink-0">
                                    {item.usuario_nombre.split(" ").slice(0, 2).map((n) => n[0]).join("")}
                                  </div>
                                  <div>
                                    <span className="font-extrabold text-slate-900 block">{item.usuario_nombre}</span>
                                    <span className="font-mono text-[10px] text-slate-400 font-bold">{item.codigo_rrhh}</span>
                                  </div>
                                </div>
                              </td>

                              <td className="p-3.5">
                                <span className="font-semibold text-slate-800 block">{item.puesto_nombre}</span>
                                <span className="text-[11px] text-slate-400">{item.sede_nombre}</span>
                              </td>

                              <td className="p-3.5">
                                <span className="font-bold text-slate-800 max-w-xs block truncate" title={item.curso_titulo}>
                                  {item.curso_titulo}
                                </span>
                                <span className="text-[10px] text-slate-400">Min. {item.curso_tiempo_minimo}s de estudio</span>
                              </td>

                              <td className="p-3.5">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5 font-mono text-[11px]">
                                    <span className={item.lectura_completada ? "font-bold text-emerald-700" : "text-slate-600"}>
                                      {item.segundos_lectura_reales}s
                                    </span>
                                    <span className="text-slate-400">/ {item.curso_tiempo_minimo}s</span>
                                    {item.lectura_completada && (
                                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                    )}
                                  </div>
                                  <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full ${item.lectura_completada ? "bg-emerald-500" : "bg-brand-primary"}`}
                                      style={{
                                        width: `${Math.min(100, (item.segundos_lectura_reales / Math.max(item.curso_tiempo_minimo, 1)) * 100)}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              </td>

                              <td className="p-3.5">
                                {item.puntuacion_obtenida !== null ? (
                                  <Badge
                                    className={`font-mono text-[10px] ${
                                      esAprobado
                                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                        : "bg-rose-100 text-rose-800 border-rose-300"
                                    }`}
                                  >
                                    {item.puntuacion_obtenida}% / 100
                                  </Badge>
                                ) : (
                                  <span className="text-[11px] text-slate-400 italic">Sin presentar</span>
                                )}
                              </td>

                              <td className="p-3.5">
                                {esAprobado && (
                                  <div className="flex items-center gap-1 text-emerald-700 font-bold text-xs">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                    <span>Certificado</span>
                                  </div>
                                )}
                                {esReprobado && (
                                  <div className="flex items-center gap-1 text-rose-700 font-bold text-xs">
                                    <XCircle className="h-4 w-4 text-rose-600" />
                                    <span>No Aprobó</span>
                                  </div>
                                )}
                                {esEnProgreso && (
                                  <div className="flex items-center gap-1 text-blue-700 font-bold text-xs">
                                    <Clock className="h-4 w-4 text-blue-600 animate-spin" />
                                    <span>En Lectura</span>
                                  </div>
                                )}
                                {esPendiente && (
                                  <Badge variant="outline" className="text-slate-400 border-slate-200 text-[10px]">
                                    Pendiente
                                  </Badge>
                                )}
                              </td>

                              <td className="p-3.5 text-right">
                                {esAprobado ? (
                                  <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-bold">
                                    <Award className="h-3 w-3 mr-1 text-emerald-600" />
                                    Acreditado
                                  </Badge>
                                ) : (
                                  <Button
                                    size="sm"
                                    onClick={() => enviarRecordatorioWhatsAppLMS(item)}
                                    className="h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-sm"
                                  >
                                    <MessageCircle className="h-3.5 w-3.5 mr-1" />
                                    Recordar WhatsApp
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>

                  {trackerLms.length === 0 && (
                    <div className="text-center py-12 text-slate-400 space-y-2">
                      <GraduationCap className="h-10 w-10 mx-auto text-slate-300" />
                      <p className="text-xs font-bold text-slate-700">Aún no hay cursos asignados o registros de avance</p>
                      <p className="text-[11px] text-slate-400">Crea un curso en la pestaña &apos;Nuevo Curso con IA&apos; para comenzar a rastrear.</p>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          )}

          {/* VISTA 2: CATÁLOGO DE CURSOS PUBLICADOS */}
          {subPestañaLms === "catalogo" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Catálogo de Materiales Formativos</h3>
                  <p className="text-xs text-slate-500">Cursos disponibles con exámenes generados por inteligencia artificial.</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setSubPestañaLms("crear")}
                  className="bg-brand-dark hover:bg-brand-dark-hover text-white rounded-xl text-xs font-bold h-8"
                >
                  <PlusCircle className="h-3.5 w-3.5 mr-1" />
                  Crear Nuevo Curso
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cursosLms.map((c) => (
                  <Card key={c.id} className="rounded-2xl border-slate-200 shadow-sm overflow-hidden bg-white">
                    <CardHeader className="bg-slate-50/70 p-4 border-b border-slate-100">
                      <div className="flex items-center justify-between">
                        <Badge className="bg-purple-100 text-purple-800 text-[10px] font-bold">
                          {c.asignaciones?.length ? "Puesto Específico" : "General para Todos"}
                        </Badge>
                        <span className="text-[11px] font-mono text-slate-400">Min. {c.tiempo_minimo_lectura_segundos}s lectura</span>
                      </div>
                      <CardTitle className="text-sm font-bold text-slate-900 mt-2">{c.titulo}</CardTitle>
                      <CardDescription className="text-xs text-slate-500 line-clamp-2">
                        {c.descripcion || "Sin descripción corta"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span>Aprobación Mínima:</span>
                        <span className="font-bold text-slate-900">{c.puntuacion_minima_aprobacion}%</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span>Video Complementario:</span>
                        <span className="font-semibold text-slate-700">{c.video_url ? "Sí (Incluido)" : "Solo Manual"}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setFiltroCursoId(c.id);
                          setSubPestañaLms("tracker");
                        }}
                        className="w-full text-xs rounded-xl border-slate-200 hover:bg-slate-50 font-bold"
                      >
                        <Award className="h-3.5 w-3.5 mr-1 text-brand-accent" />
                        Ver Tracker de este Curso
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* VISTA 3: FORMULARIO CREAR CURSO CON IA */}
          {subPestañaLms === "crear" && (
            <Card className="max-w-3xl mx-auto rounded-3xl border-slate-200 shadow-sm bg-white overflow-hidden">
              <CardHeader className="p-5 sm:p-6 bg-slate-50/70 border-b border-slate-100">
                <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  Crear Material Formativo con Evaluación de IA
                </CardTitle>
                <CardDescription className="text-xs">
                  Solo Recursos Humanos puede subir cursos. Puedes segmentar para que un curso de Bartender solo lo vea dicho puesto y no personal de cocina o limpieza.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 sm:p-6">
                <form onSubmit={handleCrearCursoLMS} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Título del Curso o Protocolo
                      </label>
                      <Input
                        value={cursoTitulo}
                        onChange={(e) => setCursoTitulo(e.target.value)}
                        placeholder="Ej. Coctelería de Autor y BPM en Barra"
                        className="text-xs rounded-xl"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Asignar Exclusivamente a Puesto
                      </label>
                      <select
                        value={cursoPuestoId}
                        onChange={(e) => setCursoPuestoId(e.target.value)}
                        className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white"
                      >
                        <option value="">A todos los puestos (General)</option>
                        {puestos.map((p) => (
                          <option key={p.id} value={p.id}>
                            Solo para: {p.nombre} ({p.departamento})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Descripción Breve
                    </label>
                    <Input
                      value={cursoDesc}
                      onChange={(e) => setCursoDesc(e.target.value)}
                      placeholder="Objetivo y resumen de la capacitación"
                      className="text-xs rounded-xl"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Tiempo Mínimo de Lectura (Segundos de Seguridad)
                      </label>
                      <Input
                        type="number"
                        value={cursoTiempoMin}
                        onChange={(e) => setCursoTiempoMin(Number(e.target.value))}
                        placeholder="120"
                        className="text-xs rounded-xl"
                      />
                      <span className="text-[10px] text-slate-400">
                        Evita que los colaboradores avancen sin leer el documento.
                      </span>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        URL de Video Opcional (YouTube / Vimeo / MP4)
                      </label>
                      <Input
                        value={cursoVideoUrl}
                        onChange={(e) => setCursoVideoUrl(e.target.value)}
                        placeholder="https://..."
                        className="text-xs rounded-xl"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Contenido Formativo Completo (Alimentación de la IA)
                    </label>
                    <Textarea
                      value={cursoContenido}
                      onChange={(e) => setCursoContenido(e.target.value)}
                      placeholder="Pega aquí el contenido, manual, recetas o directivas completas. La IA extraerá preguntas pedagógicas de Verdadero/Falso y Opción Múltiple (justificación opcional)."
                      className="text-xs rounded-xl min-h-[160px] leading-relaxed"
                      required
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setSubPestañaLms("tracker")}
                      className="text-xs rounded-xl"
                    >
                      Volver al Tracker
                    </Button>
                    <Button
                      type="submit"
                      disabled={creandoCurso}
                      className="bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold h-11 px-6 shadow-md shadow-purple-700/20"
                    >
                      {creandoCurso ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generando Examen con IA y Asignando...
                        </>
                      ) : (
                        "Guardar y Procesar con IA"
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* 4. ASISTENCIAS & EXPORTACIÓN EXCEL */}
        <TabsContent value="reportes" className="mt-6">
          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-bold text-slate-800">
                  Registros de Asistencia y Reportes para Nómina
                </CardTitle>
                <CardDescription className="text-xs">
                  Cálculo automático de horas regulares y horas extras validadas.
                </CardDescription>
              </div>
              <Button
                onClick={handleDescargarExcel}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold h-10 px-4"
              >
                <Download className="mr-1.5 h-4 w-4" />
                Exportar Todo a Excel (.xlsx)
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-500 border-y">
                    <tr>
                      <th className="p-3">ID RRHH</th>
                      <th className="p-3">Usuario</th>
                      <th className="p-3">Colaborador</th>
                      <th className="p-3">Fecha</th>
                      <th className="p-3">Entrada</th>
                      <th className="p-3">Almuerzo</th>
                      <th className="p-3">Salida</th>
                      <th className="p-3">Horas Regulares</th>
                      <th className="p-3">Horas Extras</th>
                      <th className="p-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {marcajes.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/80">
                        <td className="p-3 font-mono font-bold text-purple-700">{m.usuario?.codigo_rrhh || "-"}</td>
                        <td className="p-3 font-mono text-slate-700">{m.usuario?.username || "-"}</td>
                        <td className="p-3 font-semibold text-slate-800">{m.usuario?.nombre_completo}</td>
                        <td className="p-3">{m.fecha}</td>
                        <td className="p-3">{m.hora_entrada ? new Date(m.hora_entrada).toLocaleTimeString() : "-"}</td>
                        <td className="p-3">{m.tomo_almuerzo ? "Tomó Almuerzo" : "Jornada Continua"}</td>
                        <td className="p-3">{m.hora_salida ? new Date(m.hora_salida).toLocaleTimeString() : "-"}</td>
                        <td className="p-3 font-bold text-teal-700">{m.horas_regulares}h</td>
                        <td className="p-3 font-bold text-purple-700">{m.horas_extras}h</td>
                        <td className="p-3">
                          <Badge className="bg-emerald-50 text-emerald-800 text-[10px] uppercase">
                            {m.estado}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

