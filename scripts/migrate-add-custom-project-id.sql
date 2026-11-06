-- Migration: Allow custom ID for proyectos table
-- This script modifies the proyectos table to support custom text IDs instead of only auto-generated numeric IDs

-- If proyectos table uses a SERIAL/AUTO_INCREMENT id, we need to change it to VARCHAR
-- First, check if the table exists and its current structure:
-- SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'proyectos';

-- Option 1: If you're creating a fresh proyectos table:
-- CREATE TABLE proyectos (
--   id VARCHAR(50) PRIMARY KEY COMMENT 'Unique project identifier (can be custom like PROY-001)',
--   nombre VARCHAR(255) NOT NULL COMMENT 'Project name',
--   ubicacion_del_proyecto VARCHAR(255) COMMENT 'Project location',
--   soluciones VARCHAR(255) COMMENT 'Contact person',
--   horas_totales DECIMAL(10,2) COMMENT 'Total budgeted hours',
--   horas_usadas_manual DECIMAL(10,2) DEFAULT 0 COMMENT 'Manual hours override',
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
-- );

-- Option 2: If you're modifying an existing table, backup first, then:
-- For existing tables with numeric IDs, you'll need to:

-- Step 1: Create a temporary backup of existing data
-- CREATE TABLE proyectos_backup AS SELECT * FROM proyectos;

-- Step 2: Drop the old table (or use ALTER to change the column type)
-- If the current id is PRIMARY KEY SERIAL/BIGINT, changing it requires special handling

-- Step 3: Recreate with new structure OR use Supabase migration
-- If using Supabase, you can use the Supabase SQL Editor to:

-- ALTER TABLE proyectos MODIFY COLUMN id VARCHAR(50);
-- -- This might fail if id is auto_increment, so you may need:
-- ALTER TABLE proyectos CHANGE COLUMN id id VARCHAR(50);

-- Or more safely, create a new table and migrate:
CREATE TABLE IF NOT EXISTS proyectos_v2 (
  id VARCHAR(50) PRIMARY KEY COMMENT 'Unique project identifier (can be custom like PROY-001)',
  nombre VARCHAR(255) NOT NULL UNIQUE COMMENT 'Project name',
  ubicacion_del_proyecto VARCHAR(255) COMMENT 'Project location',
  soluciones VARCHAR(255) COMMENT 'Contact person',
  horas_totales DECIMAL(10,2) COMMENT 'Total budgeted hours',
  horas_usadas_manual DECIMAL(10,2) DEFAULT 0 COMMENT 'Manual hours override',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_nombre (nombre)
);

-- If you want to migrate data from old table to new:
-- INSERT INTO proyectos_v2 (id, nombre, ubicacion_del_proyecto, soluciones, horas_totales, horas_usadas_manual, created_at, updated_at)
-- SELECT CAST(id AS CHAR), nombre, ubicacion_del_proyecto, soluciones, horas_totales, horas_usadas_manual, created_at, updated_at
-- FROM proyectos;

-- Then rename:
-- DROP TABLE proyectos;
-- RENAME TABLE proyectos_v2 TO proyectos;

-- IMPORTANT: If using Supabase, follow this approach instead:
-- 1. Go to SQL Editor in Supabase Dashboard
-- 2. Run migrations in this order:
--    a. Backup existing data
--    b. Create new table with VARCHAR id
--    c. Migrate data
--    d. Drop old table and rename

-- Simple alternative: Just ensure the table supports VARCHAR ids
-- This works if the table hasn't been created yet:
ALTER TABLE proyectos
MODIFY COLUMN id VARCHAR(50) NOT NULL PRIMARY KEY COMMENT 'Unique project identifier';
