"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  obtenerPanelSuperAdmin,
  obtenerUsuariosBoco,
  obtenerSedesBoco,
  obtenerMarcasBoco,
  obtenerPuestosBoco,
  obtenerMarcajesBoco,
  crearUsuarioBoco,
  crearSedeBoco,
  actualizarSedeBoco,
  actualizarUsuarioBoco,
  actualizarUsuariosMasivo,
  toggleActivarUsuarioBoco,
  restablecerContraseniaBoco,
  siguienteCodigoRRHH,
  type PanelSuperAdmin,
  type ResumenSedeSA,
} from "@/app/boco-actions";
import { exportarReporteCompletoBoco } from "@/lib/excel-export";
import { MARCAS, obtenerTema, type MarcaSlug } from "@/lib/brands";
import type { UsuarioBoco, SedeZona, Marca, DepartamentoPuesto, Role } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Globe2,
  Building2,
  Users,
  ShieldCheck,
  MapPin,
  PlusCircle,
  Pencil,
  KeyRound,
  Search,
  Loader2,
  AlertTriangle,
  FileSpreadsheet,
  RefreshCw,
  Crosshair,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";

const POR_PAGINA = 40;
const ROLES_ETIQUETA: Record<string, string> = {
  superadmin: "Super Admin",
  rrhh: "RRHH",
  asignador: "Asignador",
  colaborador: "Colaborador",
};

const selectCls = "w-full text-xs rounded-xl border border-slate-300 p-2 bg-white";
const labelCls = "text-[11px] font-bold text-slate-700 block mb-1";

function LogoMarca({ slug, className = "" }: { slug?: string | null; className?: string }) {
  const t = obtenerTema(slug);
  if (!t.logo) return null;
  return (
    <div
      className={`flex items-center justify-center rounded-xl px-2 h-9 shrink-0 border border-slate-200/70 ${className}`}
      style={{ backgroundColor: t.logoFondo }}
    >
      <Image src={t.logo} alt={t.nombre} width={t.logoAncho} height={28} className="object-contain max-h-7 w-auto" />
    </div>
  );
}

interface FormUsuario {
  modo: "crear" | "editar";
  id?: string;
  username: string;
  codigo_rrhh: string;
  nombre_completo: string;
  email: string;
  telefono: string;
  rol: Role;
  sede_id: string;
  puesto_id: string;
  asignador_id: string;
  password: string;
}

const formUsuarioVacio = (rol: Role = "colaborador", sede_id = ""): FormUsuario => ({
  modo: "crear",
  username: "",
  codigo_rrhh: "",
  nombre_completo: "",
  email: "",
  telefono: "",
  rol,
  sede_id,
  puesto_id: "",
  asignador_id: "",
  password: "Boco2026#",
});

interface FormSede {
  id?: string;
  nombre: string;
  codigo: string;
  marca_id: string;
  direccion: string;
  latitud: string;
  longitud: string;
  radio_metros: number;
}

const formSedeVacio = (): FormSede => ({
  nombre: "",
  codigo: "",
  marca_id: "",
  direccion: "",
  latitud: "",
  longitud: "",
  radio_metros: 100,
});

