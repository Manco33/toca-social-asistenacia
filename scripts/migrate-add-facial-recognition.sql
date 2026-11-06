-- ============================================
-- MIGRACIÓN: Agregar Reconocimiento Facial
-- Fecha: Noviembre 13, 2025
-- ============================================

-- Paso 1: Agregar columnas a tabla "empleados" para reconocimiento facial
-- ============================================================

-- Columna para almacenar el descriptor facial (128 números)
ALTER TABLE empleados
ADD COLUMN IF NOT EXISTS facial_descriptor JSONB;

-- Marca de cuándo se registró la cara
ALTER TABLE empleados
ADD COLUMN IF NOT EXISTS facial_enrolled_at TIMESTAMP WITH TIME ZONE;

-- Si el usuario tiene reconocimiento facial activo
ALTER TABLE empleados
ADD COLUMN IF NOT EXISTS facial_enabled BOOLEAN DEFAULT false;

-- Última verificación exitosa
ALTER TABLE empleados
ADD COLUMN IF NOT EXISTS facial_last_verified TIMESTAMP WITH TIME ZONE;

-- Número de intentos fallidos consecutivos
ALTER TABLE empleados
ADD COLUMN IF NOT EXISTS facial_failed_attempts INTEGER DEFAULT 0;

-- Timestamp de último intento fallido
ALTER TABLE empleados
ADD COLUMN IF NOT EXISTS facial_last_failed_at TIMESTAMP WITH TIME ZONE;

-- Paso 2: Crear tabla de auditoría para reconocimiento facial
-- ============================================================

CREATE TABLE IF NOT EXISTS facial_audit (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL, -- 'enrollment', 'verification', 'liveness'
  phase VARCHAR(50), -- 'phase_1', 'phase_2', 'phase_3'
  success BOOLEAN NOT NULL,
  distance FLOAT8,
  confidence FLOAT8,
  liveness_type VARCHAR(50), -- 'blink', 'head_turn'
  error_message TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_facial_audit_user_id ON facial_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_facial_audit_created_at ON facial_audit(created_at);
CREATE INDEX IF NOT EXISTS idx_facial_audit_action ON facial_audit(action);
CREATE INDEX IF NOT EXISTS idx_facial_audit_success ON facial_audit(success);

-- Paso 3: Crear vista para reportes de auditoría
-- ============================================================

CREATE OR REPLACE VIEW facial_audit_summary AS
SELECT 
  user_id,
  DATE(created_at) as date,
  action,
  success,
  COUNT(*) as attempts,
  AVG(distance) as avg_distance,
  AVG(confidence) as avg_confidence
FROM facial_audit
GROUP BY user_id, DATE(created_at), action, success;

-- Paso 4: Crear política de Row-Level Security (RLS)
-- ============================================================

-- Nota: Las políticas RLS se pueden implementar después cuando tengas
-- la integración de autenticación Supabase completamente configurada.
-- Por ahora, descomenta si necesitas proteger los datos.

-- Habilitar RLS en facial_audit (opcional)
-- ALTER TABLE facial_audit ENABLE ROW LEVEL SECURITY;

-- Policy: Los usuarios solo ven sus propios registros
-- CREATE POLICY "Users can view their own facial audit"
-- ON facial_audit
-- FOR SELECT
-- USING (user_id = (SELECT id FROM empleados WHERE usuario = current_user LIMIT 1));

-- Policy: Los admin ven todo
-- CREATE POLICY "Admins can view all facial audit"
-- ON facial_audit
-- FOR ALL
-- USING (
--   (SELECT rol FROM empleados WHERE id = user_id) = 'administrador'
-- );

-- Paso 5: Crear función para limpiar intentos fallidos
-- ============================================================

CREATE OR REPLACE FUNCTION reset_failed_facial_attempts()
RETURNS void AS $$
BEGIN
  -- Resetear intentos fallidos si pasaron 15 minutos desde el último intento
  UPDATE empleados
  SET facial_failed_attempts = 0
  WHERE facial_failed_attempts > 0
    AND facial_last_failed_at IS NOT NULL
    AND (NOW() - facial_last_failed_at) > INTERVAL '15 minutes';
END;
$$ LANGUAGE plpgsql;

-- Paso 6: Crear función para registrar auditoría
-- ============================================================

CREATE OR REPLACE FUNCTION log_facial_audit(
  p_user_id BIGINT,
  p_action VARCHAR,
  p_phase VARCHAR,
  p_success BOOLEAN,
  p_distance FLOAT8 DEFAULT NULL,
  p_confidence FLOAT8 DEFAULT NULL,
  p_liveness_type VARCHAR DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS TABLE(id BIGINT) AS $$
BEGIN
  RETURN QUERY
  INSERT INTO facial_audit (
    user_id,
    action,
    phase,
    success,
    distance,
    confidence,
    liveness_type,
    error_message,
    created_at
  )
  VALUES (
    p_user_id,
    p_action,
    p_phase,
    p_success,
    p_distance,
    p_confidence,
    p_liveness_type,
    p_error_message,
    NOW()
  )
  RETURNING facial_audit.id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VERIFICACIÓN
-- ============================================

-- Ver columnas agregadas a empleados:
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'empleados' AND column_name LIKE 'facial_%';

-- Ver tabla facial_audit:
-- SELECT * FROM facial_audit LIMIT 5;

-- Ver vista de resumen:
-- SELECT * FROM facial_audit_summary;

-- ============================================
-- ROLLBACK (en caso de necesitar revertir)
-- ============================================

-- Para revertir TODO:
/*
DROP VIEW IF EXISTS facial_audit_summary;
DROP TABLE IF EXISTS facial_audit;
ALTER TABLE empleados DROP COLUMN IF EXISTS facial_descriptor;
ALTER TABLE empleados DROP COLUMN IF EXISTS facial_enrolled_at;
ALTER TABLE empleados DROP COLUMN IF EXISTS facial_enabled;
ALTER TABLE empleados DROP COLUMN IF EXISTS facial_last_verified;
ALTER TABLE empleados DROP COLUMN IF EXISTS facial_failed_attempts;
ALTER TABLE empleados DROP COLUMN IF EXISTS facial_last_failed_at;
DROP FUNCTION IF EXISTS reset_failed_facial_attempts();
DROP FUNCTION IF EXISTS log_facial_audit(...);
*/
