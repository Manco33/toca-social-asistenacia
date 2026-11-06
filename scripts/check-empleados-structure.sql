-- Verificar estructura de tabla empleados
-- Ejecuta esto en Supabase SQL Editor para ver los campos y constraints

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'empleados'
ORDER BY ordinal_position;