export function BocoSuperAdminDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [panel, setPanel] = useState<PanelSuperAdmin | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioBoco[]>([]);
  const [sedes, setSedes] = useState<SedeZona[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [puestos, setPuestos] = useState<DepartamentoPuesto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [pestana, setPestana] = useState("operacion");

  // Filtros de colaboradores
  const [filtroMarca, setFiltroMarca] = useState("todas");
  const [filtroSede, setFiltroSede] = useState("todas");
  const [filtroRol, setFiltroRol] = useState("colaborador");
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());

  // Acción masiva
  const [masivaSede, setMasivaSede] = useState("");
  const [masivaAsignador, setMasivaAsignador] = useState("");
  const [masivaPuesto, setMasivaPuesto] = useState("");
  const [aplicandoMasiva, setAplicandoMasiva] = useState(false);

  // Diálogos
  const [formUsuario, setFormUsuario] = useState<FormUsuario | null>(null);
  const [guardandoUsuario, setGuardandoUsuario] = useState(false);
  const [formSede, setFormSede] = useState<FormSede | null>(null);
  const [guardandoSede, setGuardandoSede] = useState(false);
  const [detectandoGps, setDetectandoGps] = useState(false);

  const cargar = async () => {
    if (!user) return;
    setCargando(true);
    try {
      const [p, u, s, m, pu] = await Promise.all([
        obtenerPanelSuperAdmin(user.id),
        obtenerUsuariosBoco(),
        obtenerSedesBoco(),
        obtenerMarcasBoco(),
        obtenerPuestosBoco(),
      ]);
      if (p.success && p.panel) setPanel(p.panel);
      else if (p.error) toast({ title: "No se pudo cargar el panel", description: p.error, variant: "destructive" });
      setUsuarios(u);
      setSedes(s);
      setMarcas(m);
      setPuestos(pu);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (user?.id) cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const sedesOrdenadas = useMemo(
    () =>
      [...sedes].sort((a, b) =>
        `${a.marca?.nombre || "zz"} ${a.nombre}`.localeCompare(`${b.marca?.nombre || "zz"} ${b.nombre}`)
      ),
    [sedes]
  );
  const sedeNombre = (id?: string | null) => sedes.find((s) => s.id === id)?.nombre || "Sin sede";
  const asignadores = useMemo(() => usuarios.filter((u) => u.rol === "asignador" && u.activo), [usuarios]);

  // ---------------------------------------------------------------- Colaboradores
  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return usuarios.filter((u) => {
      if (u.rol === "superadmin") return false;
      if (filtroRol !== "todos" && u.rol !== filtroRol) return false;
      if (filtroMarca !== "todas" && u.sede?.marca?.slug !== filtroMarca) return false;
      if (filtroSede === "sin_sede" && u.sede_id) return false;
      if (filtroSede !== "todas" && filtroSede !== "sin_sede" && u.sede_id !== filtroSede) return false;
      if (soloPendientes && !(!u.sede_id || (u.rol === "colaborador" && (!u.asignador_id || !u.puesto_id)))) return false;
      if (q) {
        const texto = `${u.nombre_completo} ${u.codigo_rrhh || ""} ${u.username}`.toLowerCase();
        if (!texto.includes(q)) return false;
      }
      return true;
    });
  }, [usuarios, filtroRol, filtroMarca, filtroSede, soloPendientes, busqueda]);

  useEffect(() => setPagina(1), [filtroRol, filtroMarca, filtroSede, soloPendientes, busqueda]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const visibles = filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
  const todosVisiblesMarcados = visibles.length > 0 && visibles.every((u) => seleccion.has(u.id));

  const alternarSeleccion = (id: string) =>
    setSeleccion((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const alternarTodosVisibles = () =>
    setSeleccion((prev) => {
      const n = new Set(prev);
      if (todosVisiblesMarcados) visibles.forEach((u) => n.delete(u.id));
      else visibles.forEach((u) => n.add(u.id));
      return n;
    });

  const aplicarMasiva = async () => {
    if (!user) return;
    const campos: { sede_id?: string | null; asignador_id?: string | null; puesto_id?: string | null } = {};
    if (masivaSede) campos.sede_id = masivaSede;
    if (masivaAsignador) campos.asignador_id = masivaAsignador === "__ninguno" ? null : masivaAsignador;
    if (masivaPuesto) campos.puesto_id = masivaPuesto;
    if (Object.keys(campos).length === 0) {
      toast({ title: "Elige qué asignar", description: "Selecciona sede, asignador o puesto.", variant: "destructive" });
      return;
    }
    setAplicandoMasiva(true);
    const res = await actualizarUsuariosMasivo(user.id, Array.from(seleccion), campos);
    setAplicandoMasiva(false);
    if (res.success) {
      toast({ title: "Asignación aplicada", description: `${res.total} colaboradores actualizados.` });
      setSeleccion(new Set());
      setMasivaSede("");
      setMasivaAsignador("");
      setMasivaPuesto("");
      cargar();
    } else {
      toast({ title: "No se pudo aplicar", description: res.error, variant: "destructive" });
    }
  };

  // ---------------------------------------------------------------- Usuario (crear / editar)
  const abrirCrearUsuario = (rol: Role = "colaborador", sede_id = "") => setFormUsuario(formUsuarioVacio(rol, sede_id));

  const abrirEditarUsuario = (u: UsuarioBoco) =>
    setFormUsuario({
      modo: "editar",
      id: u.id,
      username: u.username,
      codigo_rrhh: u.codigo_rrhh || "",
      nombre_completo: u.nombre_completo,
      email: u.email || "",
      telefono: u.telefono || "",
      rol: u.rol,
      sede_id: u.sede_id || "",
      puesto_id: u.puesto_id || "",
      asignador_id: u.asignador_id || "",
      password: "",
    });

  const sugerirUsernameDesdeNombre = (nombreCompleto: string): string => {
    const limpio = nombreCompleto
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .trim();
    if (!limpio) return "";
    const partes = limpio.split(/\s+/).filter(Boolean);
    if (partes.length === 1) return partes[0];
    if (partes.length === 2) return `${partes[0][0]}${partes[1]}`;
    if (partes.length === 3) return `${partes[0][0]}${partes[1]}`;
    // 4 o más palabras (2 nombres + 2 apellidos): inicial del 1er nombre + penúltima palabra (1er apellido)
    return `${partes[0][0]}${partes[partes.length - 2]}`;
  };

  const sugerirCodigo = async (sedeId: string) => {
    if (!sedeId) return;
    const codigo = await siguienteCodigoRRHH(sedeId);
    setFormUsuario((f) => (f ? { ...f, codigo_rrhh: codigo } : f));
  };

  const guardarUsuario = async () => {
    if (!user || !formUsuario) return;
    const f = formUsuario;
    if (!f.nombre_completo.trim()) {
      toast({ title: "Falta el nombre", variant: "destructive" });
      return;
    }
    setGuardandoUsuario(true);
    try {
      if (f.modo === "crear") {
        if (!f.username.trim() || !f.password) {
          toast({ title: "Faltan datos", description: "Usuario y contraseña inicial son obligatorios.", variant: "destructive" });
          return;
        }
        if (f.rol === "rrhh" && !f.sede_id) {
          toast({ title: "Falta la sede", description: "Todo usuario de RRHH debe pertenecer a una sede.", variant: "destructive" });
          return;
        }
        const res = await crearUsuarioBoco(
          {
            username: f.username,
            codigo_rrhh: f.codigo_rrhh,
            nombre_completo: f.nombre_completo,
            email: f.email,
            password_hash: f.password,
            telefono: f.telefono,
            rol: f.rol,
            puesto_id: f.puesto_id || undefined,
            sede_id: f.sede_id || undefined,
            asignador_id: f.asignador_id || undefined,
          },
          user.id
        );
        if (!res.success) {
          toast({ title: "No se pudo crear", description: res.error, variant: "destructive" });
          return;
        }
        toast({ title: "Usuario creado", description: `${f.nombre_completo} (${ROLES_ETIQUETA[f.rol]}).` });
      } else if (f.id) {
        const res = await actualizarUsuarioBoco(user.id, f.id, {
          username: f.username,
          codigo_rrhh: f.codigo_rrhh,
          nombre_completo: f.nombre_completo,
          email: f.email,
          telefono: f.telefono,
          rol: f.rol,
          sede_id: f.sede_id || null,
          puesto_id: f.puesto_id || null,
          asignador_id: f.rol === "colaborador" ? f.asignador_id || null : null,
        });
        if (!res.success) {
          toast({ title: "No se pudo guardar", description: res.error, variant: "destructive" });
          return;
        }
        toast({ title: "Cambios guardados", description: f.nombre_completo });
      }
      setFormUsuario(null);
      cargar();
    } finally {
      setGuardandoUsuario(false);
    }
  };

  const alternarActivo = async (u: UsuarioBoco) => {
    if (!user) return;
    const res = await toggleActivarUsuarioBoco(u.id, !u.activo, user.id);
    if (res.success) {
      toast({ title: u.activo ? "Usuario desactivado" : "Usuario activado", description: u.nombre_completo });
      cargar();
    } else toast({ title: "Error", description: res.error, variant: "destructive" });
  };

  const restablecerClave = async (u: UsuarioBoco) => {
    if (!user) return;
    if (!window.confirm(`¿Restablecer la contraseña de ${u.nombre_completo} a la inicial (Boco2026#)?`)) return;
    const res = await restablecerContraseniaBoco(user.id, u.id);
    toast(
      res.success
        ? { title: "Contraseña restablecida", description: "Ahora es Boco2026#. Pídele que la cambie al ingresar." }
        : { title: "Error", description: res.error, variant: "destructive" }
    );
  };

  // ---------------------------------------------------------------- Sede (crear / editar)
  const abrirEditarSede = (s: SedeZona) =>
    setFormSede({
      id: s.id,
      nombre: s.nombre,
      codigo: s.codigo || "",
      marca_id: s.marca_id || "",
      direccion: s.direccion || "",
      latitud: String(s.latitud),
      longitud: String(s.longitud),
      radio_metros: s.radio_metros,
    });

  const usarGpsActual = () => {
    if (!navigator.geolocation) {
      toast({ title: "GPS no disponible", variant: "destructive" });
      return;
    }
    setDetectandoGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormSede((f) =>
          f ? { ...f, latitud: pos.coords.latitude.toFixed(6), longitud: pos.coords.longitude.toFixed(6) } : f
        );
        setDetectandoGps(false);
        toast({ title: "Ubicación detectada", description: `Precisión aprox. ${Math.round(pos.coords.accuracy)} m` });
      },
      () => {
        setDetectandoGps(false);
        toast({ title: "No se pudo obtener el GPS", description: "Escribe las coordenadas a mano.", variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const guardarSede = async () => {
    if (!user || !formSede) return;
    const f = formSede;
    const lat = parseFloat(f.latitud);
    const lng = parseFloat(f.longitud);
    if (!f.nombre.trim() || Number.isNaN(lat) || Number.isNaN(lng)) {
      toast({ title: "Datos incompletos", description: "Nombre, latitud y longitud son obligatorios.", variant: "destructive" });
      return;
    }
    setGuardandoSede(true);
    try {
      const res = f.id
        ? await actualizarSedeBoco(user.id, f.id, {
            nombre: f.nombre,
            codigo: f.codigo,
            marca_id: f.marca_id || null,
            direccion: f.direccion,
            latitud: lat,
            longitud: lng,
            radio_metros: f.radio_metros,
          })
        : await crearSedeBoco(
            {
              nombre: f.nombre,
              codigo: f.codigo,
              marca_id: f.marca_id || undefined,
              direccion: f.direccion,
              latitud: lat,
              longitud: lng,
              radio_metros: f.radio_metros,
            },
            user.id
          );
      if (!res.success) {
        toast({ title: "No se pudo guardar la sede", description: res.error, variant: "destructive" });
        return;
      }
      toast({ title: f.id ? "Sede actualizada" : "Sede creada", description: `${f.nombre} · geocerca de ${f.radio_metros} m` });
      setFormSede(null);
      cargar();
    } finally {
      setGuardandoSede(false);
    }
  };

  const descargarExcel = async () => {
    const marcajes = await obtenerMarcajesBoco();
    exportarReporteCompletoBoco({
      colaboradores: usuarios.filter((u) => u.rol !== "superadmin"),
      marcajes,
      nombreArchivo: `Reporte_Nacional_BOCO_${new Date().toISOString().slice(0, 10)}.xlsx`,
    });
  };

  const usuariosRrhh = usuarios.filter((u) => u.rol === "rrhh");
  const t = panel?.totales;

  // ==============================================================================
  // RENDER
  // ==============================================================================
  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* ENCABEZADO */}
      <div className="bg-brand-dark rounded-3xl p-6 sm:p-7 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-brand-primary/25 via-brand-accent/15 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-2">
          <span className="text-[11px] uppercase font-bold tracking-widest text-brand-accent flex items-center gap-1.5">
            <Globe2 className="h-3.5 w-3.5" /> Centro de Control Nacional
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Super Administrador BOCO</h1>
          <p className="text-xs text-slate-300 max-w-2xl">
            Marcas, sucursales, equipos de Recursos Humanos e IDs de todos los colaboradores del país en un solo lugar.
          </p>
        </div>
        <div className="relative z-10 flex flex-wrap gap-2">
          <Button
            onClick={cargar}
            variant="outline"
            className="bg-white/10 border-white/25 text-white hover:bg-white/20 hover:text-white rounded-2xl h-11"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${cargando ? "animate-spin" : ""}`} /> Actualizar
          </Button>
          <Button
            onClick={descargarExcel}
            className="bg-brand-accent hover:bg-brand-accent-hover text-slate-950 rounded-2xl h-11 px-5 font-bold"
          >
            <FileSpreadsheet className="h-5 w-5 mr-2" /> Excel Nacional
          </Button>
        </div>
      </div>

      {/* INDICADORES */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { etiqueta: "Marcas", valor: t?.marcas, icono: Sparkles, alerta: false },
          { etiqueta: "Sucursales", valor: t?.sedes, icono: Building2, alerta: false },
          { etiqueta: "Colaboradores", valor: t?.colaboradores, icono: Users, alerta: false },
          { etiqueta: "Usuarios RRHH", valor: t?.rrhh, icono: ShieldCheck, alerta: false },
          { etiqueta: "Sin asignador", valor: t?.sinAsignador, icono: AlertTriangle, alerta: (t?.sinAsignador || 0) > 0 },
          { etiqueta: "Sedes sin RRHH", valor: t?.sedesSinRrhh, icono: AlertTriangle, alerta: (t?.sedesSinRrhh || 0) > 0 },
        ].map((k) => (
          <div
            key={k.etiqueta}
            className={`bg-white p-4 rounded-2xl border shadow-sm ${k.alerta ? "border-amber-300" : "border-slate-200/80"}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{k.etiqueta}</span>
              <k.icono className={`h-4 w-4 ${k.alerta ? "text-amber-500" : "text-brand-primary"}`} />
            </div>
            <span className="text-2xl font-extrabold text-brand-dark block mt-1">{k.valor ?? "–"}</span>
          </div>
        ))}
      </div>

      {(t?.sedesSinVerificar || 0) > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            <strong>{t?.sedesSinVerificar} sede(s) tienen coordenadas aproximadas.</strong> Mientras no se fije la ubicación real, los
            colaboradores podrían quedar bloqueados por la geocerca. Ve a <em>Sucursales → Editar</em> estando físicamente en la sede y
            pulsa <em>Usar mi ubicación actual</em>.
          </p>
        </div>
      )}

      <Tabs value={pestana} onValueChange={setPestana} className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 max-w-3xl bg-slate-200/80 p-1.5 rounded-2xl gap-1">
          <TabsTrigger value="operacion" className="text-xs font-semibold rounded-xl flex items-center gap-1.5 py-2">
            <Globe2 className="h-3.5 w-3.5 text-brand-primary" /> Operación
          </TabsTrigger>
          <TabsTrigger value="colaboradores" className="text-xs font-semibold rounded-xl flex items-center gap-1.5 py-2">
            <Users className="h-3.5 w-3.5 text-brand-primary" /> Colaboradores
          </TabsTrigger>
          <TabsTrigger value="rrhh" className="text-xs font-semibold rounded-xl flex items-center gap-1.5 py-2">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-primary" /> Usuarios RRHH
          </TabsTrigger>
          <TabsTrigger value="sedes" className="text-xs font-semibold rounded-xl flex items-center gap-1.5 py-2">
            <MapPin className="h-3.5 w-3.5 text-brand-primary" /> Sucursales
          </TabsTrigger>
        </TabsList>

        {/* ============================ OPERACIÓN ============================ */}
        <TabsContent value="operacion" className="mt-6 space-y-6">
          {cargando && !panel && (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-brand-primary" />
            </div>
          )}

          {panel?.marcas.map((m) => {
            const tema = obtenerTema(m.marca.slug);
            return (
              <Card key={m.marca.id} className="rounded-3xl border-slate-200 shadow-sm overflow-hidden bg-white">
                <div className="h-1.5 w-full" style={{ backgroundColor: tema.hexPrimary }} />
                <CardHeader className="flex flex-row items-center justify-between gap-3 p-5 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <LogoMarca slug={m.marca.slug} />
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900">{m.marca.nombre}</CardTitle>
                      <CardDescription className="text-xs">
                        {m.sedes.length} sucursal(es) · {m.totalColaboradores} colaboradores
                      </CardDescription>
                    </div>
                  </div>
                  {m.sedesSinRrhh > 0 && (
                    <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100 text-[10px] font-bold">
                      {m.sedesSinRrhh} sin RRHH
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  {m.sedes.length === 0 ? (
                    <p className="p-5 text-xs text-slate-500">Aún no hay sucursales para esta marca.</p>
                  ) : (
                    <FilasSedes
                      filas={m.sedes}
                      onEditar={abrirEditarSede}
                      onAgregarRrhh={(id) => {
                        abrirCrearUsuario("rrhh", id);
                      }}
                      onVerColaboradores={(id) => {
                        setFiltroSede(id);
                        setFiltroMarca("todas");
                        setFiltroRol("colaborador");
                        setPestana("colaboradores");
                      }}
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}

          {panel && panel.sedesSinMarca.length > 0 && (
            <Card className="rounded-3xl border-slate-200 shadow-sm bg-white overflow-hidden">
              <CardHeader className="p-5 border-b border-slate-100">
                <CardTitle className="text-base font-bold text-slate-900">Sedes sin marca asignada</CardTitle>
                <CardDescription className="text-xs">
                  Edita cada sede para ligarla a Sky Zone, Toca Social, Bounce City o Epic Zone.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <FilasSedes
                  filas={panel.sedesSinMarca}
                  onEditar={abrirEditarSede}
                  onAgregarRrhh={(id) => abrirCrearUsuario("rrhh", id)}
                  onVerColaboradores={(id) => {
                    setFiltroSede(id);
                    setPestana("colaboradores");
                  }}
                />
              </CardContent>
            </Card>
          )}

          {(t?.sinSede || 0) > 0 && (
            <div className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-amber-300 text-xs">
              <span className="text-slate-700">
                <strong>{t?.sinSede}</strong> usuario(s) no tienen sucursal asignada.
              </span>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl text-xs"
                onClick={() => {
                  setFiltroSede("sin_sede");
                  setFiltroRol("todos");
                  setPestana("colaboradores");
                }}
              >
                Ver y asignar
              </Button>
            </div>
          )}
        </TabsContent>

        {/* ============================ COLABORADORES ============================ */}
        <TabsContent value="colaboradores" className="mt-6 space-y-4">
          <Card className="rounded-3xl border-slate-200 shadow-sm bg-white overflow-hidden">
            <CardHeader className="p-5 border-b border-slate-100 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900">
                    Personal ({filtrados.length})
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Asigna el ID de RRHH, la sucursal, el puesto y el asignador de cada persona.
                  </CardDescription>
                </div>
                <Button
                  onClick={() => abrirCrearUsuario("colaborador")}
                  className="bg-brand-dark hover:bg-brand-dark-hover text-white rounded-xl text-xs font-bold h-10"
                >
                  <UserPlus className="h-4 w-4 mr-1.5" /> Nuevo colaborador
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                <div className="relative lg:col-span-2">
                  <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar por nombre, ID o usuario"
                    className="pl-8 text-xs rounded-xl"
                  />
                </div>
                <select value={filtroMarca} onChange={(e) => setFiltroMarca(e.target.value)} className={selectCls}>
                  <option value="todas">Todas las marcas</option>
                  {marcas.map((m) => (
                    <option key={m.id} value={m.slug}>
                      {m.nombre}
                    </option>
                  ))}
                </select>
                <select value={filtroSede} onChange={(e) => setFiltroSede(e.target.value)} className={selectCls}>
                  <option value="todas">Todas las sucursales</option>
                  <option value="sin_sede">Sin sucursal</option>
                  {sedesOrdenadas
                    .filter((s) => filtroMarca === "todas" || s.marca?.slug === filtroMarca)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre}
                      </option>
                    ))}
                </select>
                <select value={filtroRol} onChange={(e) => setFiltroRol(e.target.value)} className={selectCls}>
                  <option value="colaborador">Colaboradores</option>
                  <option value="asignador">Asignadores</option>
                  <option value="rrhh">RRHH</option>
                  <option value="todos">Todos los roles</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer w-fit">
                <input
                  type="checkbox"
                  checked={soloPendientes}
                  onChange={(e) => setSoloPendientes(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Mostrar solo pendientes (sin sucursal, sin asignador o sin puesto)
              </label>

              {/* BARRA DE ASIGNACIÓN MASIVA */}
              {seleccion.size > 0 && (
                <div className="p-4 rounded-2xl bg-brand-primary/10 border border-brand-primary/30 space-y-3">
                  <p className="text-xs font-bold text-brand-dark">
                    {seleccion.size} seleccionado(s): asignar en bloque
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                    <div>
                      <label className={labelCls}>Sucursal</label>
                      <select value={masivaSede} onChange={(e) => setMasivaSede(e.target.value)} className={selectCls}>
                        <option value="">No cambiar</option>
                        {sedesOrdenadas.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Asignador</label>
                      <select value={masivaAsignador} onChange={(e) => setMasivaAsignador(e.target.value)} className={selectCls}>
                        <option value="">No cambiar</option>
                        <option value="__ninguno">Quitar asignador</option>
                        {asignadores.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.nombre_completo} · {sedeNombre(a.sede_id)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Puesto</label>
                      <select value={masivaPuesto} onChange={(e) => setMasivaPuesto(e.target.value)} className={selectCls}>
                        <option value="">No cambiar</option>
                        {puestos.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={aplicarMasiva}
                        disabled={aplicandoMasiva}
                        className="bg-brand-dark hover:bg-brand-dark-hover text-white rounded-xl text-xs font-bold h-9 flex-1"
                      >
                        {aplicandoMasiva ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar"}
                      </Button>
                      <Button variant="outline" onClick={() => setSeleccion(new Set())} className="rounded-xl text-xs h-9">
                        Limpiar
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardHeader>

            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-500 border-b">
                  <tr>
                    <th className="p-3 w-8">
                      <input
                        type="checkbox"
                        checked={todosVisiblesMarcados}
                        onChange={alternarTodosVisibles}
                        className="h-4 w-4 rounded border-slate-300"
                        aria-label="Seleccionar todos"
                      />
                    </th>
                    <th className="p-3">ID RRHH</th>
                    <th className="p-3">Nombre</th>
                    <th className="p-3">Rol / Puesto</th>
                    <th className="p-3">Sucursal</th>
                    <th className="p-3">Asignador</th>
                    <th className="p-3">Estado</th>
                    <th className="p-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibles.map((u) => {
                    const asig = usuarios.find((x) => x.id === u.asignador_id);
                    return (
                      <tr key={u.id} className={`hover:bg-slate-50/80 ${!u.activo ? "opacity-55" : ""}`}>
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={seleccion.has(u.id)}
                            onChange={() => alternarSeleccion(u.id)}
                            className="h-4 w-4 rounded border-slate-300"
                            aria-label={`Seleccionar ${u.nombre_completo}`}
                          />
                        </td>
                        <td className="p-3 font-mono font-bold text-brand-primary whitespace-nowrap">
                          {u.codigo_rrhh || <span className="text-amber-600">Sin ID</span>}
                        </td>
                        <td className="p-3">
                          <span className="font-semibold text-slate-900 block">{u.nombre_completo}</span>
                          <span className="font-mono text-[10px] text-slate-400">@{u.username}</span>
                        </td>
                        <td className="p-3">
                          <span className="block font-bold uppercase text-[10px] text-slate-700">{ROLES_ETIQUETA[u.rol]}</span>
                          <span className="text-[11px] text-slate-500">{u.puesto?.nombre || "Sin puesto"}</span>
                        </td>
                        <td className="p-3">
                          {u.sede ? (
                            <div className="flex items-center gap-1.5">
                              <span
                                className="h-2 w-2 rounded-full shrink-0"
                                style={{ backgroundColor: obtenerTema(u.sede.marca?.slug).hexPrimary }}
                              />
                              <span className="text-slate-700">{u.sede.nombre}</span>
                            </div>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100 text-[10px]">Sin sucursal</Badge>
                          )}
                        </td>
                        <td className="p-3">
                          {u.rol === "colaborador" ? (
                            asig ? (
                              <span className="text-slate-700">{asig.nombre_completo}</span>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300">
                                Sin asignador
                              </Badge>
                            )
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">No aplica</span>
                          )}
                        </td>
                        <td className="p-3">
                          {u.activo ? (
                            <Badge className="bg-emerald-50 text-emerald-800 hover:bg-emerald-50 text-[10px]">Activo</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">Inactivo</Badge>
                          )}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => abrirEditarUsuario(u)}>
                            <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => restablecerClave(u)}>
                            <KeyRound className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className={`h-8 px-2 text-xs ${u.activo ? "text-rose-600" : "text-emerald-700"}`}
                            onClick={() => alternarActivo(u)}
                          >
                            {u.activo ? "Desactivar" : "Activar"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {visibles.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-10 text-center text-slate-500">
                        {cargando ? "Cargando..." : "No hay personas con esos filtros."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>

            {totalPaginas > 1 && (
              <div className="flex items-center justify-between p-3 border-t border-slate-100 text-xs text-slate-600">
                <span>
                  Página {pagina} de {totalPaginas}
                </span>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="h-8 rounded-lg" disabled={pagina === 1} onClick={() => setPagina(pagina - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-lg"
                    disabled={pagina === totalPaginas}
                    onClick={() => setPagina(pagina + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ============================ USUARIOS RRHH ============================ */}
        <TabsContent value="rrhh" className="mt-6">
          <Card className="rounded-3xl border-slate-200 shadow-sm bg-white overflow-hidden">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-slate-100">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">Equipos de Recursos Humanos ({usuariosRrhh.length})</CardTitle>
                <CardDescription className="text-xs">
                  Cada sucursal tiene su propio RRHH: solo verá y administrará a los colaboradores de su sucursal.
                </CardDescription>
              </div>
              <Button
                onClick={() => abrirCrearUsuario("rrhh")}
                className="bg-brand-dark hover:bg-brand-dark-hover text-white rounded-xl text-xs font-bold h-10"
              >
                <PlusCircle className="h-4 w-4 mr-1.5" /> Crear usuario de RRHH
              </Button>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-500 border-b">
                  <tr>
                    <th className="p-3">Marca</th>
                    <th className="p-3">Sucursal</th>
                    <th className="p-3">Responsable de RRHH</th>
                    <th className="p-3">ID / Usuario</th>
                    <th className="p-3">Estado</th>
                    <th className="p-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usuariosRrhh.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/80">
                      <td className="p-3">
                        <span className="font-semibold text-slate-800">{u.sede?.marca?.nombre || "Sin marca"}</span>
                      </td>
                      <td className="p-3">{u.sede?.nombre || <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100 text-[10px]">Sin sucursal</Badge>}</td>
                      <td className="p-3 font-semibold text-slate-900">{u.nombre_completo}</td>
                      <td className="p-3">
                        <span className="font-mono font-bold text-brand-primary block">{u.codigo_rrhh || "-"}</span>
                        <span className="font-mono text-[10px] text-slate-400">@{u.username}</span>
                      </td>
                      <td className="p-3">
                        {u.activo ? (
                          <Badge className="bg-emerald-50 text-emerald-800 hover:bg-emerald-50 text-[10px]">Activo</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">Inactivo</Badge>
                        )}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => abrirEditarUsuario(u)}>
                          <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => restablecerClave(u)}>
                          <KeyRound className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className={`h-8 px-2 text-xs ${u.activo ? "text-rose-600" : "text-emerald-700"}`}
                          onClick={() => alternarActivo(u)}
                        >
                          {u.activo ? "Desactivar" : "Activar"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {usuariosRrhh.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-10 text-center text-slate-500">
                        Aún no hay usuarios de RRHH. Crea el primero y asígnalo a su sucursal.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================ SUCURSALES ============================ */}
        <TabsContent value="sedes" className="mt-6">
          <Card className="rounded-3xl border-slate-200 shadow-sm bg-white overflow-hidden">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-slate-100">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">Sucursales y geocercas ({sedes.length})</CardTitle>
                <CardDescription className="text-xs">
                  Cada sucursal pertenece a una marca y define el radio permitido para marcar.
                </CardDescription>
              </div>
              <Button
                onClick={() => setFormSede(formSedeVacio())}
                className="bg-brand-dark hover:bg-brand-dark-hover text-white rounded-xl text-xs font-bold h-10"
              >
                <PlusCircle className="h-4 w-4 mr-1.5" /> Nueva sucursal
              </Button>
            </CardHeader>
            <CardContent className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {sedesOrdenadas.map((s) => {
                const tema = obtenerTema(s.marca?.slug);
                return (
                  <div key={s.id} className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3 relative overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: tema.hexPrimary }} />
                    <div className="flex items-start justify-between gap-2 pl-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          {s.marca?.nombre || "Sin marca"} {s.codigo ? `· ${s.codigo}` : ""}
                        </span>
                        <span className="text-sm font-bold text-slate-900 block">{s.nombre}</span>
                      </div>
                      <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => abrirEditarSede(s)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="pl-2 space-y-1 text-[11px] text-slate-600">
                      <p className="font-mono">
                        {s.latitud}, {s.longitud}
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 text-[10px]">Radio {s.radio_metros} m</Badge>
                        {s.coordenadas_verificadas === false && (
                          <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100 text-[10px]">Coordenadas por verificar</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ============================ DIÁLOGO USUARIO ============================ */}
      <Dialog open={!!formUsuario} onOpenChange={(o) => !o && setFormUsuario(null)}>
        <DialogContent className="max-w-xl rounded-3xl max-h-[90vh] overflow-y-auto">
          {formUsuario && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {formUsuario.modo === "crear"
                    ? formUsuario.rol === "rrhh"
                      ? "Crear usuario de RRHH"
                      : "Nuevo colaborador"
                    : `Editar a ${formUsuario.nombre_completo}`}
                </DialogTitle>
                <DialogDescription>
                  {formUsuario.modo === "crear"
                    ? "Contraseña inicial para su primer ingreso; luego la cambia en “Mi Clave”."
                    : "Los cambios se aplican de inmediato."}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Nombre completo</label>
                  <Input
                    value={formUsuario.nombre_completo}
                    onChange={(e) => {
                      const nuevoNombre = e.target.value;
                      setFormUsuario((prev) =>
                        prev
                          ? {
                              ...prev,
                              nombre_completo: nuevoNombre,
                              username:
                                prev.modo === "crear"
                                  ? sugerirUsernameDesdeNombre(nuevoNombre)
                                  : prev.username,
                            }
                          : prev
                      );
                    }}
                    className="text-xs rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Rol</label>
                    <select
                      value={formUsuario.rol}
                      onChange={(e) => setFormUsuario({ ...formUsuario, rol: e.target.value as Role })}
                      className={selectCls}
                    >
                      <option value="colaborador">Colaborador</option>
                      <option value="asignador">Asignador / Líder</option>
                      <option value="rrhh">Recursos Humanos</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Sucursal</label>
                    <select
                      value={formUsuario.sede_id}
                      onChange={(e) => {
                        const sedeId = e.target.value;
                        setFormUsuario({ ...formUsuario, sede_id: sedeId });
                        if (formUsuario.modo === "crear" && !formUsuario.codigo_rrhh) sugerirCodigo(sedeId);
                      }}
                      className={selectCls}
                    >
                      <option value="">Sin sucursal</option>
                      {sedesOrdenadas.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.marca?.nombre ? `${s.marca.nombre} · ` : ""}
                          {s.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>ID de RRHH (nómina)</label>
                    <div className="flex gap-1.5">
                      <Input
                        value={formUsuario.codigo_rrhh}
                        onChange={(e) => setFormUsuario({ ...formUsuario, codigo_rrhh: e.target.value })}
                        placeholder="Ej. SZM-023"
                        className="text-xs rounded-xl font-mono font-bold"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-xl h-9 px-2"
                        disabled={!formUsuario.sede_id}
                        onClick={() => sugerirCodigo(formUsuario.sede_id)}
                        title="Sugerir el siguiente ID de la sucursal"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Usuario (login)</label>
                    <div className="flex gap-1.5">
                      <Input
                        value={formUsuario.username}
                        onChange={(e) => setFormUsuario({ ...formUsuario, username: e.target.value.toLowerCase() })}
                        placeholder="Ej. dlima"
                        className="text-xs rounded-xl font-mono"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-xl h-9 px-2"
                        disabled={!formUsuario.nombre_completo.trim()}
                        onClick={() =>
                          setFormUsuario((f) =>
                            f ? { ...f, username: sugerirUsernameDesdeNombre(f.nombre_completo) } : f
                          )
                        }
                        title="Generar usuario a partir del nombre (ej. dlima)"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>

                {formUsuario.rol !== "rrhh" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>Puesto</label>
                      <select
                        value={formUsuario.puesto_id}
                        onChange={(e) => setFormUsuario({ ...formUsuario, puesto_id: e.target.value })}
                        className={selectCls}
                      >
                        <option value="">Sin puesto</option>
                        {puestos.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                    {formUsuario.rol === "colaborador" && (
                      <div>
                        <label className={labelCls}>Asignador</label>
                        <select
                          value={formUsuario.asignador_id}
                          onChange={(e) => setFormUsuario({ ...formUsuario, asignador_id: e.target.value })}
                          className={selectCls}
                        >
                          <option value="">Sin asignador</option>
                          {[...asignadores]
                            .sort((a, b) => {
                              const aMisma = a.sede_id === formUsuario.sede_id ? 0 : 1;
                              const bMisma = b.sede_id === formUsuario.sede_id ? 0 : 1;
                              return aMisma - bMisma || a.nombre_completo.localeCompare(b.nombre_completo);
                            })
                            .map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.nombre_completo} ({sedeNombre(a.sede_id)})
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Correo (opcional)</label>
                    <Input
                      type="email"
                      value={formUsuario.email}
                      onChange={(e) => setFormUsuario({ ...formUsuario, email: e.target.value })}
                      className="text-xs rounded-xl"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Teléfono WhatsApp (opcional)</label>
                    <Input
                      value={formUsuario.telefono}
                      onChange={(e) => setFormUsuario({ ...formUsuario, telefono: e.target.value })}
                      placeholder="+502 5555 5555"
                      className="text-xs rounded-xl"
                    />
                  </div>
                </div>

                {formUsuario.modo === "crear" && (
                  <div>
                    <label className={labelCls}>Contraseña inicial</label>
                    <Input
                      value={formUsuario.password}
                      onChange={(e) => setFormUsuario({ ...formUsuario, password: e.target.value })}
                      className="text-xs rounded-xl font-mono"
                    />
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="outline" onClick={() => setFormUsuario(null)} className="rounded-xl text-xs">
                  Cancelar
                </Button>
                <Button
                  onClick={guardarUsuario}
                  disabled={guardandoUsuario}
                  className="bg-brand-dark hover:bg-brand-dark-hover text-white rounded-xl text-xs font-bold"
                >
                  {guardandoUsuario ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ============================ DIÁLOGO SUCURSAL ============================ */}
      <Dialog open={!!formSede} onOpenChange={(o) => !o && setFormSede(null)}>
        <DialogContent className="max-w-xl rounded-3xl max-h-[90vh] overflow-y-auto">
          {formSede && (
            <>
              <DialogHeader>
                <DialogTitle>{formSede.id ? `Editar ${formSede.nombre}` : "Nueva sucursal"}</DialogTitle>
                <DialogDescription>
                  Para fijar la geocerca real, abre este panel desde la tablet o celular estando dentro de la sucursal y pulsa “Usar mi
                  ubicación actual”.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className={labelCls}>Nombre</label>
                    <Input
                      value={formSede.nombre}
                      onChange={(e) => setFormSede({ ...formSede, nombre: e.target.value })}
                      className="text-xs rounded-xl"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Código</label>
                    <Input
                      value={formSede.codigo}
                      onChange={(e) => setFormSede({ ...formSede, codigo: e.target.value.toUpperCase() })}
                      maxLength={10}
                      placeholder="SZM"
                      className="text-xs rounded-xl font-mono font-bold"
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Marca</label>
                  <select
                    value={formSede.marca_id}
                    onChange={(e) => setFormSede({ ...formSede, marca_id: e.target.value })}
                    className={selectCls}
                  >
                    <option value="">Sin marca</option>
                    {marcas.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Dirección</label>
                  <Input
                    value={formSede.direccion}
                    onChange={(e) => setFormSede({ ...formSede, direccion: e.target.value })}
                    className="text-xs rounded-xl"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className={labelCls}>Latitud</label>
                    <Input
                      value={formSede.latitud}
                      onChange={(e) => setFormSede({ ...formSede, latitud: e.target.value })}
                      className="text-xs rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Longitud</label>
                    <Input
                      value={formSede.longitud}
                      onChange={(e) => setFormSede({ ...formSede, longitud: e.target.value })}
                      className="text-xs rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Radio (m)</label>
                    <Input
                      type="number"
                      min={20}
                      value={formSede.radio_metros}
                      onChange={(e) => setFormSede({ ...formSede, radio_metros: Number(e.target.value) })}
                      className="text-xs rounded-xl"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={usarGpsActual}
                  disabled={detectandoGps}
                  className="w-full rounded-xl text-xs font-semibold"
                >
                  {detectandoGps ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Crosshair className="h-4 w-4 mr-2 text-brand-primary" />}
                  Usar mi ubicación actual
                </Button>
              </div>

              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="outline" onClick={() => setFormSede(null)} className="rounded-xl text-xs">
                  Cancelar
                </Button>
                <Button
                  onClick={guardarSede}
                  disabled={guardandoSede}
                  className="bg-brand-dark hover:bg-brand-dark-hover text-white rounded-xl text-xs font-bold"
                >
                  {guardandoSede ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar sucursal"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ------------------------------------------------------------------------------
// Tabla de sucursales dentro de cada marca
// ------------------------------------------------------------------------------
function FilasSedes({
  filas,
  onEditar,
  onAgregarRrhh,
  onVerColaboradores,
}: {
  filas: ResumenSedeSA[];
  onEditar: (s: SedeZona) => void;
  onAgregarRrhh: (sedeId: string) => void;
  onVerColaboradores: (sedeId: string) => void;
}) {
  return (
    <table className="w-full text-left text-xs text-slate-600">
      <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-500 border-b">
        <tr>
          <th className="p-3">Sucursal</th>
          <th className="p-3">Responsable RRHH</th>
          <th className="p-3 text-center">Colaboradores</th>
          <th className="p-3 text-center">Asignadores</th>
          <th className="p-3 text-center">Sin asignador</th>
          <th className="p-3 text-center">Sin rostro</th>
          <th className="p-3 text-right">Acciones</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {filas.map((r) => (
          <tr key={r.sede.id} className="hover:bg-slate-50/80">
            <td className="p-3">
              <span className="font-bold text-slate-900 block">{r.sede.nombre}</span>
              <span className="text-[10px] font-mono text-slate-400">{r.sede.codigo || "sin código"}</span>
              {r.sede.coordenadas_verificadas === false && (
                <Badge className="ml-2 bg-amber-100 text-amber-900 hover:bg-amber-100 text-[9px]">GPS por verificar</Badge>
              )}
            </td>
            <td className="p-3">
              {r.rrhh.length > 0 ? (
                r.rrhh.map((h) => (
                  <span key={h.id} className={`block ${h.activo ? "text-slate-800 font-medium" : "text-slate-400 line-through"}`}>
                    {h.nombre_completo}
                  </span>
                ))
              ) : (
                <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 text-[10px]">Sin RRHH</Badge>
              )}
            </td>
            <td className="p-3 text-center font-bold text-slate-900">{r.colaboradores}</td>
            <td className="p-3 text-center">{r.asignadores}</td>
            <td className={`p-3 text-center font-bold ${r.sinAsignador > 0 ? "text-amber-600" : "text-slate-400"}`}>{r.sinAsignador}</td>
            <td className="p-3 text-center text-slate-500">{r.sinRostro}</td>
            <td className="p-3 text-right whitespace-nowrap">
              <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => onVerColaboradores(r.sede.id)}>
                <Users className="h-3.5 w-3.5 mr-1" /> Personal
              </Button>
              <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => onAgregarRrhh(r.sede.id)}>
                <ShieldCheck className="h-3.5 w-3.5 mr-1" /> RRHH
              </Button>
              <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => onEditar(r.sede)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

