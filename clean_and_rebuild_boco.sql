-- ==============================================================================
-- BOCO: LIMPIEZA TOTAL Y RECONSTRUCCIÓN DE BASE DE DATOS EN SUPABASE
-- Este script elimina todas las tablas del sistema anterior (Aktiva) y
-- cualquier tabla previa de BOCO para dejar la base de datos 100% limpia.
-- ==============================================================================

-- 1. ELIMINAR TABLAS DEL SISTEMA ANTERIOR (AKTIVA)
DROP TABLE IF EXISTS facturas CASCADE;
DROP TABLE IF EXISTS registro_horas CASCADE;
DROP TABLE IF EXISTS horas_extras CASCADE;
DROP TABLE IF EXISTS project_hours_log CASCADE;
DROP TABLE IF EXISTS project_intervals CASCADE;
DROP TABLE IF EXISTS device_bindings CASCADE;
DROP TABLE IF EXISTS device_attempts CASCADE;
DROP TABLE IF EXISTS overtime_requests CASCADE;
DROP TABLE IF EXISTS proyectos CASCADE;
DROP TABLE IF EXISTS empleados CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 2. ELIMINAR TABLAS DE BOCO (SI EXISTÍAN PREVIAMENTE)
DROP TABLE IF EXISTS whatsapp_notificaciones_log CASCADE;
DROP TABLE IF EXISTS lms_avance_colaborador CASCADE;
DROP TABLE IF EXISTS lms_evaluaciones_ia CASCADE;
DROP TABLE IF EXISTS lms_asignaciones_cursos CASCADE;
DROP TABLE IF EXISTS lms_cursos CASCADE;
DROP TABLE IF EXISTS banco_horas_compensacion CASCADE;
DROP TABLE IF EXISTS justificaciones_faltas CASCADE;
DROP TABLE IF EXISTS marcajes_asistencia CASCADE;
DROP TABLE IF EXISTS horarios_turnos CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS departamentos_puestos CASCADE;
DROP TABLE IF EXISTS sedes_zonas CASCADE;
DROP TABLE IF EXISTS marcas CASCADE;

-- ==============================================================================
-- A CONTINUACIÓN: RECONSTRUCCIÓN DEL ESQUEMA LIMPIO DE BOCO
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. SEDES Y GEOCERCAS
CREATE TABLE sedes_zonas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(150) NOT NULL,
  direccion TEXT,
  latitud DOUBLE PRECISION NOT NULL,
  longitud DOUBLE PRECISION NOT NULL,
  radio_metros INTEGER NOT NULL DEFAULT 100,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. PUESTOS Y DEPARTAMENTOS
CREATE TABLE departamentos_puestos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(100) NOT NULL UNIQUE,
  departamento VARCHAR(100) NOT NULL,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. USUARIOS (CON USERNAME Y CONTRASEÑA)
CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(60) NOT NULL UNIQUE,
  codigo_rrhh VARCHAR(50),
  nombre_completo VARCHAR(200) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  telefono VARCHAR(30),
  rol VARCHAR(30) NOT NULL CHECK (rol IN ('rrhh', 'asignador', 'colaborador')),
  puesto_id UUID REFERENCES departamentos_puestos(id) ON DELETE SET NULL,
  sede_id UUID REFERENCES sedes_zonas(id) ON DELETE SET NULL,
  asignador_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  facial_descriptor JSONB,
  facial_enrolled BOOLEAN NOT NULL DEFAULT false,
  facial_enrolled_at TIMESTAMP WITH TIME ZONE,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. HORARIOS Y TURNOS SEMANALES
