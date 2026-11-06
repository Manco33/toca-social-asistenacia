-- ============================================================================
-- POSTGRESQL: Agregar DPI y celular a empleados
-- ============================================================================
-- Este script agrega campos DPI (identificador editable) y número celular
-- El ID existente se mantiene intacto, DPI es el identificador principal editable

-- PASO 1: Agregar columnas DPI y celular a empleados
-- DPI: Documento de identidad personal (hasta 13 cifras, editable)
-- numero_celular: Número telefónico
ALTER TABLE empleados
ADD COLUMN IF NOT EXISTS dpi VARCHAR(13),
ADD COLUMN IF NOT EXISTS numero_celular VARCHAR(20);

-- PASO 2: Crear índice en DPI para búsquedas y actualizaciones rápidas
-- Recomendado: crear un índice único parcial que excluya NULLs para
-- evitar conflictos con valores vacíos o no definidos.
-- IMPORTANTE: si hay duplicados reales (dos empleados con mismo DPI
-- no-NULL), la creación del índice único fallará y deberás limpiar
-- esos duplicados primero (ver sección de reparación más abajo).
CREATE UNIQUE INDEX IF NOT EXISTS idx_empleados_dpi ON empleados(dpi) WHERE dpi IS NOT NULL;

-- PASO 3: Crear restricción CHECK para validar que DPI sea numérico y máximo 13 dígitos
-- Aseguramos que el valor sea NULL o solo dígitos (1 a 13 cifras)
ALTER TABLE empleados
DROP CONSTRAINT IF EXISTS check_dpi_format;
ALTER TABLE empleados
ADD CONSTRAINT check_dpi_format CHECK (dpi IS NULL OR (dpi ~ '^[0-9]{1,13}$'));

-- El ID se mantiene como antes (sin cambios)
-- El DPI es el identificador editable que apunta al empleado


-- ============================================================================
-- EJEMPLO DE USO: Actualizar empleado con DPI y celular
-- ============================================================================

-- Agregar DPI y celular a un empleado existente:
-- El DPI es editable y sirve como identificador alternativo (máximo 13 cifras)
UPDATE empleados
SET 
  dpi = '1234567890123',  -- 13 cifras máximo
  numero_celular = '+502 7123 4567'
WHERE id = 1;

-- Ver empleados con DPI:
SELECT id, nombre, usuario, dpi, numero_celular, rol
FROM empleados
WHERE dpi IS NOT NULL AND dpi != ''
ORDER BY id;

-- Buscar empleado por DPI:
SELECT id, nombre, usuario, dpi, numero_celular
FROM empleados
WHERE dpi = '1234567890123';

-- Editar/actualizar DPI de un empleado (cambiar a un DPI diferente):
UPDATE empleados
SET dpi = '9876543210987'
WHERE id = 1;

-- Validar que DPI tenga formato correcto (solo números, máximo 13):
-- El constraint CHECK se encarga automáticamente de validar esto
-- Si intentas insertar DPI con formato inválido, PostgreSQL lo rechazará
