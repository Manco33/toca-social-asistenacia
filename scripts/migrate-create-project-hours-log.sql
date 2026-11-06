-- Tabla para registrar cambios en horas de proyectos
CREATE TABLE IF NOT EXISTS proyecto_horas_log (
  id BIGSERIAL PRIMARY KEY,
  proyecto_id BIGINT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  proyecto_nombre TEXT,
  horas_totales_anterior NUMERIC,
  horas_totales_nuevo NUMERIC,
  horas_usadas_manual_anterior NUMERIC,
  horas_usadas_manual_nuevo NUMERIC,
  horas_calculadas_tecnicos NUMERIC, -- horas reales sumadas de GPS
  changed_by TEXT, -- usuario admin que hizo el cambio
  change_reason TEXT, -- razón del cambio
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_proyecto_horas_log_proyecto_id ON proyecto_horas_log(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_proyecto_horas_log_created_at ON proyecto_horas_log(created_at);

-- Tabla de resumen diario: qué horas reales trabajaron los técnicos por proyecto
CREATE TABLE IF NOT EXISTS proyecto_horas_resumen (
  id BIGSERIAL PRIMARY KEY,
  proyecto_id BIGINT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  proyecto_nombre TEXT,
  fecha DATE NOT NULL,
  horas_calculadas_tecnicos NUMERIC, -- suma de GPS logs ese día
  horas_usadas_manual NUMERIC, -- manual override
  horas_totales NUMERIC, -- límite del proyecto
  horas_usadas NUMERIC, -- horas_calculadas + manual
  horas_restantes NUMERIC, -- horas_totales - horas_usadas (puede ser negativo)
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(proyecto_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_proyecto_horas_resumen_proyecto_id ON proyecto_horas_resumen(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_proyecto_horas_resumen_fecha ON proyecto_horas_resumen(fecha);
