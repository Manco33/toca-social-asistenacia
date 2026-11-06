# Agregando proyecto_id como Foreign Key (PostgreSQL/Supabase)

## Resumen del cambio

En lugar de guardar solo el nombre del proyecto (texto) en `horarios_gps`, ahora guardamos un `proyecto_id` que es una referencia a la tabla `proyectos`. Esto permite:

- ✅ Integridad referencial: No puedes asociar un log a un proyecto inexistente
- ✅ Mejor rendimiento: Puedes hacer JOINs con proyectos sin matching por nombre
- ✅ Escalabilidad: Si renombras un proyecto, los logs siguen asociados correctamente
- ✅ Datos más confiables: Sin riesgos de inconsistencias por cambios en nombres

## Estructura actual

```sql
CREATE TABLE public.proyectos (
  id SERIAL PRIMARY KEY,           ← INTEGER, no VARCHAR
  nombre VARCHAR NOT NULL,
  soluciones TEXT,
  ubicacion_del_proyecto VARCHAR,
  horas_totales NUMERIC,
  horas_usadas_manual NUMERIC DEFAULT 0
);

CREATE TABLE public.horarios_gps (
  id SERIAL PRIMARY KEY,
  usuario VARCHAR(50) NOT NULL,
  fecha DATE NOT NULL,
  tipo_actividad VARCHAR(100),
  coordenadas VARCHAR(100),
  hora_marcaje TIME,
  proyecto VARCHAR(100),
  nota VARCHAR,
  CONSTRAINT fk_horarios_usuario FOREIGN KEY (usuario) REFERENCES empleados(usuario)
    ON UPDATE CASCADE ON DELETE CASCADE
);
```

## Estructura después de la migración

Añadirá a `horarios_gps`:
- `proyecto_id INTEGER` — nueva columna referencial a `proyectos.id`
- `fk_horarios_gps_proyecto_id` — constraint de foránea
- `idx_horarios_gps_proyecto_id` — índice para queries rápidas

## Pasos para implementar

### 1. Ejecutar la migración SQL en Supabase

En el **SQL Editor** de Supabase:

1. Abre https://supabase.com → Tu proyecto → SQL Editor
2. Crea una nueva query
3. Copia todo el contenido de: **`scripts/migrate-add-proyecto-id-foreign-key.sql`**
4. Haz click en **"Run"**

El SQL ejecutará sin errores y agregará la columna y el constraint.

### 2. Verificar la estructura

Ejecuta esta query en el SQL Editor para confirmar:

```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'horarios_gps' 
ORDER BY ordinal_position;
```

Deberías ver:
```
id              | integer      | false
usuario         | character    | false
fecha           | date         | false
tipo_actividad  | character    | true
coordenadas     | character    | true
hora_marcaje    | time         | true
proyecto        | character    | true
nota            | character    | true
proyecto_id     | integer      | true  ← NUEVA (INTEGER, no VARCHAR)
```

### 3. Migrar datos existentes (IMPORTANTE)

Tienes dos opciones:

#### Opción A: Si `proyectos.id` contiene los nombres exactos

En SQL Editor, ejecuta:

```sql
-- Primero, verifica los proyectos
SELECT id, nombre FROM proyectos LIMIT 10;

-- Luego migra basándote en nombres exactos
UPDATE public.horarios_gps hg
SET proyecto_id = p.id
FROM public.proyectos p
WHERE p.nombre = hg.proyecto
AND hg.proyecto IS NOT NULL 
AND hg.proyecto != '';
```

#### Opción B: Si `proyectos.id` usa IDs personalizados (ej: PROY-001)

Primero verifica la estructura:

```sql
SELECT id, nombre FROM public.proyectos;
```

Luego, mapea manualmente cada proyecto:

```sql
-- Mapea cada proyecto por su ID personalizado
UPDATE public.horarios_gps 
SET proyecto_id = 'PROY-001'
WHERE proyecto = 'P-Coca Cola';

UPDATE public.horarios_gps 
SET proyecto_id = 'PROY-002'
WHERE proyecto = 'ABBSA';

UPDATE public.horarios_gps 
SET proyecto_id = 'PROY-003'
WHERE proyecto = 'Proyecto 3';

-- Repite para cada proyecto...
```

Verifica cuántos se migraron:

```sql
SELECT proyecto, COUNT(*) as count, COUNT(proyecto_id) as con_id
FROM public.horarios_gps
GROUP BY proyecto;
```

### 4. Actualizar el Backend (`actions.ts`)

En la función `getRegistroHoras` (alrededor de línea 410-420), actualiza la query:

**ANTES:**
```typescript
const { data: gpsRows } = await supabase
  .from('horarios_gps')
  .select('*')
  .eq('usuario', user.usuario)
  .gte('fecha', start)
  .lte('fecha', end)
  .order('fecha', { ascending: false })
  .order('hora_marcaje', { ascending: true });
```

