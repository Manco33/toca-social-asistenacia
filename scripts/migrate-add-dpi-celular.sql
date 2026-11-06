-- Migration: Add DPI and numero_celular to empleados table
-- This script adds two new columns to track employee identification and contact information

ALTER TABLE empleados
ADD COLUMN dpi VARCHAR(255) UNIQUE COMMENT 'Documento de Identidad Personal (DPI) - Guatemala',
ADD COLUMN numero_celular VARCHAR(20) COMMENT 'Número de teléfono celular del empleado';

-- Create index for faster DPI lookups
CREATE INDEX idx_empleados_dpi ON empleados(dpi);

-- Optional: If you want to add a constraint to ensure at least one contact method exists
-- ALTER TABLE empleados ADD CONSTRAINT check_contact CHECK (numero_celular IS NOT NULL OR usuario IS NOT NULL);
