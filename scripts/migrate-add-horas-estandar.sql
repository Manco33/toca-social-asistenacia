-- Migration: add horas_estandar to empleados
ALTER TABLE empleados
ADD COLUMN horas_estandar DECIMAL(4,2) DEFAULT 9.00 COMMENT 'Horas estándar de jornada (sin almuerzo)',
ADD COLUMN tiempo_almuerzo DECIMAL(3,2) DEFAULT 1.00 COMMENT 'Tiempo estándar de almuerzo en horas';

-- Update existing rows to default values
UPDATE empleados SET 
    horas_estandar = 9.00,
    tiempo_almuerzo = 1.00
WHERE horas_estandar IS NULL OR tiempo_almuerzo IS NULL;