CREATE TABLE horarios_turnos (
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

-- 5. MARCAJES DE ASISTENCIA Y GEOCERCA
CREATE TABLE marcajes_asistencia (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  hora_entrada TIMESTAMP WITH TIME ZONE,
  latitud_entrada DOUBLE PRECISION,
  longitud_entrada DOUBLE PRECISION,
  distancia_sede_entrada_metros DOUBLE PRECISION,
  en_rango_entrada BOOLEAN DEFAULT true,
  foto_entrada_url TEXT,
  hora_inicio_almuerzo TIMESTAMP WITH TIME ZONE,
  hora_fin_almuerzo TIMESTAMP WITH TIME ZONE,
  tomo_almuerzo BOOLEAN DEFAULT true,
  hora_salida TIMESTAMP WITH TIME ZONE,
  latitud_salida DOUBLE PRECISION,
  longitud_salida DOUBLE PRECISION,
  distancia_sede_salida_metros DOUBLE PRECISION,
  en_rango_salida BOOLEAN DEFAULT true,
  foto_salida_url TEXT,
  horas_trabajadas_totales DECIMAL(5,2) DEFAULT 0.00,
  horas_regulares DECIMAL(5,2) DEFAULT 0.00,
  horas_extras DECIMAL(5,2) DEFAULT 0.00,
  estado VARCHAR(30) DEFAULT 'presente' CHECK (estado IN ('presente', 'retardo', 'falta', 'justificado', 'descanso')),
  metodo_verificacion VARCHAR(30) DEFAULT 'facial',
  observaciones TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(usuario_id, fecha)
);

-- 6. JUSTIFICACIONES DE FALTAS Y REPOSICIONES
CREATE TABLE justificaciones_faltas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  asignador_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha_afectada DATE NOT NULL,
  tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('falta', 'llegada_tarde', 'salida_temprana', 'permiso')),
  motivo TEXT NOT NULL,
  comprobante_url TEXT,
  horas_a_reponer DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  fecha_compromiso_reposicion DATE,
  horas_repuestas DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  estado VARCHAR(30) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado', 'cumplido')),
  resolucion_asignador TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. BANCO DE HORAS Y DÍAS FESTIVOS
CREATE TABLE banco_horas_compensacion (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  semana_inicio DATE NOT NULL,
  semana_fin DATE NOT NULL,
  horas_meta DECIMAL(5,2) NOT NULL DEFAULT 40.00,
  horas_trabajadas DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  diferencia_horas DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  dias_festivos_laborados INTEGER NOT NULL DEFAULT 0,
  dias_compensados_tomados INTEGER NOT NULL DEFAULT 0,
  saldo_neto_horas DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  notas TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(usuario_id, semana_inicio)
);

-- 8. SISTEMA DE APRENDIZAJE (LMS) - CURSOS
CREATE TABLE lms_cursos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creado_por UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  titulo VARCHAR(200) NOT NULL,
  descripcion TEXT,
  contenido_texto TEXT NOT NULL,
  video_url TEXT,
  documento_url TEXT,
  tiempo_minimo_lectura_segundos INTEGER NOT NULL DEFAULT 120,
  puntuacion_minima_aprobacion INTEGER NOT NULL DEFAULT 80,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. ASIGNACIÓN DE CURSOS POR PUESTO O COLABORADOR
CREATE TABLE lms_asignaciones_cursos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  curso_id UUID NOT NULL REFERENCES lms_cursos(id) ON DELETE CASCADE,
  asignado_por UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  puesto_id UUID REFERENCES departamentos_puestos(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  fecha_limite DATE,
  obligatorio BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT check_asignacion CHECK (puesto_id IS NOT NULL OR usuario_id IS NOT NULL)
);

