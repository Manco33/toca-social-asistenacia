-- Migración: Regenerar contraseñas válidas para los 3 usuarios de prueba
-- Las contraseñas anteriores no eran válidas con bcrypt

BEGIN;

-- Usuario: admin
-- Contraseña: Admin123456!
UPDATE empleados 
SET contrasena = '$2a$10$4kCMjIpOzfcb2.IJSajp7.iEGqSCLuMH49UsXA3P7h8z8atPMLihS'
WHERE usuario = 'admin';

-- Usuario: rrhh  
-- Contraseña: RRHH123456!
UPDATE empleados
SET contrasena = '$2a$10$NxqWuA6EUVEIe.XqbUBSM.jGDoWUBvDrPIXJxyuw4U3f5gp8yxcv.'
WHERE usuario = 'rrhh';

-- Usuario: tecnico
-- Contraseña: Tecnico123456!
UPDATE empleados
SET contrasena = '$2a$10$ogKWKnXudGFyL5RThQglN.TfK1pS1QZQR110yjpfbsSc4yB/xGfg6'
WHERE usuario = 'tecnico';

COMMIT;

-- CREDENCIALES DE PRUEBA:
-- Usuario: admin | Email: admin@aktivacorp.com | Contraseña: Admin123456!
-- Usuario: rrhh | Email: rrhh@aktivacorp.com | Contraseña: RRHH123456!
-- Usuario: tecnico | Email: tecnico@aktivacorp.com | Contraseña: Tecnico123456!
