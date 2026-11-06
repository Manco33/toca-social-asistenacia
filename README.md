# 🏢 BOCO - Sistema de Asistencia Biométrico, Horarios y Aprendizaje (LMS)

Sistema integral de gestión de turnos, marcaje con geocerca, reconocimiento facial, administración de personal, banco de horas flexible y sistema de aprendizaje con inteligencia artificial desarrollado para **BOCO**.

---

## 🚀 1. Roles del Sistema

### 👔 1. Recursos Humanos (RRHH)
- **Gestión de Colaboradores:** Creación de usuarios con **Código de RRHH alfanumérico con letras, números y símbolos** (ej. `BC-984#X`), activación y desactivación de personal.
- **Asignación de Puestos y Sedes:** Vincula colaboradores con su área (ej. *Bartender*, *Chef / Cocina*, *Limpieza*, *Técnico TI*) y su sede física.
- **Geocercas:** Configura coordenadas geográficas (latitud, longitud) y el radio de tolerancia en metros para el marcaje.
- **Asignación de Equipos:** Asigna qué Asignador / Líder de turno es responsable de qué colaboradores.
- **LMS (Exclusivo de RRHH):**
  - Solo RRHH puede subir cursos, manuales, videos y documentos.
  - **Segmentación estricta por puesto:** Los cursos para *Bartender* solo los ven los bartenders; un colaborador de *Cocina* o *Limpieza* no ve cursos ajenos a su área.
  - **Contador de lectura protegido:** Temporizador de seguridad obligatorio para evitar que el colaborador marque "ya lo leí" sin revisarlo.
  - **Exámenes generados por IA (Gemini):** Preguntas de Verdadero/Falso y Opción Múltiple que **exigen que el colaborador redacte la justificación argumentada de su respuesta**.
- **Reportes Ejecutivos en Excel (.xlsx):** Exportación en un clic con pestañas completas de Asistencias, Horas Regulares, Horas Extras, Banco de Horas y Avance de Capacitación.

### 📋 2. Usuario Asignador (Líder / Supervisor de Turno)
- **Planificación de Horarios:** Asigna y ajusta turnos diarios y semanales para cada colaborador de su team.
- **Alertas Automáticas por WhatsApp:** Al cambiar o asignar un turno, el sistema dispara automáticamente el mensaje de confirmación al colaborador.
- **Justificación de Inasistencias:** Formulario para registrar retardos o faltas justificadas con comprobante y causa.
- **Banco de Horas Flexible & Reposición:**
  - Control de reposición de horas (ej. colaborador que faltó un día y la siguiente semana trabaja 49h para compensar las 40h semanales).
  - Control de turnos trabajados en **días festivos** que se le deben al colaborador.

### 👤 3. Usuario Normal (Colaborador)
- **Enrolamiento Biométrico:** Registro de rostro con Face-API (descriptor 128D) para inicio de sesión y validaciones rápidas.
- **Marcaje Geocercado con Biometría:**
  - Registro de Entrada, Salida a Almuerzo, Fin de Almuerzo (opción de registrar si tomó o no almuerzo) y Salida.
  - **Bloqueo por Geocerca:** Si el colaborador está fuera del radio de tolerancia de su sede asignada, el sistema bloquea el marcaje y le indica la distancia exacta a la que se encuentra.
- **Consulta de Horarios:** Visualización de sus turnos programados de la semana.
- **Capacitación LMS:** Lectura del material de su puesto, cumplimiento del temporizador de seguridad y realización de la evaluación de IA con justificación obligatoria.

---

## 🗄️ 2. Base de Datos en Supabase (`supabase_boco_schema.sql`)

El archivo [`supabase_boco_schema.sql`](file:///c:/Users/Dlima/Downloads/aktiva-marcaje-main/supabase_boco_schema.sql) contiene la estructura relacional limpia y lista para ejecutar en el SQL Editor de Supabase:
- `sedes_zonas`: Coordenadas y geocercas en metros.
- `departamentos_puestos`: Puestos de trabajo para segmentación de cursos.
- `usuarios`: Códigos de RRHH, roles, vinculaciones y descriptores faciales.
- `horarios_turnos`: Planificación semanal y estado de notificaciones WhatsApp.
- `marcajes_asistencia`: Horas de entrada, salida, almuerzo, cálculo de horas regulares y extras.
- `justificaciones_faltas`: Motivos, comprobantes y planes de reposición.
- `banco_horas_compensacion`: Balances semanales y días festivos.
- `lms_cursos`, `lms_asignaciones_cursos`, `lms_evaluaciones_ia`, `lms_avance_colaborador`: Sistema de aprendizaje inteligente.
- `whatsapp_notificaciones_log`: Bitácora de avisos por WhatsApp.

---

## 📁 3. Configuración del Entorno (`.env.local`)

Copia `.env.example` a `.env.local` y agrega tus credenciales:
```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key

# Clave de Gemini para generación de evaluaciones LMS
GOOGLE_API_KEY=tu-api-key-de-gemini
```

---

## 💻 4. Ejecución del Proyecto

1. Instala dependencias:
   ```bash
   npm install
   ```
2. Ejecuta en modo desarrollo:
   ```bash
   npm run dev
   ```
3. Abre [http://localhost:3000](http://localhost:3000) en tu navegador.
