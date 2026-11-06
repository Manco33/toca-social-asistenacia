-- OPCIÓN 1: Actualizar la llave foránea para que elimine las facturas en cascada
-- (PRECAUCIÓN: Esto eliminará todas las facturas asociadas a este empleado)
ALTER TABLE facturas
DROP CONSTRAINT facturas_usuario_id_fkey,
ADD CONSTRAINT facturas_usuario_id_fkey
    FOREIGN KEY (usuario_id)
    REFERENCES empleados(id)
    ON DELETE CASCADE;

-- Después de correr lo de arriba, ya podrás eliminar el empleado desde la interfaz.


-- OPCIÓN 2 (Alternativa Segura): Si NO quieres borrar las facturas de este empleado
-- sino "desvincularlas" (dejarlas huérfanas o asignarlas a otro usuario)
--
-- ALTER TABLE facturas
-- DROP CONSTRAINT facturas_usuario_id_fkey,
-- ADD CONSTRAINT facturas_usuario_id_fkey
--     FOREIGN KEY (usuario_id)
--     REFERENCES empleados(id)
--     ON DELETE SET NULL;
