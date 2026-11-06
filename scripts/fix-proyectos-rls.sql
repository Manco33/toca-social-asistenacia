-- Habilitar RLS en la tabla proyectos (si no está ya habilitado)
alter table proyectos enable row level security;

-- Crear política para permitir lectura a usuarios autenticados
drop policy if exists "Allow authenticated users to read proyectos" on proyectos;
create policy "Allow authenticated users to read proyectos" on proyectos
  for select
  using (auth.role() = 'authenticated');

-- Crear política para permitir lectura a anónimos (por si acaso)
drop policy if exists "Allow anonymous users to read proyectos" on proyectos;
create policy "Allow anonymous users to read proyectos" on proyectos
  for select
  using (true);

-- Verificar las políticas creadas
select tablename, policyname, cmd, roles, using_expression, with_check_expression 
from pg_policies 
where tablename = 'proyectos';
