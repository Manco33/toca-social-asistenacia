-- ============================================================================
-- MIGRATION: Add proyecto_id as Foreign Key to horarios_gps (PostgreSQL/Supabase)
-- ============================================================================
--
-- This migration adds a proyecto_id column to horarios_gps table that references
-- the proyectos table by id. This allows proper relational tracking of logs
-- to specific projects instead of just storing the project name as text.
--
-- The old 'proyecto' column (text) will be kept for backwards compatibility
-- but proyecto_id should be used for new inserts.
--
-- ============================================================================

-- Step 1: Add the proyecto_id column (nullable initially to handle existing rows)
-- This assumes proyectos table has id as INTEGER PRIMARY KEY (SERIAL)
ALTER TABLE public.horarios_gps
ADD COLUMN proyecto_id INTEGER;

-- Step 2: Create foreign key constraint
-- This assumes proyectos table exists with id as PRIMARY KEY
ALTER TABLE public.horarios_gps
ADD CONSTRAINT fk_horarios_gps_proyecto_id
FOREIGN KEY (proyecto_id) REFERENCES public.proyectos(id)
ON DELETE SET NULL
ON UPDATE CASCADE;

-- Step 3: Create an index on proyecto_id for faster queries
CREATE INDEX IF NOT EXISTS idx_horarios_gps_proyecto_id ON public.horarios_gps(proyecto_id);

-- Step 4: (OPTIONAL) Migrate existing data from 'proyecto' text column to 'proyecto_id'
--
-- This query will populate proyecto_id based on the existing proyecto name column
-- It matches proyecto name with proyectos.id
-- 
-- WARNING: Only run this if your proyectos.id contains the project names!
-- If proyectos.id uses custom IDs, you'll need to adjust this query or do a manual migration
--
-- UNCOMMENT AND RUN THIS IF NEEDED:
/*
UPDATE public.horarios_gps hg
SET proyecto_id = p.id
FROM public.proyectos p
WHERE p.nombre = hg.proyecto
AND hg.proyecto IS NOT NULL 
AND hg.proyecto != '';
*/

-- Step 5: Verify the migration
-- SELECT id, usuario, fecha, hora_marcaje, proyecto, proyecto_id 
-- FROM public.horarios_gps 
-- LIMIT 10;
