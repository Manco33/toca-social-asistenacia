-- Migración: Crear tabla users con gestión de roles
-- Este script crea la tabla para gestionar usuarios, roles y estados

BEGIN;

-- Crear tabla users
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  supabase_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255),
  phone VARCHAR(20),
  role VARCHAR(50) NOT NULL DEFAULT 'pending_role' CHECK (role IN ('pending_role', 'technician', 'administrator', 'rrhh')),
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive', 'suspended')),
  assigned_by_rrhh UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP WITH TIME ZONE,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_supabase_id ON users(supabase_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Crear política RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Política: Usuarios pueden ver su propio perfil
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING (auth.uid() = supabase_id);

-- Política: RRHH puede ver todos los usuarios
CREATE POLICY "RRHH can view all users" ON users
  FOR SELECT USING (
    (SELECT role FROM users WHERE supabase_id = auth.uid()) = 'rrhh'
  );

-- Política: RRHH puede actualizar usuarios
CREATE POLICY "RRHH can update users" ON users
  FOR UPDATE USING (
    (SELECT role FROM users WHERE supabase_id = auth.uid()) = 'rrhh'
  );

-- Política: Administrador puede ver todos
CREATE POLICY "Admins can view all users" ON users
  FOR SELECT USING (
    (SELECT role FROM users WHERE supabase_id = auth.uid()) = 'administrator'
  );

COMMIT;
