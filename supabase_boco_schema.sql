-- ==============================================================================
-- BOCO - SISTEMA INTEGRAL DE CONTROL DE ASISTENCIA, HORARIOS Y APRENDIZAJE (LMS)
-- Esquema Maestro Relacional para Supabase / PostgreSQL
-- ==============================================================================

-- Habilitar extensión para UUID si no está activa
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLA: SEDES Y ZONAS DE MARCAJE (GEOCERCAS)
CREATE TABLE IF NOT EXISTS sedes_zonas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(150) NOT NULL,
  direccion TEXT,
  latitud DOUBLE PRECISION NOT NULL,
  longitud DOUBLE PRECISION NOT NULL,
  radio_metros INTEGER NOT NULL DEFAULT 100, -- Radio máximo permitido para marcar
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TABLA: DEPARTAMENTOS Y PUESTOS (Para segmentación de cursos y funciones)
CREATE TABLE IF NOT EXISTS departamentos_puestos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(100) NOT NULL UNIQUE, -- Ej: 'Bartender', 'Chef / Cocina', 'Limpieza / Stewarding', 'Técnico TI', 'Administración'
  departamento VARCHAR(100) NOT NULL,  -- Ej: 'Alimentos y Bebidas', 'Operaciones', 'Tecnología', 'RRHH'
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABLA: USUARIOS Y COLABORADORES
-- Roles: 'rrhh' (Admin RRHH), 'asignador' (Líder de Turno/Team), 'colaborador' (Personal Operativo)
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(60) NOT NULL UNIQUE,    -- Nombre de usuario para iniciar sesión (ej: "valeria.rrhh", "alejandro.bar")
  codigo_rrhh VARCHAR(50),                 -- Código interno de RRHH opcional
  nombre_completo VARCHAR(200) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  telefono VARCHAR(30), -- Teléfono para WhatsApp (con código de país)
  rol VARCHAR(30) NOT NULL CHECK (rol IN ('rrhh', 'asignador', 'colaborador')),
  puesto_id UUID REFERENCES departamentos_puestos(id) ON DELETE SET NULL,
  sede_id UUID REFERENCES sedes_zonas(id) ON DELETE SET NULL,
  asignador_id UUID REFERENCES usuarios(id) ON DELETE SET NULL, -- Asignador responsable de este colaborador
  activo BOOLEAN NOT NULL DEFAULT true,
  
  -- Biometría facial (Face-API Descriptor 128 floats serializado en JSON)
  facial_descriptor JSONB,
  facial_enrolled BOOLEAN NOT NULL DEFAULT false,
  facial_enrolled_at TIMESTAMP WITH TIME ZONE,
  avatar_url TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. TABLA: HORARIOS Y TURNOS SEMANALES (Gestionado por el Usuario Asignador)
CREATE TABLE IF NOT EXISTS horarios_turnos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  asignador_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  hora_entrada TIME NOT NULL,
  hora_salida TIME NOT NULL,
  tolerancia_minutos INTEGER DEFAULT 15,
  es_dia_descanso BOOLEAN DEFAULT false,
  es_dia_festivo BOOLEAN DEFAULT false,
  notificado_whatsapp BOOLEAN DEFAULT false,
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(usuario_id, fecha)
);

