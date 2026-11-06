-- Crear tabla horas_extras
CREATE TABLE IF NOT EXISTS public.horas_extras (
  id bigserial PRIMARY KEY,
  usuario text NOT NULL, -- nombre del técnico
  fecha date NOT NULL,
  horas numeric NOT NULL,
  motivo text NOT NULL,
  aceptado boolean DEFAULT NULL -- null: pendiente, true: aceptado, false: negado
);

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_horas_extras_usuario ON public.horas_extras(usuario);
CREATE INDEX IF NOT EXISTS idx_horas_extras_fecha ON public.horas_extras(fecha);
CREATE INDEX IF NOT EXISTS idx_horas_extras_aceptado ON public.horas_extras(aceptado);

-- (Opcional) RLS policies: ajustar según necesidades de seguridad
-- ALTER TABLE public.horas_extras ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY insert_horas_extras ON public.horas_extras FOR INSERT TO authenticated USING (true) WITH CHECK (true);
-- CREATE POLICY select_horas_extras ON public.horas_extras FOR SELECT TO authenticated USING (true);
-- CREATE POLICY manage_horas_extras ON public.horas_extras FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
