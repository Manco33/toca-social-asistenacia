"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { loginBoco, enrolarRostroColaborador, verificarRostroUsuarioBoco } from "@/app/boco-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import {
  Camera,
  Loader2,
  ShieldCheck,
  UserCheck,
  AlertTriangle,
  ArrowLeft,
  User,
  Briefcase,
  Calendar,
  Lock,
  ArrowRight,
  Download,
  Globe2,
  Tablet,
} from "lucide-react";
import type { UsuarioBoco } from "@/lib/types";
import Image from "next/image";
import {
  MARCAS,
  MARCAS_OPERATIVAS,
  CLAVE_MARCA_KIOSCO,
  aplicarTemaMarca,
  esMarcaSlug,
  obtenerTema,
  type MarcaSlug,
} from "@/lib/brands";

export function BocoLogin() {
  const router = useRouter();
  const { login } = useAuth();
  const { toast } = useToast();
  const { canInstall, isInstalled, isInstalling, handleInstall } = useInstallPrompt();

  // Paso del flujo: "portada" (pantalla kiosco tablet con la imagen para presionar), "credenciales", "biometria"
  const [paso, setPaso] = useState<"portada" | "credenciales" | "biometria">("portada");
  const [tempUser, setTempUser] = useState<UsuarioBoco | null>(null);
  const [mostrarGuiaAccesoDirecto, setMostrarGuiaAccesoDirecto] = useState(false);

  // Estados de formulario
  const [identificador, setIdentificador] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Marca configurada en esta tablet (kiosco)
  const [marcaKiosco, setMarcaKiosco] = useState<MarcaSlug>("boco");
  useEffect(() => {
    try {
      const guardada = localStorage.getItem(CLAVE_MARCA_KIOSCO);
      if (esMarcaSlug(guardada)) setMarcaKiosco(guardada);
    } catch {}
  }, []);
  const temaKiosco = obtenerTema(marcaKiosco);
  const elegirMarcaKiosco = (slug: MarcaSlug) => {
    setMarcaKiosco(slug);
    aplicarTemaMarca(slug);
    try {
      localStorage.setItem(CLAVE_MARCA_KIOSCO, slug);
    } catch {}
  };

  // Estados de reconocimiento facial
  const [facialLoading, setFacialLoading] = useState(false);
  const [modelosCargados, setModelosCargados] = useState(false);
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [errorCamara, setErrorCamara] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cargar modelos de face-api (solo en cliente)
  const cargarModelosFaceApi = async () => {
    if (modelosCargados) return;
    try {
      setFacialLoading(true);
      const faceapi = await import("@vladmandic/face-api");
      const MODEL_URL = "/models";
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
      setModelosCargados(true);
    } catch (err: any) {
      console.error("Error cargando modelos de reconocimiento facial:", err);
      toast({
        title: "Modelos Biométricos",
        description: "No se pudieron precargar los modelos faciales locales.",
        variant: "destructive",
      });
    } finally {
      setFacialLoading(false);
    }
  };

  const iniciarCamara = async () => {
    setErrorCamara(null);
    try {
      await cargarModelosFaceApi();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCamaraActiva(true);
    } catch (err: any) {
      console.error("Error al iniciar cámara:", err);
      setErrorCamara("No se pudo acceder a la cámara. Revisa los permisos del navegador.");
    }
  };

  const detenerCamara = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCamaraActiva(false);
  };

  useEffect(() => {
    return () => {
      detenerCamara();
    };
  }, []);

  // Descargar / Instalar acceso directo con el icono oficial de BOCO Marcaje
  const handleInstalarAccesoDirecto = async () => {
    if (canInstall) {
      await handleInstall();
      return;
    }
    setMostrarGuiaAccesoDirecto((prev) => !prev);
  };

  // PASO 1: VALIDAR USUARIO Y CONTRASEÑA
  const handleValidarCredenciales = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identificador.trim() || !password) {
      toast({
        title: "Campos requeridos",
        description: "Ingresa tu usuario y contraseña.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      let res = await loginBoco(identificador, password).catch(() => undefined);
      if (!res || typeof res.success !== "boolean") {
        const apiRes = await fetch("/api/boco/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identificador, password }),
        });
        res = await apiRes.json();
      }
      if (res?.success && res.user) {
        // Si es superadmin, puede entrar directo al Centro de Control Nacional
        if (res.user.rol === "superadmin") {
          login(res.user);
          toast({
            title: "Super Administrador BOCO",
            description: `Bienvenido ${res.user.nombre_completo}. Ingresando al panel nacional...`,
          });
          redirigirPorRol(res.user.rol);
          return;
        }

        setTempUser(res.user);
        setPaso("biometria");
        toast({
          title: "Credenciales Válidas",
          description: `Hola ${res.user.nombre_completo}. Paso obligatorio: Validación Facial.`,
        });
        setTimeout(() => {
          iniciarCamara();
        }, 150);
      } else {
        toast({
          title: "Acceso denegado",
          description: res?.error || "Usuario o contraseña incorrectos.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Fallo en la conexión.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // PASO 2: ENROLAR O VERIFICAR ROSTRO OBLIGATORIO
  const handleProcesarFacial = async () => {
    if (!videoRef.current || !tempUser) return;
    setFacialLoading(true);

    try {
      const faceapi = await import("@vladmandic/face-api");
      const deteccion = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!deteccion) {
        toast({
          title: "Rostro no detectado",
          description: "Mira de frente a la cámara con buena iluminación y sin accesorios en el rostro.",
          variant: "destructive",
        });
        setFacialLoading(false);
        return;
      }

      const descriptorArray = Array.from(deteccion.descriptor);

      // CASO A: EL USUARIO NO ESTÁ ENROLADO AÚN -> ENROLARLO AHORA
      if (!tempUser.facial_enrolled) {
        const resEnrol = await enrolarRostroColaborador(tempUser.id, descriptorArray);
        if (resEnrol.success) {
          detenerCamara();
          const userActualizado = { ...tempUser, facial_enrolled: true, facial_descriptor: descriptorArray };
          login(userActualizado);
          toast({
            title: "¡Rostro Enrolado con Éxito!",
            description: "Tu biometría ha sido registrada en BOCO. Ingresando al sistema...",
          });
          redirigirPorRol(tempUser.rol);
        } else {
          toast({
            title: "Error al enrolar",
            description: resEnrol.error || "No se pudo guardar la biometría.",
            variant: "destructive",
          });
        }
        setFacialLoading(false);
        return;
      }

      // CASO B: EL USUARIO YA ESTÁ ENROLADO -> VERIFICAR COINCIDENCIA
      const resVerif = await verificarRostroUsuarioBoco(tempUser.id, descriptorArray);
      if (resVerif.success && resVerif.coincidencia) {
        detenerCamara();
        login(tempUser);
        toast({
          title: "¡Verificación Facial Exitosa!",
          description: `Identidad biométrica confirmada: ${tempUser.nombre_completo}`,
        });
        redirigirPorRol(tempUser.rol);
      } else {
        toast({
          title: "Verificación Fallida",
          description: resVerif.error || "El rostro escaneado no coincide con el perfil del usuario registrado.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Error Biométrico",
        description: err.message || "Fallo al procesar el reconocimiento facial.",
        variant: "destructive",
      });
    } finally {
      setFacialLoading(false);
    }
  };

  const redirigirPorRol = (rol: string) => {
    if (rol === "superadmin") {
      router.push("/dashboard/superadmin");
    } else if (rol === "rrhh") {
      router.push("/dashboard/rrhh");
    } else if (rol === "asignador") {
      router.push("/dashboard/asignador");
    } else {
      router.push("/dashboard");
    }
  };

  const volverACredenciales = () => {
    detenerCamara();
    setTempUser(null);
    setPaso("credenciales");
  };

  return (
    <Card className="w-full max-w-md bg-white/95 backdrop-blur-xl shadow-2xl border-slate-200/90 rounded-3xl overflow-hidden transition-all">
      {/* =========================================================================
          PASO 0 (PORTADA KIOSCO TABLET): IMAGEN GRANDE PARA PRESIONAR Y ENTRAR
      ========================================================================= */}
      {paso === "portada" && (
        <div className="p-6 sm:p-8 flex flex-col items-center text-center space-y-5">
          {temaKiosco.logo && (
            <div
              className="flex items-center justify-center rounded-2xl px-4 h-12 border border-slate-200/70"
              style={{ backgroundColor: temaKiosco.logoFondo }}
            >
              <Image
                src={temaKiosco.logo}
                alt={temaKiosco.nombre}
                width={temaKiosco.logoAncho * 1.3}
                height={40}
                className="object-contain max-h-10 w-auto"
              />
            </div>
          )}

          {/* Botón táctil principal con la imagen oficial de BOCO Marcaje */}
          <button
            type="button"
            onClick={() => setPaso("credenciales")}
            className="group relative flex flex-col items-center focus:outline-none transition-transform active:scale-95 hover:scale-[1.02]"
            title="Presiona para iniciar sesión y marcar asistencia"
          >
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border-2 border-slate-100 group-hover:border-brand-primary/50 transition-all">
              <Image
                src="/boco-marcaje-original.jpg"
                alt="BOCO Marcaje - Presiona para ingresar"
                width={320}
                height={320}
                priority
                className="w-64 sm:w-72 h-auto object-contain select-none"
              />
            </div>
            <span className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand-dark text-white text-xs font-bold uppercase tracking-wider shadow-lg group-hover:bg-brand-dark-hover transition-all">
              Toca la imagen para ingresar
              <ArrowRight className="h-4 w-4 text-brand-accent" />
            </span>
          </button>

          {/* Selector de Marca para la Tablet de cada Sucursal */}
          <div className="w-full pt-3 border-t border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center mb-2">
              Diseño de sucursal en esta Tablet
            </p>
            <div className="grid grid-cols-2 gap-2">
              {MARCAS_OPERATIVAS.map((slug) => {
                const m = MARCAS[slug];
                const activo = marcaKiosco === slug;
                return (
                  <button
                    key={slug}
                    type="button"
                    onClick={() => elegirMarcaKiosco(slug)}
                    className={`h-9 rounded-xl border text-[11px] font-semibold flex items-center justify-center gap-2 transition-all ${
                      activo
                        ? "border-brand-primary bg-brand-primary/10 text-brand-dark font-bold"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: m.hexPrimary }} />
                    {m.nombre}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Botón para Descargar / Poner como Acceso Directo con el ícono de BOCO Marcaje */}
          {!isInstalled && (
            <div className="w-full pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleInstalarAccesoDirecto}
                disabled={isInstalling}
                className="w-full h-10 rounded-xl text-xs font-bold border-slate-300 text-slate-700 hover:bg-slate-100 gap-2"
              >
                <Download className="h-4 w-4 text-brand-primary" />
                {isInstalling ? "Instalando acceso directo..." : "Descargar / Crear Acceso Directo con este Ícono"}
              </Button>

              {mostrarGuiaAccesoDirecto && (
                <div className="mt-2.5 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-left text-[11px] text-slate-600 space-y-1.5">
                  <p className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Tablet className="h-3.5 w-3.5 text-brand-primary" />
                    Cómo fijar el ícono de BOCO Marcaje en la pantalla de la Tablet:
                  </p>
                  <p>• <strong>Android / Chrome:</strong> Toca el menú <strong>⋮</strong> (arriba a la derecha) y selecciona <strong>&ldquo;Instalar aplicación&rdquo;</strong> o <strong>&ldquo;Agregar a la pantalla principal&rdquo;</strong>.</p>
                  <p>• <strong>iPad / Safari:</strong> Toca el botón <strong>Compartir</strong> y elige <strong>&ldquo;Agregar a inicio&rdquo;</strong>.</p>
                  <p>• <strong>PC / Windows:</strong> Haz clic en el ícono de instalación en la barra de direcciones del navegador.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          ENCABEZADO DE LOGIN (PASOS CREDENCIALES Y BIOMETRÍA)
      ========================================================================= */}
      {paso !== "portada" && (
        <CardHeader className="text-center pb-3 pt-6 px-6">
          <div className="flex items-center justify-between mb-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                detenerCamara();
                setTempUser(null);
                setPaso("portada");
              }}
              className="text-xs text-slate-500 hover:text-slate-800 h-8 px-2 rounded-xl"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Portada Tablet
            </Button>
            {temaKiosco.logo && (
              <div
                className="flex items-center justify-center rounded-xl px-2.5 h-8 border border-slate-200/70"
                style={{ backgroundColor: temaKiosco.logoFondo }}
              >
                <Image
                  src={temaKiosco.logo}
                  alt={temaKiosco.nombre}
                  width={temaKiosco.logoAncho}
                  height={26}
                  className="object-contain max-h-6 w-auto"
                />
              </div>
            )}
          </div>

          <div className="flex justify-center mb-2">
            <Image
              src="/boco-marcaje-icon.png"
              alt="BOCO Marcaje"
              width={72}
              height={72}
              priority
              className="rounded-[18px] shadow-md shadow-brand-dark/20 select-none"
            />
          </div>
          <CardTitle className="text-xl font-extrabold tracking-tight text-brand-dark">
            {temaKiosco.slug === "boco" ? "BOCO Marcaje" : `${temaKiosco.nombre} · Marcaje`}
          </CardTitle>
          <CardDescription className="text-xs text-slate-500 mt-1">
            Control de asistencia con biometría facial. Ingresa tu usuario y contraseña.
          </CardDescription>
        </CardHeader>
      )}

      {paso !== "portada" && (
        <CardContent className="p-6 pt-2">
          {/* =========================================================================
              PASO 1: USUARIO Y CONTRASEÑA
          ========================================================================= */}
          {paso === "credenciales" && (
            <form onSubmit={handleValidarCredenciales} className="space-y-4">
              <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 font-medium">
                <div className="h-7 w-7 rounded-lg bg-blue-50 text-brand-primary flex items-center justify-center flex-shrink-0">
                  <Lock className="h-4 w-4" />
                </div>
                <span><strong>Paso 1:</strong> Ingresa tu usuario y tu contraseña.</span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Usuario
                </label>
                <Input
                  placeholder="Ej. dlima, sperez, aprod"
                  value={identificador}
                  onChange={(e) => setIdentificador(e.target.value)}
                  className="h-11 rounded-xl border-slate-300 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 font-medium text-sm bg-white"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Contraseña
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 rounded-xl border-slate-300 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 text-sm bg-white"
                  disabled={loading}
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-brand-dark hover:bg-brand-dark-hover text-white font-bold rounded-xl shadow-lg shadow-slate-900/15 transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-brand-accent" />
                    Validando credenciales...
                  </>
                ) : (
                  <>
                    Continuar
                    <ArrowRight className="h-4 w-4 text-brand-primary" />
                  </>
                )}
              </Button>
            </form>
          )}

          {/* =========================================================================
              PASO 2: BIOMETRÍA FACIAL OBLIGATORIA (ENROLAR O VERIFICAR)
          ========================================================================= */}
          {paso === "biometria" && tempUser && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-blue-50/70 border border-blue-200">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">{tempUser.nombre_completo}</span>
                    <span className="text-[11px] text-blue-700 font-mono">@{tempUser.username || tempUser.codigo_rrhh}</span>
                  </div>
                </div>
                {tempUser.facial_enrolled ? (
                  <Badge className="bg-brand-accent text-slate-950 font-bold text-[10px] hover:bg-brand-accent">
                    Verificación
                  </Badge>
                ) : (
                  <Badge className="bg-[#F5A623] text-white font-bold text-[10px] hover:bg-[#F5A623]">
                    Primer Enrolamiento
                  </Badge>
                )}
              </div>

              {/* VISOR DE CÁMARA */}
              <div className="relative w-full aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-slate-300 shadow-inner flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${camaraActiva ? "block" : "hidden"}`}
                />

                {!camaraActiva && !errorCamara && (
                  <div className="flex flex-col items-center text-slate-400 p-4 text-center">
                    <Camera className="h-10 w-10 mb-2 opacity-50 text-blue-400" />
                    <p className="text-xs">Iniciando cámara frontal...</p>
                  </div>
                )}

                {errorCamara && (
                  <div className="flex flex-col items-center text-amber-400 p-4 text-center">
                    <AlertTriangle className="h-8 w-8 mb-2" />
                    <p className="text-xs">{errorCamara}</p>
                  </div>
                )}

                {facialLoading && (
                  <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                    <Loader2 className="h-8 w-8 animate-spin text-brand-accent mb-2" />
                    <p className="text-xs font-semibold">
                      {!tempUser.facial_enrolled ? "Registrando vector biométrico..." : "Comparando rasgos faciales..."}
                    </p>
                  </div>
                )}
              </div>

              <p className="text-center text-[11px] text-slate-500">
                {!tempUser.facial_enrolled
                  ? "Mira a la cámara para registrar tu perfil facial institucional por primera vez."
                  : "Mira a la cámara para validar tu identidad con tus rasgos biométricos."}
              </p>

              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  disabled={facialLoading || !camaraActiva}
                  onClick={handleProcesarFacial}
                  className="w-full h-11 bg-brand-dark hover:bg-brand-dark-hover text-white font-bold rounded-xl shadow-lg shadow-slate-900/15 transition-all text-xs flex items-center justify-center gap-2"
                >
                  {!tempUser.facial_enrolled ? (
                    <>
                      <ShieldCheck className="h-4 w-4 text-brand-accent" />
                      Capturar y Enrolar Mi Rostro
                    </>
                  ) : (
                    <>
                      <UserCheck className="h-4 w-4 text-brand-accent" />
                      Verificar Rostro y Entrar
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={volverACredenciales}
                  className="w-full h-9 text-xs text-slate-500 hover:text-slate-800"
                >
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                  Cambiar de usuario
                </Button>
              </div>
            </div>
          )}

          {/* CONFIGURACIÓN DE LA TABLET (MARCA DEL KIOSCO) */}
          {paso === "credenciales" && (
            <div className="mt-5 pt-4 border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center mb-2">
                Esta tablet pertenece a
              </p>
              <div className="grid grid-cols-2 gap-2">
                {MARCAS_OPERATIVAS.map((slug) => {
                  const m = MARCAS[slug];
                  const activo = marcaKiosco === slug;
                  return (
                    <button
                      key={slug}
                      type="button"
                      onClick={() => elegirMarcaKiosco(slug)}
                      className={`h-8 rounded-xl border text-[11px] font-semibold flex items-center justify-center gap-2 transition-all ${
                        activo
                          ? "border-brand-primary bg-brand-primary/10 text-brand-dark"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.hexPrimary }} />
                      {m.nombre}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
