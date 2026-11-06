# 🎯 GUÍA VISUAL: 5 PASOS PARA ACTIVAR FACIAL RECOGNITION

## PASO 1: Verificar la BD ✅

```
ANTES: Sin columnas faciales
┌─────────────────────────────────┐
│ empleados                       │
├─────────────────────────────────┤
│ id  │ nombre │ usuario │ ...   │
│ 1   │ Juan   │ juan123 │ ...   │
└─────────────────────────────────┘

DESPUÉS: Con columnas faciales
┌────────────────────────────────────────────────────────────────────┐
│ empleados                                                          │
├────────────────────────────────────────────────────────────────────┤
│ id  │ nombre │ usuario │ facial_descriptor │ facial_enabled │ ... │
│ 1   │ Juan   │ juan123 │ NULL              │ false          │ ... │
└────────────────────────────────────────────────────────────────────┘

✅ Ya ejecutaste: scripts/migrate-add-facial-recognition.sql
```

## PASO 2: Entender el Flujo ✅

```
LOGIN FLOW CON FACIAL RECOGNITION

┌─────────────────────────────────────┐
│  Usuario entra usuario/contraseña   │
└────────────┬────────────────────────┘
             │
             ▼
    ┌─────────────────┐
    │ ¿Contraseña OK? │
    └────┬────────┬───┘
        NO│       │SÍ
          │       │
    ┌─────▼──┐   ┌▼──────────────────┐
    │ ERROR  │   │ ¿Cara registrada? │
    └────────┘   └────┬───────────┬──┘
                     NO│          │SÍ
                       │          │
              ┌────────▼┐    ┌────▼─────────┐
              │FASE 1   │    │ FASE 2       │
              │Registra │    │ Verifica     │
              │cara     │    │ cara         │
              │(3×)     │    │              │
              └────┬────┘    └────┬─────────┘
                   │             │
                   └──────┬──────┘
                          │
                   ┌──────▼────────┐
                   │   FASE 3      │
                   │   Liveness    │
                   │   (Parpadeo   │
                   │    o Cabeza)  │
                   └──────┬────────┘
                          │
                   ┌──────▼────────┐
                   │  ✅ ÉXITO!    │
                   │  Dashboard    │
                   └───────────────┘
```

## PASO 3: Reemplazar el Login ✅

### OPCIÓN A (Recomendada): Versión Simplificada

```bash
Archivo: src/app/login/page.tsx

CAMBIO:
┌─────────────────────────────────────────┐
│ VIEJO:                                  │
│ import { LoginForm } from '@/...';      │
│ export default function LoginPage() {   │
│   return <LoginForm />;                 │
│ }                                       │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ NUEVO:                                  │
│ import { LoginFormWithFacial }          │
│   from '@/components/...';              │
│ export default function LoginPage() {   │
│   return <LoginFormWithFacial />;       │
│ }                                       │
└─────────────────────────────────────────┘

✅ RESULTADO:
   ├─ Formulario login normal
   ├─ Después: opción de registrar cara
   ├─ Después: opción de verificar cara
   └─ Después: prueba de vida
```

### OPCIÓN B: Versión Completa

```bash
Ya está en src/components/login-form.tsx

Necesita que importes manualmente:
├─ FacialEnrollment
├─ FacialVerification
└─ FacialLiveness

(Más trabajo pero más profesional)
```

**ELIGE UNA. RECOMIENDO OPCIÓN A.**

## PASO 4: Ejecutar el Servidor ✅

```bash
cd c:\Users\derek\Downloads\aktiva-marcaje-main

npm run dev

Esperado:
✓ Ready in XXXms
✓ Compiled in XXXms
→ http://localhost:3000
```

## PASO 5: Probar ✅

```
1. Abre: http://localhost:3000/login
   
   VES:
   ┌───────────────────────────────┐
   │ 🔓 Iniciar Sesión             │
   │ Con soporte para Reconocimiento│
   │ Facial                        │
   ├───────────────────────────────┤
   │ Usuario: [____]               │
   │ Contraseña: [________]        │
   │                               │
   │ [Iniciar Sesión]              │
   │                               │
   │ ℹ️ Nota: Después de iniciar   │
   │ sesión se pedirá facial...    │
   └───────────────────────────────┘

2. Entra con tu usuario/contraseña
   
3. Sigue el flujo:
   
   PRIMERA VEZ:
   ┌───────────────────────────────┐
   │ 📸 Registrar Rostro           │
   ├───────────────────────────────┤
   │ Para mayor seguridad...       │
   │ ℹ️ Necesitaremos acceder a... │
   │                               │
   │ [📷 Registrar Cara]           │
   │ [Omitir por ahora]            │
   └───────────────────────────────┘
   
   ↓
   
   ┌───────────────────────────────┐
   │ 🎬 Prueba de Vida             │
   ├───────────────────────────────┤
   │ Elige un desafío:             │
   │ • 👀 Parpadea 2 veces        │
   │ • 🔄 Gira tu cabeza           │
   │                               │
   │ [🎬 Iniciar Desafío]          │
   │ [Saltar]                      │
   └───────────────────────────────┘
   
   ↓
   
   ┌───────────────────────────────┐
   │ ✅ Dashboard                   │
   │ Bienvenido, Juan!             │
   └───────────────────────────────┘
```

