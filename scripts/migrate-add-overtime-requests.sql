-- Crear tabla overtime_requests

CREATE TABLE IF NOT EXISTS public.overtime_requests (
  id bigserial PRIMARY KEY,
  user_id bigint NOT NULL,
  user_name text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  reason text DEFAULT '',
  estimated_hours numeric DEFAULT NULL,
  tasks text DEFAULT NULL,
  reviewed_by text,
  reviewed_at timestamptz,
  response text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_overtime_requests_user_id ON public.overtime_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_overtime_requests_status ON public.overtime_requests(status);
CREATE INDEX IF NOT EXISTS idx_overtime_requests_requested_at ON public.overtime_requests(requested_at DESC);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_overtime_requests_updated_at ON public.overtime_requests;
CREATE TRIGGER trg_overtime_requests_updated_at
BEFORE UPDATE ON public.overtime_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- (Opcional) RLS policies: ajustar según necesidades de seguridad
-- Por defecto no habilitamos RLS aquí; si usas RLS en tu esquema, añade políticas apropiadas.

-- Ejemplo de políticas (descomentar si necesitas habilitar RLS):
-- ALTER TABLE public.overtime_requests ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY insert_overtime_requests ON public.overtime_requests FOR INSERT TO authenticated USING (true) WITH CHECK (true);
-- CREATE POLICY select_overtime_requests ON public.overtime_requests FOR SELECT TO authenticated USING (true);
-- CREATE POLICY manage_overtime_requests ON public.overtime_requests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
