# Creación de Usuarios de Prueba - Aktiva Marcaje

## 📋 Resumen

Este guía te ayudará a:
1. Limpiar la tabla `empleados` (borrar todos excepto 3)
2. Crear 3 usuarios de prueba: admin, rrhh y técnico

## 🛠️ Opción 1: Script Automático (RECOMENDADO)

### Paso 1: Asegurate de tener las variables de entorno

En `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

### Paso 2: Ejecutar el script

```bash
node scripts/create-test-users.js
```

### Resultado esperado:
```
🚀 Iniciando creación de usuarios de prueba...

📝 Creando usuario: admin@aktivacorp.com
   ✅ Usuario creado en Auth: abc123...
   ✅ Usuario creado en BD con rol: administrator
   📧 Email: admin@aktivacorp.com
   🔑 Contraseña: Admin123456!

... (más usuarios)

✅ Proceso completado!

📋 Credenciales de prueba:
──────────────────────────────────────────────────
Email: admin@aktivacorp.com
Password: Admin123456!
Rol: administrator
...
```

## 🔧 Opción 2: Scripts SQL Manuales

### Paso 1: Limpiar tabla `empleados`

1. Ve a **Supabase Dashboard > SQL Editor**
2. Abre el archivo: `scripts/migrate-clean-employees-test-users.sql`
3. Copia y pega el contenido
4. Ejecuta el query

**Resultado:** 3 empleados de prueba con contraseña `admin123`

### Paso 2: Crear usuarios en tabla `users`

#### Opción A: Si uses Supabase UI (MÁS FÁCIL)

1. Ve a **Supabase Dashboard > Authentication > Users**
2. Click en "+ Invite"
3. Crea estos usuarios:

| Email | Contraseña | Confirmado |
|-------|-----------|-----------|
| admin@aktivacorp.com | Admin123456! | ✅ |
| rrhh@aktivacorp.com | RRHH123456! | ✅ |
| tecnico@aktivacorp.com | Tecnico123456! | ✅ |

4. Copia los **ID (UUID)** de cada usuario

5. Ve a **SQL Editor** en Supabase
6. Abre: `scripts/migrate-create-test-users.sql`
7. **Reemplaza los UUIDs** placeholders:
```sql
INSERT INTO users (supabase_id, email, full_name, role, status) VALUES
(
  'TU_UUID_REAL_AQUI'::uuid,  -- ← Reemplaza esto
  'admin@aktivacorp.com',
  'Administrador Sistema',
  'administrator',
  'active'
),
...
```

8. Ejecuta el query

## 🧪 Pruebas

### Test 1: Login Admin
```
Email: admin@aktivacorp.com
Password: Admin123456!
Rol esperado: administrator
```

### Test 2: Login RRHH
```
Email: rrhh@aktivacorp.com
Password: RRHH123456!
Rol esperado: rrhh
Acceso esperado: /dashboard/rrhh/users
```

### Test 3: Login Técnico
```
Email: tecnico@aktivacorp.com
Password: Tecnico123456!
Rol esperado: technician
Acceso esperado: /dashboard (technician view)
```

## 📊 Verificar que todo está correcto

### En Supabase Dashboard:

1. **Verificar tabla `empleados`:**
   - Ve a **Table Editor > empleados**
   - Deberías ver 3 registros:
     - Administrador Sistema (usuario: admin)
     - Recursos Humanos (usuario: rrhh)
     - Juan Técnico Prueba (usuario: tecnico)

2. **Verificar tabla `users`:**
   - Ve a **Table Editor > users**
   - Deberías ver 3 registros con roles asignados

3. **Verificar Supabase Auth:**
   - Ve a **Authentication > Users**
   - Deberías ver 3 usuarios con email confirmado ✅

## ⚠️ Cuidado

- ⚠️ **IMPORTANTE:** El script SQL limpia todos los empleados. No hay "undo" fácil.
- 💾 Si tienes datos importantes, **hacer backup primero**
- 🔑 Las credenciales son de PRUEBA. Cambiarlas en producción.

## 🆘 Si algo falla

### Error: "SUPABASE_SERVICE_ROLE_KEY no configurada"
```
❌ Error: Configura NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local
```

**Solución:**
1. Ve a Supabase Dashboard > Settings > API > Project API Keys
2. Copia el "Service Role (secret)" key
3. Agrega a `.env.local`:
```env
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

### Error: "Usuario ya existe"
```
❌ Error en Auth: User already exists
```

**Solución:**
Borra los usuarios anteriores en Supabase Dashboard > Authentication > Users, luego intenta de nuevo.

### Error de Base de Datos
```
❌ Error en BD: The "users" table doesn't exist
```

**Solución:**
Ejecuta primero la migración:
- Ve a `scripts/migrate-create-users-table.sql`
- Cópialo y pégalo en Supabase SQL Editor
- Ejecúta antes de crear usuarios

## 📝 Notas

- Los 3 usuarios estarán activos inmediatamente
- Todos tienen acceso confirmado (no necesitan confirmar email)
- Los passwordshashes en BD se generan automáticamente
- Puedes cambiar contraseñas después desde Supabase UI

## ✅ Próximo Paso

Una vez creados los 3 usuarios, puedes:

1. Iniciar sesión en la app
2. Probar el flujo de login
3. Verificar que facial recognition funciona
4. Prueba el panel de RRHH para ver usuarios pendientes
