-- ============================================================================
-- POSTGRESQL: Hacer ID editable en proyectos
-- ============================================================================
-- Este script permite editar el ID de la tabla proyectos

-- PASO 1: Verificar estructura actual de proyectos
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'proyectos' 
-- ORDER BY ordinal_position;

-- PASO 2: Si el ID es SERIAL/BIGSERIAL, cambiar para permitir edición
-- Primero, eliminar la restricción de auto-increment (DEFAULT)
ALTER TABLE proyectos ALTER COLUMN id DROP DEFAULT;

-- PASO 3: Cambiar el tipo de dato a INTEGER o BIGINT (sin auto-increment)
-- Si ya es INTEGER/BIGINT, este paso no es necesario
-- ALTER TABLE proyectos ALTER COLUMN id TYPE BIGINT;

-- Alternativamente, si quieres permitir IDs de texto también (VARCHAR):
-- ALTER TABLE proyectos ALTER COLUMN id TYPE VARCHAR(50);
-- Esto permitiría IDs como "PROY-001", "CLI-2024", etc.


-- ============================================================================
-- EJEMPLO DE USO: Editar ID de proyecto
-- ============================================================================

-- Ver estructura actual
SELECT id, nombre, ubicacion_del_proyecto, horas_totales
FROM proyectos
LIMIT 5;

-- Método 1: Cambiar el ID directamente (si no hay restricciones de FK)
UPDATE proyectos
SET id = 1001
WHERE id = 16;

-- Método 2: Crear proyecto con ID específico (si no existe)
INSERT INTO proyectos (id, nombre, ubicacion_del_proyecto, soluciones, horas_totales)
VALUES (2001, 'Nuevo Proyecto', 'Ubicación', 'Contacto', 100);

-- Método 3: Si hay restricciones de FK, necesitas copiar y eliminar
-- PASO 1: Crear nuevo proyecto con nuevo ID
INSERT INTO proyectos (id, nombre, ubicacion_del_proyecto, soluciones, horas_totales)
SELECT 
  2001 as id,  -- Nuevo ID
  nombre,
  ubicacion_del_proyecto,
  soluciones,
  horas_totales
FROM proyectos
WHERE id = 16;

-- PASO 2: Actualizar referencias en otras tablas (si las hay)
-- UPDATE otra_tabla SET proyecto_id = 2001 WHERE proyecto_id = 16;

-- PASO 3: Eliminar proyecto antiguo
DELETE FROM proyectos WHERE id = 16;


-- ============================================================================
-- SCRIPT COMPLETO PARA HACER TODO EDITABLE
-- ============================================================================

-- 1. Agregar columnas a empleados (si no existen)
ALTER TABLE empleados
ADD COLUMN IF NOT EXISTS dpi VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS numero_celular VARCHAR(20);

-- 2. Crear índice en DPI
CREATE INDEX IF NOT EXISTS idx_empleados_dpi ON empleados(dpi);

-- 3. Permitir edición de ID en empleados
-- (Ya viene editable por defecto en la mayoría de BDs)
-- Si tiene DEFAULT AUTO INCREMENT, eliminar:
-- ALTER TABLE empleados ALTER COLUMN id DROP DEFAULT;

-- 4. Permitir edición de ID en proyectos
ALTER TABLE proyectos ALTER COLUMN id DROP DEFAULT;

-- 5. Verificar cambios
SELECT 
  table_name,
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name IN ('empleados', 'proyectos')
ORDER BY table_name, ordinal_position;