---

## 🎬 FLUJO VISUAL DETALLADO

### PANTALLA 1: Login

```
┌──────────────────────────────────────────┐
│           AKTIVA MARCAJE                 │
├──────────────────────────────────────────┤
│                                          │
│  Usuario:  [juan123..................]  │
│  Contraseña: [•••••••••••••••]         │
│                                          │
│         [  Iniciar Sesión  ]             │
│                                          │
│  ℹ️  Próximos pasos: Facial recognition  │
│                                          │
└──────────────────────────────────────────┘
```

### PANTALLA 2: Primera Vez (Registrar)

```
┌──────────────────────────────────────────┐
│         📸 REGISTRAR ROSTRO             │
├──────────────────────────────────────────┤
│ Para mayor seguridad, registra tu       │
│ rostro. Es OPCIONAL pero recomendado.   │
│                                          │
│ ⚠️ Necesitaremos tu cámara              │
│    Daremos 3 intentos para captura      │
│                                          │
│      [📷 REGISTRAR CARA]                │
│      [Omitir por ahora]                 │
│                                          │
└──────────────────────────────────────────┘

↓ (Si clickeas "Registrar Cara")

┌──────────────────────────────────────────┐
│         📷 CAPTURANDO ROSTRO            │
├──────────────────────────────────────────┤
│                                          │
│  ┌──────────────────────────────────┐   │
│  │                                  │   │
│  │  (CÁMARA EN VIVO)                │   │
│  │  ████████░░░░░░░  Muestra 2/3   │   │
│  │                                  │   │
│  │  ✓ Cara detectada              │   │
│  │  ✓ Ojos abiertos               │   │
│  │  ✓ Iluminación OK               │   │
│  │                                  │   │
│  └──────────────────────────────────┘   │
│                                          │
│          Aguarda... capturando...       │
│                                          │
└──────────────────────────────────────────┘

↓ (Después de 3 capturas)

┌──────────────────────────────────────────┐
│         ✅ ROSTRO REGISTRADO             │
├──────────────────────────────────────────┤
│ Tu rostro se guardó exitosamente.       │
│ Usaremos esto para verificarte en      │
│ futuros logins.                         │
│                                          │
│      [Continuar a Prueba de Vida]      │
│                                          │
└──────────────────────────────────────────┘
```

### PANTALLA 3: Liveness (Prueba de Vida)

```
┌──────────────────────────────────────────┐
│       🎬 PRUEBA DE VIDA                  │
├──────────────────────────────────────────┤
│ Completa una acción para confirmar      │
│ que eres una persona real.              │
│                                          │
│ Elige un desafío:                       │
│                                          │
│  👀 PARPADEO (2 veces en 3 segundos)  │
│     ✓ Más rápido                       │
│     ✗ Requiere buen ángulo              │
│                                          │
│  🔄 MOVER CABEZA (15° en 5 segundos)  │
│     ✓ Más confiable                    │
│     ✓ Acepta cualquier ángulo           │
│     ✗ Toma más tiempo                   │
│                                          │
│    [👀 PARPADEAR]  [🔄 MOVER CABEZA]  │
│                                          │
└──────────────────────────────────────────┘

↓ (Si clickeas "Mover Cabeza")

┌──────────────────────────────────────────┐
│       🔄 MOVIMIENTO DE CABEZA            │
├──────────────────────────────────────────┤
│                                          │
│  ┌──────────────────────────────────┐   │
│  │                                  │   │
│  │  (CÁMARA EN VIVO)                │   │
│  │                                  │   │
│  │  Gira tu cabeza lentamente...    │   │
│  │  de izquierda a derecha.         │   │
│  │                                  │   │
│  │  Ángulo detectado: ↙ 12°        │   │
│  │  Necesario: ↔ 15°               │   │
│  │  Progreso: ████████░░ 80%       │   │
│  │  Tiempo: 3s / 5s                │   │
│  │                                  │   │
│  └──────────────────────────────────┘   │
│                                          │
└──────────────────────────────────────────┘

↓ (Después de movimiento)

┌──────────────────────────────────────────┐
│       ✅ ÉXITO!                          │
├──────────────────────────────────────────┤
│ Prueba de vida completada.              │
│ Estás entrando al dashboard...          │
│                                          │
│          [Cargar...]                    │
│                                          │
└──────────────────────────────────────────┘
```

