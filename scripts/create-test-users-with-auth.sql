-- Migración: Crear usuarios de prueba con Supabase Auth (alternativa)
-- Este script es más simple: crea usuarios directamente sin UUIDs manuales

-- NOTA: Esta versión asume que los usuarios ya existen en auth.users
-- Si no existen, primero créalos manualmente en Supabase Dashboard > Auth > Users

-- Para obtener los UUIDs:
-- 1. Ve a Supabase Dashboard > Authentication > Users
-- 2. Busca estos emails: admin@aktivacorp.com, rrhh@aktivacorp.com, tecnico@aktivacorp.com
-- 3. Copia cada UUID y reemplaza en el script a continuación

-- PASO 1: Obtén los UUIDs reales de Supabase Auth y luego ejecuta:

BEGIN;

-- Limpia registros anteriores
DELETE FROM users WHERE email IN ('admin@aktivacorp.com', 'rrhh@aktivacorp.com', 'tecnico@aktivacorp.com');

-- PASO 2: Reemplaza estos UUIDs con los reales de Supabase Auth
-- Ejemplo: si tu usuario admin tiene UUID: a1b2c3d4-e5f6-7890-abcd-ef1234567890
-- Cambia 00000000-0000-0000-0000-000000000001 por a1b2c3d4-e5f6-7890-abcd-ef1234567890

INSERT INTO users (supabase_id, email, full_name, role, status) VALUES
(
  (SELECT id FROM auth.users WHERE email = 'admin@aktivacorp.com' LIMIT 1)::uuid,
  'admin@aktivacorp.com',
  'Administrador Sistema',
  'administrator',
  'active'
),
(
  (SELECT id FROM auth.users WHERE email = 'rrhh@aktivacorp.com' LIMIT 1)::uuid,
  'rrhh@aktivacorp.com',
  'Recursos Humanos',
  'rrhh',
  'active'
),
(
  (SELECT id FROM auth.users WHERE email = 'tecnico@aktivacorp.com' LIMIT 1)::uuid,
  'tecnico@aktivacorp.com',
  'Juan Técnico Prueba',
  'technician',
  'active'
);

COMMIT;

-- Verificar que se crearon correctamente:
-- SELECT * FROM users;