-- 10. EVALUACIONES GENERADAS POR IA
CREATE TABLE lms_evaluaciones_ia (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  curso_id UUID NOT NULL REFERENCES lms_cursos(id) ON DELETE CASCADE,
  preguntas_json JSONB NOT NULL,
  modelo_ia VARCHAR(50) DEFAULT 'gemini-flash-latest',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. AVANCES Y RESULTADOS DEL LMS
CREATE TABLE lms_avance_colaborador (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  curso_id UUID NOT NULL REFERENCES lms_cursos(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  segundos_lectura_reales INTEGER NOT NULL DEFAULT 0,
  lectura_completada BOOLEAN NOT NULL DEFAULT false,
  intentos_realizados INTEGER NOT NULL DEFAULT 0,
  puntuacion_obtenida DECIMAL(5,2),
  respuestas_usuario_json JSONB,
  aprobado BOOLEAN NOT NULL DEFAULT false,
  fecha_aprobacion TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(curso_id, usuario_id)
);

-- 12. LOG DE WHATSAPP
CREATE TABLE whatsapp_notificaciones_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  destinatario_usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  telefono VARCHAR(30) NOT NULL,
  tipo_evento VARCHAR(50) NOT NULL,
  mensaje TEXT NOT NULL,
  estado VARCHAR(30) DEFAULT 'enviado',
  fecha_envio TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- DATOS SEMILLA (PUESTOS BASE)
-- ==============================================================================

-- Puestos
INSERT INTO departamentos_puestos (id, nombre, departamento, descripcion) VALUES
  ('b1111111-1111-1111-1111-111111111111', 'Bartender', 'Alimentos y Bebidas', 'Preparación de coctelería, servicio de barra y control de inventario.'),
  ('b2222222-2222-2222-2222-222222222222', 'Chef / Cocina', 'Cocina', 'Elaboración de platillos, higiene alimentaria y control de línea.'),
  ('b3333333-3333-3333-3333-333333333333', 'Limpieza y Stewarding', 'Operaciones', 'Sanitización de áreas, químicos de limpieza y equipo.'),
  ('b4444444-4444-4444-4444-444444444444', 'Técnico de Soporte TI', 'Tecnología', 'Mantenimiento preventivo, redes y sistemas.');

-- Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol);
CREATE INDEX IF NOT EXISTS idx_usuarios_username ON usuarios(username);
CREATE INDEX IF NOT EXISTS idx_marcajes_fecha ON marcajes_asistencia(fecha);
CREATE INDEX IF NOT EXISTS idx_marcajes_usuario ON marcajes_asistencia(usuario_id);
CREATE INDEX IF NOT EXISTS idx_horarios_fecha_usuario ON horarios_turnos(usuario_id, fecha);
CREATE INDEX IF NOT EXISTS idx_lms_asignaciones_puesto ON lms_asignaciones_cursos(puesto_id);
CREATE INDEX IF NOT EXISTS idx_lms_asignaciones_usuario ON lms_asignaciones_cursos(usuario_id);



-- ==============================================================================
-- BOCO MARCAJE: MIGRACIÓN MULTIMARCA / MULTISUCURSAL + SUPER ADMIN
-- ------------------------------------------------------------------------------
-- NO BORRA DATOS. Es seguro ejecutarlo varias veces (idempotente).
--
-- ORDEN DE EJECUCIÓN EN SUPABASE (SQL Editor):
--   1) (Opcional) clean_and_rebuild_boco.sql   -> solo si quieres empezar de cero
--   2) migracion_multimarca.sql                -> ESTE archivo
--   3) importar_empleados_planilla.sql         -> carga los ~94 colaboradores
--
-- Qué hace:
--   * Crea la tabla `marcas` (Sky Zone, Toca Social, Bounce City, Epic Zone).
--   * Liga cada sede a una marca (sedes_zonas.marca_id) y le da un código corto.
--   * Agrega el rol `superadmin`.
--   * Permite colaboradores sin correo (RRHH aún no lo comparte).
--   * Hace único el ID de RRHH (codigo_rrhh).
--   * Crea las 6 sedes y el usuario Super Admin.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. MARCAS -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS marcas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(40) NOT NULL UNIQUE,
  nombre VARCHAR(100) NOT NULL,
  logo_url TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

INSERT INTO marcas (slug, nombre, logo_url) VALUES
  ('sky_zone',    'Sky Zone',    '/marcas/sky-zone.png'),
  ('toca_social', 'Toca Social', '/marcas/toca-social.svg'),
  ('bounce_city', 'Bounce City', '/marcas/bounce-city.jpg'),
  ('epic_zone',   'Epic Zone',   '/marcas/epic-zone.png')
ON CONFLICT (slug) DO UPDATE SET nombre = EXCLUDED.nombre, logo_url = EXCLUDED.logo_url;

-- 2. SEDES LIGADAS A UNA MARCA --------------------------------------------------
ALTER TABLE sedes_zonas ADD COLUMN IF NOT EXISTS marca_id UUID REFERENCES marcas(id) ON DELETE SET NULL;
ALTER TABLE sedes_zonas ADD COLUMN IF NOT EXISTS codigo VARCHAR(10);
ALTER TABLE sedes_zonas ADD COLUMN IF NOT EXISTS coordenadas_verificadas BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS ux_sedes_codigo ON sedes_zonas(codigo) WHERE codigo IS NOT NULL;

-- La sede "Toca social" ya creada manualmente: se liga a su marca sin tocar sus coordenadas.
UPDATE sedes_zonas
   SET marca_id = (SELECT id FROM marcas WHERE slug = 'toca_social'),
       codigo = 'TCS',
       coordenadas_verificadas = true
 WHERE lower(trim(nombre)) = 'toca social' AND codigo IS NULL;

