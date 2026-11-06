-- ============================================================================
-- MIGRATION GUIDE: Database Schema Updates for DPI, Celular, and Custom Project IDs
-- ============================================================================
-- 
-- This guide provides step-by-step instructions to update your database schema
-- to support: DPI and celular fields for employees, and custom IDs for projects
--
-- ============================================================================
-- PART 1: Add DPI and Celular to EMPLEADOS Table
-- ============================================================================

-- Step 1: Add the new columns to empleados table
ALTER TABLE empleados
ADD COLUMN dpi VARCHAR(255) UNIQUE COMMENT 'Documento de Identidad Personal (DPI) - Guatemala',
ADD COLUMN numero_celular VARCHAR(20) COMMENT 'Número de teléfono celular del empleado';

-- Step 2: Create an index on DPI for faster lookups
CREATE INDEX IF NOT EXISTS idx_empleados_dpi ON empleados(dpi);

-- Step 3: Verify the columns were added
-- SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS 
-- WHERE TABLE_NAME = 'empleados' 
-- ORDER BY ORDINAL_POSITION;

-- ============================================================================
-- PART 2: Update PROYECTOS Table to Support Custom IDs
-- ============================================================================
--
-- IMPORTANT: This is complex because changing a PRIMARY KEY requires:
-- 1. Backup existing data
-- 2. Drop constraints and foreign keys
-- 3. Change the column type
-- 4. Recreate constraints and foreign keys
--
-- We provide multiple options below:

-- Option A: Quick approach (works if proyectos table is new or has no relations)
-- ============================================================================

-- 1. Backup existing proyectos
CREATE TABLE proyectos_backup AS SELECT * FROM proyectos;

-- 2. Drop the old table
DROP TABLE IF EXISTS proyectos;

-- 3. Create new proyectos table with VARCHAR id
CREATE TABLE proyectos (
  id VARCHAR(50) PRIMARY KEY COMMENT 'Unique project identifier (numeric or custom like PROY-001)',
  nombre VARCHAR(255) NOT NULL UNIQUE COMMENT 'Project name',
  ubicacion_del_proyecto VARCHAR(255) COMMENT 'Project location/address',
  soluciones VARCHAR(255) COMMENT 'Contact person name',
  horas_totales DECIMAL(10,2) COMMENT 'Total budgeted hours for the project',
  horas_usadas_manual DECIMAL(10,2) DEFAULT 0 COMMENT 'Manual override for hours used',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_nombre (nombre),
  INDEX idx_horas_totales (horas_totales)
);

-- 4. Restore data from backup
INSERT INTO proyectos (id, nombre, ubicacion_del_proyecto, soluciones, horas_totales, horas_usadas_manual, created_at, updated_at)
SELECT CAST(id AS CHAR), nombre, ubicacion_del_proyecto, soluciones, horas_totales, horas_usadas_manual, created_at, updated_at
FROM proyectos_backup;

-- 5. Verify the migration
-- SELECT * FROM proyectos LIMIT 5;

-- 6. Once verified, you can drop the backup
-- DROP TABLE proyectos_backup;


-- Option B: Detailed approach (safer, preserves relations)
-- ============================================================================
--
-- Use this if other tables reference proyectos.id
-- Steps:
-- 1. Identify foreign key constraints:
--    SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
--    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
--    WHERE REFERENCED_TABLE_NAME = 'proyectos';
--
-- 2. Drop foreign key constraints
-- 3. Add new VARCHAR id column as proyectos_id_new
-- 4. Migrate data: UPDATE proyectos SET proyectos_id_new = CAST(id AS CHAR)
-- 5. Drop old id, rename new one
-- 6. Recreate foreign keys with new column type
--
-- Consult your DBA or DevOps for this approach


-- Option C: For Supabase users
-- ============================================================================
--
-- 1. Go to SQL Editor in Supabase Dashboard
-- 2. Create backup first:
--    CREATE TABLE proyectos_backup_[TIMESTAMP] AS SELECT * FROM proyectos;
-- 3. Use migrations in /scripts/ directory
-- 4. Test in development environment first
-- 5. Deploy to production after testing


-- ============================================================================
-- PART 3: Verify the Changes
-- ============================================================================

-- Check empleados table structure
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'empleados'
ORDER BY ORDINAL_POSITION;

-- Check proyectos table structure
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'proyectos'
ORDER BY ORDINAL_POSITION;

-- ============================================================================
-- PART 4: Example Data Usage
-- ============================================================================

-- Add DPI and celular to an existing employee
UPDATE empleados
SET dpi = '1234567-90', numero_celular = '+502 7123 4567'
WHERE usuario = 'john@example.com';

-- Create a new project with custom ID
INSERT INTO proyectos (id, nombre, ubicacion_del_proyecto, soluciones, horas_totales)
VALUES ('PROY-2024-001', 'Renovación Casa', 'Ciudad de Guatemala', 'Juan Pérez', 200.00);

-- Create a new project with auto-generated numeric ID
INSERT INTO proyectos (id, nombre, ubicacion_del_proyecto, soluciones, horas_totales)
VALUES ('1001', 'Construcción Comercial', 'Zona 10', 'María López', 500.00);

-- Query employees with DPI
SELECT id, nombre, usuario, dpi, numero_celular, rol
FROM empleados
WHERE dpi IS NOT NULL
ORDER BY nombre;

-- Query projects and filter by ID
SELECT id, nombre, ubicacion_del_proyecto, horas_totales, horas_usadas_manual
FROM proyectos
WHERE id = 'PROY-2024-001';
