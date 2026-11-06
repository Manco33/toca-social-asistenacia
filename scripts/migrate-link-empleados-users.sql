-- Migración: Enlazar tabla empleados con tabla users (Supabase Auth)
-- Este script crea una relación entre empleados y users usando supabase_id

BEGIN;

-- PASO 1: Agregar columna supabase_id a empleados si no existe
ALTER TABLE empleados
ADD COLUMN IF NOT EXISTS supabase_id UUID UNIQUE REFERENCES users(supabase_id) ON DELETE SET NULL;

-- PASO 2: Actualizar los empleados existentes con sus UUIDs de users
-- Esto enlaza empleados.usuario con users.email automáticamente

UPDATE empleados e
SET supabase_id = u.supabase_id
FROM users u
WHERE LOWER(e.usuario) = LOWER(SPLIT_PART(u.email, '@', 1))
  AND u.supabase_id IS NOT NULL
  AND e.supabase_id IS NULL;

-- PASO 3: Verificar que se actualizaron correctamente
-- Ejecuta esto después para validar:
-- SELECT e.id, e.usuario, e.nombre, e.supabase_id, u.email, u.role
-- FROM empleados e
-- LEFT JOIN users u ON e.supabase_id = u.supabase_id
-- ORDER BY e.id;

-- PASO 4: Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_empleados_supabase_id ON empleados(supabase_id);

COMMIT;

-- Notas:
-- - La columna supabase_id enlaza empleados con users
-- - Si un usuario en auth.users es eliminado, el supabase_id de empleados se pone en NULL (ON DELETE SET NULL)
-- - Los endpoints ahora pueden usar este enlace para mapear datos