### PANTALLA 4: Dashboard

```
┌──────────────────────────────────────────┐
│    DASHBOARD - AKTIVA MARCAJE             │
├──────────────────────────────────────────┤
│                                          │
│  ¡Bienvenido, Juan Pérez!               │
│  Login: Facial Recognition ✓             │
│  Hora: 14:35:22                         │
│                                          │
│  [Llegada] [Almuerzo] [Salida]           │
│                                          │
│  Hoy:                                   │
│  • 08:00 - Llegada a oficina            │
│  • 12:30 - Almuerzo                     │
│  • [En espera de Salida]                │
│                                          │
└──────────────────────────────────────────┘
```

---

## 🧪 DEMO INTERACTIVA (Sin código)

```
URL: http://localhost:3000/facial-demo.html

VES ESTO:

┌────────────────────────────────────────────────────────────┐
│           FACIAL RECOGNITION DEMO - INTERACTIVE            │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ [Detección] [Enrolamiento] [Verificación] [Liveness] [Docs]│
│                                                            │
│ ┌─────────────────────────────────────────────────────┐  │
│ │                                                     │  │
│ │  (CÁMARA EN VIVO)                                   │  │
│ │                                                     │  │
│ │  Estado: Detectando cara...                        │  │
│ │  Confianza: 98.5%                                  │  │
│ │  Face Size: 240x280                                │  │
│ │  Landmarks: Detectados (68)                        │  │
│ │                                                     │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                            │
│ [Empezar]                                                 │
│                                                            │
└────────────────────────────────────────────────────────────┘

✅ Funciona SIN LOGIN
✅ Prueba las 5 tabs
✅ Entiende cómo funciona
✅ 100% interactivo
```

---

## 🔄 COMPARACIÓN: ANTES vs DESPUÉS

### ANTES (Sin Facial Recognition)

```
Login ──┐
        ├──> Contraseña ──> ✅ Dashboard
        └──> ❌ Error
```

### DESPUÉS (Con Facial Recognition)

```
Login ──┐
        ├──> Contraseña ──┐
        │                 ├──> ¿1a vez?
        │                 │    ├─ SÍ  ──> Registrar Cara
        │                 │    └─ NO  ──> Verificar Cara
        │                 │
        │                 ├──> Prueba de Vida (Parpadeo/Movimiento)
        │                 │
        └──────────────────> ✅ Dashboard + Facial Guardada
```

---

## 📱 QUÉ NECESITAS

```
✅ Cámara (integrada o USB)
✅ Navegador moderno (Chrome, Firefox, Safari, Edge)
✅ Permisos de cámara habilitados
✅ JavaScript habilitado
✅ Conexión a Internet (para modelos del CDN)

❌ NO necesitas:
   ❌ GPU especial
   ❌ Servidor separado para facial
   ❌ Librería especial de criptografía
   ❌ Hardware adicional
```

---

## 🎯 RESUMEN DE PASOS

```
┌──────────────────────────────────────────┐
│ PASO 1: BD Lista ✅                      │
│ ✓ Migración ejecutada                   │
│ ✓ Tablas/columnas creadas               │
└──────────────────────────────────────────┘
           ↓
┌──────────────────────────────────────────┐
│ PASO 2: Flujo Entendido ✅               │
│ ✓ 3 Fases (Enrollment, Verify, Liveness)│
│ ✓ Contraseña siempre funciona           │
└──────────────────────────────────────────┘
           ↓
┌──────────────────────────────────────────┐
│ PASO 3: Login Actualizado ✅             │
│ ✓ Opción A (simple) o B (completa)      │
│ ✓ Imports agregados                     │
└──────────────────────────────────────────┘
           ↓
┌──────────────────────────────────────────┐
│ PASO 4: Servidor Corriendo ✅            │
│ ✓ npm run dev sin errores               │
│ ✓ http://localhost:3000 accesible       │
└──────────────────────────────────────────┘
           ↓
┌──────────────────────────────────────────┐
│ PASO 5: Probado ✅                       │
│ ✓ Login con usuario/contraseña          │
│ ✓ Facial Recognition funciona           │
│ ✓ Dashboard accesible                   │
└──────────────────────────────────────────┘
```

---

**¿Necesitas ayuda en algún paso? Cuéntame dónde estás atascado.**
