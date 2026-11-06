# Sistema de Registro de Usuarios - Guía Completa

## 🎯 Resumen de Cambios

Se ha mejorado significativamente el flujo de registro (signup) de nuevos usuarios en el sistema Marcaje Aktiva. Ahora los usuarios pueden crear una cuenta de forma clara y directa.

---

## 📋 Flujo de Autenticación

### 1. **Pantalla de Bienvenida (Nuevo)**
La primera pantalla que ven los usuarios ahora es una **pantalla de bienvenida** clara con dos opciones:

```
┌─────────────────────────────────┐
│        ¡Bienvenido!             │
│  Elige cómo deseas acceder      │
│  a Marcaje Aktiva               │
├─────────────────────────────────┤
│  [Iniciar Sesión]               │
│  [Crear Cuenta Nueva]           │
└─────────────────────────────────┘
```

### 2. **Opción 1: Iniciar Sesión**
- Acceso para usuarios existentes con credenciales
- Usuario + Contraseña
- Después de login exitoso → Flujo de Facial Recognition (si está configurado)

### 3. **Opción 2: Crear Cuenta Nueva** ✨
- Para nuevos empleados con email corporativo
- Campos requeridos:
  - **Email Corporativo** (ej: juan@aktivacorp.com)
  - **Usuario** (nombre de usuario único, 3-20 caracteres)
  - **Nombre Completo**
  - **Contraseña** (mín. 8 caracteres, mayúscula, número, carácter especial)
  - **Confirmar Contraseña**
  - **Teléfono** (opcional)

---

## 🔐 Validaciones de Registro

### Email
- ✓ Debe ser un email válido
- ✓ Debe ser dominio corporativo `@aktivacorp.com`
- ✓ No puede estar registrado previamente

### Usuario
- ✓ Mínimo 3 caracteres
- ✓ Máximo 20 caracteres
- ✓ Debe ser único (no puede repetirse)

### Contraseña
- ✓ Mínimo 8 caracteres
- ✓ Obligatorio: 1 mayúscula (A-Z)
- ✓ Obligatorio: 1 número (0-9)
- ✓ Obligatorio: 1 carácter especial (!@#$%^&*)
- ✓ Debe coincidir en ambos campos

---

## 🗄️ Datos Creados en el Sistema

Cuando un nuevo usuario se registra exitosamente, se crean registros en **dos tablas**:

### Tabla: `users` (Supabase Auth)
```sql
{
  supabase_id: UUID,           -- ID de autenticación Supabase
  email: string,                -- Email corporativo
  full_name: string,            -- Nombre completo
  phone: string,                -- Teléfono (opcional)
  role: 'pending_role',         -- Estado inicial
  status: 'pending',            -- Pendiente de aprobación RRHH
  created_at: timestamp
}
```

### Tabla: `empleados` (PostgreSQL)
```sql
{
  usuario: string,              -- Nombre de usuario (generado del email)
  nombre: string,               -- Nombre completo
  supabase_id: UUID,           -- LINK con users.supabase_id
  rol: 'técnico',              -- Rol por defecto
  created_at: timestamp
}
```

### Enlace Automático
- El campo `supabase_id` en `empleados` referencia `users.supabase_id`
- Esto permite relacionar la autenticación con los datos del empleado
- Si exista un empleado previo con el mismo nombre de usuario, se actualiza automáticamente con el `supabase_id`

---

## ⏳ Estado Después del Registro

1. **Cuenta Creada** ✓
   - Usuario crea cuenta
   - Se inserta en `users` con estado `pending_role`
   - Se crea/actualiza registro en `empleados`

2. **Pendiente de Aprobación** ⏱️
   - El equipo de RRHH revisa la solicitud
   - Ver: Panel de Administración → Usuarios Pendientes

3. **Aprobado** ✓
   - RRHH asigna un rol: `technician`, `administrator`, o `rrhh`
   - Usuario recibe notificación
   - Puede iniciar sesión normalmente

---

## 📧 Emails Enviados

Cuando se registra un nuevo usuario:

### Email 1: Confirmación de Contraseña
- Se envía un link de recuperación de contraseña
- El usuario puede confirmar/cambiar su contraseña
- Link válido por un período limitado

---

## 🛠️ Cambios Técnicos Realizados

### 1. **Archivo: `src/components/login-form.tsx`**
- ✅ Agregada pantalla de bienvenida con tipo `AuthMode = "welcome"`
- ✅ Cambio de estado inicial de `"login"` a `"welcome"`
- ✅ Navegación mejorada entre pantallas
- ✅ Botones más claros y descriptivos

### 2. **Archivo: `src/app/user-actions.ts`**
- ✅ Actualizada función `createSupabaseUser()`
- ✅ Se crea automáticamente registro en tabla `empleados`
- ✅ Enlace automático vía `supabase_id` si empleado existe
- ✅ Mejor manejo de errores

### 3. **Migraciones SQL**
- El archivo `scripts/migrate-link-empleados-users.sql` ya existe
- Define el campo `supabase_id` en tabla empleados
- Crea índices para búsquedas rápidas

---

## 🚀 Cómo Probar

### Paso 1: Iniciar la aplicación
```bash
npm run dev
```

### Paso 2: Navegar a login
```
http://localhost:3000/login
```

### Paso 3: Hacer clic en "Crear Cuenta Nueva"
- Deberías ver el formulario de registro con todos los campos

### Paso 4: Llenar formulario
```
Email: test-123@aktivacorp.com
Usuario: test123
Nombre: Test User
Teléfono: +502 7123 4567
Contraseña: Password123!
```

### Paso 5: Verificar
✓ Vista "Cuenta Creada - Pendiente de Aprobación"
✓ Email enviado al usuario
✓ Registro en tabla `users` con estado `pending_role`
✓ Registro en tabla `empleados` creado/actualizado

---

## 🔍 Troubleshooting

### Problema: "Solo se permiten emails @aktivacorp.com"
**Solución:** Usar un email con dominio `@aktivacorp.com`

### Problema: "Este correo ya está registrado"
**Solución:** El email ya existe en el sistema. Usar otro email o contactar RRHH para recuperar cuenta.

### Problema: "Contraseña débil"
**Solución:** La contraseña debe incluir:
- Mínimo 8 caracteres
- Al menos 1 mayúscula
- Al menos 1 número
- Al menos 1 carácter especial

### Problema: "Las contraseñas no coinciden"
**Solución:** Asegurar que ambos campos de contraseña sean idénticos

### Problema: No recibe email
- Verificar carpeta de spam
- Esperar 2-3 minutos
- Contactar al administrador

---

## 👥 Proceso de Aprobación (RRHH)

1. Ir a `/dashboard/rrhh`
2. Ver sección "Usuarios Pendientes"
3. Revisar solicitud
4. Asignar rol (technician/administrator/rrhh)
5. Usuario recibe notificación

---

## 📱 Información Técnica

- **Framework:** Next.js 15+
- **Auth:** Supabase
- **Database:** PostgreSQL
- **Client Validation:** Zod + React Hook Form
- **UI Components:** shadcn/ui

---

## ✅ Checklist de Funcionalidades

- [x] Pantalla de bienvenida clara
- [x] Formulario de registro con validaciones
- [x] Validación de email corporativo
- [x] Creación automática en `users`
- [x] Creación automática en `empleados`
- [x] Enlace vía `supabase_id`
- [x] Email de confirmación
- [x] Flujo de aprobación RRHH
- [x] Mensajes de error claros
- [x] Navegación mejorada

---

**Última actualización:** 2026-02-23
**Versión:** 1.0
