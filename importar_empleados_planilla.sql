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