-- Sedes nuevas. ATENCIÓN: las coordenadas son APROXIMADAS (coordenadas_verificadas = false).
-- El Super Admin debe abrir  Sedes -> Editar -> "Usar mi ubicación actual"  estando
-- físicamente en cada sucursal para fijar la geocerca real antes de que marquen.
INSERT INTO sedes_zonas (nombre, direccion, latitud, longitud, radio_metros, codigo, marca_id, coordenadas_verificadas) VALUES
  ('Sky Zone Majadas',        'Majadas Once, Zona 11, Guatemala',      14.6055, -90.5527, 100, 'SZM', (SELECT id FROM marcas WHERE slug='sky_zone'),    false),
  ('Sky Zone Cayalá',         'Paseo Cayalá, Zona 16, Guatemala',      14.6070, -90.4965, 100, 'SZC', (SELECT id FROM marcas WHERE slug='sky_zone'),    false),
  ('Sky Zone Galerías Tiffany','Galerías Tiffany, Guatemala',          14.5905, -90.5075, 100, 'SZT', (SELECT id FROM marcas WHERE slug='sky_zone'),    false),
  ('Bounce City',             'Guatemala',                             14.6349, -90.5069, 100, 'BCY', (SELECT id FROM marcas WHERE slug='bounce_city'), false),
  ('Epic Zone CAES',          'CAES, Km 14 Carretera a El Salvador',   14.5255, -90.4640, 100, 'EPZ', (SELECT id FROM marcas WHERE slug='epic_zone'),   false)
ON CONFLICT (codigo) WHERE codigo IS NOT NULL DO UPDATE SET marca_id = EXCLUDED.marca_id;

-- Si Toca Social aún no existía, se crea.
INSERT INTO sedes_zonas (nombre, direccion, latitud, longitud, radio_metros, codigo, marca_id, coordenadas_verificadas)
SELECT 'Toca Social', 'Guatemala', 14.6349, -90.5069, 100, 'TCS', (SELECT id FROM marcas WHERE slug='toca_social'), false
WHERE NOT EXISTS (SELECT 1 FROM sedes_zonas WHERE codigo = 'TCS');

