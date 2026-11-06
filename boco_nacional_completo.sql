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

-- 2. COLABORADORES
INSERT INTO usuarios (username, codigo_rrhh, nombre_completo, password_hash, rol, puesto_id, sede_id, activo)
SELECT v.username, v.codigo, v.nombre, 'Boco2026#', 'colaborador', p.id, s.id, true
FROM (VALUES
  ('SZM', 'SZM-001', 'szm-001', 'Mildre Victoria Orozco López', 'Vendedor corporativo'),
  ('SZM', 'SZM-002', 'szm-002', 'Osnyel Espinosa Llera', 'Vendedor de eventos'),
  ('SZM', 'SZM-003', 'szm-003', 'Nereyda Maricela Gudiel Pineda', 'Vendedor de membresias'),
  ('SZM', 'SZM-004', 'szm-004', 'Kelin Elisa Donis Hernández', 'Gerente de Operaciones'),
  ('SZM', 'SZM-005', 'szm-005', 'Yoaldi Dennisse Sanchez Salvatierra', 'Gerente de Eventos'),
  ('SZM', 'SZM-006', 'szm-006', 'Jeisel Sucely Janneth Rucal Ovalle', 'Cajero'),
  ('SZM', 'SZM-007', 'szm-007', 'Randy Elí Escobar Urzúa', 'Host'),
  ('SZM', 'SZM-008', 'szm-008', 'Nataly Azucena Marysol Caballeros Hernández', 'Host'),
  ('SZM', 'SZM-009', 'szm-009', 'Candy Viviana Aliñado Monterroso', 'Host'),
  ('SZM', 'SZM-010', 'szm-010', 'Rosa Regina Grave Canizales', 'Host Bienvenida'),
  ('SZM', 'SZM-011', 'szm-011', 'Emely María Fernanda Ardón Argueta', 'Host Bienvenida'),
  ('SZM', 'SZM-012', 'szm-012', 'Rodrigo Antonio Cruz Rivera', 'Monitor'),
  ('SZM', 'SZM-013', 'szm-013', 'Andreú Gil Berduo', 'Monitor'),
  ('SZM', 'SZM-014', 'szm-014', 'José Andrés Hernández Cano', 'Monitor'),
  ('SZM', 'SZM-015', 'szm-015', 'Karen Aida Ixtecoc Zet', 'Monitor'),
  ('SZM', 'SZM-016', 'szm-016', 'Darleén Mariana Quevedo de la Cruz', 'Monitor'),
  ('SZM', 'SZM-017', 'szm-017', 'Mirella Johanna Mancilla Marroquín', 'Cocina'),
  ('SZM', 'SZM-018', 'szm-018', 'Cesar Emanuel Ruiz Ortega', 'Cleaning'),
  ('SZM', 'SZM-019', 'szm-019', 'Edson Anderson Urias Mayen', 'Cleaning'),
  ('SZM', 'SZM-020', 'szm-020', 'Joseph Anderson Jimenez Tay', 'Monitor Fin de Semana'),
  ('SZM', 'SZM-021', 'szm-021', 'Sophia Mendez Pinelo', 'Monitor Fin de Semana'),
  ('SZM', 'SZM-022', 'szm-022', 'Adriana Rocio Salvador Cortez', 'Host Fin de Semana'),
  ('SZC', 'SZC-001', 'szc-001', 'Alberto Hernandez', 'Vendedor corporativo'),
  ('SZC', 'SZC-002', 'szc-002', 'Jeffersson Alejandro Ochoa Morales', 'Vendedor de eventos'),
  ('SZC', 'SZC-003', 'szc-003', 'Jennifer Gabriela Carranza Méndez', 'Vendedor de membresias'),
  ('SZC', 'SZC-004', 'szc-004', 'Ubaldo Noe Estrada Soto', 'Gerente de Operaciones'),
  ('SZC', 'SZC-005', 'szc-005', 'Isidro Luis Gonzales Corado', 'Gerente de Eventos'),
  ('SZC', 'SZC-006', 'szc-006', 'Ronald Leonel Gómez Aguilar', 'Cajero'),
  ('SZC', 'SZC-007', 'szc-007', 'Avril del Cid Ruano', 'Host'),
  ('SZC', 'SZC-008', 'szc-008', 'Gerson Adrian Gudelio Cardona Estrada', 'Host'),
  ('SZC', 'SZC-009', 'szc-009', 'José Daniel Ruíz Ruíz', 'Host'),
  ('SZC', 'SZC-010', 'szc-010', 'Jose Pablo Zetina Sandoval', 'Host Bienvenida'),
  ('SZC', 'SZC-011', 'szc-011', 'Mario Andres Ixcotoyac Cruz', 'Host Bienvenida'),
  ('SZC', 'SZC-012', 'szc-012', 'Iris Stefany Dávila Barrientos', 'Host Bienvenida'),
  ('SZC', 'SZC-013', 'szc-013', 'Marco Javier García López', 'Monitor'),
  ('SZC', 'SZC-014', 'szc-014', 'Paula Marina Sanchez Sheron', 'Monitor'),
  ('SZC', 'SZC-015', 'szc-015', 'Yoselin Liseth Pineda Puac', 'Monitor'),
  ('SZC', 'SZC-016', 'szc-016', 'Leslie Janeth Alvarado Rodriguez', 'Monitor'),
  ('SZC', 'SZC-017', 'szc-017', 'Manuel Eduardo de León Caminale', 'Monitor'),
  ('SZC', 'SZC-018', 'szc-018', 'Angel David Ramos Méndez', 'Monitor'),
  ('SZC', 'SZC-019', 'szc-019', 'Miriam Noemi Ordoñez Chic', 'Cocina'),
  ('SZC', 'SZC-020', 'szc-020', 'Astrid Gricelda Cruz Flores', 'Cocina'),
  ('SZC', 'SZC-021', 'szc-021', 'Queylin Victoria Méndez López', 'Cleaning'),
  ('SZC', 'SZC-022', 'szc-022', 'Sendy Meliza Martínez Pinto', 'Cleaning'),
  ('SZC', 'SZC-023', 'szc-023', 'Henry Emanuel Juarez Ortiz', 'Cleaning'),
  ('SZC', 'SZC-024', 'szc-024', 'Karen Floridalma Gómez Vasquez', 'Host Fin de Semana'),
  ('SZT', 'SZT-001', 'szt-001', 'Carlos Steeven Rivas', 'Vendedor de eventos'),
  ('SZT', 'SZT-002', 'szt-002', 'Daniel Armando Pernilla Morales', 'Vendedor de membresias'),
  ('SZT', 'SZT-003', 'szt-003', 'Leslie Alejandra Orozco Cardona', 'Gerente de Operaciones'),
  ('SZT', 'SZT-004', 'szt-004', 'Ana Gabriela Alfaro Cabrera', 'Gerente de Eventos'),
  ('SZT', 'SZT-005', 'szt-005', 'Bianky Mayerly Mártir Ortíz', 'Cajero'),
  ('SZT', 'SZT-006', 'szt-006', 'Alaniz Nicoll Girón Gramajo', 'Cajero'),
  ('SZT', 'SZT-007', 'szt-007', 'Marjorie Pamela García López', 'Host'),
  ('SZT', 'SZT-008', 'szt-008', 'Juan Esteban Rodríguez Porres', 'Host'),
  ('SZT', 'SZT-009', 'szt-009', 'Diego Gabriel Alejandro Rivera de Paz', 'Monitor'),
  ('SZT', 'SZT-010', 'szt-010', 'Rosa Angie Letona Solares', 'Monitor'),
  ('SZT', 'SZT-011', 'szt-011', 'Ricardo André Sandoval Ramírez', 'Monitor'),
  ('SZT', 'SZT-012', 'szt-012', 'Dannia Nicole Caal González', 'Monitor'),
  ('SZT', 'SZT-013', 'szt-013', 'Sonia Beatriz Escobar Gonzalez', 'Cocina'),
  ('SZT', 'SZT-014', 'szt-014', 'Elena Aju', 'Cocina'),
  ('SZT', 'SZT-015', 'szt-015', 'Anthony Josué Pineda Escobar', 'Cleaning'),
  ('SZT', 'SZT-016', 'szt-016', 'Jennifer Marina Tocay Galvez', 'Cleaning'),
  ('SZT', 'SZT-017', 'szt-017', 'Andrea Elisabelle Vásquez Aguilar', 'Monitor Fin de Semana'),
  ('SZT', 'SZT-018', 'szt-018', 'Jasmin Alejandra Lemus Ramirez', 'Host Fin de Semana'),
  ('BCY', 'BCY-001', 'bcy-001', 'Edin Amilcar Pérez Pirir', 'Líder de Operación'),
  ('BCY', 'BCY-002', 'bcy-002', 'Jeefryan Ander Vásquez Ruiz', 'Anfitrión de Amenidades'),
  ('BCY', 'BCY-003', 'bcy-003', 'Dylan Gabriel Hernández Echeverria', 'Anfitrión de Amenidades'),
  ('EPZ', 'EPZ-001', 'epz-001', 'Tannia Irasema Dealtan Gonzalez', 'Gerente de Operaciones'),
  ('EPZ', 'EPZ-002', 'epz-002', 'Jose Fernando Bethancourt Pineda', 'Gerente de Restaurante'),
  ('EPZ', 'EPZ-003', 'epz-003', 'Kristian Aldiery Zepeda Donis', 'Gerente de Eventos'),
  ('EPZ', 'EPZ-004', 'epz-004', 'Keyla Samanta Ruano Acevedo', 'Cajero'),
  ('EPZ', 'EPZ-005', 'epz-005', 'Heidi Gabriela Lorenzana Valenzuela', 'Cajero'),
  ('EPZ', 'EPZ-006', 'epz-006', 'Sandra Elizabeth Perez Corleto', 'Cajero'),
  ('EPZ', 'EPZ-007', 'epz-007', 'Elba Estrellita Matheu', 'Cajero Cafetería'),
  ('EPZ', 'EPZ-008', 'epz-008', 'Daniel Josue Linares Aquino', 'Host'),
  ('EPZ', 'EPZ-009', 'epz-009', 'Evelyn Beatriz Sánchez Sarceño', 'Host'),
  ('EPZ', 'EPZ-010', 'epz-010', 'Joshep Abraham Santacruz', 'Host'),
  ('EPZ', 'EPZ-011', 'epz-011', 'Angela Natividad Chete Pineda', 'Host Bienvenida'),
  ('EPZ', 'EPZ-012', 'epz-012', 'Jose Gabriel Asicon Davila', 'Host Bienvenida'),
  ('EPZ', 'EPZ-013', 'epz-013', 'Diego Jose Torres', 'Monitor'),
  ('EPZ', 'EPZ-014', 'epz-014', 'Maybell Yaneliss Contreras', 'Monitor'),
  ('EPZ', 'EPZ-015', 'epz-015', 'Estrephany Gabriela Morales', 'Monitor'),
  ('EPZ', 'EPZ-016', 'epz-016', 'Fatima Mayte Orozco', 'Monitor'),
  ('EPZ', 'EPZ-017', 'epz-017', 'Milvia Maricruz Rivera Farfan', 'Monitor'),
  ('EPZ', 'EPZ-018', 'epz-018', 'Jose Andres Santos Juarez', 'Monitor'),
  ('EPZ', 'EPZ-019', 'epz-019', 'Evelyn Alejandra Concua Estacuy', 'Cocina'),
  ('EPZ', 'EPZ-020', 'epz-020', 'Deisy Suzely Cruz Ramirez', 'Cocina'),
  ('EPZ', 'EPZ-021', 'epz-021', 'Josseline Scarlette Chacon Hernandez', 'Cleaning'),
  ('EPZ', 'EPZ-022', 'epz-022', 'Jeidy Guadalupe Castillo', 'Cleaning'),
  ('EPZ', 'EPZ-023', 'epz-023', 'Andrea Alexandra Samayoa Lopz', 'Host Fin de Semana'),
  ('TCS', 'TCS-001', 'tcs-001', 'Many Ouvarer', 'Operations'),
  ('TCS', 'TCS-002', 'tcs-002', 'Daniel Aguns', 'Hospitality'),
  ('TCS', 'TCS-003', 'tcs-003', 'William Morano', 'Hospitality'),
  ('TCS', 'TCS-004', 'tcs-004', 'Mariela Velasquist', 'Check-in'),
  ('TCS', 'TCS-005', 'tcs-005', 'Daniela Perez', 'Check-in'),
  ('TCS', 'TCS-006', 'tcs-006', 'Suy', 'Host'),
  ('TCS', 'TCS-007', 'tcs-007', 'Nini Quisen', 'Host'),
  ('TCS', 'TCS-008', 'tcs-008', 'Ana Karen Gutierrez', 'Host'),
  ('TCS', 'TCS-009', 'tcs-009', 'Nahomi Herrtez', 'Host'),
  ('TCS', 'TCS-010', 'tcs-010', 'Leonel', 'Teammate'),
  ('TCS', 'TCS-011', 'tcs-011', 'Adolfo Prod', 'Teammate'),
  ('TCS', 'TCS-012', 'tcs-012', 'Astrid Guisela', 'Teammate'),
  ('TCS', 'TCS-013', 'tcs-013', 'Estefani', 'Teammate'),
  ('TCS', 'TCS-014', 'tcs-014', 'Marvin', 'Teammate'),
  ('TCS', 'TCS-015', 'tcs-015', 'Kevin Castillo', 'BAR'),
  ('TCS', 'TCS-016', 'tcs-016', 'Castillo', 'BAR'),
  ('TCS', 'TCS-017', 'tcs-017', 'Malani', 'BAR'),
  ('TCS', 'TCS-018', 'tcs-018', 'Cleaning Staff', 'Cleaning Staff'),
  ('TCS', 'TCS-019', 'tcs-019', 'Hemalatha', 'Tech'),
  ('TCS', 'TCS-020', 'tcs-020', 'Emanuel', 'Tech')
) AS v(sede_codigo, codigo, username, nombre, puesto)
JOIN sedes_zonas s ON s.codigo = v.sede_codigo
JOIN departamentos_puestos p ON p.nombre = v.puesto
ON CONFLICT (username) DO NOTHING;

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

