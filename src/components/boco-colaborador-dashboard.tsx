"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  registrarMarcajeBoco,
  obtenerMarcajeHoyColaborador,
  obtenerTurnosSemana,
  enrolarRostroColaborador,
  obtenerCursosParaColaborador,
  registrarSegundosLecturaLMS,
  calificarEvaluacionLMS,
  cambiarContraseniaBoco,
} from "@/app/boco-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Clock,
  MapPin,
  Camera,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Calendar,
  ShieldCheck,
  Coffee,
  LogOut as LogOutIcon,
  LogIn as LogInIcon,
  Loader2,
  Lock,
  Sparkles,
  UserCheck,
  KeyRound,
  Award,
  AlertTriangle,
} from "lucide-react";
import * as faceapi from "@vladmandic/face-api";
import type { HorarioTurno, LMSCurso, LMSAvanceColaborador, LMSRespuestaColaborador } from "@/lib/types";
import { BocoLogo } from "@/components/boco-brand";

export function BocoColaboradorDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Estados de Geolocalización y Sede
  const [coords, setCoords] = useState<{ latitud: number; longitud: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsCargando, setGpsCargando] = useState(false);

  // Estados de Marcaje
  const [marcajeLoading, setMarcajeLoading] = useState(false);
  const [tomoAlmuerzo, setTomoAlmuerzo] = useState(true);
  const [marcajeHoy, setMarcajeHoy] = useState<any | null>(null);
  const [estadoHoy, setEstadoHoy] = useState({
    entradaRegistrada: false,
    almuerzoIniciado: false,
    almuerzoFinalizado: false,
    salidaRegistrada: false,
  });

  // Estados de Enrolamiento Facial
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [enrolando, setEnrolando] = useState(false);
  const [facialEnrolled, setFacialEnrolled] = useState(user?.facial_enrolled || false);

  // Estados del LMS y Cursos
  const [cursos, setCursos] = useState<any[]>([]);
  const [cursoActivo, setCursoActivo] = useState<any | null>(null);
  const [segundosLectura, setSegundosLectura] = useState(0);
  const [tiempoCumplido, setTiempoCumplido] = useState(false);
  const [enEvaluacion, setEnEvaluacion] = useState(false);
  const [respuestasEvaluacion, setRespuestasEvaluacion] = useState<Record<number, { seleccion: string; justificacion: string }>>({});
  const [evaluando, setEvaluando] = useState(false);
  const [resultadoTest, setResultadoTest] = useState<{ puntuacion: number; aprobado: boolean; retroalimentacion: string } | null>(null);

  // Estados para Cambiar Contraseña
  const [passActual, setPassActual] = useState("");
  const [passNueva, setPassNueva] = useState("");
  const [passConfirmar, setPassConfirmar] = useState("");
  const [cambiandoPass, setCambiandoPass] = useState(false);

  // Obtener geolocalización actual
  const obtenerUbicacion = () => {
    setGpsCargando(true);
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsError("Tu navegador no soporta geolocalización.");
      setGpsCargando(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          latitud: pos.coords.latitude,
          longitud: pos.coords.longitude,
        });
        setGpsCargando(false);
      },
      (err) => {
        setGpsError("No se pudo obtener tu ubicación GPS. Habilita los permisos de ubicación.");
        setGpsCargando(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const cargarMarcajeHoy = async () => {
    if (!user) return;
    try {
      const res = await obtenerMarcajeHoyColaborador(user.id);
      if (res.success && res.marcaje) {
        const m = res.marcaje;
        setMarcajeHoy(m);
        setEstadoHoy({
          entradaRegistrada: !!m.hora_entrada,
          almuerzoIniciado: !!m.hora_inicio_almuerzo,
          almuerzoFinalizado: !!m.hora_fin_almuerzo,
          salidaRegistrada: !!m.hora_salida,
        });
        if (m.tomo_almuerzo !== undefined && m.tomo_almuerzo !== null) {
          setTomoAlmuerzo(m.tomo_almuerzo);
        }
      } else {
        setMarcajeHoy(null);
        setEstadoHoy({
          entradaRegistrada: false,
          almuerzoIniciado: false,
          almuerzoFinalizado: false,
          salidaRegistrada: false,
        });
      }
    } catch (e) {
      console.warn("Error cargando marcaje de hoy:", e);
    }
  };

  const [turnosColab, setTurnosColab] = useState<any[]>([]);

  const cargarHorarioSemanaColab = async () => {
    if (!user) return;
    try {
      const hoy = new Date();
      const dia = hoy.getDay();
      const diff = hoy.getDate() - dia + (dia === 0 ? -6 : 1);
      const lunes = new Date(hoy);
      lunes.setDate(diff);
      const domingo = new Date(lunes);
      domingo.setDate(domingo.getDate() + 6);
      const fechaIni = lunes.toISOString().slice(0, 10);
      const fechaFin = domingo.toISOString().slice(0, 10);

      const turnos = await obtenerTurnosSemana(fechaIni, fechaFin);
      const misTurnos = turnos.filter((t) => t.usuario_id === user.id);
      setTurnosColab(misTurnos);
    } catch (e) {
      console.warn("Error cargando turnos del colaborador:", e);
    }
  };

  useEffect(() => {
    obtenerUbicacion();
    cargarMarcajeHoy();
    cargarCursosColaborador();
    cargarHorarioSemanaColab();
  }, [user]);

  // Temporizador de lectura protegido anti-trampas
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (cursoActivo && !tiempoCumplido) {
      interval = setInterval(() => {
        setSegundosLectura((prev) => {
          const nuevo = prev + 1;
          const meta = cursoActivo.tiempo_minimo_lectura_segundos || 60;
          if (nuevo >= meta) {
            setTiempoCumplido(true);
            // Notificar al servidor que cumplió la lectura obligatoria
            if (user) {
              registrarSegundosLecturaLMS(user.id, cursoActivo.id, nuevo);
            }
          }
          return nuevo;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [cursoActivo, tiempoCumplido]);

  const cargarCursosColaborador = async () => {
    if (!user) return;
    try {
      const res = await obtenerCursosParaColaborador(user.id);
      setCursos(res);
    } catch (e) {
      console.warn("Error cargando cursos:", e);
    }
  };

  // Manejar marcajes de asistencia
  const ejecutarMarcaje = async (tipo: 'entrada' | 'inicio_almuerzo' | 'fin_almuerzo' | 'salida') => {
    if (!user) return;
    if (!coords) {
      toast({
        title: "Ubicación Requerida",
        description: "Esperando señal de GPS para validar tu sede.",
        variant: "destructive",
      });
      obtenerUbicacion();
      return;
    }

    setMarcajeLoading(true);
    try {
      const res = await registrarMarcajeBoco({
        usuarioId: user.id,
        tipo,
        latitud: coords.latitud,
        longitud: coords.longitud,
        tomoAlmuerzo,
      });

      if (res.success) {
        toast({
          title: "Marcaje Registrado Exitosamente",
          description: `Acción: ${tipo.replace('_', ' ').toUpperCase()} validada en sede asignada (${res.distanciaMetros}m).`,
        });

        await cargarMarcajeHoy();
      } else {
        toast({
          title: "Marcaje Rechazado por Geocerca",
          description: res.error || "No estás en el rango permitido de tu sede asignada.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Fallo al registrar marcaje.",
        variant: "destructive",
      });
    } finally {
      setMarcajeLoading(false);
    }
  };

  // Enrolar rostro del colaborador
  const iniciarCamaraEnrolamiento = async () => {
    try {
      const MODEL_URL = "/models";
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCamaraActiva(true);
    } catch (err: any) {
      toast({
        title: "Cámara no disponible",
        description: "No se pudo acceder a la cámara frontal.",
        variant: "destructive",
      });
    }
  };

  const capturarYEnrolar = async () => {
    if (!videoRef.current || !user) return;
    setEnrolando(true);
    try {
      const deteccion = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!deteccion) {
        toast({
          title: "Rostro no detectado",
          description: "Mira directamente a la cámara para capturar tus rasgos biométricos.",
          variant: "destructive",
        });
        setEnrolando(false);
        return;
      }

      const descriptorArray = Array.from(deteccion.descriptor);
      const res = await enrolarRostroColaborador(user.id, descriptorArray);

      if (res.success) {
        setFacialEnrolled(true);
        toast({
          title: "¡Rostro Enrolado con Éxito!",
          description: "Tus rasgos biométricos fueron registrados para acceso y marcaje rápido.",
        });
        if (videoRef.current?.srcObject) {
          (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
        }
        setCamaraActiva(false);
      } else {
        toast({
          title: "Error al enrolar",
          description: res.error || "No se pudo almacenar el descriptor.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Error Biométrico",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setEnrolando(false);
    }
  };

  // Manejar examen LMS
  const enviarEvaluacion = async () => {
    if (!user || !cursoActivo) return;
    const preguntas = cursoActivo.evaluacion?.preguntas_json || [];

    // Validar que todas las preguntas tengan respuesta seleccionada
    for (const preg of preguntas) {
      const respuesta = respuestasEvaluacion[preg.id];
      if (!respuesta || !respuesta.seleccion) {
        toast({
          title: "Pregunta sin responder",
          description: `Por favor responde la pregunta #${preg.id}.`,
          variant: "destructive",
        });
        return;
      }
    }

    setEvaluando(true);
    try {
      const payloadRespuestas: LMSRespuestaColaborador[] = preguntas.map((p: any) => ({
        pregunta_id: p.id,
        respuesta_seleccionada: respuestasEvaluacion[p.id].seleccion,
        justificacion_escrita: respuestasEvaluacion[p.id].justificacion,
      }));

      const res = await calificarEvaluacionLMS({
        usuarioId: user.id,
        cursoId: cursoActivo.id,
        respuestas: payloadRespuestas,
      });

      if (res.success) {
        setResultadoTest(res);
        cargarCursosColaborador();
        toast({
          title: res.aprobado ? "¡Curso Aprobado!" : "Calificación Insuficiente",
          description: res.retroalimentacion,
        });
      }
    } catch (err: any) {
      toast({
        title: "Error de Envío",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setEvaluando(false);
    }
  };

  const handleCambiarPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!passActual || !passNueva || !passConfirmar) {
      toast({
        title: "Campos Requeridos",
        description: "Completa todos los campos para cambiar tu contraseña.",
        variant: "destructive",
      });
      return;
    }

    if (passNueva !== passConfirmar) {
      toast({
        title: "Contraseñas no coinciden",
        description: "La nueva contraseña y su confirmación deben ser exactamente iguales.",
        variant: "destructive",
      });
      return;
    }

    if (passNueva.length < 6) {
      toast({
        title: "Contraseña muy corta",
        description: "La nueva contraseña debe tener al menos 6 caracteres.",
        variant: "destructive",
      });
      return;
    }

    setCambiandoPass(true);
    try {
      const res = await cambiarContraseniaBoco(user.id, passActual, passNueva);
      if (res.success) {
        toast({
          title: "Contraseña Actualizada con Éxito",
          description: "Tu nueva contraseña ha sido guardada de forma segura.",
        });
        setPassActual("");
        setPassNueva("");
        setPassConfirmar("");
      } else {
        toast({
          title: "Error al cambiar contraseña",
          description: res.error || "Verifica tu contraseña actual.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCambiandoPass(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* BARRA SUPERIOR DE MARCA OFICIAL BOCO */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <BocoLogo size="md" showSubtitle subtitle="Portal de Colaborador" />
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="text-right hidden sm:block">
            <span className="text-xs font-bold text-slate-800 block">{user?.nombre_completo}</span>
            <span className="text-[11px] font-mono text-slate-500">@{user?.username || user?.codigo_rrhh}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (typeof window !== "undefined") {
                localStorage.removeItem("boco_auth_user");
                window.location.href = "/";
              }
            }}
            className="text-xs rounded-xl border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"
          >
            <LogOutIcon className="h-3.5 w-3.5 mr-1" />
            Cerrar Sesión
          </Button>
        </div>
      </div>

      {/* TARJETA SUPERIOR DE INFORMACIÓN DE PUESTO Y SEDE (BOCO NAVY & ACCENTS) */}
      <div className="bg-brand-dark rounded-3xl p-6 sm:p-7 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-slate-800">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-brand-primary/20 via-brand-accent/15 to-transparent rounded-full blur-3xl -z-0 pointer-events-none" />

        <div className="relative z-10 space-y-2">
          <span className="text-[11px] uppercase font-bold tracking-widest text-brand-accent">
            Portal del Colaborador
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Hola, {user?.nombre_completo}
          </h1>
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-300">
            <span className="bg-white/10 px-3 py-1 rounded-full font-mono text-white border border-white/10">
              Código: {user?.codigo_rrhh}
            </span>
            <span className="bg-white/10 px-3 py-1 rounded-full text-white border border-white/10">
              Puesto: <strong className="text-brand-primary">{user?.puesto?.nombre || "Colaborador"}</strong>
            </span>
            <span className="bg-white/10 px-3 py-1 rounded-full text-white border border-white/10 flex items-center gap-1">
              <MapPin className="h-3 w-3 text-[#F5A623]" />
              Sede: <strong className="text-white">{user?.sede?.nombre || "Sin Asignar"}</strong>
            </span>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-3 self-stretch md:self-auto justify-end">
          <div className="bg-slate-900/80 backdrop-blur-md px-4 py-3 rounded-2xl text-center border border-slate-700/80 w-full sm:w-auto">
            <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider mb-1">
              Biometría Facial
            </span>
            {facialEnrolled ? (
              <Badge className="bg-brand-accent text-slate-950 font-bold text-xs hover:bg-brand-accent flex items-center justify-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Enrolado
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[#F5A623] border-[#F5A623]/50 text-xs flex items-center justify-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Pendiente
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* PESTAÑAS PRINCIPALES (SIN EMOJIS, CON ICONOS REFINADOS) */}
      <Tabs defaultValue="marcajes" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 max-w-3xl bg-slate-200/80 p-1.5 rounded-2xl gap-1">
          <TabsTrigger value="marcajes" className="text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 py-2">
            <Clock className="h-3.5 w-3.5 text-brand-primary" />
            Marcaje
          </TabsTrigger>
          <TabsTrigger value="horarios" className="text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 py-2">
            <Calendar className="h-3.5 w-3.5 text-[#F5A623]" />
            Mi Horario
          </TabsTrigger>
          <TabsTrigger value="biometria" className="text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 py-2">
            <Camera className="h-3.5 w-3.5 text-brand-accent" />
            Biometría
          </TabsTrigger>
          <TabsTrigger value="lms" className="text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 py-2">
            <BookOpen className="h-3.5 w-3.5 text-brand-primary" />
            Cursos ({cursos.length})
          </TabsTrigger>
          <TabsTrigger value="seguridad" className="text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 py-2">
            <KeyRound className="h-3.5 w-3.5 text-slate-600" />
            Seguridad
          </TabsTrigger>
        </TabsList>

        {/* 1. SECCIÓN DE MARCAJE CON GEOCERCA */}
        <TabsContent value="marcajes" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 shadow-sm rounded-3xl border-slate-200/90 overflow-hidden">
              <CardHeader className="bg-slate-50/70 border-b border-slate-100 p-5">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
                  <Clock className="h-5 w-5 text-brand-primary" />
                  Registro de Asistencia en Tiempo Real
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Marcaje validado contra la geocerca de tu sede asignada:{" "}
                  <strong>{user?.sede?.nombre || "Sede por defecto"}</strong> (tolerancia: {user?.sede?.radio_metros || 100}m).
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6 p-5 sm:p-6">
                {/* ESTADO DEL GPS */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-blue-50 text-brand-primary flex items-center justify-center flex-shrink-0">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Estado de Ubicación GPS</p>
                      {coords ? (
                        <p className="text-[11px] text-slate-600 font-mono">
                          Lat: {coords.latitud.toFixed(4)}, Lon: {coords.longitud.toFixed(4)}
                        </p>
                      ) : (
                        <p className="text-[11px] text-[#F5A623] font-medium">
                          {gpsCargando ? "Detectando satélites GPS..." : gpsError || "Obteniendo coordenadas..."}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={obtenerUbicacion}
                    disabled={gpsCargando}
                    className="text-xs rounded-xl self-end sm:self-auto border-slate-200"
                  >
                    {gpsCargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Actualizar GPS"}
                  </Button>
                </div>

                {/* BOTONES DE MARCAJE (DISEÑO BOCO) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* ENTRADA */}
                  <Button
                    onClick={() => ejecutarMarcaje('entrada')}
                    disabled={marcajeLoading || estadoHoy.entradaRegistrada}
                    className={`h-24 rounded-2xl flex flex-col items-center justify-center gap-1.5 shadow-md transition-all ${
                      estadoHoy.entradaRegistrada
                        ? "bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed shadow-none"
                        : "bg-brand-dark hover:bg-brand-dark-hover text-white shadow-brand-dark/20"
                    }`}
                  >
                    <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${
                      estadoHoy.entradaRegistrada ? "bg-emerald-100 text-emerald-700" : "bg-brand-accent text-slate-950"
                    }`}>
                      {estadoHoy.entradaRegistrada ? <CheckCircle2 className="h-5 w-5" /> : <LogInIcon className="h-5 w-5" />}
                    </div>
                    <span className="text-sm font-bold">
                      {estadoHoy.entradaRegistrada
                        ? `Entrada: ${marcajeHoy?.hora_entrada ? new Date(marcajeHoy.hora_entrada).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Registrada'}`
                        : "Marcar Entrada"}
                    </span>
                    <span className="text-[11px] opacity-75">
                      {estadoHoy.entradaRegistrada ? "Completado para hoy" : "Validar geocerca en sede"}
                    </span>
                  </Button>

                  {/* SALIDA */}
                  <Button
                    onClick={() => ejecutarMarcaje('salida')}
                    disabled={marcajeLoading || !estadoHoy.entradaRegistrada || estadoHoy.salidaRegistrada}
                    className={`h-24 rounded-2xl flex flex-col items-center justify-center gap-1.5 shadow-md transition-all ${
                      estadoHoy.salidaRegistrada
                        ? "bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed shadow-none"
                        : estadoHoy.entradaRegistrada
                        ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20"
                        : "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none"
                    }`}
                  >
                    <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${
                      estadoHoy.salidaRegistrada ? "bg-rose-100 text-rose-700" : "bg-white/20 text-white"
                    }`}>
                      {estadoHoy.salidaRegistrada ? <CheckCircle2 className="h-5 w-5" /> : <LogOutIcon className="h-5 w-5" />}
                    </div>
                    <span className="text-sm font-bold">
                      {estadoHoy.salidaRegistrada
                        ? `Salida: ${marcajeHoy?.hora_salida ? new Date(marcajeHoy.hora_salida).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Registrada'}`
                        : "Marcar Salida"}
                    </span>
                    <span className="text-[11px] opacity-75">
                      {estadoHoy.salidaRegistrada ? "Turno completado" : "Cierre de turno"}
                    </span>
                  </Button>
                </div>

                {/* DETALLE RESUMEN DEL DÍA SI YA TIENE REGISTRO */}
                {marcajeHoy && (
                  <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-200 text-xs text-teal-900 space-y-2">
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-teal-700" />
                        Registro Activo de Hoy ({marcajeHoy.fecha})
                      </span>
                      <Badge className="bg-teal-700 text-white uppercase text-[10px]">
                        {marcajeHoy.estado || "PRESENTE"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                      <div className="p-2 bg-white rounded-xl border border-teal-100">
                        <span className="text-[10px] text-slate-400 block font-sans">Entrada</span>
                        <strong>{marcajeHoy.hora_entrada ? new Date(marcajeHoy.hora_entrada).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}</strong>
                      </div>
                      <div className="p-2 bg-white rounded-xl border border-teal-100">
                        <span className="text-[10px] text-slate-400 block font-sans">Almuerzo</span>
                        <strong>{marcajeHoy.tomo_almuerzo ? (marcajeHoy.hora_inicio_almuerzo ? "Tomado" : "Pendiente") : "Continua"}</strong>
                      </div>
                      <div className="p-2 bg-white rounded-xl border border-teal-100">
                        <span className="text-[10px] text-slate-400 block font-sans">Salida</span>
                        <strong>{marcajeHoy.hora_salida ? new Date(marcajeHoy.hora_salida).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Pendiente"}</strong>
                      </div>
                      <div className="p-2 bg-white rounded-xl border border-teal-100">
                        <span className="text-[10px] text-slate-400 block font-sans">Horas Total</span>
                        <strong>{marcajeHoy.horas_trabajadas_totales ? `${marcajeHoy.horas_trabajadas_totales}h` : "En curso"}</strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* CONTROL DE ALMUERZO / HORA DE NO ALMUERZO */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-amber-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Coffee className="h-5 w-5 text-amber-600" />
                      <span className="text-xs font-bold text-slate-800">Control de Almuerzo</span>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tomoAlmuerzo}
                        onChange={(e) => setTomoAlmuerzo(e.target.checked)}
                        className="rounded text-teal-600 focus:ring-teal-500"
                      />
                      <span>Tomó Almuerzo hoy</span>
                    </label>
                  </div>

                  {tomoAlmuerzo ? (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => ejecutarMarcaje('inicio_almuerzo')}
                        disabled={marcajeLoading || !estadoHoy.entradaRegistrada || estadoHoy.almuerzoIniciado}
                        className="rounded-xl text-xs h-10 border-amber-300 hover:bg-amber-100 text-amber-900 font-semibold flex items-center justify-center gap-1.5"
                      >
                        {estadoHoy.almuerzoIniciado ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            Almuerzo Iniciado
                          </>
                        ) : (
                          "Iniciar Almuerzo"
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => ejecutarMarcaje('fin_almuerzo')}
                        disabled={marcajeLoading || !estadoHoy.almuerzoIniciado || estadoHoy.almuerzoFinalizado}
                        className="rounded-xl text-xs h-10 border-amber-300 hover:bg-amber-100 text-amber-900 font-semibold flex items-center justify-center gap-1.5"
                      >
                        {estadoHoy.almuerzoFinalizado ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            Almuerzo Terminado
                          </>
                        ) : (
                          "Terminar Almuerzo"
                        )}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 italic">
                      Se ha marcado como jornada continua (sin deducción de tiempo de almuerzo).
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* RESUMEN LATERAL */}
            <Card className="shadow-sm rounded-2xl border-slate-200">
              <CardHeader>
                <CardTitle className="text-base font-bold text-slate-800">
                  Reglas de Marcaje BOCO
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-xs text-slate-600">
                <div className="flex gap-2">
                  <ShieldCheck className="h-4 w-4 text-teal-600 flex-shrink-0 mt-0.5" />
                  <p>
                    <strong>Geocerca Obligatoria:</strong> El sistema calcula en metros la distancia a tu sede. Si estás fuera del radio asignado, el marcaje queda bloqueado.
                  </p>
                </div>
                <div className="flex gap-2">
                  <CheckCircle2 className="h-4 w-4 text-teal-600 flex-shrink-0 mt-0.5" />
                  <p>
                    <strong>Horas Extras:</strong> Cualquier labor posterior a las 8 horas reglamentarias computa automáticamente a tu banco de horas.
                  </p>
                </div>
                <div className="flex gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p>
                    <strong>Faltas o Retardos:</strong> Si tienes un imprevisto justificable, coordina con tu Asignador para programar la reposición de horas.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 2. SECCIÓN DE HORARIOS DE LA SEMANA */}
        <TabsContent value="horarios" className="mt-6">
          <Card className="shadow-sm rounded-2xl border-slate-200 overflow-hidden">
            <CardHeader className="bg-slate-900 text-white p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-teal-400" />
                  Mi Horario Semanal Asignado
                </CardTitle>
                <CardDescription className="text-xs text-slate-300">
                  Planificación semanal asignada por tu supervisor. Cualquier cambio en eventos o turnos te notificará por WhatsApp.
                </CardDescription>
              </div>

              {/* TOTAL DE HORAS SEMANALES */}
              <div className="bg-slate-800 border border-slate-700 px-4 py-2 rounded-2xl text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Total Horas Semanales
                </span>
                <span className="text-lg font-extrabold text-amber-400 font-mono">
                  {turnosColab.reduce((acc, t) => {
                    if (t.es_dia_descanso || !t.hora_entrada || !t.hora_salida) return acc;
                    const [h1, m1] = t.hora_entrada.split(":").map(Number);
                    const [h2, m2] = t.hora_salida.split(":").map(Number);
                    let min = (h2 * 60 + m2) - (h1 * 60 + m1);
                    if (min < 0) min += 24 * 60;
                    return acc + min / 60;
                  }, 0).toFixed(1)}h
                </span>
              </div>
            </CardHeader>

            <CardContent className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {Array.from({ length: 7 }, (_, i) => {
                  const hoy = new Date();
                  const dia = hoy.getDay();
                  const diff = hoy.getDate() - dia + (dia === 0 ? -6 : 1);
                  const f = new Date(hoy);
                  f.setDate(diff + i);
                  const fechaIso = f.toISOString().slice(0, 10);
                  const nombres = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
                  const diaNombre = nombres[i];
                  const displayFecha = `${f.getDate()}/${f.getMonth() + 1}`;

                  const turno = turnosColab.find((t) => t.fecha === fechaIso);
                  const esDescanso = turno?.es_dia_descanso;
                  const tieneNota = Boolean(turno?.notas?.trim());
                  const esOffAmarillo = esDescanso && turno?.notas?.toLowerCase().includes("off");

                  return (
                    <div
                      key={fechaIso}
                      className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between min-h-[140px] ${
                        esDescanso
                          ? esOffAmarillo
                            ? "bg-yellow-100 border-yellow-300 text-slate-900"
                            : "bg-slate-950 border-slate-900 text-white"
                          : "bg-white border-slate-200 hover:border-teal-400 hover:shadow-md"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between border-b pb-1.5 mb-2 border-slate-200/50">
                          <span className={`text-xs font-bold ${esDescanso && !esOffAmarillo ? 'text-white' : 'text-slate-800'}`}>
                            {diaNombre}
                          </span>
                          <span className={`text-[10px] font-mono ${esDescanso && !esOffAmarillo ? 'text-slate-400' : 'text-slate-500'}`}>
                            {displayFecha}
                          </span>
                        </div>

                        {esDescanso ? (
                          <div className="text-center py-4">
                            <span className="text-sm font-extrabold uppercase block tracking-wider">
                              {turno?.notas || "Día OFF"}
                            </span>
                            <span className="text-[10px] opacity-75">Descanso programado</span>
                          </div>
                        ) : turno ? (
                          <div className="space-y-1.5">
                            <div className="text-xs font-mono font-bold text-slate-800">
                              {turno.hora_entrada?.slice(0, 5)} - {turno.hora_salida?.slice(0, 5)}
                            </div>
                            {tieneNota && (
                              <Badge className="bg-[#6b21a8] text-white text-[10px] font-bold px-2 py-0.5">
                                {turno.notas}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-slate-400 text-[11px] italic">
                            Por programar
                          </div>
                        )}
                      </div>

                      {!esDescanso && turno && (
                        <div className="pt-2 border-t border-slate-100 text-[10px] text-teal-700 font-medium">
                          Tolerancia: 15 min
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. SECCIÓN DE ENROLAMIENTO FACIAL */}
        <TabsContent value="biometria" className="mt-6">
          <Card className="max-w-xl mx-auto shadow-sm rounded-2xl border-slate-200">
            <CardHeader className="text-center">
              <CardTitle className="text-lg font-bold text-slate-800">
                Enrolamiento Biométrico Facial
              </CardTitle>
              <CardDescription className="text-xs">
                Registra tu rostro para poder autenticarte rápidamente sin necesidad de escribir contraseñas.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-4">
              <div className="relative w-full aspect-video bg-slate-900 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-200 shadow-inner">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${camaraActiva ? 'block' : 'hidden'}`}
                />
                {!camaraActiva && (
                  <div className="flex flex-col items-center text-slate-400 p-6 text-center">
                    <Camera className="h-12 w-12 mb-2 opacity-50" />
                    <p className="text-xs">Cámara apagada</p>
                  </div>
                )}
                {enrolando && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white">
                    <Loader2 className="h-8 w-8 animate-spin text-teal-400 mb-2" />
                    <p className="text-xs">Procesando descriptor biométrico (128D)...</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 w-full">
                {!camaraActiva ? (
                  <Button
                    onClick={iniciarCamaraEnrolamiento}
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs h-11"
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    Encender Cámara para Enrolamiento
                  </Button>
                ) : (
                  <Button
                    onClick={capturarYEnrolar}
                    disabled={enrolando}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs h-11 font-bold shadow-md shadow-emerald-600/20"
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Capturar y Guardar Rostro
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. SECCIÓN DEL SISTEMA DE APRENDIZAJE (LMS) */}
        <TabsContent value="lms" className="mt-6">
          {!cursoActivo ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    Cursos Asignados a mi Puesto ({user?.puesto?.nombre || "General"})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Material formativo exclusivo subido y asignado por Recursos Humanos.
                  </p>
                </div>
              </div>

              {cursos.length === 0 ? (
                <Card className="rounded-2xl p-8 text-center text-slate-500">
                  <BookOpen className="h-12 w-12 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-semibold">No tienes capacitaciones pendientes</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Recursos Humanos te notificará cuando haya un nuevo manual o protocolo asignado para tu puesto.
                  </p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {cursos.map((c) => (
                    <Card key={c.id} className="rounded-2xl border-slate-200 hover:shadow-md transition-all flex flex-col justify-between">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="bg-teal-50 text-teal-800 text-[10px]">
                            {user?.puesto?.nombre || "Capacitación"}
                          </Badge>
                          {c.avance?.aprobado && (
                            <Badge className="bg-emerald-600 text-white text-[10px]">Aprobado ✅</Badge>
                          )}
                        </div>
                        <CardTitle className="text-base font-bold text-slate-800 mt-2">
                          {c.titulo}
                        </CardTitle>
                        <CardDescription className="text-xs line-clamp-2">
                          {c.descripcion || "Manual y lineamientos operativos de BOCO."}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-2">
                        <div className="text-[11px] text-slate-500 mb-3 flex items-center justify-between">
                          <span>Tiempo mín. lectura: {Math.ceil(c.tiempo_minimo_lectura_segundos / 60)} min</span>
                          <span>Calif. mínima: {c.puntuacion_minima_aprobacion}%</span>
                        </div>
                        <Button
                          onClick={() => {
                            setCursoActivo(c);
                            setSegundosLectura(c.avance?.segundos_lectura_reales || 0);
                            setTiempoCumplido(c.avance?.lectura_completada || false);
                            setEnEvaluacion(false);
                            setResultadoTest(null);
                          }}
                          className="w-full bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs h-10 font-semibold"
                        >
                          Iniciar Curso
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* DETALLE DEL CURSO Y SISTEMA DE LECTURA PROTEGIDA */
            <div className="space-y-6">
              <Button
                variant="ghost"
                onClick={() => setCursoActivo(null)}
                className="text-xs text-slate-600 hover:text-slate-900 mb-2"
              >
                ← Volver al listado de cursos
              </Button>

              <Card className="rounded-2xl border-slate-200">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <Badge className="bg-teal-600 text-white text-xs mb-1">
                        Puesto: {user?.puesto?.nombre || "General"}
                      </Badge>
                      <CardTitle className="text-2xl font-bold text-slate-800">
                        {cursoActivo.titulo}
                      </CardTitle>
                    </div>

                    {/* CONTADOR DE SEGURIDAD ANTI-TRAMPAS */}
                    <div className="bg-slate-100 p-3 rounded-2xl flex items-center gap-3 border border-slate-200">
                      <Clock className="h-6 w-6 text-teal-600 animate-pulse" />
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-bold block">
                          Temporizador de Seguridad
                        </span>
                        <span className="text-sm font-extrabold text-slate-800">
                          {segundosLectura}s / {cursoActivo.tiempo_minimo_lectura_segundos}s
                        </span>
                      </div>
                    </div>
                  </div>

                  <Progress
                    value={Math.min(100, (segundosLectura / (cursoActivo.tiempo_minimo_lectura_segundos || 60)) * 100)}
                    className="h-2 mt-3"
                  />
                  {!tiempoCumplido && (
                    <p className="text-[11px] text-amber-700 mt-1 flex items-center gap-1">
                      <Lock className="h-3.5 w-3.5" />
                      Debes leer atentamente el material. La evaluación de IA se desbloqueará al completar el tiempo obligatorio.
                    </p>
                  )}
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* TEXTO DEL MATERIAL DE RRHH */}
                  <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 prose prose-slate max-w-none text-slate-700 text-sm whitespace-pre-wrap leading-relaxed">
                    {cursoActivo.contenido_texto}
                  </div>

                  {cursoActivo.video_url && (
                    <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200 text-xs">
                      <strong>Video formativo de referencia:</strong>{" "}
                      <a href={cursoActivo.video_url} target="_blank" rel="noreferrer" className="text-teal-700 underline font-semibold">
                        Ver video del protocolo aquí
                      </a>
                    </div>
                  )}

                  {/* BOTÓN PARA ABRIR EVALUACIÓN DE IA */}
                  {!enEvaluacion ? (
                    <div className="pt-4 border-t border-slate-200 flex justify-end">
                      <Button
                        disabled={!tiempoCumplido}
                        onClick={() => setEnEvaluacion(true)}
                        className={`h-12 px-6 rounded-xl font-bold text-xs shadow-lg transition-all ${
                          tiempoCumplido
                            ? "bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/25"
                            : "bg-slate-300 text-slate-500 cursor-not-allowed"
                        }`}
                      >
                        <Sparkles className="mr-2 h-4 w-4" />
                        {tiempoCumplido ? "Comenzar Evaluación de IA (Desbloqueado)" : "Evaluación Bloqueada por Tiempo"}
                      </Button>
                    </div>
                  ) : (
                    /* FORMULARIO DE EVALUACIÓN GENERADA POR IA */
                    <div className="pt-6 border-t border-slate-200 space-y-6">
                      <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 text-purple-900 text-xs flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-purple-600 flex-shrink-0" />
                        <span>
                          <strong>Evaluación Generada por IA:</strong> Selecciona la respuesta correcta en cada reactivo. La justificación de tu respuesta es opcional.
                        </span>
                      </div>

                      {cursoActivo.evaluacion?.preguntas_json?.map((preg: any, idx: number) => (
                        <div key={preg.id} className="p-5 rounded-2xl border border-slate-200 bg-white space-y-3">
                          <p className="text-sm font-bold text-slate-800">
                            {idx + 1}. {preg.pregunta}
                          </p>

                          {/* OPCIONES DE RESPUESTA */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {preg.opciones.map((op: string) => {
                              const seleccionada = respuestasEvaluacion[preg.id]?.seleccion === op;
                              return (
                                <button
                                  key={op}
                                  type="button"
                                  onClick={() =>
                                    setRespuestasEvaluacion((prev) => ({
                                      ...prev,
                                      [preg.id]: {
                                        ...prev[preg.id],
                                        seleccion: op,
                                        justificacion: prev[preg.id]?.justificacion || "",
                                      },
                                    }))
                                  }
                                  className={`p-3 rounded-xl text-xs text-left border transition-all ${
                                    seleccionada
                                      ? "bg-teal-50 border-teal-600 text-teal-900 font-bold"
                                      : "border-slate-200 hover:bg-slate-50 text-slate-700"
                                  }`}
                                >
                                  {op}
                                </button>
                              );
                            })}
                          </div>

                          {/* CAMPO DE JUSTIFICACIÓN OPCIONAL */}
                          <div>
                            <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                              Justifica tu respuesta (Opcional):
                            </label>
                            <Textarea
                              placeholder="Opcional: Si deseas, agrega notas, fundamento o por qué elegiste esta opción..."
                              value={respuestasEvaluacion[preg.id]?.justificacion || ""}
                              onChange={(e) =>
                                setRespuestasEvaluacion((prev) => ({
                                  ...prev,
                                  [preg.id]: {
                                    ...prev[preg.id],
                                    seleccion: prev[preg.id]?.seleccion || "",
                                    justificacion: e.target.value,
                                  },
                                }))
                              }
                              className="text-xs rounded-xl border-slate-300 min-h-[60px]"
                            />
                          </div>
                        </div>
                      ))}

                      {resultadoTest && (
                        <div className={`p-4 rounded-2xl text-xs font-semibold ${resultadoTest.aprobado ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'}`}>
                          {resultadoTest.retroalimentacion}
                        </div>
                      )}

                      <div className="flex justify-end gap-3 pt-2">
                        <Button
                          variant="outline"
                          onClick={() => setEnEvaluacion(false)}
                          className="rounded-xl text-xs"
                        >
                          Cancelar
                        </Button>
                        <Button
                          onClick={enviarEvaluacion}
                          disabled={evaluando}
                          className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold h-11 px-6 shadow-md shadow-teal-600/20"
                        >
                          {evaluando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Enviar Examen para Calificación"}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* 5. SECCIÓN DE SEGURIDAD / CAMBIAR CONTRASEÑA */}
        <TabsContent value="seguridad" className="mt-6">
          <Card className="max-w-md mx-auto rounded-2xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Lock className="h-5 w-5 text-teal-600" />
                Cambiar Mi Contraseña
              </CardTitle>
              <CardDescription className="text-xs">
                Actualiza tu clave de acceso personal para ingresar al sistema BOCO.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCambiarPassword} className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Contraseña Actual
                  </label>
                  <Input
                    type="password"
                    value={passActual}
                    onChange={(e) => setPassActual(e.target.value)}
                    placeholder="••••••••"
                    className="text-xs rounded-xl"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Nueva Contraseña (mínimo 6 caracteres)
                  </label>
                  <Input
                    type="password"
                    value={passNueva}
                    onChange={(e) => setPassNueva(e.target.value)}
                    placeholder="••••••••"
                    className="text-xs rounded-xl"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Confirmar Nueva Contraseña
                  </label>
                  <Input
                    type="password"
                    value={passConfirmar}
                    onChange={(e) => setPassConfirmar(e.target.value)}
                    placeholder="••••••••"
                    className="text-xs rounded-xl"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={cambiandoPass}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs h-11 shadow-md shadow-teal-600/20"
                >
                  {cambiandoPass ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Actualizando contraseña...
                    </>
                  ) : (
                    "Guardar Nueva Contraseña"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

