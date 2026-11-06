# Flujo de Registro - Nota Importante

## 📋 Cómo Funciona el Registro Ahora

### Escenario 1: Empleado EXISTE en tabla `empleados` ✅
1. El empleado se crea en `users` (Supabase Auth)
2. Se enlaza automáticamente con su registro en `empleados` vía `supabase_id`
3. El usuario puede iniciar sesión

**Ejemplo:**
- Empleado "Derek" existe en tabla `empleados` con `usuario='derek'`
- Se registra con email: `derek@aktivacorp.com`
- Sistema busca empleado con `usuario='derek'` (parte del email antes de @)
- Encuentra el empleado y lo enlaza automáticamente ✓

### Escenario 2: Empleado NO EXISTE en tabla `empleados` ⚠️
1. El empleado se crea en `users` (Supabase Auth) ✓
2. **NO se puede enlazar** porque no existe en `empleados`
3. RRHH debe crear la resgstro en `empleados` manualmente

**Solución:** Los empleados deben existir primero en la tabla `empleados` antes de registrarse en el sistema.

---

## 🔄 Flujo Recomendado

### Opción A: Pre-registro de Empleados (Recomendado)
1. **RRHH crea empleados en tabla `empleados`**
   - Campo `usuario`: nombre de usuario (parte del email antes de @)
   - Ejemplo: para `derek@aktivacorp.com` → `usuario='derek'`
   
2. **Empleado se registra en login**
   - Email: `derek@aktivacorp.com`
   - Usuario: `derek`
   - Contraseña: (según requisitos de seguridad)
   - Sistema enlaza automáticamente ✓

3. **RRHH aprueba el acceso**
   - Asigna un rol: technician, administrator, rrhh

---

## 🛠️ Crear Empleados en Base de Datos

### Opción 1: SQL Manual
```sql
INSERT INTO empleados (usuario, nombre, rol)
VALUES 
  ('derek', 'Derek Lima', 'técnico'),
  ('juan', 'Juan Pérez', 'técnico'),
  ('maria', 'María García', 'técnico');
```

### Opción 2: Script Node.js (si existe)
```bash
npm run scripts/insert-empleados.js
```

### Opción 3: Panel de RRHH (si está implementado)
- Ir a `/dashboard/rrhh`
- Ver sección "Crear Empleado"
- Llenar campos y guardar

---

## 📝 Tabla: Estructura de `empleados`

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|-------------|-------------|
| `id` | BIGINT | Sí (Auto) | ID único generado |
| `usuario` | VARCHAR | **Sí** | ex: derek, juan, maria |
| `nombre` | TEXT | **Sí** | ex: Derek Lima |
| `rol` | VARCHAR | No | ex: técnico, supervisor |
| `supabase_id` | UUID | No | Se rellena al registrarse |
| `dpi` | VARCHAR(13) | No | Documento de identidad |
| `numero_celular` | VARCHAR(20) | No | Teléfono del empleado |

---

## ✅ Checklist Antes de Usar

- [ ] Confirmar que existe tabla `empleados` en base de datos
- [ ] Insertar empleados en tabla `empleados` (campos: usuario, nombre)
- [ ] El campo `usuario` debe coincidir con la parte antes del @ del email
- [ ] Ejemplo:
  - Email: `derek@aktivacorp.com`
  - usuario: `derek` ← DEBE COINCIDIR

---

## 🚀 Ahora Probar

1. **Crear empleado en BD** (si no existe)
```sql
INSERT INTO empleados (usuario, nombre, rol)
VALUES ('derek', 'Derek Lima', 'técnico');
```

2. **Ir a login y crear cuenta**
- Email: `derek@aktivacorp.com`
- Usuario: `derek`
- Contraseña: `SecurePass123!`

3. **Resultado:**
- ✅ Usuario creado en `users`
- ✅ Enlazado automáticamente en `empleados`
- ⏳ Pendiente de aprobación RRHH

---

## 🐛 Si Aún Hay Error

**Error:** "Error al crear registro de usuario"

**Soluciones:**
1. Verificar que `empleados` tabla existe
2. Confirmar campos obligatorios están llenos
3. Revisar que el email NO está registrado previamente
4. Revisar logs del servidor: `npm run dev`

---

**Última actualización:** 2026-02-23
