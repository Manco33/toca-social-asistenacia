"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  obtenerUsuariosBoco,
  asignarHorarioTurno,
  obtenerTurnosSemana,
  guardarMatrizSemanalCompleta,
  copiarTurnosSemanaAnterior,
  registrarJustificacionFalta,
  obtenerMonitoreoHoyEquipo,
  obtenerBancoHorasEquipo,
  registrarAjusteBancoHoras,
  type ResumenBancoHorasColaborador,
} from "@/app/boco-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Calendar,
  Clock,
  MessageCircle,
  FileText,
  Scale,
  PlusCircle,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Gift,
  ChevronLeft,
  ChevronRight,
  Copy,
  Save,
  Send,
  Sparkles,
  Tag,
  X,
  LayoutGrid,
  CalendarPlus,
  LogOut as LogOutIcon,
  Sun,
  Users,
  Radio,
  RefreshCw,
  UserCheck,
  UserX,
  AlertOctagon,
  Coffee,
  Sliders,
  ArrowRight,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import type { UsuarioBoco } from "@/lib/types";
import { BocoLogo } from "@/components/boco-brand";

function obtenerLunesSemana(fechaRef: Date = new Date()): Date {
  const d = new Date(fechaRef);
  const dia = d.getDay();
  const diff = d.getDate() - dia + (dia === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatearFechaIso(d: Date): string {
  const anio = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

function calcularHorasTurno(entrada: string, salida: string, descanso: boolean): number {
  if (descanso || !entrada || !salida) return 0;
  try {
    const [h1, m1] = entrada.split(":").map(Number);
    const [h2, m2] = salida.split(":").map(Number);
    let min = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (min < 0) min += 24 * 60;
    return Number((min / 60).toFixed(1));
  } catch {
    return 0;
  }
}

export function BocoAsignadorDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [team, setTeam] = useState<UsuarioBoco[]>([]);
  const [loading, setLoading] = useState(false);

  // ESTADO DE LA MATRIZ SEMANAL (ESTILO EXCEL)
  const [lunesSemana, setLunesSemana] = useState<Date>(() => obtenerLunesSemana(new Date()));
  const [matrizTurnos, setMatrizTurnos] = useState<{
    [clave: string]: {
      usuario_id: string;
      fecha: string;
      hora_entrada: string;
      hora_salida: string;
      es_dia_descanso: boolean;
      es_dia_festivo?: boolean;
      notas?: string;
    };
  }>({});
  const [cargandoMatriz, setCargandoMatriz] = useState(false);
  const [guardandoMatriz, setGuardandoMatriz] = useState(false);
  const [copiandoSemana, setCopiandoSemana] = useState(false);

  // ESTADO DE MONITOREO EN VIVO (HOY)
  const [monitoreoHoy, setMonitoreoHoy] = useState<Array<{
    usuario_id: string;
    turnoHoy: any;
    marcajeHoy: any;
    estado: 'puntual' | 'retardo' | 'sin_marcar' | 'turno_proximo' | 'en_almuerzo' | 'finalizado' | 'descanso' | 'sin_turno';
    minutosDiferencia: number;
    mensajeEstado: string;
  }>>([]);
  const [cargandoMonitoreo, setCargandoMonitoreo] = useState(false);
  const [filtroMonitoreo, setFiltroMonitoreo] = useState<string>('todos');
  const [pestañaActiva, setPestañaActiva] = useState<string>('monitoreo');

  // ESTADO DEL BANCO DE HORAS & MEDIDOR DE NIVELACIÓN
  const [jornadaBaseDefault, setJornadaBaseDefault] = useState<number>(42); // 42h mixta estándar BOCO
  const [bancoHorasResumen, setBancoHorasResumen] = useState<ResumenBancoHorasColaborador[]>([]);
  const [cargandoBanco, setCargandoBanco] = useState(false);
  const [colabAjusteModal, setColabAjusteModal] = useState<UsuarioBoco | null>(null);
  const [ajusteHoras, setAjusteHoras] = useState<number>(2);
  const [ajusteTipo, setAjusteTipo] = useState<'a_favor_colaborador' | 'a_favor_empresa' | 'compensacion_tomada'>('a_favor_colaborador');
  const [ajusteMotivo, setAjusteMotivo] = useState<string>('');
  const [guardandoAjuste, setGuardandoAjuste] = useState(false);

  // Modal para edición rápida de celda de la matriz
  const [celdaEditando, setCeldaEditando] = useState<{
    usuario: UsuarioBoco;
    fecha: string;
    diaNombre: string;
    hora_entrada: string;
    hora_salida: string;
    es_dia_descanso: boolean;
    notas: string;
  } | null>(null);

  // Formulario Asignación 1 a 1 Individual
  const [colabSeleccionadoId, setColabSeleccionadoId] = useState("");
  const [fechaTurno, setFechaTurno] = useState(() => formatearFechaIso(new Date()));
  const [horaEntrada, setHoraEntrada] = useState("08:00");
  const [horaSalida, setHoraSalida] = useState("17:00");
  const [esFestivo, setEsFestivo] = useState(false);
  const [asignandoTurno, setAsignandoTurno] = useState(false);

  // Formulario Justificación y Reposición de Horas
  const [justColabId, setJustColabId] = useState("");
  const [justFecha, setJustFecha] = useState(() => formatearFechaIso(new Date()));
  const [justTipo, setJustTipo] = useState<"falta" | "llegada_tarde" | "salida_temprana">("falta");
  const [justMotivo, setJustMotivo] = useState("");
  const [justHorasReponer, setJustHorasReponer] = useState(8);
  const [justFechaReponer, setJustFechaReponer] = useState("");
  const [guardandoJust, setGuardandoJust] = useState(false);

  // 7 días de la semana seleccionada
  const diasSemana = Array.from({ length: 7 }, (_, i) => {
    const f = new Date(lunesSemana);
    f.setDate(f.getDate() + i);
    const nombres = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    const fechaIso = formatearFechaIso(f);
    const displayFecha = `${f.getMonth() + 1}/${f.getDate()}/${f.getFullYear()}`;
    return {
      nombre: nombres[i],
      fecha: fechaIso,
      display: displayFecha,
    };
  });

  useEffect(() => {
    cargarTeam();
  }, [user]);

  useEffect(() => {
    if (team.length > 0) {
      cargarTurnosMatriz();
    }
  }, [lunesSemana, team]);

  const cargarTeam = async () => {
    setLoading(true);
    try {
      const todos = await obtenerUsuariosBoco();
      const asignadorDbId = "c2222222-2222-2222-2222-222222222222";
      const esCarlos = user?.username === "carlos.asig" || user?.id === asignadorDbId;

      const miembros = todos.filter((u) => {
        if (u.rol !== "colaborador") return false;
        if (user?.id && u.asignador_id === user.id) return true;
        if (esCarlos && (u.asignador_id === asignadorDbId || u.asignador?.username === "carlos.asig")) return true;
        if (user?.username && u.asignador?.username === user.username) return true;
        return false;
      });

      setTeam(miembros);
      if (miembros.length > 0) {
        if (!colabSeleccionadoId || !miembros.some(m => m.id === colabSeleccionadoId)) {
          setColabSeleccionadoId(miembros[0].id);
          setJustColabId(miembros[0].id);
        }
        cargarMonitoreo(miembros);
      } else {
        setMonitoreoHoy([]);
      }
    } catch (e) {
      console.warn("Error cargando team:", e);
    } finally {
      setLoading(false);
    }
  };

  const cargarMonitoreo = async (miembrosEquipo: UsuarioBoco[] = team) => {
    if (!miembrosEquipo || miembrosEquipo.length === 0) return;
    setCargandoMonitoreo(true);
    try {
      const uIds = miembrosEquipo.map((m) => m.id);
      const res = await obtenerMonitoreoHoyEquipo(uIds);
      if (res.success && res.monitoreo) {
        setMonitoreoHoy(res.monitoreo);
      }
    } catch (e) {
      console.warn("Error cargando monitoreo de hoy:", e);
    } finally {
      setCargandoMonitoreo(false);
    }
  };

  const enviarAlertaWhatsAppColaborador = (colab: UsuarioBoco, info?: any) => {
    if (!colab.telefono) {
      toast({
        title: "Sin teléfono registrado",
        description: `El colaborador ${colab.nombre_completo} no tiene teléfono en su ficha de RRHH.`,
        variant: "destructive",
      });
      return;
    }
    const cleanPhone = colab.telefono.replace(/\D/g, "");
    const horaEntrada = info?.turnoHoy?.hora_entrada ? info.turnoHoy.hora_entrada.slice(0, 5) : "el inicio de tu turno";
    const texto = `Hola ${colab.nombre_completo}, te contactamos de BOCO. Según el sistema de asistencia, tu turno programado para hoy iniciaba a las ${horaEntrada} y aún no registras marcaje de entrada en sede. Por favor comunícate a la brevedad con tu supervisor.`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(texto)}`;
    window.open(url, "_blank");
  };

  const formatearHoraAmPm = (isoOString?: string | null) => {
    if (!isoOString) return "—";
    try {
      const d = new Date(isoOString);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      }
      return isoOString.slice(0, 5);
    } catch {
      return isoOString;
    }
  };

  const cargarTurnosMatriz = async () => {
    setCargandoMatriz(true);
    try {
      const fechaInicio = formatearFechaIso(lunesSemana);
      const domingo = new Date(lunesSemana);
      domingo.setDate(domingo.getDate() + 6);
      const fechaFin = formatearFechaIso(domingo);

      const turnosDb = await obtenerTurnosSemana(fechaInicio, fechaFin);
      const nuevaMatriz: typeof matrizTurnos = {};

      turnosDb.forEach((t) => {
        const clave = `${t.usuario_id}_${t.fecha}`;
        nuevaMatriz[clave] = {
          usuario_id: t.usuario_id,
          fecha: t.fecha,
          hora_entrada: t.hora_entrada?.slice(0, 5) || "08:00",
          hora_salida: t.hora_salida?.slice(0, 5) || "17:00",
          es_dia_descanso: Boolean(t.es_dia_descanso),
          es_dia_festivo: Boolean(t.es_dia_festivo),
          notas: t.notas || "",
        };
      });

      setMatrizTurnos(nuevaMatriz);
      cargarBancoHoras(team, jornadaBaseDefault, fechaInicio, fechaFin);
    } catch (err) {
      console.warn("Error al cargar matriz:", err);
    } finally {
      setCargandoMatriz(false);
    }
  };

  const cargarBancoHoras = async (
    miembrosEquipo: UsuarioBoco[] = team,
    baseHoras: number = jornadaBaseDefault,
    fechaIni?: string,
    fechaFin?: string
  ) => {
    if (!miembrosEquipo || miembrosEquipo.length === 0) return;
    setCargandoBanco(true);
    try {
      const uIds = miembrosEquipo.map((m) => m.id);
      const fIni = fechaIni || diasSemana[0]?.fecha;
      const fFin = fechaFin || diasSemana[6]?.fecha;
      const res = await obtenerBancoHorasEquipo(uIds, fIni, fFin, baseHoras);
      if (res.success && res.resumen) {
        setBancoHorasResumen(res.resumen);
      }
    } catch (e) {
      console.warn("Error cargando banco de horas:", e);
    } finally {
      setCargandoBanco(false);
    }
  };

  const handleGuardarAjusteBanco = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!colabAjusteModal || !ajusteMotivo.trim()) {
      toast({
        title: "Campos Requeridos",
        description: "Ingresa el motivo del ajuste en el Banco de Horas.",
        variant: "destructive",
      });
      return;
    }
    setGuardandoAjuste(true);
    try {
      const fIni = diasSemana[0]?.fecha;
      const fFin = diasSemana[6]?.fecha;
      const horasFinal = ajusteTipo === 'a_favor_empresa' ? -Math.abs(ajusteHoras) : Math.abs(ajusteHoras);
      const res = await registrarAjusteBancoHoras({
        usuario_id: colabAjusteModal.id,
        semana_inicio: fIni,
        semana_fin: fFin,
        horas_ajuste: horasFinal,
        tipo: ajusteTipo,
        motivo: ajusteMotivo.trim(),
      });
      if (res.success) {
        toast({
          title: "Ajuste Guardado",
          description: `Ajuste de ${ajusteHoras}h guardado para ${colabAjusteModal.nombre_completo}.`,
        });
        setColabAjusteModal(null);
        setAjusteMotivo("");
        cargarBancoHoras(team, jornadaBaseDefault);
      } else {
        toast({ title: "Error", description: res.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setGuardandoAjuste(false);
    }
  };

  const notificarBalanceWhatsApp = (colab: UsuarioBoco, resumen: ResumenBancoHorasColaborador) => {
    if (!colab.telefono) {
      toast({
        title: "Sin teléfono registrado",
        description: `El colaborador ${colab.nombre_completo} no tiene teléfono en su ficha de RRHH.`,
        variant: "destructive",
      });
      return;
    }
    const cleanPhone = colab.telefono.replace(/\D/g, "");
    const saldoTxt = resumen.saldo_neto_horas >= 0 ? `+${resumen.saldo_neto_horas}h a tu favor (BOCO te las debe)` : `${resumen.saldo_neto_horas}h adeudadas`;
    const texto = `Hola ${colab.nombre_completo}, tu reporte de Banco de Horas BOCO (Semana ${resumen.semana_inicio} al ${resumen.semana_fin}) es:
• Horas Asignadas: ${resumen.horas_programadas}h (Jornada base mixta: ${resumen.jornada_base}h)
• Horas Extras/Excedentes en Sede: +${resumen.horas_excedentes_operacion}h
• Festivos Laborados: ${resumen.dias_festivos_laborados} días (+${resumen.dias_festivos_laborados * 8}h)
• Saldo Neto Consolidado: ${saldoTxt}
• Nivelación Sugerida Próxima Semana: Prográmate ${resumen.sugerencia_proxima_semana}h para quedar en saldo cero.
Recuerda que en BOCO las horas extras no se pagan monetariamente, se nivelan con turnos compensatorios.`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(texto)}`;
    window.open(url, "_blank");
  };

  const abrirEdicionCelda = (usuario: UsuarioBoco, fecha: string, diaNombre: string) => {
    const clave = `${usuario.id}_${fecha}`;
    const existente = matrizTurnos[clave];
    setCeldaEditando({
      usuario,
      fecha,
      diaNombre,
      hora_entrada: existente?.hora_entrada || "11:00",
      hora_salida: existente?.hora_salida || "18:00",
      es_dia_descanso: existente ? existente.es_dia_descanso : false,
      notas: existente?.notas || "",
    });
  };

  const guardarEdicionCelda = (copiarATodaLaSemana: boolean = false) => {
    if (!celdaEditando) return;
    const { usuario, fecha, hora_entrada, hora_salida, es_dia_descanso, notas } = celdaEditando;

    const nuevaMatriz = { ...matrizTurnos };

    if (copiarATodaLaSemana) {
      diasSemana.forEach((d) => {
        const key = `${usuario.id}_${d.fecha}`;
        nuevaMatriz[key] = {
          usuario_id: usuario.id,
          fecha: d.fecha,
          hora_entrada,
          hora_salida,
          es_dia_descanso,
          notas,
        };
      });
      toast({
        title: "Horario Replicado",
        description: `Se aplicó el horario a toda la semana de ${usuario.nombre_completo}. Recuerda presionar "Guardar Matriz".`,
      });
    } else {
      const key = `${usuario.id}_${fecha}`;
      nuevaMatriz[key] = {
        usuario_id: usuario.id,
        fecha,
        hora_entrada,
        hora_salida,
        es_dia_descanso,
        notas,
      };
    }

    setMatrizTurnos(nuevaMatriz);
    setCeldaEditando(null);
  };

  const cambiarSemana = (deltaDias: number) => {
    const nuevoLunes = new Date(lunesSemana);
    nuevoLunes.setDate(nuevoLunes.getDate() + deltaDias);
    setLunesSemana(nuevoLunes);
  };

  const handleGuardarMatriz = async (notificarWhatsApp: boolean = false) => {
    setGuardandoMatriz(true);
    try {
      const asignadorRealId =
        user?.id && user.id.length > 20 ? user.id : "c2222222-2222-2222-2222-222222222222";

      const listaTurnos: any[] = [];
      team.forEach((u) => {
        diasSemana.forEach((d) => {
          const key = `${u.id}_${d.fecha}`;
          const t = matrizTurnos[key];
          if (t) {
            listaTurnos.push({
              usuario_id: u.id,
              asignador_id: asignadorRealId,
              fecha: d.fecha,
              hora_entrada: t.hora_entrada,
              hora_salida: t.hora_salida,
              es_dia_descanso: t.es_dia_descanso,
              notas: t.notas,
            });
          }
        });
      });

      if (listaTurnos.length === 0) {
        toast({
          title: "Matriz Vacía",
          description: "No hay turnos configurados para guardar en esta semana.",
          variant: "destructive",
        });
        return;
      }

      const res = await guardarMatrizSemanalCompleta(listaTurnos, notificarWhatsApp);
      if (res.success) {
        toast({
          title: notificarWhatsApp ? "¡Matriz Guardada y Notificada por WhatsApp!" : "Matriz Semanal Guardada",
          description: `Se sincronizaron ${res.guardados} turnos.${
            notificarWhatsApp ? " Alertas de WhatsApp enviadas al equipo." : ""
          }`,
        });
      } else {
        toast({ title: "Error al guardar matriz", description: res.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setGuardandoMatriz(false);
    }
  };

  const handleCopiarSemanaAnterior = async () => {
    setCopiandoSemana(true);
    try {
      const asignadorRealId =
        user?.id && user.id.length > 20 ? user.id : "c2222222-2222-2222-2222-222222222222";

      const lunesAnterior = new Date(lunesSemana);
      lunesAnterior.setDate(lunesAnterior.getDate() - 7);

      const res = await copiarTurnosSemanaAnterior(
        formatearFechaIso(lunesAnterior),
        formatearFechaIso(lunesSemana),
        asignadorRealId
      );

      if (res.success) {
        toast({
          title: "Horarios Copiados",
          description: `Se clonaron ${res.copiados} turnos de la semana anterior con éxito.`,
        });
        await cargarTurnosMatriz();
      } else {
        toast({
          title: "Semana Anterior sin Turnos",
          description: res.error || "No se encontraron turnos en la semana previa para copiar.",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({ title: "Error al copiar", description: e.message, variant: "destructive" });
    } finally {
      setCopiandoSemana(false);
    }
  };

  const handleGuardarTurno = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!colabSeleccionadoId || !fechaTurno) {
      toast({
        title: "Campos Requeridos",
        description: "Selecciona un colaborador y la fecha del turno.",
        variant: "destructive",
      });
      return;
    }

    setAsignandoTurno(true);
    try {
      const asignadorRealId =
        user?.id && user.id.length > 20 ? user.id : "c2222222-2222-2222-2222-222222222222";

      const res = await asignarHorarioTurno({
        usuario_id: colabSeleccionadoId,
        asignador_id: asignadorRealId,
        fecha: fechaTurno,
        hora_entrada: horaEntrada,
        hora_salida: horaSalida,
        es_dia_festivo: esFestivo,
      });

      if (res.success) {
        const colab = team.find((c) => c.id === colabSeleccionadoId);
        toast({
          title: "Horario Asignado & Notificado",
          description: `Turno guardado para ${colab?.nombre_completo}. Notificación de WhatsApp activada.`,
        });
      } else {
        toast({ title: "Error", description: res.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAsignandoTurno(false);
    }
  };

  const handleGuardarJustificacion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!justColabId || !justMotivo.trim()) {
      toast({
        title: "Campos Requeridos",
        description: "Ingresa el motivo de la falta o retraso.",
        variant: "destructive",
      });
      return;
    }

    setGuardandoJust(true);
    try {
      const res = await registrarJustificacionFalta({
        usuario_id: justColabId,
        asignador_id: user?.id,
        fecha_afectada: justFecha,
        tipo: justTipo,
        motivo: justMotivo.trim(),
        horas_a_reponer: Number(justHorasReponer) || 0,
        fecha_compromiso_reposicion: justFechaReponer || undefined,
      });

      if (res.success) {
        toast({
          title: "Justificación Registrada",
          description: `Compromiso de reposición de ${justHorasReponer}h guardado en el Banco de Horas.`,
        });
        setJustMotivo("");
      } else {
        toast({ title: "Error", description: res.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setGuardandoJust(false);
    }
  };

  // Conteo dinámico de métricas para el Monitor de Asistencia
  const totalEquipo = team.length;
  const sinMarcarCount = monitoreoHoy.filter((m) => m.estado === "sin_marcar").length;
  const retardoCount = monitoreoHoy.filter((m) => m.estado === "retardo").length;
  const puntualCount = monitoreoHoy.filter((m) => m.estado === "puntual" || m.estado === "finalizado").length;
  const proximoCount = monitoreoHoy.filter((m) => m.estado === "turno_proximo").length;
  const descansoCount = monitoreoHoy.filter((m) => m.estado === "descanso").length;
  const enAlmuerzoCount = monitoreoHoy.filter((m) => m.estado === "en_almuerzo").length;

  const miembrosFiltrados = team.filter((colab) => {
    if (filtroMonitoreo === "todos") return true;
    const info = monitoreoHoy.find((m) => m.usuario_id === colab.id);
    if (!info) return filtroMonitoreo === "todos";
    if (filtroMonitoreo === "sin_marcar") return info.estado === "sin_marcar";
    if (filtroMonitoreo === "retardo") return info.estado === "retardo";
    if (filtroMonitoreo === "puntual") return info.estado === "puntual" || info.estado === "finalizado";
    if (filtroMonitoreo === "proximo") return info.estado === "turno_proximo";
    if (filtroMonitoreo === "descanso") return info.estado === "descanso";
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* HEADER DE ASIGNADOR (BOCO NAVY & ACCENTS) */}
      <div className="bg-brand-dark rounded-3xl p-6 sm:p-7 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-slate-800">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-brand-primary/20 via-brand-accent/15 to-transparent rounded-full blur-3xl -z-0 pointer-events-none" />

        <div className="relative z-10 space-y-2">
          <span className="text-[11px] uppercase font-bold tracking-widest text-brand-primary">
            Supervisión y Control de Asistencia
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Control de Asistencia y Planificación de Turnos
          </h1>
          <p className="text-xs text-slate-300 max-w-2xl">
            Semáforo de asistencia en tiempo real, matriz semanal de turnos, alertas instantáneas por WhatsApp y balance compensatorio de horas.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-slate-700/80 self-start md:self-auto">
          <div className="h-2 w-2 rounded-full bg-brand-accent animate-pulse" />
          <MessageCircle className="h-4 w-4 text-brand-accent" />
          <span className="text-xs font-semibold text-slate-200">WhatsApp Sync Activo</span>
        </div>
      </div>

      {/* PESTAÑAS ASIGNADOR (SIN EMOJIS, CON ICONOS REFINADOS) */}
      <Tabs value={pestañaActiva} onValueChange={setPestañaActiva} className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 max-w-3xl bg-slate-200/80 p-1.5 rounded-2xl gap-1">
          <TabsTrigger value="monitoreo" className="text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 py-2">
            <Radio className="h-3.5 w-3.5 text-rose-500 animate-pulse" />
            Asistencia en Vivo (Hoy)
            {sinMarcarCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-rose-500 text-white ml-1">
                {sinMarcarCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="matriz" className="text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 py-2">
            <LayoutGrid className="h-3.5 w-3.5 text-brand-primary" />
            Matriz Semanal
          </TabsTrigger>
          <TabsTrigger value="justificaciones" className="text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 py-2">
            <FileText className="h-3.5 w-3.5 text-brand-accent" />
            Justificar Faltas
          </TabsTrigger>
          <TabsTrigger value="bancohoras" className="text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 py-2">
            <Scale className="h-3.5 w-3.5 text-slate-600" />
            Banco de Horas
          </TabsTrigger>
        </TabsList>

        {/* 1. MATRIZ SEMANAL VISUAL (ESTILO EXCEL MODERNO BOCO) */}
        <TabsContent value="matriz" className="mt-6 space-y-4">
          <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden bg-white">
            {/* BARRA SUPERIOR DE ACCIONES Y NAVEGACIÓN */}
            <div className="p-4 bg-brand-dark text-white flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => cambiarSemana(-7)}
                  className="h-8 w-8 p-0 border-slate-700 bg-slate-800 text-white hover:bg-slate-700 rounded-lg"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="px-3 py-1 rounded-xl bg-slate-800/90 border border-slate-700 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                    Semana Seleccionada
                  </span>
                  <span className="text-xs font-mono font-bold text-white">
                    {diasSemana[0]?.nombre} {diasSemana[0]?.display} — {diasSemana[6]?.nombre} {diasSemana[6]?.display}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => cambiarSemana(7)}
                  className="h-8 w-8 p-0 border-slate-700 bg-slate-800 text-white hover:bg-slate-700 rounded-lg"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setLunesSemana(obtenerLunesSemana(new Date()))}
                  className="text-[11px] h-8 text-brand-primary hover:text-white hover:bg-slate-800 rounded-lg"
                >
                  Semana Actual
                </Button>
              </div>

              {/* ACCIONES RÁPIDAS DE LA MATRIZ */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={copiandoSemana}
                  onClick={handleCopiarSemanaAnterior}
                  className="h-8 text-xs bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white rounded-xl"
                >
                  {copiandoSemana ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1 text-[#F5A623]" />}
                  Copiar Semana Anterior
                </Button>

                <Button
                  type="button"
                  size="sm"
                  disabled={guardandoMatriz}
                  onClick={() => handleGuardarMatriz(false)}
                  className="h-8 text-xs bg-brand-primary hover:bg-brand-primary-hover text-white font-bold rounded-xl shadow-sm"
                >
                  {guardandoMatriz ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                  Guardar Matriz
                </Button>

                <Button
                  type="button"
                  size="sm"
                  disabled={guardandoMatriz}
                  onClick={() => handleGuardarMatriz(true)}
                  className="h-8 text-xs bg-brand-accent hover:bg-brand-accent-hover text-slate-950 font-bold rounded-xl shadow-md shadow-brand-accent/20"
                >
                  {guardandoMatriz ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                  Guardar & Notificar WhatsApp
                </Button>
              </div>
            </div>

            {/* CUADRÍCULA DE PLANIFICACIÓN SEMANAL (MODERNO BOCO) */}
            <div className="overflow-x-auto">
              {cargandoMatriz ? (
                <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
                  <span className="text-xs font-medium">Cargando turnos de la semana...</span>
                </div>
              ) : team.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-xs">
                  No hay colaboradores registrados en tu equipo aún.
                </div>
              ) : (
                <table className="w-full border-collapse text-xs select-none">
                  {/* ENCABEZADOS DE LA MATRIZ */}
                  <thead>
                    <tr>
                      <th className="bg-brand-dark text-white font-bold p-3 text-center border-r border-slate-700 w-44">
                        <span className="block text-sm tracking-wider font-extrabold text-white">Equipo BOCO</span>
                        <span className="text-[10px] font-normal text-slate-400">Colaborador</span>
                      </th>
                      {diasSemana.map((dia) => (
                        <th
                          key={dia.fecha}
                          className="bg-slate-900 text-white font-semibold p-2.5 text-center border-r border-slate-700 min-w-[125px]"
                        >
                          <span className="block text-xs font-bold text-slate-200">{dia.nombre}</span>
                          <span className="text-[11px] font-mono text-slate-400">{dia.display}</span>
                        </th>
                      ))}
                      <th className="bg-slate-900 text-white font-bold p-3 text-center min-w-[100px]">
                        <span className="block text-xs uppercase tracking-wide text-slate-300">Total</span>
                        <span className="block text-xs font-extrabold text-[#F5A623]">Horas</span>
                      </th>
                    </tr>
                  </thead>

                  {/* FILAS DE CADA COLABORADOR */}
                  <tbody className="divide-y divide-slate-200">
                    {team.map((colab) => {
                      let totalHorasSemana = 0;
                      diasSemana.forEach((d) => {
                        const key = `${colab.id}_${d.fecha}`;
                        const t = matrizTurnos[key];
                        if (t && !t.es_dia_descanso) {
                          totalHorasSemana += calcularHorasTurno(t.hora_entrada, t.hora_salida, false);
                        }
                      });

                      return (
                        <tr key={colab.id} className="border-b border-slate-200">
                          {/* COLUMNA 1: NOMBRE DEL COLABORADOR */}
                          <td className="bg-brand-dark-hover text-white font-bold p-3 text-center border-r border-slate-700 w-44">
                            <span className="block text-sm font-extrabold tracking-wide text-white">
                              {colab.nombre_completo.split(" ")[0]}
                            </span>
                            <span className="text-[10px] font-mono text-slate-300 block truncate">
                              {colab.nombre_completo}
                            </span>
                            <span className="text-[9px] bg-slate-800 text-brand-accent px-2 py-0.5 rounded-full inline-block mt-1 font-medium">
                              {colab.puesto?.nombre || "Colaborador"}
                            </span>
                          </td>

                          {/* COLUMNAS 2 A 8: DÍAS DE LA SEMANA */}
                          {diasSemana.map((dia) => {
                            const key = `${colab.id}_${dia.fecha}`;
                            const turno = matrizTurnos[key];
                            const esDescanso = turno?.es_dia_descanso;
                            const tieneNota = Boolean(turno?.notas?.trim());
                            const esOffAmarillo = esDescanso && turno?.notas?.toLowerCase().includes("off");
                            const horasDia = turno && !esDescanso ? calcularHorasTurno(turno.hora_entrada, turno.hora_salida, false) : 0;

                            return (
                              <td
                                key={dia.fecha}
                                onClick={() => abrirEdicionCelda(colab, dia.fecha, dia.nombre)}
                                className="border-r border-slate-200 p-1.5 text-center cursor-pointer transition-all hover:ring-2 hover:ring-brand-primary hover:z-10 bg-white"
                              >
                                {esDescanso ? (
                                  /* CELDA DÍA DE DESCANSO / OFF */
                                  <div
                                    className={`min-h-[64px] rounded-xl flex flex-col items-center justify-center p-1 transition-all ${
                                      esOffAmarillo
                                        ? "bg-amber-100 text-amber-950 font-extrabold border border-amber-300 shadow-sm"
                                        : "bg-slate-900 text-slate-200 font-bold border border-slate-800 shadow-sm"
                                    }`}
                                  >
                                    <span className="text-xs uppercase tracking-wider font-extrabold">
                                      {turno?.notas || "OFF"}
                                    </span>
                                    <span className="text-[9px] opacity-75">Descanso</span>
                                  </div>
                                ) : turno ? (
                                  /* CELDA TURNO ACTIVO */
                                  <div className="min-h-[64px] rounded-xl p-1.5 flex flex-col justify-between hover:bg-blue-50/50 border border-slate-200 bg-slate-50/40">
                                    {/* HORAS ENTRADA Y SALIDA */}
                                    <div className="flex items-center justify-between text-[11px] font-mono font-bold text-slate-800 border-b border-slate-200/80 pb-0.5 px-1">
                                      <span>{turno.hora_entrada}</span>
                                      <span className="text-slate-400">-</span>
                                      <span>{turno.hora_salida}</span>
                                    </div>

                                    {/* HORAS CALCULADAS */}
                                    <div className="text-xs font-extrabold text-slate-700 my-0.5">
                                      {horasDia}h
                                    </div>

                                    {/* ETIQUETA DE EVENTO / NOTA ESPECIAL (PILL CHIP MODERNO) */}
                                    {tieneNota ? (
                                      <span className="bg-brand-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm inline-block truncate max-w-full">
                                        {turno.notas}
                                      </span>
                                    ) : (
                                      <span className="text-[9px] text-slate-400 font-medium">Turno Regular</span>
                                    )}
                                  </div>
                                ) : (
                                  /* CELDA VACÍA (SIN ASIGNAR) */
                                  <div className="min-h-[64px] rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:border-brand-primary hover:text-brand-primary p-1">
                                    <PlusCircle className="h-4 w-4 mb-0.5 opacity-60" />
                                    <span className="text-[10px] font-medium">Asignar</span>
                                  </div>
                                )}
                              </td>
                            );
                          })}

                          {/* COLUMNA 9: TOTAL DE HORAS SEMANALES */}
                          <td className="bg-slate-50/80 font-extrabold text-base text-slate-900 text-center p-3 border-l border-slate-200">
                            <span
                              className={`inline-block px-3 py-1 rounded-xl font-mono text-sm font-bold ${
                                totalHorasSemana >= 40
                                  ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                                  : "bg-slate-200 text-slate-800"
                              }`}
                            >
                              {totalHorasSemana}h
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* PIE DE MATRIZ CON LEYENDAS (SIN EMOJIS) */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
              <div className="flex flex-wrap items-center gap-4">
                <span className="font-bold text-slate-700">Leyenda:</span>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-white border border-slate-300 inline-block" />
                  <span>Turno Normal</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-brand-primary inline-block" />
                  <span>Evento Asignado</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-slate-900 inline-block" />
                  <span>Día Libre / OFF</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-amber-400 inline-block" />
                  <span>Descanso Festivo</span>
                </div>
              </div>

              <span className="text-[11px] text-brand-primary font-semibold">
                Haz clic en cualquier celda para editar horarios o asignar eventos.
              </span>
            </div>
          </Card>

          {/* MODAL / PANEL DE EDICIÓN RÁPIDA DE CELDA */}
          {celdaEditando && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <span className="text-xs uppercase font-bold text-brand-primary tracking-wider">
                      Editar Turno en Matriz
                    </span>
                    <h3 className="text-base font-bold text-slate-900">
                      {celdaEditando.usuario.nombre_completo} — {celdaEditando.diaNombre} ({celdaEditando.fecha})
                    </h3>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setCeldaEditando(null)}
                    className="h-8 w-8 p-0 rounded-full text-slate-400 hover:text-slate-700"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                {/* BOTÓN RÁPIDO DÍA DE DESCANSO (OFF) */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Día Libre / Descanso</span>
                    <span className="text-[11px] text-slate-500">Pinta la celda como OFF (no computa horas).</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={celdaEditando.es_dia_descanso}
                      onChange={(e) =>
                        setCeldaEditando({ ...celdaEditando, es_dia_descanso: e.target.checked })
                      }
                      className="rounded text-brand-primary focus:ring-brand-primary h-4 w-4"
                    />
                    <span className="text-xs font-bold text-slate-900">Es Día OFF</span>
                  </label>
                </div>

                {!celdaEditando.es_dia_descanso && (
                  <>
                    {/* PRESETS DE TURNOS FRECUENTES */}
                    <div>
                      <span className="text-[11px] font-bold text-slate-700 block mb-1.5">
                        Horarios Frecuentes (1 Toque)
                      </span>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { e: "11:00", s: "18:00", label: "11 - 18 (7h)" },
                          { e: "14:00", s: "22:00", label: "14 - 22 (8h)" },
                          { e: "08:00", s: "17:00", label: "08 - 17 (9h)" },
                          { e: "12:00", s: "22:00", label: "12 - 22 (10h)" },
                          { e: "10:30", s: "17:30", label: "10.5 - 17.5" },
                          { e: "16:00", s: "02:00", label: "16 - 02 (Cierre)" },
                        ].map((preset) => (
                          <Button
                            key={preset.label}
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setCeldaEditando({
                                ...celdaEditando,
                                hora_entrada: preset.e,
                                hora_salida: preset.s,
                              })
                            }
                            className="text-[11px] h-8 border-slate-200 hover:bg-blue-50 hover:border-blue-300 text-slate-700 rounded-lg"
                          >
                            {preset.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* ENTRADA Y SALIDA PERSONALIZADAS */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          Hora de Entrada
                        </label>
                        <Input
                          type="time"
                          value={celdaEditando.hora_entrada}
                          onChange={(e) =>
                            setCeldaEditando({ ...celdaEditando, hora_entrada: e.target.value })
                          }
                          className="text-xs rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          Hora de Salida
                        </label>
                        <Input
                          type="time"
                          value={celdaEditando.hora_salida}
                          onChange={(e) =>
                            setCeldaEditando({ ...celdaEditando, hora_salida: e.target.value })
                          }
                          className="text-xs rounded-xl"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* ETIQUETA / EVENTO ASIGNADO (SIN EMOJIS, CHIPS MODERNOS) */}
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Etiqueta de Evento o Nota Especial
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {[
                      { tag: "", label: "Sin Evento" },
                      { tag: "1 evento", label: "1 Evento" },
                      { tag: "2 evento", label: "2 Eventos" },
                      { tag: "EVENT BNI", label: "Evento BNI" },
                      { tag: "Capacitación", label: "Capacitación" },
                      { tag: "Inventario", label: "Inventario" },
                      { tag: "OFF 1 Nov", label: "Descanso Festivo" },
                    ].map((btn) => (
                      <Button
                        key={btn.label}
                        type="button"
                        size="sm"
                        variant={celdaEditando.notas === btn.tag ? "default" : "outline"}
                        onClick={() =>
                          setCeldaEditando({ ...celdaEditando, notas: btn.tag })
                        }
                        className={`text-[11px] h-7 px-2.5 rounded-lg font-medium ${
                          celdaEditando.notas === btn.tag
                            ? "bg-brand-dark text-white"
                            : "border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {btn.label}
                      </Button>
                    ))}
                  </div>
                  <Input
                    type="text"
                    value={celdaEditando.notas}
                    onChange={(e) =>
                      setCeldaEditando({ ...celdaEditando, notas: e.target.value })
                    }
                    placeholder="O escribe nombre del evento (ej. Evento Henrry, Boda Salón)..."
                    className="text-xs rounded-xl"
                  />
                </div>

                {/* BOTONES DE APLICAR */}
                <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
                  <Button
                    type="button"
                    onClick={() => guardarEdicionCelda(false)}
                    className="flex-1 bg-brand-dark hover:bg-brand-dark-hover text-white text-xs font-bold h-10 rounded-xl"
                  >
                    Guardar para este Día
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => guardarEdicionCelda(true)}
                    className="flex-1 border-brand-primary/40 text-brand-primary hover:bg-blue-50 text-xs font-bold h-10 rounded-xl"
                  >
                    Repetir en Toda la Semana
                  </Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* 1. MONITOR DE ASISTENCIA EN VIVO (HOY) */}
        <TabsContent value="monitoreo" className="mt-6 space-y-6">
          {/* BARRA SUPERIOR DE MONITOREO CON FECHA Y REFRESH */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                </span>
                <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
                  Semáforo de Asistencia en Tiempo Real
                </h2>
              </div>
              <p className="text-xs text-slate-500">
                Visualiza al instante quién está puntual en sede, quién tiene retardo y quién está en alerta roja por no haber marcado.
              </p>
            </div>

            <div className="flex items-center gap-2.5 self-end sm:self-auto">
              <div className="px-3.5 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-mono font-bold">
                Hoy: {new Date().toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => cargarMonitoreo()}
                disabled={cargandoMonitoreo}
                className="h-9 rounded-xl border-slate-200 text-xs font-semibold hover:bg-slate-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${cargandoMonitoreo ? "animate-spin text-brand-primary" : "text-slate-600"}`} />
                {cargandoMonitoreo ? "Actualizando..." : "Actualizar en Vivo"}
              </Button>
            </div>
          </div>

          {/* KPI CARDS RESUMEN */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Total Equipo</span>
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
              {sinMarcarCount > 0 && (
                <div className="absolute top-0 right-0 w-2 h-full bg-rose-500 animate-pulse" />
              )}
              <div className="flex items-center justify-between text-rose-700 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">¡Alerta Sin Marcar!</span>
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

          {/* FILTROS RÁPIDOS POR ESTADO DE SEMÁFORO */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <Button
              size="sm"
              variant={filtroMonitoreo === "todos" ? "default" : "outline"}
              onClick={() => setFiltroMonitoreo("todos")}
              className={`rounded-xl text-xs h-8 ${filtroMonitoreo === "todos" ? "bg-brand-dark text-white" : "border-slate-200 text-slate-600"}`}
            >
              Todos ({totalEquipo})
            </Button>
            <Button
              size="sm"
              variant={filtroMonitoreo === "sin_marcar" ? "default" : "outline"}
              onClick={() => setFiltroMonitoreo("sin_marcar")}
              className={`rounded-xl text-xs h-8 ${filtroMonitoreo === "sin_marcar" ? "bg-rose-600 text-white hover:bg-rose-700" : "border-rose-200 text-rose-700 hover:bg-rose-50"}`}
            >
              <AlertOctagon className="h-3 w-3 mr-1" />
              Rojo: Sin Marcar ({sinMarcarCount})
            </Button>
            <Button
              size="sm"
              variant={filtroMonitoreo === "retardo" ? "default" : "outline"}
              onClick={() => setFiltroMonitoreo("retardo")}
              className={`rounded-xl text-xs h-8 ${filtroMonitoreo === "retardo" ? "bg-amber-600 text-white hover:bg-amber-700" : "border-amber-200 text-amber-700 hover:bg-amber-50"}`}
            >
              <Clock className="h-3 w-3 mr-1" />
              Amarillo: Con Retardo ({retardoCount})
            </Button>
            <Button
              size="sm"
              variant={filtroMonitoreo === "puntual" ? "default" : "outline"}
              onClick={() => setFiltroMonitoreo("puntual")}
              className={`rounded-xl text-xs h-8 ${filtroMonitoreo === "puntual" ? "bg-emerald-600 text-white hover:bg-emerald-700" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"}`}
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Verde: Puntuales ({puntualCount})
            </Button>
            <Button
              size="sm"
              variant={filtroMonitoreo === "proximo" ? "default" : "outline"}
              onClick={() => setFiltroMonitoreo("proximo")}
              className={`rounded-xl text-xs h-8 ${filtroMonitoreo === "proximo" ? "bg-slate-700 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
            >
              Turno Próximo ({proximoCount})
            </Button>
            <Button
              size="sm"
              variant={filtroMonitoreo === "descanso" ? "default" : "outline"}
              onClick={() => setFiltroMonitoreo("descanso")}
              className={`rounded-xl text-xs h-8 ${filtroMonitoreo === "descanso" ? "bg-purple-700 text-white" : "border-purple-200 text-purple-700 hover:bg-purple-50"}`}
            >
              Día OFF ({descansoCount})
            </Button>
          </div>

          {/* LISTADO DE TARJETAS DE MONITOREO EN TIEMPO REAL */}
          {miembrosFiltrados.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80">
              <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-700">No hay colaboradores en esta categoría</p>
              <p className="text-xs text-slate-400 mt-1">Selecciona el filtro &apos;Todos&apos; para ver a todo tu equipo.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {miembrosFiltrados.map((colab) => {
                const info = monitoreoHoy.find((m) => m.usuario_id === colab.id);
                const estado = info?.estado || "sin_turno";
                const esRojo = estado === "sin_marcar";
                const esAmarillo = estado === "retardo";
                const esVerde = estado === "puntual" || estado === "finalizado";
                const esDescanso = estado === "descanso";
                const esProximo = estado === "turno_proximo";
                const esAlmuerzo = estado === "en_almuerzo";

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
                    <div className="p-5 sm:p-6 space-y-4">
                      {/* ENCABEZADO DE FICHA */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3.5">
                          <div className="relative shrink-0">
                            <div className="h-12 w-12 rounded-2xl bg-brand-dark text-white flex items-center justify-center font-bold text-sm tracking-wide shadow-sm">
                              {colab.nombre_completo.split(" ").slice(0, 2).map((n) => n[0]).join("")}
                            </div>
                            <div
                              className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white ${
                                esRojo
                                  ? "bg-rose-500 animate-pulse"
                                  : esAmarillo
                                  ? "bg-amber-400"
                                  : esVerde
                                  ? "bg-brand-accent"
                                  : esAlmuerzo
                                  ? "bg-blue-400"
                                  : "bg-slate-300"
                              }`}
                            />
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-extrabold text-slate-900 text-sm sm:text-base">
                                {colab.nombre_completo}
                              </span>
                              <span className="text-[11px] font-mono px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-bold border border-slate-200">
                                {colab.codigo_rrhh || colab.username}
                              </span>
                              {colab.facial_enrolled ? (
                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-semibold">
                                  <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" />
                                  Biometría Enrolada
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-slate-400 border-slate-200 text-[10px]">
                                  Sin Enrolar
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
                              <span className="font-medium text-slate-600">{colab.puesto?.nombre || "Colaborador"}</span>
                              <span>•</span>
                              <span>{colab.sede?.nombre || "Sede Polanco"}</span>
                              {colab.telefono && (
                                <>
                                  <span>•</span>
                                  <span className="font-mono text-emerald-700 font-semibold">{colab.telefono}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* SEMÁFORO BADGE GRANDE */}
                        <div className="self-start sm:self-auto shrink-0">
                          {esRojo && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 text-white font-extrabold text-xs shadow-sm shadow-rose-200 animate-pulse">
                              <AlertOctagon className="h-4 w-4" />
                              <span>ROJO: SIN MARCAR</span>
                            </div>
                          )}
                          {esAmarillo && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 text-white font-extrabold text-xs shadow-sm shadow-amber-200">
                              <Clock className="h-4 w-4" />
                              <span>AMARILLO: RETARDO</span>
                            </div>
                          )}
                          {esVerde && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-accent text-brand-dark font-extrabold text-xs shadow-sm shadow-emerald-100">
                              <CheckCircle2 className="h-4 w-4" />
                              <span>VERDE: EN SEDE</span>
                            </div>
                          )}
                          {esAlmuerzo && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500 text-white font-extrabold text-xs">
                              <Coffee className="h-4 w-4" />
                              <span>EN ALMUERZO</span>
                            </div>
                          )}
                          {esDescanso && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-100 text-purple-800 font-bold text-xs border border-purple-200">
                              <Sun className="h-4 w-4 text-purple-600" />
                              <span>DÍA LIBRE (OFF)</span>
                            </div>
                          )}
                          {esProximo && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200">
                              <Clock className="h-4 w-4 text-slate-500" />
                              <span>TURNO PRÓXIMO</span>
                            </div>
                          )}
                          {estado === "sin_turno" && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-500 font-semibold text-xs border border-slate-200">
                              <span>SIN TURNO HOY</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* DATOS COMPARATIVOS HORARIO VS MARCAJE REAL */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-slate-50/90 border border-slate-200/80 text-xs">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider mb-1">
                            Turno Programado Hoy
                          </span>
                          {info?.turnoHoy ? (
                            info.turnoHoy.es_dia_descanso ? (
                              <span className="font-bold text-purple-700">Día de descanso (OFF)</span>
                            ) : (
                              <span className="font-mono font-bold text-slate-800">
                                {info.turnoHoy.hora_entrada?.slice(0, 5)} — {info.turnoHoy.hora_salida?.slice(0, 5)}
                                <span className="text-slate-400 font-normal ml-1">
                                  ({calcularHorasTurno(info.turnoHoy.hora_entrada, info.turnoHoy.hora_salida, false)}h)
                                </span>
                              </span>
                            )
                          ) : (
                            <span className="text-slate-400 italic">No programado en Matriz</span>
                          )}
                        </div>

                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider mb-1">
                            Marcaje de Entrada
                          </span>
                          {info?.marcajeHoy?.hora_entrada ? (
                            <span className="font-mono font-bold text-slate-800">
                              {formatearHoraAmPm(info.marcajeHoy.hora_entrada)}
                              {info.minutosDiferencia > 0 && esAmarillo && (
                                <span className="text-amber-700 ml-1 font-semibold">(+{info.minutosDiferencia} min)</span>
                              )}
                              {info.minutosDiferencia <= 0 && esVerde && (
                                <span className="text-emerald-700 ml-1 font-semibold">(a tiempo)</span>
                              )}
                            </span>
                          ) : (
                            <span className={esRojo ? "font-bold text-rose-600" : "text-slate-400 italic"}>
                              {esRojo ? "No ha registrado entrada" : "En espera"}
                            </span>
                          )}
                        </div>

                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider mb-1">
                            Marcaje de Salida / Almuerzo
                          </span>
                          {info?.marcajeHoy?.hora_salida ? (
                            <span className="font-mono font-bold text-slate-800">
                              Salida: {formatearHoraAmPm(info.marcajeHoy.hora_salida)}
                            </span>
                          ) : info?.marcajeHoy?.hora_inicio_almuerzo && !info?.marcajeHoy?.hora_fin_almuerzo ? (
                            <span className="font-semibold text-blue-700">
                              En Almuerzo ({formatearHoraAmPm(info.marcajeHoy.hora_inicio_almuerzo)})
                            </span>
                          ) : info?.marcajeHoy?.hora_entrada ? (
                            <span className="text-emerald-700 font-medium">Jornada activa en sede</span>
                          ) : (
                            <span className="text-slate-400 italic">—</span>
                          )}
                        </div>
                      </div>

                      {/* BANNER DE DIAGNÓSTICO Y ACCIÓN DIRECTA */}
                      <div
                        className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                          esRojo
                            ? "bg-rose-100/70 border-rose-200 text-rose-900"
                            : esAmarillo
                            ? "bg-amber-100/70 border-amber-200 text-amber-900"
                            : esVerde
                            ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                            : "bg-slate-100/70 border-slate-200 text-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {esRojo ? (
                            <AlertOctagon className="h-5 w-5 text-rose-600 shrink-0" />
                          ) : esAmarillo ? (
                            <Clock className="h-5 w-5 text-amber-600 shrink-0" />
                          ) : esVerde ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                          ) : (
                            <Clock className="h-5 w-5 text-slate-400 shrink-0" />
                          )}
                          <p className="text-xs font-semibold">
                            {info?.mensajeEstado || "Sin novedad registrada para la jornada de hoy."}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                          {/* BOTÓN WHATSAPP PARA CONTACTO DIRECTO */}
                          <Button
                            size="sm"
                            onClick={() => enviarAlertaWhatsAppColaborador(colab, info)}
                            className="flex-1 sm:flex-initial h-8 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm"
                          >
                            <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                            Alerta WhatsApp
                          </Button>

                          {/* BOTÓN JUSTIFICAR FALTA / RETARDO */}
                          {(esRojo || esAmarillo) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setJustColabId(colab.id);
                                setJustTipo(esRojo ? "falta" : "llegada_tarde");
                                setPestañaActiva("justificaciones");
                              }}
                              className={`flex-1 sm:flex-initial h-8 px-3 rounded-xl text-xs font-bold ${
                                esRojo
                                  ? "border-rose-300 text-rose-700 hover:bg-rose-200/50 bg-white"
                                  : "border-amber-300 text-amber-800 hover:bg-amber-200/50 bg-white"
                              }`}
                            >
                              <FileText className="h-3.5 w-3.5 mr-1.5" />
                              {esRojo ? "Justificar Falta" : "Banco de Horas"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* 2. JUSTIFICACIÓN DE FALTAS Y REPOSICIONES */}
        <TabsContent value="justificaciones" className="mt-6">
          <Card className="max-w-2xl mx-auto rounded-2xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                Formulario de Justificación y Plan de Reposición
              </CardTitle>
              <CardDescription className="text-xs">
                Registra inasistencias o llegadas tarde justificadas y acuerda la fecha para reponer las horas adeudadas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGuardarJustificacion} className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Colaborador Afectado
                  </label>
                  <select
                    value={justColabId}
                    onChange={(e) => setJustColabId(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white font-medium"
                    required
                  >
                    {team.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre_completo} ({c.codigo_rrhh})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Fecha del Incidente
                    </label>
                    <Input
                      type="date"
                      value={justFecha}
                      onChange={(e) => setJustFecha(e.target.value)}
                      className="text-xs rounded-xl"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Tipo de Incidencia
                    </label>
                    <select
                      value={justTipo}
                      onChange={(e) => setJustTipo(e.target.value as any)}
                      className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white"
                    >
                      <option value="falta">Falta Justificada (Día Completo)</option>
                      <option value="llegada_tarde">Llegada Tarde Justificada</option>
                      <option value="salida_temprana">Salida Anticipada con Permiso</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Motivo y Comprobante Comprobable
                  </label>
                  <Textarea
                    value={justMotivo}
                    onChange={(e) => setJustMotivo(e.target.value)}
                    placeholder="Describe la causa (ej. constancia médica, cita oficial, imprevisto de transporte comprobable)..."
                    className="text-xs rounded-xl min-h-[80px]"
                    required
                  />
                </div>

                <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 space-y-3">
                  <span className="text-xs font-bold text-blue-900 block">
                    Compromiso Flexible de Reposición de Horas
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                        Horas a Reponer
                      </label>
                      <Input
                        type="number"
                        step="0.5"
                        value={justHorasReponer}
                        onChange={(e) => setJustHorasReponer(Number(e.target.value))}
                        className="text-xs rounded-xl bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                        Fecha Programada de Reposición
                      </label>
                      <Input
                        type="date"
                        value={justFechaReponer}
                        onChange={(e) => setJustFechaReponer(e.target.value)}
                        className="text-xs rounded-xl bg-white"
                      />
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={guardandoJust}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold h-11"
                >
                  {guardandoJust ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Guardar Justificación y Asignar Reposición"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. BANCO DE HORAS FLEXIBLE Y MEDIDOR DE NIVELACIÓN */}
        <TabsContent value="bancohoras" className="mt-6 space-y-6">
          {/* HEADER DEL BANCO DE HORAS Y SELECTOR DE JORNADA BASE */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-xl bg-blue-50 text-brand-primary flex items-center justify-center">
                    <Scale className="h-5 w-5" />
                  </div>
                  <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
                    Banco de Horas y Medidor de Nivelación Semanal
                  </h2>
                </div>
                <p className="text-xs text-slate-500 max-w-2xl">
                  En BOCO <strong>no se pagan horas extras</strong> en nómina: se reponen y nivelan compensando las horas asignadas en las semanas siguientes.
                </p>
              </div>

              {/* SELECTOR DE JORNADA ORDINARIA BASE */}
              <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-600 px-2">Jornada Base:</span>
                <Button
                  size="sm"
                  variant={jornadaBaseDefault === 42 ? "default" : "outline"}
                  onClick={() => {
                    setJornadaBaseDefault(42);
                    cargarBancoHoras(team, 42);
                  }}
                  className={`h-8 rounded-xl text-xs font-bold ${
                    jornadaBaseDefault === 42
                      ? "bg-brand-dark text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  Mixta: 42h (BOCO Oficial)
                </Button>
                <Button
                  size="sm"
                  variant={jornadaBaseDefault === 44 ? "default" : "outline"}
                  onClick={() => {
                    setJornadaBaseDefault(44);
                    cargarBancoHoras(team, 44);
                  }}
                  className={`h-8 rounded-xl text-xs font-bold ${
                    jornadaBaseDefault === 44
                      ? "bg-brand-dark text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  Diurna: 44h
                </Button>
                <Button
                  size="sm"
                  variant={jornadaBaseDefault === 40 ? "default" : "outline"}
                  onClick={() => {
                    setJornadaBaseDefault(40);
                    cargarBancoHoras(team, 40);
                  }}
                  className={`h-8 rounded-xl text-xs font-bold ${
                    jornadaBaseDefault === 40
                      ? "bg-brand-dark text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  Base 40h
                </Button>
              </div>
            </div>

            {/* BARRA DE NAVEGACIÓN SEMANAL Y ACCIÓN RÁPIDA */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => cambiarSemana(-7)}
                  className="h-8 w-8 p-0 rounded-lg border-slate-200"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="px-3 py-1 bg-slate-100 rounded-xl text-xs font-mono font-bold text-slate-800">
                  Semana: {diasSemana[0]?.nombre} {diasSemana[0]?.display} — {diasSemana[6]?.nombre} {diasSemana[6]?.display}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => cambiarSemana(7)}
                  className="h-8 w-8 p-0 rounded-lg border-slate-200"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => cargarBancoHoras(team, jornadaBaseDefault)}
                  disabled={cargandoBanco}
                  className="h-8 rounded-xl border-slate-200 text-xs font-semibold"
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${cargandoBanco ? "animate-spin text-brand-primary" : "text-slate-600"}`} />
                  Recalcular con Marcajes
                </Button>
              </div>
            </div>
          </div>

          {/* LISTADO DE COLABORADORES CON EL MEDIDOR DE BANCO DE HORAS */}
          <div className="space-y-4">
            {team.map((colab) => {
              // Buscar datos consolidados del backend o calcular dinámicamente con la matriz en memoria
              const resumenBackend = bancoHorasResumen.find((r) => r.usuario_id === colab.id);

              // 1. Horas programadas en la matriz para este colaborador en esta semana
              let horasProgramadasMatriz = 0;
              let festivosEnSemana = 0;
              diasSemana.forEach((d) => {
                const clave = `${colab.id}_${d.fecha}`;
                const t = matrizTurnos[clave];
                if (t && !t.es_dia_descanso && t.hora_entrada && t.hora_salida) {
                  horasProgramadasMatriz += calcularHorasTurno(t.hora_entrada, t.hora_salida, false);
                }
                if (t && t.es_dia_festivo && !t.es_dia_descanso) {
                  festivosEnSemana++;
                }
              });
              horasProgramadasMatriz = Number(horasProgramadasMatriz.toFixed(1));

              const horasBase = jornadaBaseDefault;
              const diferenciaProgramacion = Number((horasProgramadasMatriz - horasBase).toFixed(1));
              const horasExcedentes = resumenBackend?.horas_excedentes_operacion || 0;
              const festivosCount = resumenBackend?.dias_festivos_laborados ?? festivosEnSemana;
              const horasFestivos = festivosCount * 8;
              const horasPorReponer = resumenBackend?.horas_por_reponer_justificadas || 0;

              // Saldo neto = Diferencia Matriz (ej. 44h - 42h = +2h) + Horas extras trabajadas en sede + Festivos (x8h) - Horas a reponer
              const saldoNeto = Number(
                (diferenciaProgramacion + horasExcedentes + horasFestivos - horasPorReponer).toFixed(1)
              );

              // Sugerencia de nivelación para la próxima semana (ej. si le debo 11h, la próxima semana 42 - 11 = 31h)
              let sugerenciaProximaSemana = horasBase;
              if (saldoNeto > 0) {
                sugerenciaProximaSemana = Math.max(0, Number((horasBase - saldoNeto).toFixed(1)));
              } else if (saldoNeto < 0) {
                sugerenciaProximaSemana = Number((horasBase + Math.abs(saldoNeto)).toFixed(1));
              }

              return (
                <Card key={colab.id} className="rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden bg-white">
                  <div className="p-5 sm:p-6 space-y-5">
                    {/* ENCABEZADO: COLABORADOR Y SALDO PRINCIPAL */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <div className="h-12 w-12 rounded-2xl bg-brand-dark text-white flex items-center justify-center font-bold text-sm tracking-wide shadow-sm shrink-0">
                          {colab.nombre_completo.split(" ").slice(0, 2).map((n) => n[0]).join("")}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-slate-900 text-base">{colab.nombre_completo}</span>
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-bold border border-slate-200">
                              {colab.codigo_rrhh || colab.username}
                            </span>
                            <span className="text-xs text-slate-500 font-medium">{colab.puesto?.nombre || "Colaborador"}</span>
                          </div>
                          <span className="text-xs text-slate-400 block mt-0.5">{colab.sede?.nombre || "BOCO Polanco"}</span>
                        </div>
                      </div>

                      {/* SALDO NETO CONSOLIDADO */}
                      <div className="self-start sm:self-auto">
                        <div
                          className={`px-4 py-2 rounded-2xl border flex items-center gap-2 shadow-sm ${
                            saldoNeto > 0
                              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                              : saldoNeto < 0
                              ? "bg-rose-50 border-rose-200 text-rose-900"
                              : "bg-slate-50 border-slate-200 text-slate-700"
                          }`}
                        >
                          <Scale className={`h-4 w-4 ${saldoNeto > 0 ? "text-emerald-600" : saldoNeto < 0 ? "text-rose-600" : "text-slate-500"}`} />
                          <div>
                            <span className="text-[10px] uppercase font-bold tracking-wider block opacity-75">
                              {saldoNeto > 0 ? "Saldo a Favor (BOCO debe)" : saldoNeto < 0 ? "Saldo Deudor (Por reponer)" : "Saldo en Cero"}
                            </span>
                            <span className="text-base font-extrabold font-mono">
                              {saldoNeto > 0 ? `+${saldoNeto} horas` : saldoNeto < 0 ? `${saldoNeto} horas` : "0.0 horas"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* MEDIDOR VISUAL DE NIVELACIÓN (GAUGE) */}
                    <div className="p-4 rounded-2xl bg-slate-50/90 border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="flex items-center gap-1.5 text-slate-800">
                          <Sliders className="h-4 w-4 text-brand-primary" />
                          Medidor Visual de Nivelación de Jornada
                        </span>
                        <span className="text-slate-500 text-[11px] font-mono">
                          Jornada Base: {horasBase}h | Asignadas: {horasProgramadasMatriz}h
                        </span>
                      </div>

                      {/* BARRA GRÁFICA DEL MEDIDOR */}
                      <div className="relative w-full h-4 bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
                        {/* ZONA DEUDA (ROJO) */}
                        <div className="w-1/2 h-full bg-gradient-to-r from-rose-500 via-rose-400 to-amber-300 flex justify-end items-center pr-1.5">
                          {saldoNeto < 0 && (
                            <div className="h-3 w-3 rounded-full bg-rose-700 shadow ring-2 ring-white animate-pulse" />
                          )}
                        </div>
                        {/* EJE CERO / EQUILIBRIO */}
                        <div className="w-1.5 h-full bg-brand-dark z-10 shrink-0" title="Punto Cero (Equilibrio)" />
                        {/* ZONA A FAVOR (VERDE) */}
                        <div className="w-1/2 h-full bg-gradient-to-r from-brand-accent/70 via-brand-accent to-emerald-600 flex justify-start items-center pl-1.5">
                          {saldoNeto > 0 && (
                            <div className="h-3 w-3 rounded-full bg-emerald-900 shadow ring-2 ring-white animate-pulse" />
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between text-[10px] font-mono text-slate-400">
                        <span className="text-rose-600 font-bold">-20h (Deuda Colaborador)</span>
                        <span className="font-extrabold text-brand-dark">0h (Equilibrio)</span>
                        <span className="text-emerald-600 font-bold">+20h (BOCO Debe Horas)</span>
                      </div>

                      {/* CAJA DE RECOMENDACIÓN INTELIGENTE DE NIVELACIÓN */}
                      <div
                        className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                          saldoNeto > 0
                            ? "bg-emerald-50/80 border-emerald-200 text-emerald-950"
                            : saldoNeto < 0
                            ? "bg-amber-50/80 border-amber-200 text-amber-950"
                            : "bg-white border-slate-200 text-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Sparkles className={`h-5 w-5 shrink-0 ${saldoNeto > 0 ? "text-emerald-600" : "text-amber-600"}`} />
                          <p className="text-xs font-medium leading-relaxed">
                            {saldoNeto > 0 ? (
                              <>
                                <strong>Nivelación Sugerida:</strong> Para saldar las <strong>+{saldoNeto}h</strong> que BOCO le debe a {colab.nombre_completo}, asígnale <strong>{sugerenciaProximaSemana} horas</strong> la próxima semana ({horasBase}h base - {saldoNeto}h = {sugerenciaProximaSemana}h).
                              </>
                            ) : saldoNeto < 0 ? (
                              <>
                                <strong>Nivelación Sugerida:</strong> Para reponer las <strong>{Math.abs(saldoNeto)}h</strong> adeudadas, asígnale <strong>{sugerenciaProximaSemana} horas</strong> la próxima semana ({horasBase}h base + {Math.abs(saldoNeto)}h = {sugerenciaProximaSemana}h).
                              </>
                            ) : (
                              <>
                                <strong>Banco Equilibrado:</strong> Cumple exactamente su meta semanal de <strong>{horasBase} horas</strong>.
                              </>
                            )}
                          </p>
                        </div>

                        {saldoNeto !== 0 && (
                          <Button
                            size="sm"
                            onClick={() => {
                              cambiarSemana(7);
                              setPestañaActiva("matriz");
                              toast({
                                title: "Semana Siguiente Seleccionada",
                                description: `Meta recomendada para ${colab.nombre_completo}: ${sugerenciaProximaSemana} horas en la matriz.`,
                              });
                            }}
                            className="bg-brand-dark hover:bg-brand-dark-hover text-white text-xs font-bold rounded-xl h-8 shrink-0 shadow-sm"
                          >
                            Programar {sugerenciaProximaSemana}h en Matriz
                            <ArrowRight className="h-3.5 w-3.5 ml-1" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* DESGLOSE TRANSPARENTE EN 5 CAJAS */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider mb-1">
                          1. En Matriz
                        </span>
                        <span className="text-base font-extrabold font-mono text-slate-900">
                          {horasProgramadasMatriz}h
                        </span>
                        <span className="text-[10px] text-slate-500 block mt-0.5">Programadas hoy</span>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider mb-1">
                          2. Base Mixta
                        </span>
                        <span className="text-base font-extrabold font-mono text-slate-900">
                          {horasBase}h
                        </span>
                        <span className={`text-[10px] font-bold block mt-0.5 ${diferenciaProgramacion >= 0 ? "text-emerald-600" : "text-amber-600"}`}>
                          Dif: {diferenciaProgramacion >= 0 ? `+${diferenciaProgramacion}h` : `${diferenciaProgramacion}h`}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200">
                        <span className="text-[10px] uppercase font-bold text-blue-700 block tracking-wider mb-1">
                          3. Extras en Sede
                        </span>
                        <span className="text-base font-extrabold font-mono text-blue-900">
                          +{horasExcedentes}h
                        </span>
                        <span className="text-[10px] text-blue-700 block mt-0.5">Quedarse tras salida</span>
                      </div>

                      <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200">
                        <span className="text-[10px] uppercase font-bold text-amber-700 block tracking-wider mb-1">
                          4. Festivos
                        </span>
                        <span className="text-base font-extrabold font-mono text-amber-900">
                          {festivosCount} {festivosCount === 1 ? "día" : "días"}
                        </span>
                        <span className="text-[10px] text-amber-700 block mt-0.5">+{horasFestivos}h compensables</span>
                      </div>

                      <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-200">
                        <span className="text-[10px] uppercase font-bold text-rose-700 block tracking-wider mb-1">
                          5. Faltas a Reponer
                        </span>
                        <span className="text-base font-extrabold font-mono text-rose-900">
                          -{horasPorReponer}h
                        </span>
                        <span className="text-[10px] text-rose-700 block mt-0.5">Permisos pendientes</span>
                      </div>
                    </div>

                    {/* BOTONES DE ACCIÓN DIRECTA */}
                    <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setColabAjusteModal(colab);
                          setAjusteHoras(2);
                          setAjusteTipo("a_favor_colaborador");
                        }}
                        className="h-8 rounded-xl text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50"
                      >
                        <Scale className="h-3.5 w-3.5 mr-1 text-brand-primary" />
                        Registrar Ajuste Manual
                      </Button>

                      <Button
                        size="sm"
                        onClick={() =>
                          notificarBalanceWhatsApp(colab, {
                            usuario_id: colab.id,
                            semana_inicio: diasSemana[0]?.fecha,
                            semana_fin: diasSemana[6]?.fecha,
                            jornada_base: horasBase,
                            horas_programadas: horasProgramadasMatriz,
                            diferencia_programacion: diferenciaProgramacion,
                            horas_reales_trabajadas: resumenBackend?.horas_reales_trabajadas || 0,
                            horas_excedentes_operacion: horasExcedentes,
                            dias_festivos_laborados: festivosCount,
                            horas_por_reponer_justificadas: horasPorReponer,
                            saldo_neto_horas: saldoNeto,
                            estado_balance: saldoNeto > 0 ? "a_favor_colaborador" : saldoNeto < 0 ? "a_favor_empresa" : "nivelado",
                            sugerencia_proxima_semana: sugerenciaProximaSemana,
                            mensaje_medidor: "",
                          })
                        }
                        className="h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                      >
                        <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                        Notificar Saldo WhatsApp
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* MODAL PARA REGISTRO DE AJUSTE MANUAL EN BANCO DE HORAS */}
      {colabAjusteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Ajuste Manual de Banco de Horas</h3>
                <p className="text-xs text-slate-500">{colabAjusteModal.nombre_completo} ({colabAjusteModal.codigo_rrhh})</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setColabAjusteModal(null)}
                className="h-8 w-8 p-0 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleGuardarAjusteBanco} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Tipo de Ajuste
                </label>
                <select
                  value={ajusteTipo}
                  onChange={(e) => setAjusteTipo(e.target.value as any)}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white font-medium"
                >
                  <option value="a_favor_colaborador">Horas Extras / Tiempo a Favor del Colaborador (+)</option>
                  <option value="a_favor_empresa">Horas Adeudadas / Descuento por Falta o Salida (-)</option>
                  <option value="compensacion_tomada">Compensación Tomada (Turno libre otorgado)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Cantidad de Horas
                </label>
                <Input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={ajusteHoras}
                  onChange={(e) => setAjusteHoras(Number(e.target.value))}
                  className="text-xs rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Motivo o Justificación del Ajuste
                </label>
                <Textarea
                  value={ajusteMotivo}
                  onChange={(e) => setAjusteMotivo(e.target.value)}
                  placeholder="Ej. Quedó 2h apoyando cierre por evento especial; acuerdo verbal con gerencia..."
                  className="text-xs rounded-xl min-h-[75px]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setColabAjusteModal(null)}
                  className="text-xs rounded-xl"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={guardandoAjuste}
                  className="bg-brand-dark hover:bg-brand-dark-hover text-white text-xs font-bold rounded-xl"
                >
                  {guardandoAjuste ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : "Guardar Ajuste"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

