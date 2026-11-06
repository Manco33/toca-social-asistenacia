# Guía de Migración de Base de Datos

## Descripción General

Esta guía te ayudará a actualizar tu base de datos para soportar:
1. **DPI (Documento de Identidad Personal)** para empleados
2. **Número de celular** para empleados
3. **IDs personalizados** para proyectos

## Requisitos Previos

- Acceso a Supabase Dashboard o tu gestor de BD
- Credenciales de administrador
- Una copia de seguridad de tu base de datos

## PARTE 1: Actualizar Tabla EMPLEADOS

### Paso 1: Agregar columnas DPI y celular

**SQL:**
```sql
ALTER TABLE empleados
ADD COLUMN dpi VARCHAR(255) UNIQUE COMMENT 'Documento de Identidad Personal (DPI)',
ADD COLUMN numero_celular VARCHAR(20) COMMENT 'Número de teléfono celular';

CREATE INDEX idx_empleados_dpi ON empleados(dpi);
```

**Instrucciones en Supabase:**
1. Abre Supabase Dashboard → SQL Editor
2. Copia y pega el SQL anterior
3. Haz clic en "Execute" (Ejecutar)
4. Verifica que se muestre "Success"

### Paso 2: Verificar que las columnas se agregaron

```sql
SELECT COLUMN_NAME, DATA_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'empleados' 
AND COLUMN_NAME IN ('dpi', 'numero_celular');
```

Deberías ver 2 filas:
- `dpi` - VARCHAR
- `numero_celular` - VARCHAR

---

## PARTE 2: Actualizar Tabla PROYECTOS

### Importante: Esta es la parte más delicada

El cambio de un PRIMARY KEY es complejo. Te presento dos opciones:

### Opción A: Tabla nueva (Recomendada si tienes pocos proyectos)

```sql
-- 1. Backup de los datos actuales
CREATE TABLE proyectos_backup AS SELECT * FROM proyectos;

-- 2. Eliminar la tabla antigua
DROP TABLE proyectos;

-- 3. Crear nueva tabla con id VARCHAR
CREATE TABLE proyectos (
  id VARCHAR(50) PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL UNIQUE,
  ubicacion_del_proyecto VARCHAR(255),
  soluciones VARCHAR(255),
  horas_totales DECIMAL(10,2),
  horas_usadas_manual DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_nombre (nombre)
);

-- 4. Restaurar datos (convertir IDs a texto)
INSERT INTO proyectos (id, nombre, ubicacion_del_proyecto, soluciones, horas_totales, horas_usadas_manual, created_at, updated_at)
SELECT CAST(id AS CHAR), nombre, ubicacion_del_proyecto, soluciones, horas_totales, horas_usadas_manual, created_at, updated_at
FROM proyectos_backup;

-- 5. Verificar
SELECT * FROM proyectos LIMIT 5;

-- 6. Si todo está bien, eliminar backup
DROP TABLE proyectos_backup;
```

### Opción B: Modificar tabla existente (Requiere cuidado)

```sql
-- Hacer backup primero
CREATE TABLE proyectos_backup AS SELECT * FROM proyectos;

-- Intentar cambiar el tipo
ALTER TABLE proyectos MODIFY COLUMN id VARCHAR(50) NOT NULL PRIMARY KEY;
```

**Nota:** Esta opción puede fallar si hay restricciones. Si falla, usa la Opción A.

### Paso 2: Verificar que el cambio funcionó

```sql
SELECT COLUMN_NAME, DATA_TYPE, COLUMN_KEY 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'proyectos' 
AND COLUMN_NAME = 'id';
```

Deberías ver:
- `COLUMN_NAME`: id
- `DATA_TYPE`: varchar
- `COLUMN_KEY`: PRI (Primary Key)

---

## PARTE 3: Probar las nuevas funcionalidades

### Test 1: Agregar DPI a un empleado

```sql
UPDATE empleados
SET dpi = '1234567-90', numero_celular = '+502 7123 4567'
WHERE usuario = 'tu_usuario@example.com';

-- Verificar
SELECT nombre, usuario, dpi, numero_celular FROM empleados WHERE dpi IS NOT NULL;
```

### Test 2: Crear proyecto con ID personalizado

```sql
-- Crear un proyecto con ID personalizado
INSERT INTO proyectos (id, nombre, ubicacion_del_proyecto, soluciones, horas_totales)
VALUES ('PROY-2024-001', 'Mi Proyecto', 'Ciudad', 'Contacto', 200);

-- Verificar
SELECT id, nombre, horas_totales FROM proyectos WHERE id = 'PROY-2024-001';
```

---

## Cambios en el Código (Ya implementados)

Los siguientes cambios ya están hechos en el código:

### Frontend cambios:
- ✅ `src/components/admin-users.tsx` - Campos DPI y celular agregados
- ✅ `src/components/admin-projects.tsx` - Campo ID personalizado agregado
- ✅ Tabla de usuarios muestra DPI y celular
- ✅ Tabla de proyectos muestra ID
- ✅ Modal de edición permite cambiar ID del proyecto

### Backend cambios:
- ✅ `src/app/api/admin/users/route.ts` - Soporta dpi y numero_celular en POST y PUT
- ✅ `src/app/api/projects/route.ts` - Soporta id personalizado en POST y PUT

---

## Solución de Problemas

### Problema: "UNIQUE constraint failed on dpi"
**Solución:** Dos empleados intentan tener el mismo DPI. Verifica los datos.

```sql
-- Encontrar duplicados
SELECT dpi, COUNT(*) 
FROM empleados 
WHERE dpi IS NOT NULL 
GROUP BY dpi 
HAVING COUNT(*) > 1;
```

### Problema: "Cannot modify column because it's a PRIMARY KEY"
**Solución:** Usa la Opción A (crear tabla nueva). La Opción B no funcionará en tu BD.

### Problema: "Tabla proyectos no existe después de cambios"
**Solución:** Restaura desde el backup:
```sql
DROP TABLE proyectos;
RENAME TABLE proyectos_backup TO proyectos;
```

---

## Checklist Final

- [ ] Hice backup de la base de datos
- [ ] Ejecuté los cambios en empleados (DPI y celular)
- [ ] Ejecuté los cambios en proyectos (ID VARCHAR)
- [ ] Verifiqué que ambas tablas tienen las nuevas columnas
- [ ] Probé crear/editar un empleado con DPI
- [ ] Probé crear/editar un proyecto con ID personalizado
- [ ] El código frontend muestra correctamente los datos
- [ ] Los cambios se ven en Supabase Studio o phpMyAdmin

---

## Contacto

Si tienes problemas:
1. Revisa los logs en `MIGRATION_GUIDE.sql` para SQL exacto
2. Verifica que la BD está en modo de edición
3. Asegúrate de tener permisos de administrador
4. Si es Supabase, revisa la sección "Logs" en el Dashboard
