-- ============================================================================
-- SCRIPT DE IMPLEMENTACIÓN: Filtrado Seguro por Usuario en Dashboards Admin
-- ============================================================================
-- 
-- este script implementa:
-- 1. Columna admin_responsable_id en empleados
-- 2. Políticas RLS para filtrado seguro
-- 3. Índices para optimización
--
-- ¡EJECUTAR EN SUPABASE SQL EDITOR!

-- PASO 1: Agregar columna admin_responsable_id si no existe
-- ============================================================================

ALTER TABLE empleados 
ADD COLUMN IF NOT EXISTS admin_responsable_id BIGINT REFERENCES empleados(id);

-- Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_empleados_admin_responsable 
ON empleados(admin_responsable_id);

-- Crear índice compuesto para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_empleados_admin_y_rol
ON empleados(admin_responsable_id, rol);

-- PASO 2: Habilitar RLS en tabla empleados
-- ============================================================================

ALTER TABLE empleados ENABLE ROW LEVEL SECURITY;

-- PASO 3: Crear políticas RLS
-- ============================================================================

-- Política 1: Empleados pueden ver su propio registro
DROP POLICY IF EXISTS "employees_can_view_own_record" ON empleados;
CREATE POLICY "employees_can_view_own_record" ON empleados
  FOR SELECT
  USING (
    -- El usuario autenticado puede ver su propio registro
    supabase_id = auth.uid()
  );

-- Política 2: Admins pueden ver a sus empleados directos
DROP POLICY IF EXISTS "admins_can_view_their_employees" ON empleados;
CREATE POLICY "admins_can_view_their_employees" ON empleados
  FOR SELECT
  USING (
    -- El admin autenticado puede ver empleados bajo su supervisión
    admin_responsable_id = (
      SELECT id FROM empleados WHERE supabase_id = auth.uid()
    )
  );

-- Política 3: Super-admin (rolle='admin') puede ver todos
DROP POLICY IF EXISTS "superadmins_can_view_all" ON empleados;
CREATE POLICY "superadmins_can_view_all" ON empleados
  FOR SELECT
  USING (
    -- Un super-admin ('admin' role) puede ver todos
    CASE 
      WHEN auth.uid()::text = '' THEN false
      ELSE EXISTS (
        SELECT 1 FROM empleados e
        WHERE e.supabase_id = auth.uid() AND e.rol = 'administrador'
      )
    END
  );

-- Política 4: Admins pueden actualizar sus empleados
DROP POLICY IF EXISTS "admins_can_update_their_employees" ON empleados;
CREATE POLICY "admins_can_update_their_employees" ON empleados
  FOR UPDATE
  USING (
    -- Pueden actualizar empleados bajo su supervisión
    admin_responsable_id = (
      SELECT id FROM empleados WHERE supabase_id = auth.uid()
    )
  );

-- PASO 4: Habilitar RLS en tabla horarios_gps
-- ============================================================================

ALTER TABLE horarios_gps ENABLE ROW LEVEL SECURITY;

-- Política: Usuarios ven sus propios registros, admins ven registros de sus empleados
DROP POLICY IF EXISTS "users_view_own_time_entries" ON horarios_gps;
CREATE POLICY "users_view_own_time_entries" ON horarios_gps
  FOR SELECT
  USING (
    usuario = (SELECT usuario FROM empleados WHERE supabase_id = auth.uid())
    OR
    -- El usuario es admin de este empleado
    EXISTS (
      SELECT 1 FROM empleados e1
      WHERE e1.usuario = horarios_gps.usuario
      AND e1.admin_responsable_id = (
        SELECT id FROM empleados WHERE supabase_id = auth.uid()
      )
    )
  );

-- PASO 5: Habilitar RLS en otras tablas clave
-- ============================================================================

-- Tabla: registro_horas
ALTER TABLE registro_horas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_view_own_hours" ON registro_horas;
CREATE POLICY "users_view_own_hours" ON registro_horas
  FOR SELECT
  USING (
    usuario = (SELECT usuario FROM empleados WHERE supabase_id = auth.uid())
    OR
    -- El usuario es admin de este empleado
    EXISTS (
      SELECT 1 FROM empleados e1
      WHERE e1.usuario = registro_horas.usuario
      AND e1.admin_responsable_id = (
        SELECT id FROM empleados WHERE supabase_id = auth.uid()
      )
    )
  );

-- Tabla: facturas
ALTER TABLE facturas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_view_own_invoices" ON facturas;
CREATE POLICY "users_view_own_invoices" ON facturas
  FOR SELECT
  USING (
    usuario_id = (SELECT id FROM empleados WHERE supabase_id = auth.uid())
    OR
    -- El usuario es admin de este empleado
    usuario_id IN (
      SELECT id FROM empleados e1
      WHERE e1.admin_responsable_id = (
        SELECT id FROM empleados WHERE supabase_id = auth.uid()
      )
    )
  );

-- PASO 6: Verificación
-- ============================================================================

-- Ver estructura actualizada
SELECT table_name, column_name, data_type 
FROM information_schema.columns
WHERE table_name IN ('empleados', 'horarios_gps', 'registro_horas', 'facturas')
ORDER BY table_name, ordinal_position;

-- Ver índices creados
SELECT indexname, tablename, indexdef
FROM pg_indexes
WHERE tablename IN ('empleados', 'horarios_gps', 'registro_horas', 'facturas')
AND indexname LIKE 'idx_%'
ORDER BY tablename;

-- Ver políticas RLS habilitadas
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE tablename IN ('empleados', 'horarios_gps', 'registro_horas', 'facturas')
ORDER BY tablename;

-- PASO 7: Prueba (ejecutar como usuario específico)
-- ============================================================================

-- Nota: Para probar RLS, deberías:
-- 1. Usuarios autenticados con supabase_id X verán solo su propio registro
-- 2. Admins verán solo registros de empleados con admin_responsable_id = su ID
-- 3. Super-admins (rol=administrador) verán todos los registros

-- Consulta de prueba (ejecutar como admin)
-- SELECT id, nombre, usuario, rol, admin_responsable_id 
-- FROM empleados 
-- LIMIT 10;

