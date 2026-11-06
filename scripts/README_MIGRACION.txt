================================================================================
                    ACTUALIZACIÓN DE BASE DE DATOS
        DPI + Celular para Empleados | IDs Personalizados para Proyectos
================================================================================

RESUMEN RÁPIDO:
================================================================================

Para EMPLEADOS:
  • Agregar campo: dpi (VARCHAR 255, UNIQUE)
  • Agregar campo: numero_celular (VARCHAR 20)

Para PROYECTOS:
  • Cambiar ID de BIGINT a VARCHAR(50)
  • Permite IDs como: PROY-001, CLI-2024, 1001, etc.


ARCHIVOS SQL DISPONIBLES:
================================================================================

1. MIGRATION_GUIDE.sql ⭐ (PRINCIPAL - Usa este)
   → Contiene TODO lo necesario
   → Instrucciones paso a paso
   → Ejemplos de uso
   → Verificaciones

2. migrate-add-dpi-celular.sql
   → Solo cambios a tabla empleados
   → Más pequeño y simple
   → Úsalo si solo quieres agregar DPI/celular

3. migrate-add-custom-project-id.sql
   → Solo cambios a tabla proyectos
   → Con múltiples opciones de migración
   → Úsalo si solo quieres IDs personalizados


PASOS PARA EJECUTAR (En Supabase):
================================================================================

1. Abre https://app.supabase.com
2. Selecciona tu proyecto
3. Ve a "SQL Editor" (lado izquierdo)
4. Abre archivo: scripts/MIGRATION_GUIDE.sql
5. Selecciona y copia TODO el contenido
6. Pégalo en el SQL Editor
7. Haz click en "Execute" (botón de play)
8. Espera a que termine (debería decir "Success")


PASOS PARA EJECUTAR (En línea de comando):
================================================================================

MySQL/MariaDB:
  mysql -h host -u usuario -p database < scripts/MIGRATION_GUIDE.sql

PostgreSQL:
  psql postgresql://usuario:contraseña@host/database < scripts/MIGRATION_GUIDE.sql


VERIFICACIONES RÁPIDAS:
================================================================================

Después de ejecutar, verifica con estos comandos en SQL Editor:

// Ver si DPI y celular se agregaron
SELECT COLUMN_NAME, DATA_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'empleados' 
AND COLUMN_NAME IN ('dpi', 'numero_celular');

// Ver si el ID es ahora VARCHAR
SELECT COLUMN_NAME, DATA_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'proyectos' 
AND COLUMN_NAME = 'id';

// Contar empleados con DPI asignado
SELECT COUNT(*) as empleados_con_dpi FROM empleados WHERE dpi IS NOT NULL;


EJEMPLOS DE DATOS:
================================================================================

Crear empleado con DPI (vía aplicación):
  Nombre: Juan Pérez
  Usuario: juan@empresa.com
  DPI: 1234567-90
  Celular: +502 7123 4567

Crear proyecto con ID personalizado (vía aplicación):
  ID: PROY-2024-001
  Nombre: Renovación Casa
  Ubicación: Ciudad de Guatemala
  Horas Totales: 200


CAMBIOS EN EL CÓDIGO (Ya hechos):
================================================================================

Frontend:
  ✅ admin-users.tsx - Campos DPI y celular visibles y editables
  ✅ admin-projects.tsx - Campo ID visible y editable
  ✅ Tabla de usuarios muestra DPI y celular
  ✅ Tabla de proyectos muestra ID

Backend:
  ✅ /api/admin/users - Soporta dpi y numero_celular
  ✅ /api/projects - Soporta id personalizado


SOLUCIÓN DE PROBLEMAS:
================================================================================

"Algo salió mal en proyectos"
  → Si el cambio a proyectos falla, puedes:
  1. Deshacer: DROP TABLE proyectos; RENAME TABLE proyectos_backup TO proyectos;
  2. O usar la "Opción B" en MIGRATION_GUIDE.sql (más segura pero lenta)

"Dos empleados con el mismo DPI"
  → El DPI es UNIQUE. Si hay duplicados:
  SELECT dpi, COUNT(*) FROM empleados WHERE dpi IS NOT NULL GROUP BY dpi HAVING COUNT(*) > 1;

"Me dice que la tabla no existe"
  → Verifica que estés en la base de datos correcta
  → En Supabase, asegúrate de estar en el proyecto correcto


SEGURIDAD:
================================================================================

⚠️  ANTES DE EMPEZAR:
    1. Haz BACKUP de tu base de datos
    2. Prueba primero en development/staging, no en producción
    3. Lee completo el archivo DATABASE_MIGRATION_GUIDE.md

📌 El cambio en proyectos es delicado porque modifica la clave primaria.
   Por eso hay múltiples opciones en MIGRATION_GUIDE.sql


CONTACTO / AYUDA:
================================================================================

Si tienes dudas:
1. Lee: DATABASE_MIGRATION_GUIDE.md (archivo completo)
2. Revisa los logs en Supabase Dashboard
3. Verifica que la BD está funcionando con: SELECT 1;
4. Prueba primero con datos de prueba, no datos reales


PRÓXIMOS PASOS DESPUÉS DE LA MIGRACIÓN:
================================================================================

1. Reinicia la aplicación (npm run dev)
2. Entra como admin
3. Ve a "Usuarios" y edita uno
4. Deberías ver campos para DPI y celular
5. Ve a "Proyectos" y crea uno nuevo
6. Deberías poder asignar un ID personalizado


LISTO PARA EMPEZAR:
================================================================================

✅ Todos los archivos están en: /scripts/
✅ Código de la aplicación ya está actualizado
✅ Solo necesitas ejecutar los cambios en la BD

¡Adelante! 🚀
