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
