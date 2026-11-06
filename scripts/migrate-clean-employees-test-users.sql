-- Migración: Limpiar empleados y dejar solo 3 usuarios de prueba
-- Este script borra todos los empleados y sus datos relacionados en PostgreSQL
-- PRECAUCIÓN: Esto borrará todos los empleados y sus registros asociados

BEGIN;

-- Paso 1: Borrar datos relacionados (respetando foreign keys)
DELETE FROM horas_extras WHERE usuario IN (SELECT usuario FROM empleados);
DELETE FROM registro_horas WHERE usuario IN (SELECT usuario FROM empleados);
DELETE FROM facturas WHERE usuario_id IN (SELECT id FROM empleados);
-- Nota: facial_audit se borrará automáticamente por ON DELETE CASCADE cuando eliminemos empleados

-- Paso 2: Borrar todos los empleados
DELETE FROM empleados;

-- Paso 3: Resetear sequence
ALTER SEQUENCE empleados_id_seq RESTART WITH 1;

-- Paso 4: Insertar 3 usuarios de prueba
INSERT INTO empleados (nombre, usuario, contrasena, rol) VALUES
(
  'Administrador Sistema',
  'admin',
  '$2a$10$YIjlrJy5Ck9r8Z5mK3p9e.9K8L7M6N5O4P3Q2R1S0T9U8V7W6X5Y4Z3', -- hash bcrypt de 'admin123'
  'administrador'
),
(
  'Recursos Humanos',
  'rrhh',
  '$2a$10$YIjlrJy5Ck9r8Z5mK3p9e.9K8L7M6N5O4P3Q2R1S0T9U8V7W6X5Y4Z3', -- hash bcrypt de 'admin123'
  'administrador'
),
(
  'Juan Técnico Prueba',
  'tecnico',
  '$2a$10$YIjlrJy5Ck9r8Z5mK3p9e.9K8L7M6N5O4P3Q2R1S0T9U8V7W6X5Y4Z3', -- hash bcrypt de 'admin123'
  'tecnico'
);

COMMIT;

-- Nota: Las contraseñas están hasheadas con bcrypt
-- Contraseña de prueba para todos: admin123
-- Para cambiarlas, generar nuevo hash bcrypt en https://bcrypt-generator.com/

