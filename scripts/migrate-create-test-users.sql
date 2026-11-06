-- Migración: Crear usuarios de prueba en tabla users (Autenticación de Supabase)
-- Este script crea los 3 usuarios de prueba con sus roles

-- IMPORTANTE: Reemplaza los UUIDs con los IDs reales de los usuarios de Supabase Auth
-- Puedes obtenerlos en: Panel de Supabase > Autenticación > Usuarios

BEGIN;

-- Limpiar usuarios existentes
DELETE FROM users WHERE email IN ('admin@aktivacorp.com', 'rrhh@aktivacorp.com', 'tecnico@aktivacorp.com');

-- Insertar 3 usuarios de prueba
-- NOTA: Reemplaza estos UUIDs con los IDs reales de Supabase Auth
INSERT INTO users (supabase_id, email, full_name, role, status) VALUES
(
  '00000000-0000-0000-0000-000000000001'::uuid,
  'admin@aktivacorp.com',
  'Administrador Sistema',
  'administrator',
  'active'
),
(
  '00000000-0000-0000-0000-000000000002'::uuid,
  'rrhh@aktivacorp.com',
  'Recursos Humanos',
  'rrhh',
  'active'
),
(
  '00000000-0000-0000-0000-000000000003'::uuid,
  'tecnico@aktivacorp.com',
  'Juan Técnico Prueba',
  'technician',
  'active'
);

COMMIT;

-- Para obtener los UUIDs reales de Supabase:
-- 1. Ve al Panel de Supabase > Autenticación > Usuarios
-- 2. Copia los IDs de cada usuario
-- 3. Reemplaza los UUIDs anteriores (00000000-0000-0000-0000-000000000001, etc.)
-- 4. Ejecuta este script actualizado
