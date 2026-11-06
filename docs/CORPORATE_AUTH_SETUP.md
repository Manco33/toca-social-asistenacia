# Configuración de Autenticación Corporativa - Aktiva Marcaje

## 📋 Descripción General

Sistema de autenticación empresarial que requiere correos @aktivacorp.com para:
- Auto-crear usuarios en Supabase Auth
- Asignar roles (Técnico, Administrador, RRHH) mediante panel RRHH
- Mantener usuarios pendientes en estado de espera hasta asignación

## 🚀 Pasos de Implementación

### 1. Crear Tabla en Supabase

Ejecuta el script SQL en Supabase SQL Editor:

```bash
# Ruta del archivo:
scripts/migrate-create-users-table.sql
```

Este script crea:
- Tabla `users` con campos para gestión de roles
- Índices para optimización
- Políticas RLS (Row Level Security)

### 2. Configurar Variables de Entorno

Asegúrate de tener en `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=tu_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

El `SERVICE_ROLE_KEY` es necesario para crear usuarios desde el servidor.

### 3. Archivos Creados/Actualizados

#### Acciones de Servidor:
- **src/app/user-actions.ts** - Funciones CRUD para usuarios
  - `validateActivaEmail()` - Valida email @aktivacorp.com
  - `createSupabaseUser()` - Crea usuario en Auth + BD
  - `assignUserRole()` - RRHH asigna roles
  - `getPendingUsers()` - Lista usuarios pendientes

#### Componentes:
- **src/components/corporate-auth-form.tsx** - Formulario de registro/login
  - Auto-validación de email corporativo
  - Interfaz de registro con confirmación

- **src/components/rrhh-user-management.tsx** - Panel para RRHH
  - Ver usuarios pendientes
  - Asignar roles
  - Reenviar emails

#### Páginas:
- **src/app/dashboard/pending-role/page.tsx** - Pantalla de espera
  - Mostrada a usuarios con rol `pending_role`
  - Muestra estado y próximos pasos
  - Opción de reenviar correo

- **src/app/dashboard/rrhh/users/page.tsx** - Página de gestión RRHH
  - Acceso privado para usuarios con rol RRHH
  - Gestión completa de usuarios

#### Utilidades:
- **scripts/migrate-create-users-table.sql** - Migración de BD
- **src/middleware.ts** - Middleware para sesiones

## 🔄 Flujo de Autenticación

```
┌─────────────────────────────────────────┐
│ Usuario accede a login                  │
└────────────────┬────────────────────────┘
                 │
        ┌────────▼────────┐
        │ ¿Tiene cuenta?  │
        └────────┬────────┘
                 │
     ┌───────────┼───────────┐
     │           │           │
    NO          SÍ          NO
     │           │           │
     │    ┌──────▼──────┐   │
     │    │ Login exist │   │
     │    └──────┬──────┘   │
     │           │          │
     │      ┌────▼─────┐    │
     │      │ ¿Rol?    │    │
     │      └────┬─────┘    │
     │           │          │
     │    ┌──────┼──────┐   │
     │    │      │      │   │
     | pending  otros  │   │
     │    │      │      │   │
  ┌──▼─┐ │   ┌──▼──┐   │   │
  │Reg│ │   │Show │   └───┼─┐
  │Form┤ │   │Dash │       │ │
  └──┬─┘ │   └──┬──┘   ┌───▼─┴┐
     │   │      │      │ Sign Up
  ┌──▼───┼──┐   │      │ Form
  │Valid │  │   │      │
  │Email?│  │   │      │
  └──┬───┘  │   │      │
     │ ┌────▼──┐│  ┌───▼──┐
     │ │pending┘│  │Create │
     │ │role    │  │User  │
     │ │Waiting │  │BD+Auth│
     │ └────────┘  └───┬───┘
     │                 │
     │            ┌────▼────┐
     │            │pending  │
     │            │Waiting  │
     │            └────┬────┘
     │                 │
  ┌──▼─────────────────┴──┐
  │RRHH ve usuarios      │
  │pendientes en panel   │
  └──┬──────────────────┘
     │
  ┌──▼──────────────┐
  │Asigna rol +     │
  │envía correo     │
  └──┬──────────────┘
     │
  ┌──▼──────────────┐
  │Usuario vuelve   │
  │a login -> Acceso│
  │normalmente      │
  └─────────────────┘
```

## 🔐 Roles Disponibles

| Rol | Descripción | Acceso |
|-----|-------------|--------|
| **pending_role** | Usuario nuevo, sin rol asignado | Solo pantalla de espera |
| **technician** | Técnico de campo | Dashboard técnico |
| **administrator** | Administrador | Panel admin completo |
| **rrhh** | Recursos Humanos | Gestión de usuarios |

## 📧 Flujo de Emails

### Usuario Nuevo
1. Se registra con correo @aktivacorp.com
2. Sistema envía email de confirmación
3. Usuario queda en estado `pending_role`

### Asignación de Rol (RRHH)
1. RRHH ve el usuario en panel
2. Clicks "Asignar Rol"
3. Sistema envía email con link de password reset
4. Usuario recibe email y establece contraseña
5. Login normal ahora disponible

## ⚙️ Integración con Existente

El sistema conserva:
- ✅ Facial Recognition
- ✅ GPS Tracking
- ✅ Dashboard principal
- ✅ Todas las funcionalidades anteriores

Solo actualiza la capa de autenticación.

## 🧪 Testing

### Crear Usuario de Prueba
```javascript
// En browser console
const {createSupabaseUser} = await import('@/app/user-actions.ts')
await createSupabaseUser(
  'testuser@aktivacorp.com',
  'Test123456',
  'Usuario Test'
)
```

### Acceder como RRHH
1. Crear usuario RRHH manualmente en Supabase
2. Ir a `/dashboard/rrhh/users`
3. Ver usuarios pendientes

## 🆘 Troubleshooting

### Error: "SERVICE_ROLE_KEY no configurada"
- Verificar `.env.local` tiene `SUPABASE_SERVICE_ROLE_KEY`
- Esta variable NO debe estar en `.env.public`

### Usuario no aparece en tabla users
- Ver logs de `user-actions.ts`
- Verificar que tabla `users` existe en Supabase
- Confirmar políticas RLS están configuradas

### Email no se envía
- Verificar Supabase Email settings
- Comprobar que el correo no está en spam
- Ver logs en Supabase Dashboard

## 📝 Próximos Pasos

- [ ] Conectar formulario corporativo al login principal
- [ ] Agregar dashboard que detecte rol `pending_role` y redirige automáticamente
- [ ] Crear notificaciones en RRHH cuando hay usuarios pendientes
- [ ] Agregar auditoría de quién asignó cada rol

## 📚 Referencias

- Supabase Auth: https://supabase.com/docs/guides/auth
- Admin API: https://supabase.com/docs/reference/javascript/admin-api
- Row Level Security: https://supabase.com/docs/guides/auth/row-level-security
