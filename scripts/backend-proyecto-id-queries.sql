-- ============================================================================
-- BACKEND UPDATES: How to Use proyecto_id in Queries
-- ============================================================================
--
-- This file shows the SQL changes needed in your backend (actions.ts)
-- to leverage the new proyecto_id foreign key
--
-- ============================================================================

-- ============================================================================
-- OPTION 1: Get GPS logs WITH proyecto details (RECOMMENDED)
-- ============================================================================
--
-- This query gets all GPS logs for a user with the project name and details
-- It uses a LEFT JOIN so logs without a proyecto_id still appear
--
-- Location: In actions.ts, getRegistroHoras() function
-- Replace the existing horarios_gps query with this:

SELECT 
  hg.id,
  hg.usuario,
  hg.fecha,
  hg.tipo_actividad,
  hg.coordenadas,
  hg.hora_marcaje,
  hg.proyecto,
  hg.nota,
  hg.proyecto_id,
  p.id as proyecto_real_id,
  p.nombre as proyecto_nombre,
  p.horas_totales
FROM public.horarios_gps hg
LEFT JOIN public.proyectos p ON hg.proyecto_id = p.id
WHERE hg.usuario = $1
  AND hg.fecha >= $2
  AND hg.fecha <= $3
ORDER BY hg.fecha DESC, hg.hora_marcaje ASC;

-- In Supabase JS client (for actions.ts):
-- const { data: gpsRows } = await supabase
--   .from('horarios_gps')
--   .select(`
--     *,
--     proyectos!proyecto_id (id, nombre, horas_totales)
--   `)
--   .eq('usuario', user.usuario)
--   .gte('fecha', start)
--   .lte('fecha', end)
--   .order('fecha', { ascending: false })
--   .order('hora_marcaje', { ascending: true });

