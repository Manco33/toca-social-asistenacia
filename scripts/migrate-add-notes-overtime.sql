-- Añadir columna nota
ALTER TABLE horarios_gps
ADD COLUMN IF NOT EXISTS nota TEXT;

-- Añadir columna pago_horas_extra
ALTER TABLE horarios_gps
ADD COLUMN IF NOT EXISTS pago_horas_extra BOOLEAN DEFAULT FALSE;

-- Actualizar RLS policies para incluir las nuevas columnas
CREATE POLICY IF NOT EXISTS "Enable insert for authenticated users" ON "public"."horarios_gps"
FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Enable read access for all users" ON "public"."horarios_gps"
FOR SELECT TO authenticated
USING (true);