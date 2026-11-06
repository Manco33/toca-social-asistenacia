// ==============================================================================
// TIPOS GLOBALES - SISTEMA BOCO
// ==============================================================================

export type Role = 'superadmin' | 'rrhh' | 'asignador' | 'colaborador';

export function normalizeRole(role: string): Role {
  const normalized = (role || '').toLowerCase();
  if (normalized.includes('superadmin') || normalized.includes('super_admin') || normalized.includes('super admin')) {
    return 'superadmin';
  }
  if (normalized.includes('rrhh') || normalized.includes('admin') || normalized.includes('recursos')) {
    return 'rrhh';
  }
  if (normalized.includes('asigna') || normalized.includes('lider') || normalized.includes('supervisor')) {
    return 'asignador';
  }
  return 'colaborador';
}

export interface Marca {
  id: string;
  slug: string; // sky_zone | toca_social | bounce_city | epic_zone
  nombre: string;
  logo_url?: string;
  activo: boolean;
}

export interface SedeZona {
  id: string;
  nombre: string;
  codigo?: string; // Prefijo corto para IDs (SZM, SZC, SZT, BCY, EPZ, TCS)
  marca_id?: string;
  marca?: Marca;
  coordenadas_verificadas?: boolean;
  direccion?: string;
  latitud: number;
  longitud: number;
  radio_metros: number;
  activo: boolean;
  created_at?: string;
}

export interface DepartamentoPuesto {
  id: string;
  nombre: string; // ej: 'Bartender', 'Chef / Cocina', 'Limpieza y Stewarding', 'Técnico de Soporte TI'
  departamento: string;
  descripcion?: string;
  activo: boolean;
}

export interface UsuarioBoco {
  id: string;
  username: string; // Nombre de usuario para login
  codigo_rrhh?: string; // Código con letras, números y símbolos (ej: "BC-984#X")
  nombre_completo: string;
  email?: string | null;
  telefono?: string;
  rol: Role;
  puesto_id?: string;
  puesto?: DepartamentoPuesto;
  sede_id?: string;
  sede?: SedeZona;
  asignador_id?: string;
  asignador?: UsuarioBoco;
  activo: boolean;
  facial_descriptor?: number[]; // Vector biométrico de 128 floats
  facial_enrolled: boolean;
  facial_enrolled_at?: string;
  avatar_url?: string;
}

export interface HorarioTurno {
  id: string;
  usuario_id: string;
  usuario?: UsuarioBoco;
  asignador_id: string;
  fecha: string; // YYYY-MM-DD
  hora_entrada: string; // HH:mm
  hora_salida: string; // HH:mm
  tolerancia_minutos: number;
  es_dia_descanso: boolean;
  es_dia_festivo: boolean;
  notificado_whatsapp: boolean;
  notas?: string;
}

export interface MarcajeAsistencia {
  id: string;
  usuario_id: string;
  usuario?: UsuarioBoco;
  fecha: string; // YYYY-MM-DD
  
  // Entrada
  hora_entrada?: string;
  latitud_entrada?: number;
  longitud_entrada?: number;
  distancia_sede_entrada_metros?: number;
  en_rango_entrada?: boolean;
  foto_entrada_url?: string;
  
  // Almuerzo
  hora_inicio_almuerzo?: string;
  hora_fin_almuerzo?: string;
  tomo_almuerzo: boolean; // Registro de si tomó o no almuerzo
  
  // Salida
  hora_salida?: string;
  latitud_salida?: number;
  longitud_salida?: number;
  distancia_sede_salida_metros?: number;
  en_rango_salida?: boolean;
  foto_salida_url?: string;
  
  // Métricas de Horas
  horas_trabajadas_totales: number;
  horas_regulares: number;
  horas_extras: number;
  
  estado: 'presente' | 'retardo' | 'falta' | 'justificado' | 'descanso';
  metodo_verificacion: string;
  observaciones?: string;
}

export interface JustificacionFalta {
  id: string;
  usuario_id: string;
  usuario?: UsuarioBoco;
  asignador_id?: string;
  asignador?: UsuarioBoco;
  fecha_afectada: string;
  tipo: 'falta' | 'llegada_tarde' | 'salida_temprana' | 'permiso';
  motivo: string;
  comprobante_url?: string;
  horas_a_reponer: number;
  fecha_compromiso_reposicion?: string;
  horas_repuestas: number;
  estado: 'pendiente' | 'aprobado' | 'rechazado' | 'cumplido';
  resolucion_asignador?: string;
}

export interface BancoHorasCompensacion {
  id: string;
  usuario_id: string;
  usuario?: UsuarioBoco;
  semana_inicio: string;
  semana_fin: string;
  horas_meta: number; // Por defecto 40h
  horas_trabajadas: number;
  diferencia_horas: number; // Positivo = a favor, Negativo = debe reponer
  dias_festivos_laborados: number; // Días que se le deben al empleado
  dias_compensados_tomados: number;
  saldo_neto_horas: number;
  notas?: string;
}

// ==============================================================================
// SISTEMA DE APRENDIZAJE (LMS) - BOCO
// ==============================================================================

export interface LMSCurso {
  id: string;
  creado_por: string; // Solo RRHH
  titulo: string;
  descripcion?: string;
  contenido_texto: string;
  video_url?: string;
  documento_url?: string;
  tiempo_minimo_lectura_segundos: number; // Contador de seguridad anti-trampa
  puntuacion_minima_aprobacion: number;
  activo: boolean;
  created_at?: string;
}

export interface LMSAsignacionCurso {
  id: string;
  curso_id: string;
  curso?: LMSCurso;
  asignado_por: string;
  puesto_id?: string; // Segmentación por puesto (ej: Bartender, Chef, Limpieza)
  puesto?: DepartamentoPuesto;
  usuario_id?: string; // O asignación personalizada por colaborador
  usuario?: UsuarioBoco;
  fecha_limite?: string;
  obligatorio: boolean;
}

export interface LMSPreguntaIA {
  id: number;
  tipo: 'true_false' | 'multiple_choice';
  pregunta: string;
  opciones: string[];
  respuesta_correcta: string;
  explicacion_ia: string;
  requiere_justificacion: boolean; // Obliga al colaborador a fundamentar su respuesta
}

export interface LMSEvaluacionIA {
  id: string;
  curso_id: string;
  preguntas_json: LMSPreguntaIA[];
  modelo_ia: string;
}

export interface LMSRespuestaColaborador {
  pregunta_id: number;
  respuesta_seleccionada: string;
  justificacion_escrita: string;
  es_correcta?: boolean;
}

export interface LMSAvanceColaborador {
  id: string;
  curso_id: string;
  curso?: LMSCurso;
  usuario_id: string;
  segundos_lectura_reales: number;
  lectura_completada: boolean;
  intentos_realizados: number;
  puntuacion_obtenida?: number;
  respuestas_usuario_json?: LMSRespuestaColaborador[];
  aprobado: boolean;
  fecha_aprobacion?: string;
}

export interface WhatsAppNotificacion {
  id: string;
  destinatario_usuario_id?: string;
  telefono: string;
  tipo_evento: 'cambio_horario' | 'falta_detectada' | 'curso_asignado' | 'recordatorio';
  mensaje: string;
  estado: 'enviado' | 'fallido' | 'pendiente';
  fecha_envio?: string;
}