-- 3. USUARIOS: ROL SUPERADMIN, CORREO OPCIONAL, ID RRHH ÚNICO --------------------
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'usuarios'::regclass AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%rol%'
  LOOP
    EXECUTE format('ALTER TABLE usuarios DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE usuarios
  ADD CONSTRAINT usuarios_rol_check CHECK (rol IN ('superadmin', 'rrhh', 'asignador', 'colaborador'));

ALTER TABLE usuarios ALTER COLUMN email DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_usuarios_codigo_rrhh ON usuarios(codigo_rrhh) WHERE codigo_rrhh IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_usuarios_sede ON usuarios(sede_id);
CREATE INDEX IF NOT EXISTS idx_sedes_marca ON sedes_zonas(marca_id);

-- 4. USUARIO SUPER ADMIN -------------------------------------------------------
-- Usuario: superadmin   Contraseña inicial: Boco2026#   (CÁMBIALA al primer ingreso, pestaña "Mi Clave")
INSERT INTO usuarios (username, codigo_rrhh, nombre_completo, email, password_hash, rol, activo)
VALUES (
  'superadmin', 'BOCO-SA-001', 'Super Administrador BOCO', 'superadmin@boco.com',
  'Boco2026#', 'superadmin', true
)
ON CONFLICT (username) DO NOTHING;

-- Verificación rápida:
-- SELECT m.nombre AS marca, s.codigo, s.nombre AS sede, s.coordenadas_verificadas FROM sedes_zonas s LEFT JOIN marcas m ON m.id = s.marca_id ORDER BY m.nombre, s.nombre;


-- ==============================================================================
-- BOCO MARCAJE: IMPORTACIÓN DE COLABORADORES DESDE LA PLANILLA DE RRHH
-- Generado automáticamente: 90 colaboradores, 17 puestos.
-- Requiere haber ejecutado antes: migracion_multimarca.sql
--
-- * ID RRHH provisional  = <SEDE>-<NNN>  (ej. SZM-001). El Super Admin puede
--   reemplazarlo por el ID real de nómina desde el panel (pestaña Colaboradores).
-- * Usuario de acceso    = ID en minúsculas (ej. szm-001). También pueden entrar con su ID RRHH.
-- * Contraseña inicial   = Boco2026#   (cada quien la cambia en "Mi Clave")
-- * Quedan SIN asignador y SIN correo; se asignan después desde el panel.
-- * Es idempotente: si se vuelve a ejecutar, no duplica usuarios.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. PUESTOS
INSERT INTO departamentos_puestos (nombre, departamento, descripcion) VALUES
  ('Vendedor corporativo', 'Ventas', 'Puesto importado de la planilla de RRHH'),
  ('Vendedor de eventos', 'Ventas', 'Puesto importado de la planilla de RRHH'),
  ('Vendedor de membresias', 'Ventas', 'Puesto importado de la planilla de RRHH'),
  ('Gerente de Operaciones', 'Gerencia y Operación', 'Puesto importado de la planilla de RRHH'),
  ('Gerente de Eventos', 'Gerencia y Operación', 'Puesto importado de la planilla de RRHH'),
  ('Cajero', 'Caja', 'Puesto importado de la planilla de RRHH'),
  ('Host', 'Recepción y Anfitriones', 'Puesto importado de la planilla de RRHH'),
  ('Host Bienvenida', 'Recepción y Anfitriones', 'Puesto importado de la planilla de RRHH'),
  ('Monitor', 'Monitores y Atracciones', 'Puesto importado de la planilla de RRHH'),
  ('Cocina', 'Cocina', 'Puesto importado de la planilla de RRHH'),
  ('Cleaning', 'Limpieza', 'Puesto importado de la planilla de RRHH'),
  ('Monitor Fin de Semana', 'Monitores y Atracciones', 'Puesto importado de la planilla de RRHH'),
  ('Host Fin de Semana', 'Recepción y Anfitriones', 'Puesto importado de la planilla de RRHH'),
  ('Líder de Operación', 'Gerencia y Operación', 'Puesto importado de la planilla de RRHH'),
  ('Anfitrión de Amenidades', 'Monitores y Atracciones', 'Puesto importado de la planilla de RRHH'),
  ('Gerente de Restaurante', 'Gerencia y Operación', 'Puesto importado de la planilla de RRHH'),
  ('Cajero Cafetería', 'Caja', 'Puesto importado de la planilla de RRHH'),
  ('Operations', 'Gerencia y Operación', 'Puesto Toca Social'),
  ('Hospitality', 'Hospitalidad y Servicio', 'Puesto Toca Social'),
  ('Check-in', 'Recepción y Anfitriones', 'Puesto Toca Social'),
  ('Teammate', 'Operación y Piso', 'Puesto Toca Social'),
  ('BAR', 'Barra y Bebidas', 'Puesto Toca Social'),
  ('Cleaning Staff', 'Limpieza', 'Puesto Toca Social'),
  ('Tech', 'Tecnología y Soporte', 'Puesto Toca Social')
ON CONFLICT (nombre) DO NOTHING;

-- 2. COLABORADORES (usuario formato inicial+apellido tipo 'dlima')
INSERT INTO usuarios (username, codigo_rrhh, nombre_completo, password_hash, rol, puesto_id, sede_id, activo)
SELECT v.username, v.codigo, v.nombre, 'Boco2026#', 'colaborador', p.id, s.id, true
FROM (VALUES
  ('SZM', 'SZM-001', 'morozco',      'Mildre Victoria Orozco López', 'Vendedor corporativo'),
  ('SZM', 'SZM-002', 'oespinosa',    'Osnyel Espinosa Llera', 'Vendedor de eventos'),
  ('SZM', 'SZM-003', 'ngudiel',      'Nereyda Maricela Gudiel Pineda', 'Vendedor de membresias'),
  ('SZM', 'SZM-004', 'kdonis',       'Kelin Elisa Donis Hernández', 'Gerente de Operaciones'),
  ('SZM', 'SZM-005', 'ysanchez',     'Yoaldi Dennisse Sanchez Salvatierra', 'Gerente de Eventos'),
  ('SZM', 'SZM-006', 'jrucal',       'Jeisel Sucely Janneth Rucal Ovalle', 'Cajero'),
  ('SZM', 'SZM-007', 'rescobar',     'Randy Elí Escobar Urzúa', 'Host'),
  ('SZM', 'SZM-008', 'ncaballeros',  'Nataly Azucena Marysol Caballeros Hernández', 'Host'),
  ('SZM', 'SZM-009', 'calinado',     'Candy Viviana Aliñado Monterroso', 'Host'),
  ('SZM', 'SZM-010', 'rgrave',       'Rosa Regina Grave Canizales', 'Host Bienvenida'),
  ('SZM', 'SZM-011', 'eardon',       'Emely María Fernanda Ardón Argueta', 'Host Bienvenida'),
  ('SZM', 'SZM-012', 'rcruz',        'Rodrigo Antonio Cruz Rivera', 'Monitor'),
  ('SZM', 'SZM-013', 'agil',         'Andreú Gil Berduo', 'Monitor'),
  ('SZM', 'SZM-014', 'jhernandez',   'José Andrés Hernández Cano', 'Monitor'),
  ('SZM', 'SZM-015', 'kixtecoc',     'Karen Aida Ixtecoc Zet', 'Monitor'),
  ('SZM', 'SZM-016', 'dquevedo',     'Darleén Mariana Quevedo de la Cruz', 'Monitor'),
  ('SZM', 'SZM-017', 'mmancilla',    'Mirella Johanna Mancilla Marroquín', 'Cocina'),
  ('SZM', 'SZM-018', 'cruiz',        'Cesar Emanuel Ruiz Ortega', 'Cleaning'),
  ('SZM', 'SZM-019', 'eurias',       'Edson Anderson Urias Mayen', 'Cleaning'),
  ('SZM', 'SZM-020', 'jjimenez',     'Joseph Anderson Jimenez Tay', 'Monitor Fin de Semana'),
  ('SZM', 'SZM-021', 'smendez',      'Sophia Mendez Pinelo', 'Monitor Fin de Semana'),
  ('SZM', 'SZM-022', 'asalvador',    'Adriana Rocio Salvador Cortez', 'Host Fin de Semana'),
  ('SZC', 'SZC-001', 'ahernandez',   'Alberto Hernandez', 'Vendedor corporativo'),
  ('SZC', 'SZC-002', 'jochoa',       'Jeffersson Alejandro Ochoa Morales', 'Vendedor de eventos'),
  ('SZC', 'SZC-003', 'jcarranza',    'Jennifer Gabriela Carranza Méndez', 'Vendedor de membresias'),
  ('SZC', 'SZC-004', 'uestrada',     'Ubaldo Noe Estrada Soto', 'Gerente de Operaciones'),
  ('SZC', 'SZC-005', 'igonzales',    'Isidro Luis Gonzales Corado', 'Gerente de Eventos'),
  ('SZC', 'SZC-006', 'rgomez',       'Ronald Leonel Gómez Aguilar', 'Cajero'),
  ('SZC', 'SZC-007', 'adelcid',      'Avril del Cid Ruano', 'Host'),
  ('SZC', 'SZC-008', 'gcardona',     'Gerson Adrian Gudelio Cardona Estrada', 'Host'),
  ('SZC', 'SZC-009', 'jruiz',        'José Daniel Ruíz Ruíz', 'Host'),
  ('SZC', 'SZC-010', 'jzetina',      'Jose Pablo Zetina Sandoval', 'Host Bienvenida'),
  ('SZC', 'SZC-011', 'mixcotoyac',   'Mario Andres Ixcotoyac Cruz', 'Host Bienvenida'),
  ('SZC', 'SZC-012', 'idavila',      'Iris Stefany Dávila Barrientos', 'Host Bienvenida'),
  ('SZC', 'SZC-013', 'mgarcia',      'Marco Javier García López', 'Monitor'),
  ('SZC', 'SZC-014', 'psanchez',     'Paula Marina Sanchez Sheron', 'Monitor'),
  ('SZC', 'SZC-015', 'ypineda',      'Yoselin Liseth Pineda Puac', 'Monitor'),
  ('SZC', 'SZC-016', 'lalvarado',    'Leslie Janeth Alvarado Rodriguez', 'Monitor'),
  ('SZC', 'SZC-017', 'mdeleon',      'Manuel Eduardo de León Caminale', 'Monitor'),
  ('SZC', 'SZC-018', 'aramos',       'Angel David Ramos Méndez', 'Monitor'),
  ('SZC', 'SZC-019', 'mordonez',     'Miriam Noemi Ordoñez Chic', 'Cocina'),
  ('SZC', 'SZC-020', 'acruz',        'Astrid Gricelda Cruz Flores', 'Cocina'),
  ('SZC', 'SZC-021', 'qmendez',      'Queylin Victoria Méndez López', 'Cleaning'),
  ('SZC', 'SZC-022', 'smartinez',    'Sendy Meliza Martínez Pinto', 'Cleaning'),
  ('SZC', 'SZC-023', 'hjuarez',      'Henry Emanuel Juarez Ortiz', 'Cleaning'),
  ('SZC', 'SZC-024', 'kgomez',       'Karen Floridalma Gómez Vasquez', 'Host Fin de Semana'),
  ('SZT', 'SZT-001', 'crivas',       'Carlos Steeven Rivas', 'Vendedor de eventos'),
  ('SZT', 'SZT-002', 'dpernilla',    'Daniel Armando Pernilla Morales', 'Vendedor de membresias'),
  ('SZT', 'SZT-003', 'lorozco',      'Leslie Alejandra Orozco Cardona', 'Gerente de Operaciones'),
  ('SZT', 'SZT-004', 'aalfaro',      'Ana Gabriela Alfaro Cabrera', 'Gerente de Eventos'),
  ('SZT', 'SZT-005', 'bmartir',      'Bianky Mayerly Mártir Ortíz', 'Cajero'),
  ('SZT', 'SZT-006', 'agiron',       'Alaniz Nicoll Girón Gramajo', 'Cajero'),
  ('SZT', 'SZT-007', 'mpgarcia',     'Marjorie Pamela García López', 'Host'),
  ('SZT', 'SZT-008', 'jrodriguez',   'Juan Esteban Rodríguez Porres', 'Host'),
  ('SZT', 'SZT-009', 'drivera',      'Diego Gabriel Alejandro Rivera de Paz', 'Monitor'),
  ('SZT', 'SZT-010', 'rletona',      'Rosa Angie Letona Solares', 'Monitor'),
  ('SZT', 'SZT-011', 'rsandoval',    'Ricardo André Sandoval Ramírez', 'Monitor'),
  ('SZT', 'SZT-012', 'dcaal',        'Dannia Nicole Caal González', 'Monitor'),
  ('SZT', 'SZT-013', 'sescobar',     'Sonia Beatriz Escobar Gonzalez', 'Cocina'),
  ('SZT', 'SZT-014', 'eaju',         'Elena Aju', 'Cocina'),
  ('SZT', 'SZT-015', 'apineda',      'Anthony Josué Pineda Escobar', 'Cleaning'),
  ('SZT', 'SZT-016', 'jtocay',       'Jennifer Marina Tocay Galvez', 'Cleaning'),
  ('SZT', 'SZT-017', 'avasquez',     'Andrea Elisabelle Vásquez Aguilar', 'Monitor Fin de Semana'),
  ('SZT', 'SZT-018', 'jlemus',       'Jasmin Alejandra Lemus Ramirez', 'Host Fin de Semana'),
  ('BCY', 'BCY-001', 'eperez',       'Edin Amilcar Pérez Pirir', 'Líder de Operación'),
  ('BCY', 'BCY-002', 'jvasquez',     'Jeefryan Ander Vásquez Ruiz', 'Anfitrión de Amenidades'),
  ('BCY', 'BCY-003', 'dhernandez',   'Dylan Gabriel Hernández Echeverria', 'Anfitrión de Amenidades'),
  ('EPZ', 'EPZ-001', 'tdealtan',     'Tannia Irasema Dealtan Gonzalez', 'Gerente de Operaciones'),
  ('EPZ', 'EPZ-002', 'jbethancourt', 'Jose Fernando Bethancourt Pineda', 'Gerente de Restaurante'),
  ('EPZ', 'EPZ-003', 'kzepeda',      'Kristian Aldiery Zepeda Donis', 'Gerente de Eventos'),
  ('EPZ', 'EPZ-004', 'kruano',       'Keyla Samanta Ruano Acevedo', 'Cajero'),
  ('EPZ', 'EPZ-005', 'hlorenzana',   'Heidi Gabriela Lorenzana Valenzuela', 'Cajero'),
  ('EPZ', 'EPZ-006', 'sperez',       'Sandra Elizabeth Perez Corleto', 'Cajero'),
  ('EPZ', 'EPZ-007', 'ematheu',      'Elba Estrellita Matheu', 'Cajero Cafetería'),
  ('EPZ', 'EPZ-008', 'dlinares',     'Daniel Josue Linares Aquino', 'Host'),
  ('EPZ', 'EPZ-009', 'esanchez',     'Evelyn Beatriz Sánchez Sarceño', 'Host'),
  ('EPZ', 'EPZ-010', 'jsantacruz',   'Joshep Abraham Santacruz', 'Host'),
  ('EPZ', 'EPZ-011', 'achete',       'Angela Natividad Chete Pineda', 'Host Bienvenida'),
  ('EPZ', 'EPZ-012', 'jasicon',      'Jose Gabriel Asicon Davila', 'Host Bienvenida'),
  ('EPZ', 'EPZ-013', 'dtorres',      'Diego Jose Torres', 'Monitor'),
  ('EPZ', 'EPZ-014', 'mcontreras',   'Maybell Yaneliss Contreras', 'Monitor'),
  ('EPZ', 'EPZ-015', 'emorales',     'Estrephany Gabriela Morales', 'Monitor'),
  ('EPZ', 'EPZ-016', 'forozco',      'Fatima Mayte Orozco', 'Monitor'),
  ('EPZ', 'EPZ-017', 'mrivera',      'Milvia Maricruz Rivera Farfan', 'Monitor'),
  ('EPZ', 'EPZ-018', 'jsantos',      'Jose Andres Santos Juarez', 'Monitor'),
  ('EPZ', 'EPZ-019', 'econcua',      'Evelyn Alejandra Concua Estacuy', 'Cocina'),
  ('EPZ', 'EPZ-020', 'dcruz',        'Deisy Suzely Cruz Ramirez', 'Cocina'),
  ('EPZ', 'EPZ-021', 'jchacon',      'Josseline Scarlette Chacon Hernandez', 'Cleaning'),
  ('EPZ', 'EPZ-022', 'jcastillo',    'Jeidy Guadalupe Castillo', 'Cleaning'),
  ('EPZ', 'EPZ-023', 'asamayoa',     'Andrea Alexandra Samayoa Lopz', 'Host Fin de Semana'),
  ('TCS', 'TCS-001', 'mouvarer',     'Many Ouvarer', 'Operations'),
  ('TCS', 'TCS-002', 'daguns',       'Daniel Aguns', 'Hospitality'),
  ('TCS', 'TCS-003', 'wmorano',      'William Morano', 'Hospitality'),
  ('TCS', 'TCS-004', 'mvelasquist',  'Mariela Velasquist', 'Check-in'),
  ('TCS', 'TCS-005', 'dperez',       'Daniela Perez', 'Check-in'),
  ('TCS', 'TCS-006', 'suy',          'Suy', 'Host'),
  ('TCS', 'TCS-007', 'nquisen',      'Nini Quisen', 'Host'),
  ('TCS', 'TCS-008', 'agutierrez',   'Ana Karen Gutierrez', 'Host'),
  ('TCS', 'TCS-009', 'nherrtez',     'Nahomi Herrtez', 'Host'),
  ('TCS', 'TCS-010', 'leonel',       'Leonel', 'Teammate'),
  ('TCS', 'TCS-011', 'aprod',        'Adolfo Prod', 'Teammate'),
  ('TCS', 'TCS-012', 'aguisela',     'Astrid Guisela', 'Teammate'),
  ('TCS', 'TCS-013', 'estefani',     'Estefani', 'Teammate'),
  ('TCS', 'TCS-014', 'marvin',       'Marvin', 'Teammate'),
  ('TCS', 'TCS-015', 'kcastillo',    'Kevin Castillo', 'BAR'),
  ('TCS', 'TCS-016', 'castillo',     'Castillo', 'BAR'),
  ('TCS', 'TCS-017', 'malani',       'Malani', 'BAR'),
  ('TCS', 'TCS-018', 'cleaning',     'Cleaning Staff', 'Cleaning Staff'),
  ('TCS', 'TCS-019', 'hemalatha',    'Hemalatha', 'Tech'),
  ('TCS', 'TCS-020', 'emanuel',      'Emanuel', 'Tech')
) AS v(sede_codigo, codigo, username, nombre, puesto)
JOIN sedes_zonas s ON s.codigo = v.sede_codigo
JOIN departamentos_puestos p ON p.nombre = v.puesto
ON CONFLICT (codigo_rrhh) WHERE codigo_rrhh IS NOT NULL DO UPDATE
   SET username = EXCLUDED.username;

-- Si Derek Lima (@dlima) ya existe, lo vinculamos a Toca Social (TCS) y puesto Tech; si no existe, lo creamos como TCS-021
UPDATE usuarios
   SET sede_id = (SELECT id FROM sedes_zonas WHERE codigo = 'TCS'),
       puesto_id = (SELECT id FROM departamentos_puestos WHERE nombre = 'Tech')
 WHERE username = 'dlima';

INSERT INTO usuarios (username, codigo_rrhh, nombre_completo, password_hash, rol, puesto_id, sede_id, activo)
SELECT 'tcs-021', 'TCS-021', 'Derek', 'Boco2026#', 'colaborador',
       (SELECT id FROM departamentos_puestos WHERE nombre = 'Tech'),
       (SELECT id FROM sedes_zonas WHERE codigo = 'TCS'),
       true
WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE username IN ('dlima', 'tcs-021'));

-- 3. VERIFICACIÓN: colaboradores por sede (debe sumar 90 + los que ya existían)
-- SELECT s.nombre, count(*) FROM usuarios u JOIN sedes_zonas s ON s.id = u.sede_id WHERE u.rol = 'colaborador' GROUP BY s.nombre ORDER BY s.nombre;