-- 5. TABLA: MARCAJES DE ASISTENCIA Y CONTROL BIOMÉTRICO
CREATE TABLE IF NOT EXISTS marcajes_asistencia (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  
  -- Marcaje Entrada
  hora_entrada TIMESTAMP WITH TIME ZONE,
  latitud_entrada DOUBLE PRECISION,
  longitud_entrada DOUBLE PRECISION,
  distancia_sede_entrada_metros DOUBLE PRECISION,
  en_rango_entrada BOOLEAN DEFAULT true,
  foto_entrada_url TEXT,
  
  -- Almuerzo
  hora_inicio_almuerzo TIMESTAMP WITH TIME ZONE,
  hora_fin_almuerzo TIMESTAMP WITH TIME ZONE,
  tomo_almuerzo BOOLEAN DEFAULT true, -- Permite registrar si tomó o no almuerzo
  
  -- Marcaje Salida
  hora_salida TIMESTAMP WITH TIME ZONE,
  latitud_salida DOUBLE PRECISION,
  longitud_salida DOUBLE PRECISION,
  distancia_sede_salida_metros DOUBLE PRECISION,
  en_rango_salida BOOLEAN DEFAULT true,
  foto_salida_url TEXT,
  
  -- Cálculos automáticos de tiempo (en horas decimales o minutos)
  horas_trabajadas_totales DECIMAL(5,2) DEFAULT 0.00,
  horas_regulares DECIMAL(5,2) DEFAULT 0.00,
  horas_extras DECIMAL(5,2) DEFAULT 0.00,
  
  -- Estado del día
  estado VARCHAR(30) DEFAULT 'presente' CHECK (estado IN ('presente', 'retardo', 'falta', 'justificado', 'descanso')),
  metodo_verificacion VARCHAR(30) DEFAULT 'facial',
  observaciones TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(usuario_id, fecha)
);

-- 6. TABLA: JUSTIFICACIONES DE FALTAS Y REPOSICIÓN DE HORAS
CREATE TABLE IF NOT EXISTS justificaciones_faltas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  asignador_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha_afectada DATE NOT NULL,
  tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('falta', 'llegada_tarde', 'salida_temprana', 'permiso')),
  motivo TEXT NOT NULL,
  comprobante_url TEXT, -- Documento o imagen justificante
  
  -- Reposición y compensación flexible de horas
  horas_a_reponer DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  fecha_compromiso_reposicion DATE,
  horas_repuestas DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  
  estado VARCHAR(30) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado', 'cumplido')),
  resolucion_asignador TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. TABLA: BANCO DE HORAS Y DÍAS FESTIVOS COMPENSATORIOS
CREATE TABLE IF NOT EXISTS banco_horas_compensacion (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  semana_inicio DATE NOT NULL,
  semana_fin DATE NOT NULL,
  horas_meta DECIMAL(5,2) NOT NULL DEFAULT 40.00, -- Ej. 40 o 48 horas semanales reglamentarias
  horas_trabajadas DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  diferencia_horas DECIMAL(5,2) NOT NULL DEFAULT 0.00, -- Positivo = horas de más (a favor); Negativo = horas faltantes
  dias_festivos_laborados INTEGER NOT NULL DEFAULT 0,  -- Días festivos que se les deben compensar
  dias_compensados_tomados INTEGER NOT NULL DEFAULT 0,
  saldo_neto_horas DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  notas TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(usuario_id, semana_inicio)
);

-- 8. TABLA: SISTEMA DE APRENDIZAJE (LMS) - CURSOS Y MATERIAL FORMATIVO
-- Solo subido por usuarios con rol 'rrhh'
CREATE TABLE IF NOT EXISTS lms_cursos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creado_por UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  titulo VARCHAR(200) NOT NULL,
  descripcion TEXT,
  contenido_texto TEXT NOT NULL, -- Material completo de lectura
  video_url TEXT,                -- Video de inducción o capacitación
  documento_url TEXT,            -- PDF o material adjunto
  
  -- Seguridad contra trampas de lectura
  tiempo_minimo_lectura_segundos INTEGER NOT NULL DEFAULT 120, -- Contador obligatorio de seguridad
  puntuacion_minima_aprobacion INTEGER NOT NULL DEFAULT 80,    -- Escala de 0 a 100
  
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. TABLA: ASIGNACIÓN DE CURSOS POR PUESTO O COLABORADOR (Segmentación estricta por RRHH)
-- "si es bartender no se lo damos a un chef; si es limpieza no a un bartender"
CREATE TABLE IF NOT EXISTS lms_asignaciones_cursos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  curso_id UUID NOT NULL REFERENCES lms_cursos(id) ON DELETE CASCADE,
  asignado_por UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  
  -- Se puede asignar a todo un puesto (ej. a todos los 'Bartenders') o a un usuario específico
  puesto_id UUID REFERENCES departamentos_puestos(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  
  fecha_limite DATE,
  obligatorio BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT check_asignacion CHECK (puesto_id IS NOT NULL OR usuario_id IS NOT NULL)
);