-- ============================================================================
-- OPTION 2: Get only logs WITH a valid proyecto (if you don't want orphans)
-- ============================================================================
--
-- This query only returns logs that have a proyecto_id
-- Useful if you want to exclude logs without a project assignment

SELECT 
  hg.id,
  hg.usuario,
  hg.fecha,
  hg.tipo_actividad,
  hg.coordenadas,
  hg.hora_marcaje,
  hg.proyecto,
  hg.nota,
  hg.proyecto_id,
  p.nombre as proyecto_nombre,
  p.horas_totales
FROM public.horarios_gps hg
INNER JOIN public.proyectos p ON hg.proyecto_id = p.id
WHERE hg.usuario = $1
  AND hg.fecha >= $2
  AND hg.fecha <= $3
ORDER BY hg.fecha DESC, hg.hora_marcaje ASC;

-- In Supabase JS client:
-- const { data: gpsRows } = await supabase
--   .from('horarios_gps')
--   .select(`
--     *,
--     proyectos!proyecto_id (id, nombre, horas_totales)
--   `)
--   .not('proyecto_id', 'is', null)
--   .eq('usuario', user.usuario)
--   .gte('fecha', start)
--   .lte('fecha', end)
--   .order('fecha', { ascending: false })
--   .order('hora_marcaje', { ascending: true });

-- ============================================================================
-- OPTION 3: Get project statistics for a user
-- ============================================================================
--
-- This query shows time spent per project for a specific user
-- Useful for the "por proyecto" dashboard view

SELECT 
  p.id as proyecto_id,
  p.nombre as proyecto_nombre,
  COUNT(hg.id) as total_logs,
  COUNT(DISTINCT hg.fecha) as dias_en_proyecto,
  COUNT(DISTINCT hg.usuario) as usuarios,
  p.horas_totales,
  p.horas_usadas_manual
FROM public.horarios_gps hg
INNER JOIN public.proyectos p ON hg.proyecto_id = p.id
WHERE hg.usuario = $1
  AND hg.fecha >= $2
  AND hg.fecha <= $3
GROUP BY p.id, p.nombre, p.horas_totales, p.horas_usadas_manual
ORDER BY COUNT(hg.id) DESC;

-- In Supabase JS client:
-- const { data: projectStats } = await supabase
--   .from('horarios_gps')
--   .select(`
--     proyecto_id,
--     proyectos!proyecto_id (id, nombre, horas_totales, horas_usadas_manual),
--     id, fecha, usuario
--   `)
--   .eq('usuario', user.usuario)
--   .gte('fecha', start)
--   .lte('fecha', end)
--   .not('proyecto_id', 'is', null);

-- ============================================================================
-- OPTION 4: Insert a new GPS log WITH proyecto_id
-- ============================================================================
--
-- When creating a new GPS log entry, include both proyecto (text) and proyecto_id

INSERT INTO public.horarios_gps 
  (usuario, fecha, hora_marcaje, tipo_actividad, coordenadas, proyecto, proyecto_id, nota)
VALUES 
  ('tech001', '2025-12-11', '09:30:00', 'Llegada a proyecto', '12.1234,-85.5678', 'P-Coca Cola', 1, NULL);

-- In Supabase JS client (actions.ts or API route):
-- await supabase
--   .from('horarios_gps')
--   .insert([{
--     usuario: 'tech001',
--     fecha: '2025-12-11',
--     hora_marcaje: '09:30:00',
--     tipo_actividad: 'Llegada a proyecto',
--     coordenadas: '12.1234,-85.5678',
--     proyecto: 'P-Coca Cola',      // Keep for display/legacy
--     proyecto_id: 1,                 // New: use the integer ID
--     nota: null
--   }]);

-- ============================================================================
-- OPTION 5: Update proyecto_id for existing logs (batch operation)
-- ============================================================================
--
-- If you have logs without proyecto_id, update them:

UPDATE public.horarios_gps hg
SET proyecto_id = p.id
FROM public.proyectos p
WHERE p.nombre = hg.proyecto
  AND hg.proyecto_id IS NULL
  AND hg.proyecto IS NOT NULL;

-- Check how many were updated:
-- SELECT COUNT(*) FROM public.horarios_gps WHERE proyecto_id IS NOT NULL;

-- ============================================================================
-- OPTION 6: Get logs grouped by DATE and PROJECT (for dashboard)
-- ============================================================================
--
-- This is perfect for the admin dashboard to show summary by fecha + proyecto

SELECT 
  hg.fecha,
  p.id as proyecto_id,
  p.nombre as proyecto_nombre,
  COUNT(hg.id) as total_logs,
  MIN(hg.hora_marcaje) as primera_marcaje,
  MAX(hg.hora_marcaje) as ultima_marcaje,
  ARRAY_AGG(DISTINCT hg.tipo_actividad) as actividades
FROM public.horarios_gps hg
INNER JOIN public.proyectos p ON hg.proyecto_id = p.id
WHERE hg.usuario = $1
  AND hg.fecha >= $2
  AND hg.fecha <= $3
GROUP BY hg.fecha, p.id, p.nombre
ORDER BY hg.fecha DESC, p.nombre ASC;

-- In Supabase JS client (for admin dashboard):
-- const { data: dailyProjectStats } = await supabase
--   .from('horarios_gps')
--   .select(`
--     fecha,
--     proyecto_id,
--     proyectos!proyecto_id (id, nombre),
--     hora_marcaje,
--     tipo_actividad
--   `)
--   .eq('usuario', user.usuario)
--   .gte('fecha', start)
--   .lte('fecha', end)
--   .not('proyecto_id', 'is', null)
--   .order('fecha', { ascending: false });

-- ============================================================================
-- SUMMARY: Impact on Frontend
-- ============================================================================
--
-- After using proyecto_id in the backend queries:
--
-- 1. gpsLogs will have BOTH:
--    - proyecto (VARCHAR) - Old field for compatibility
--    - proyecto_id (INTEGER) - New foreign key
--    - proyectos (OBJECT) - The JOIN result with proyecto name, id, etc.
--
-- 2. Example structure in frontend:
--    {
--      id: 123,
--      usuario: "tech001",
--      fecha: "2025-12-11",
--      hora_marcaje: "09:30:00",
--      proyecto: "P-Coca Cola",           // Old text field
--      proyecto_id: 1,                     // New ID field
--      proyectos: {                        // JOIN result
--        id: 1,
--        nombre: "P-Coca Cola",
--        horas_totales: 100,
--        horas_usadas_manual: 25
--      }
--    }
--
-- 3. In your frontend logic, prefer using proyecto_id and proyectos object
--    instead of matching by proyecto name text
--
-- ============================================================================