**DESPUÉS:**
```typescript
const { data: gpsRows } = await supabase
  .from('horarios_gps')
  .select(`
    *,
    proyectos!proyecto_id (id, nombre)
  `)
  .eq('usuario', user.usuario)
  .gte('fecha', start)
  .lte('fecha', end)
  .order('fecha', { ascending: false })
  .order('hora_marcaje', { ascending: true });
```

Esto hará un LEFT JOIN con `proyectos` usando `proyecto_id`.

### 5. Actualizar el Frontend (opcional pero recomendado)

El frontend (`admin-dashboard-panel.tsx`) ya está preparado, pero puedes optimizarlo para usar `proyecto_id`:

En el `projectSummary` useMemo, cambia:

**ANTES:**
```typescript
(gpsLogs || []).forEach((g: any) => {
  const proj = (g.proyecto && g.proyecto.trim()) ? g.proyecto : null;
  if (proj) { ... }
});
```

**DESPUÉS (usa proyecto_id si está disponible):**
```typescript
(gpsLogs || []).forEach((g: any) => {
  // Usa proyecto_id si existe (nueva estructura), fallback a proyecto (texto)
  const proj = g.proyecto_id || (g.proyecto && g.proyecto.trim()) ? g.proyecto : null;
  const projName = g.proyectos?.nombre || g.proyecto || null;
  if (proj || projName) { ... }
});
```

### 6. Verificar que funciona

1. Guarda los cambios en `actions.ts`
2. Reinicia el servidor (`npm run dev`)
3. Abre la app y busca el técnico 200
4. Abre la consola (F12) y verifica los logs:

```javascript
// Deberías ver:
projectSummary debug: { gpsLogsLength: 5, registroRowsLength: 3, ... }
projectSummary result: { 'PROY-001': {...}, 'PROY-002': {...} }
```

Si ves proyectos agrupados correctamente, ¡funcionó! ✅

## Estructura de datos después

Tabla `horarios_gps` ahora con foránea:

```
id | usuario  | fecha      | hora_marcaje | proyecto      | proyecto_id | nota
---|----------|-----------|--------------|---------------|------------|------
1  | tech001  | 2025-12-11| 09:00:00     | P-Coca Cola   | PROY-001   | NULL
2  | tech001  | 2025-12-11| 12:00:00     | P-Coca Cola   | PROY-001   | NULL
3  | tech001  | 2025-12-12| 08:30:00     | ABBSA         | PROY-002   | NULL
4  | tech002  | 2025-12-12| 10:15:00     | NULL          | NULL       | NULL (sin proyecto)
```

Con la relación:
- `proyecto_id` → `proyectos.id` (referencia)
- El campo `proyecto` se mantiene para compatibilidad

## Rollback (si algo sale mal)

Si necesitas revertir:

```sql
-- Opción 1: Borrar el constraint y la columna
ALTER TABLE public.horarios_gps
DROP CONSTRAINT IF EXISTS fk_horarios_gps_proyecto_id;

ALTER TABLE public.horarios_gps
DROP COLUMN IF EXISTS proyecto_id;

DROP INDEX IF EXISTS idx_horarios_gps_proyecto_id;

-- Opción 2: Si necesitas volver a una versión anterior completa
-- Restaura desde backup en Supabase
```

## Preguntas frecuentes

**P: ¿Puedo hacer esto en Supabase?**
R: Sí, directamente en el SQL Editor del dashboard.

**P: ¿Qué pasa con los logs sin proyecto_id?**
R: Funcionan como antes. El campo es nullable, así que los logs sin proyecto_id simplemente no se agruparán por proyecto (hasta que ejecutes la migración de datos).

**P: ¿Necesito eliminar el campo 'proyecto' de texto?**
R: No es necesario, pero puedes hacerlo después de verificar que todo funciona. Mantenerlo ofrece compatibilidad hacia atrás con logs antiguos.

**P: ¿Cómo inserto nuevos logs con proyecto_id?**
R: Cuando insertes en `horarios_gps`, incluye ambos (usa el ID numérico del proyecto):

```typescript
// Primero, obtén el ID del proyecto
const { data: proyecto } = await supabase
  .from('proyectos')
  .select('id')
  .eq('nombre', 'P-Coca Cola')
  .single();

// Luego inserta el log con proyecto_id (INTEGER)
await supabase
  .from('horarios_gps')
  .insert([{
    usuario: 'tech001',
    fecha: '2025-12-11',
    hora_marcaje: '09:30:00',
    tipo_actividad: 'Llegada a proyecto',
    coordenadas: '12.1234,-85.5678',
    proyecto: 'P-Coca Cola',          // Para display/compatibilidad (VARCHAR)
    proyecto_id: proyecto.id           // Nueva foránea (INTEGER)
  }]);
```

---

**¿Necesitas ayuda? Comparte tu estructura de `proyectos.id` para optimizar la migración.**
