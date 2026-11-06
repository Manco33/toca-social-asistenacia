# 🔧 Guía: Configurar Supabase para Reconocimiento Facial

## 📋 Lo que necesitas hacer

### OPCIÓN A: Usar SQL (Recomendado - 5 minutos)

#### Paso 1: Abre Supabase
1. Entra a [https://supabase.com](https://supabase.com)
2. Selecciona tu proyecto `aktiva-marcaje`
3. Ve a **SQL Editor** (lado izquierdo)

#### Paso 2: Ejecuta el script de migración
1. Abre el archivo: `scripts/migrate-add-facial-recognition.sql`
2. Copia TODO el contenido
3. En Supabase SQL Editor, pega el código
4. Haz clic en **▶️ Run** (botón azul abajo a la derecha)

**Resultado esperado:**
```
✅ Queries executed successfully
```

---

### OPCIÓN B: Manual (Sin SQL - 15 minutos)

Si prefieres hacer todo desde la interfaz gráfica:

#### 1️⃣ Agregar columnas a `empleados`

En Supabase:
- Ve a **Database** → **Tables**
- Abre tabla `empleados`
- Haz clic en **+ Add Column** (arriba a la derecha)

Agrega estas 6 columnas:

| Nombre | Tipo | Default | Nullable |
|--------|------|---------|----------|
| `facial_descriptor` | `JSONB` | — | ✅ Sí |
| `facial_enrolled_at` | `timestamptz` | — | ✅ Sí |
| `facial_enabled` | `boolean` | `false` | ❌ No |
| `facial_last_verified` | `timestamptz` | — | ✅ Sí |
| `facial_failed_attempts` | `int8` | `0` | ❌ No |
| `facial_last_failed_at` | `timestamptz` | — | ✅ Sí |

**Cómo agregar cada columna:**
1. Haz clic en **+ Add Column**
2. Llena:
   - **Name:** (nombre de la columna)
   - **Type:** (selecciona del dropdown)
   - **Default value:** (si aplica)
   - **Is nullable:** (Sí o No)
3. Haz clic en **Save**

#### 2️⃣ Crear tabla `facial_audit`

En Supabase:
- Ve a **Database** → **Tables**
- Haz clic en **+ Create a new table**

**Configuración:**

| Campo | Tipo | Settings |
|-------|------|----------|
| `id` | `int8` | Primary Key, Auto-increment |
| `user_id` | `int8` | Foreign Key → `empleados(id)` |
| `action` | `varchar` | Not nullable |
| `phase` | `varchar` | Nullable |
| `success` | `boolean` | Not nullable |
| `distance` | `float8` | Nullable |
| `confidence` | `float8` | Nullable |
| `liveness_type` | `varchar` | Nullable |
| `error_message` | `text` | Nullable |
| `ip_address` | `inet` | Nullable |
| `user_agent` | `text` | Nullable |
| `created_at` | `timestamptz` | Default: `now()` |

**Pasos:**
1. Haz clic en **+ Create a new table**
2. Nombre: `facial_audit`
3. Agrega cada columna según la tabla arriba
4. Haz clic en **Save**

#### 3️⃣ Crear Índices (Opcional pero recomendado)

En Supabase, en la tabla `facial_audit`:
- Haz clic en **Indexes**
- Crea 4 índices:
  1. `idx_facial_audit_user_id` en columna `user_id`
  2. `idx_facial_audit_created_at` en columna `created_at`
  3. `idx_facial_audit_action` en columna `action`
  4. `idx_facial_audit_success` en columna `success`

---

## ✅ Verificación: ¿Funcionó?

Después de ejecutar la migración, verifica que todo esté bien:

### En Supabase SQL Editor, ejecuta:

```sql
-- Ver las nuevas columnas
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'empleados' 
  AND column_name LIKE 'facial_%'
ORDER BY column_name;
```

**Esperado:** Deberías ver 6 filas con las columnas facial_*

```sql
-- Ver la tabla facial_audit
SELECT * FROM facial_audit LIMIT 1;
```

**Esperado:** Tabla vacía pero con las columnas correctas

```sql
-- Ver los índices
SELECT indexname FROM pg_indexes 
WHERE tablename = 'facial_audit';
```

**Esperado:** Deberías ver los 4 índices creados

---

## 📊 Estructura Final

### Tabla `empleados` (amplificada)
```
id                           | int8 (PK)
email                        | varchar
nombre                       | varchar
... (columnas existentes)
facial_descriptor            | JSONB ← NUEVO
facial_enrolled_at          | timestamptz ← NUEVO
facial_enabled              | boolean ← NUEVO
facial_last_verified        | timestamptz ← NUEVO
facial_failed_attempts      | int8 ← NUEVO
facial_last_failed_at       | timestamptz ← NUEVO
```

### Tabla `facial_audit` (nueva)
```
id                  | int8 (PK)
user_id            | int8 (FK)
action             | varchar (enrollment, verification, liveness)
phase              | varchar (phase_1, phase_2, phase_3)
success            | boolean
distance           | float8
confidence         | float8
liveness_type      | varchar (blink, head_turn)
error_message      | text
ip_address         | inet
user_agent         | text
created_at         | timestamptz
```

---

## 🔐 Row-Level Security (RLS)

**El SQL comentado de RLS (deshabilitado por defecto):**
- ℹ️ Las políticas RLS están comentadas porque dependen de tu esquema de autenticación
- ℹ️ Si usas `usuario` (username) como FK, descomentas las líneas RLS en el SQL
- ℹ️ Si usas Supabase Auth, necesitas mapear auth.uid() a empleados.id

**Para habilitar RLS después:**
1. Asegúrate que tienes la columna de auth correcta en `empleados`
2. Descomenta las líneas de RLS en `migrate-add-facial-recognition.sql`
3. Ejecuta el script de nuevo

---

## 🎯 Próximos Pasos

Después de la migración:

1. **Instala la librería de face-api:**
   ```bash
   npm install @vladmandic/face-api
   ```
   (Ya lo hiciste según el terminal)

2. **Descarga los modelos de TensorFlow** (si no los tienes):
   - Van en `/public/models/`
   - El código automáticamente los descarga del CDN si no existen

3. **Integra los componentes en tu login:**
   - `facial-enrollment.tsx` → FASE 1
   - `facial-verification.tsx` → FASE 2
   - `facial-liveness.tsx` → FASE 3

4. **Actualiza `src/app/actions.ts`:**
   - Ya está hecho con `saveFacialDescriptor()` y `getFacialDescriptor()`

5. **Prueba con `public/facial-demo.html`:**
   - Abre en navegador sin cambios de código
   - Verifica que todo funciona

---

## 🚨 En caso de problemas

### "Error: relation 'facial_audit' does not exist"
**Solución:** El script de SQL no se ejecutó correctamente. Copia y ejecuta de nuevo.

### "Error: column 'facial_descriptor' does not exist"
**Solución:** Las columnas no se agregaron. Verifica que ejecutaste hasta la línea de "Paso 1".

### "Permission denied for schema public"
**Solución:** Tu usuario de Supabase no tiene permisos. Contacta al admin del proyecto.

### ¿Debo crear algo en TypeScript?
**No**, los tipos ya están en `src/lib/types.ts` (si no están, te lo digo).

---

## 📝 Script de Rollback

Si necesitas revertir todo:

```sql
-- Ejecuta esto en Supabase SQL Editor si quieres deshacer todo
DROP VIEW IF EXISTS facial_audit_summary;
DROP TABLE IF EXISTS facial_audit;
ALTER TABLE empleados DROP COLUMN IF EXISTS facial_descriptor;
ALTER TABLE empleados DROP COLUMN IF EXISTS facial_enrolled_at;
ALTER TABLE empleados DROP COLUMN IF EXISTS facial_enabled;
ALTER TABLE empleados DROP COLUMN IF EXISTS facial_last_verified;
ALTER TABLE empleados DROP COLUMN IF EXISTS facial_failed_attempts;
ALTER TABLE empleados DROP COLUMN IF EXISTS facial_last_failed_at;
DROP FUNCTION IF EXISTS reset_failed_facial_attempts();
DROP FUNCTION IF EXISTS log_facial_audit(bigint, varchar, varchar, boolean, float8, float8, varchar, text);
```

---

## ✨ Resumen Rápido

**Si tienes prisa (5 minutos):**
1. Copia `scripts/migrate-add-facial-recognition.sql`
2. Pégalo en Supabase SQL Editor
3. Haz clic en **Run**
4. ✅ Listo

**Si prefieres manual (15 minutos):**
1. Agrega 6 columnas a `empleados`
2. Crea tabla `facial_audit`
3. Crea 4 índices
4. ✅ Listo

---

**¿Preguntas?** Abre Supabase y cuéntame si ves algún error.
