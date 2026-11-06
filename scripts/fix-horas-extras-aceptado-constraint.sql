-- Fix migration: eliminar/ajustar constraint que impide guardar `aceptado = false`
-- Uso: ejecutar en psql o en el SQL editor de Supabase

-- Este script detecta y elimina cualquier CHECK que haga referencia a la columna
-- `aceptado` en la tabla `horas_extras`, y luego (opcional) crea una constraint
-- permisiva que acepta TRUE / FALSE / NULL.

BEGIN;

-- 1) Buscar y eliminar CHECK constraints que contengan la palabra 'aceptado'
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.horas_extras'::regclass
      AND contype = 'c' -- only check constraints
      AND pg_get_constraintdef(oid) ILIKE '%aceptado%'
  LOOP
    RAISE NOTICE 'Dropping constraint % on public.horas_extras', r.conname;
    EXECUTE format('ALTER TABLE public.horas_extras DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END$$;

-- 2) (Opcional) Añadir una constraint permisiva explícita (acepta NULL/true/false)
-- Si prefieres no volver a crearla, comenta o elimina la siguiente sección.
ALTER TABLE public.horas_extras
  ADD CONSTRAINT horas_extras_aceptado_check CHECK (aceptado IS NULL OR aceptado IN (true, false));

COMMIT;

-- Inspección: después de ejecutar, puedes listar constraints con:
-- SELECT conname, pg_get_constraintdef(oid) AS definition
-- FROM pg_constraint
-- WHERE conrelid = 'public.horas_extras'::regclass;