-- 10. TABLA: EVALUACIONES GENERADAS POR IA (Gemini)
CREATE TABLE IF NOT EXISTS lms_evaluaciones_ia (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  curso_id UUID NOT NULL REFERENCES lms_cursos(id) ON DELETE CASCADE,
  
  -- Array JSON con las preguntas generadas por IA:
  -- [
  --   {
  --     "id": 1,
  --     "tipo": "true_false" | "multiple_choice",
  --     "pregunta": "¿...?",
  --     "opciones": ["Opción A", "Opción B", ...],
  --     "respuesta_correcta": "Opción A",
  --     "explicacion_ia": "Fundamento pedagógico...",
  --     "requiere_justificacion": true
  --   }
  -- ]
  preguntas_json JSONB NOT NULL,
  modelo_ia VARCHAR(50) DEFAULT 'gemini-2.5-flash',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. TABLA: AVANCE Y RESULTADOS DE LOS COLABORADORES EN EL LMS
CREATE TABLE IF NOT EXISTS lms_avance_colaborador (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  curso_id UUID NOT NULL REFERENCES lms_cursos(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  
  -- Contador de seguridad validado
  segundos_lectura_reales INTEGER NOT NULL DEFAULT 0,
  lectura_completada BOOLEAN NOT NULL DEFAULT false,
  
  -- Evaluación
  intentos_realizados INTEGER NOT NULL DEFAULT 0,
  puntuacion_obtenida DECIMAL(5,2),
  respuestas_usuario_json JSONB, -- Respuestas elegidas + justificaciones redactadas por el usuario
  aprobado BOOLEAN NOT NULL DEFAULT false,
  fecha_aprobacion TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(curso_id, usuario_id)
);

-- 12. TABLA: LOG DE NOTIFICACIONES DE WHATSAPP (Avisos de turnos y justificaciones)
CREATE TABLE IF NOT EXISTS whatsapp_notificaciones_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  destinatario_usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  telefono VARCHAR(30) NOT NULL,
  tipo_evento VARCHAR(50) NOT NULL, -- 'cambio_horario', 'falta_detectada', 'curso_asignado', 'recordatorio'
  mensaje TEXT NOT NULL,
  estado VARCHAR(30) DEFAULT 'enviado', -- 'enviado', 'fallido', 'pendiente'
  fecha_envio TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- DATOS INICIALES SEMILLA (SEED DATA) PARA BOCO
-- ==============================================================================

-- Puestos iniciales organizados
INSERT INTO departamentos_puestos (id, nombre, departamento, descripcion) VALUES
  ('b1111111-1111-1111-1111-111111111111', 'Bartender', 'Alimentos y Bebidas', 'Preparación de coctelería, servicio de barra y control de inventario.'),
  ('b2222222-2222-2222-2222-222222222222', 'Chef / Cocina', 'Cocina', 'Elaboración de platillos, higiene alimentaria y control de línea.'),
  ('b3333333-3333-3333-3333-333333333333', 'Limpieza y Stewarding', 'Operaciones', 'Sanitización de áreas, químicos de limpieza y equipo.'),
  ('b4444444-4444-4444-4444-444444444444', 'Técnico de Soporte TI', 'Tecnología', 'Mantenimiento preventivo, redes y sistemas.')
ON CONFLICT (nombre) DO NOTHING;

-- Índices para optimizar consultas de marcajes y reportes Excel
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol);
CREATE INDEX IF NOT EXISTS idx_usuarios_codigo ON usuarios(codigo_rrhh);
CREATE INDEX IF NOT EXISTS idx_marcajes_fecha ON marcajes_asistencia(fecha);
CREATE INDEX IF NOT EXISTS idx_marcajes_usuario ON marcajes_asistencia(usuario_id);
CREATE INDEX IF NOT EXISTS idx_horarios_fecha_usuario ON horarios_turnos(usuario_id, fecha);
CREATE INDEX IF NOT EXISTS idx_lms_asignaciones_puesto ON lms_asignaciones_cursos(puesto_id);
CREATE INDEX IF NOT EXISTS idx_lms_asignaciones_usuario ON lms_asignaciones_cursos(usuario_id);


