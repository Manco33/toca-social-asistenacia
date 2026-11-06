-- ============================================================================
-- COMPLETE MIGRATION: Add proyecto_id Support to Both Tables
-- ============================================================================
--
-- This migration:
-- 1. Ensures proyectos table has proper structure
-- 2. Adds proyecto_id column to horarios_gps
-- 3. Creates the foreign key relationship
-- 4. Migrates existing data from proyecto (text) to proyecto_id (integer)
--
-- ============================================================================

-- ============================================================================
-- PART 1: PROYECTOS TABLE - Verify structure (no changes needed)
-- ============================================================================
--
-- Current structure (verified):
-- CREATE TABLE public.proyectos (
--   id SERIAL PRIMARY KEY,
--   nombre CHARACTER VARYING NOT NULL,
--   soluciones TEXT NULL,
--   ubicacion_del_proyecto CHARACTER VARYING NULL,
--   horas_totales NUMERIC NULL,
--   horas_usadas_manual NUMERIC NULL DEFAULT 0,
--   CONSTRAINT proyectos_pkey PRIMARY KEY (id)
-- );
--
-- This table is already properly set up. No changes needed.
-- The id is SERIAL (INTEGER) and is the PRIMARY KEY.

-- ============================================================================
-- PART 2: HORARIOS_GPS TABLE - Add proyecto_id column and foreign key
-- ============================================================================

-- Step 1: Add the proyecto_id column (nullable to handle existing rows)
ALTER TABLE public.horarios_gps
ADD COLUMN proyecto_id INTEGER;

-- Step 2: Create the foreign key constraint
-- This links horarios_gps.proyecto_id to proyectos.id
ALTER TABLE public.horarios_gps
ADD CONSTRAINT fk_horarios_gps_proyecto_id
FOREIGN KEY (proyecto_id) REFERENCES public.proyectos(id)
ON DELETE SET NULL
ON UPDATE CASCADE;

-- Step 3: Create an index on proyecto_id for faster queries and joins
CREATE INDEX IF NOT EXISTS idx_horarios_gps_proyecto_id 
ON public.horarios_gps(proyecto_id);

-- ============================================================================
-- PART 3: DATA MIGRATION - Populate proyecto_id from proyecto (text)
-- ============================================================================
--
-- This step matches existing proyecto names with proyectos.id
-- Only runs if there are logs without proyecto_id

UPDATE public.horarios_gps hg
SET proyecto_id = p.id
FROM public.proyectos p
WHERE p.nombre = hg.proyecto
  AND hg.proyecto IS NOT NULL 
  AND hg.proyecto != ''
  AND hg.proyecto_id IS NULL;

-- ============================================================================
-- PART 4: VERIFICATION QUERIES
-- ============================================================================
--
-- Run these to verify the migration worked correctly:

-- Check the structure of horarios_gps
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'horarios_gps' 
-- ORDER BY ordinal_position;

-- Check how many logs were migrated
-- SELECT 
--   COUNT(*) as total_logs,
--   COUNT(proyecto_id) as logs_with_proyecto_id,
--   COUNT(proyecto_id) * 100.0 / COUNT(*) as percentage_migrated
-- FROM public.horarios_gps
-- WHERE proyecto IS NOT NULL;

-- Check logs grouped by proyecto with proyecto_id
-- SELECT 
--   proyecto,
--   proyecto_id,
--   COUNT(*) as count
-- FROM public.horarios_gps
-- WHERE proyecto IS NOT NULL
-- GROUP BY proyecto, proyecto_id
-- ORDER BY proyecto;

-- Check if there are logs without a project (NULL proyecto)
-- SELECT COUNT(*) as logs_without_project
-- FROM public.horarios_gps
-- WHERE proyecto IS NULL;

-- ============================================================================
-- PART 5: SUMMARY OF CHANGES
-- ============================================================================
--
-- horarios_gps table now has:
--   - proyecto (VARCHAR 100) - Existing text field, kept for compatibility
--   - proyecto_id (INTEGER) - New foreign key to proyectos.id
--
-- Foreign key relationship:
--   horarios_gps.proyecto_id → proyectos.id
--   ON DELETE SET NULL (if a proyecto is deleted, proyecto_id becomes NULL)
--   ON UPDATE CASCADE (if proyecto id changes, logs are updated)
--
-- Index created:
--   idx_horarios_gps_proyecto_id - For fast lookups by proyecto_id
--
-- ============================================================================
