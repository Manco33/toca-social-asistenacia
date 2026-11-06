# Guía Rápida: Sistema de Reconocimiento Facial

## 🚀 Inicio Rápido

### 1. Probar la Demostración Interactiva

Abre en tu navegador:
```
http://localhost:3000/facial-demo.html
```

Puedes interactuar con todas las 4 fases sin escribir código.

---

## 📖 Estructura de Carpetas Creada

```
src/
├── lib/
│   └── facial-recognition.ts
│       ├── loadFaceAPIModels()              // Cargar modelos
│       ├── startCamera()                    // Acceder a cámara
│       ├── detectAndExtractDescriptor()     // Extraer descriptor (FASE 1)
│       ├── enrollMultipleSamples()          // Múltiples muestras
│       ├── verifyFace()                     // Comparar (FASE 2)
│       ├── compareDescriptors()             // Distancia euclidiana
│       ├── detectBlink()                    // Parpadeo (FASE 3)
│       ├── detectHeadTurn()                 // Movimiento (FASE 3)
│       └── [muchas más funciones]
│
├── components/
│   ├── facial-enrollment.tsx                // FASE 1: Registro
│   ├── facial-verification.tsx              // FASE 2: Verificación
│   └── facial-liveness.tsx                  // FASE 3: Detección de Vida
│
└── app/
    └── actions.ts
        ├── saveFacialDescriptor()           // Guardar en BD
        └── getFacialDescriptor()            // Obtener de BD

public/
└── facial-demo.html                         // Demostración interactiva

docs/
└── FACIAL_RECOGNITION.md                    // Documentación completa
```

---

## 🎯 Las 3 Fases Explicadas

### FASE 1: Enrolamiento (Registro)
**Archivo:** `src/components/facial-enrollment.tsx`

```typescript
// El usuario registra su cara UNA SOLA VEZ
// Se capturan 3 muestras y se promedian
// Resultado: Descriptor de 128 números guardado en BD

import { FacialEnrollment } from '@/components/facial-enrollment';

<FacialEnrollment
  onSuccess={(descriptor) => {
    // Descriptor registrado
  }}
  onCancel={() => {
    // Usuario canceló
  }}
/>
```

### FASE 2: Verificación (Login Facial)
**Archivo:** `src/components/facial-verification.tsx`

```typescript
// El usuario verifica su cara CADA VEZ que inicia sesión
// Se compara con el descriptor guardado
// Usa distancia euclidiana con umbral de 0.6

import { FacialVerification } from '@/components/facial-verification';

const storedDescriptor = JSON.parse(
  await getFacialDescriptor(userId)
);

<FacialVerification
  storedDescriptor={storedDescriptor}
  onSuccess={() => {
    // Cara verificada, pasar a Fase 3
  }}
/>
```

### FASE 3: Detección de Vida (Anti-Spoofing)
**Archivo:** `src/components/facial-liveness.tsx`

```typescript
// Verificar que es una cara REAL
// Dos opciones:
//   - Parpadear 2 veces en 3 segundos
//   - Girar cabeza >15° en 5 segundos

import { FacialLiveness } from '@/components/facial-liveness';

<FacialLiveness
  onSuccess={() => {
    // Autenticación completa
    redirectToDashboard();
  }}
  challenge="blink"  // O "head-turn"
/>
```

---

## 💾 Server Actions Disponibles

### Guardar Descriptor

```typescript
import { saveFacialDescriptor } from '@/app/actions';

const descriptor = [0.234, -0.156, 0.089, ...];
const serialized = JSON.stringify(descriptor);

await saveFacialDescriptor(userId, serialized);
```

### Obtener Descriptor

```typescript
import { getFacialDescriptor } from '@/app/actions';

const descriptorJson = await getFacialDescriptor(userId);
const descriptor = JSON.parse(descriptorJson);  // Si existe
```

---

## 🔧 Librerías Principales Disponibles

### `src/lib/facial-recognition.ts`

```typescript
// ===== INICIALIZACIÓN =====
loadFaceAPIModels()              // Cargar modelos (llamar UNA VEZ)
startCamera(videoElement)        // Iniciar cámara web
stopCamera(stream)               // Detener cámara

// ===== FASE 1: ENROLAMIENTO =====
detectAndExtractDescriptor(video)  // Capturar 1 descriptor
enrollMultipleSamples(video)       // Capturar y promediar 3

// ===== FASE 2: VERIFICACIÓN =====
verifyFace(video, storedDescriptor)  // Verificar cara
compareDescriptors(desc1, desc2)     // Comparar manualmente

// ===== FASE 3: LIVENESS =====
detectBlink(video, duration)       // Detectar parpadeos
detectHeadTurn(video, duration)    // Detectar movimiento de cabeza

// ===== UTILIDADES =====
serializeDescriptor(desc)          // Convertir a JSON
deserializeDescriptor(json)        // Convertir desde JSON
drawDetections(video, canvas)      // Dibujar en tiempo real
```

---

## 📝 Tipos Disponibles

```typescript
// Descriptor almacenado
interface FacialDescriptor {
  descriptor: number[];     // Vector de 128 números
  timestamp: number;        // Cuándo se registró
}

// Resultado de enrolamiento
interface EnrollmentResult {
  success: boolean;
  descriptor?: FacialDescriptor;
  error?: string;
}

// Resultado de verificación
interface VerificationResult {
  success: boolean;
  distance: number;         // 0-1 (menor = más similar)
  isMatch: boolean;         // true si distancia < 0.6
  confidence: number;       // 0-100 (%)
  error?: string;
}

// Resultado de liveness
interface LivenessResult {
  success: boolean;
  passed: boolean;          // true si desafío completado
  challenge: 'blink' | 'head-turn';
  details?: string;
  error?: string;
}
```

---

## 🌐 Integración en Login

### Flujo Completo

```typescript
// src/components/login-form.tsx (o similar)

import { FacialEnrollment } from '@/components/facial-enrollment';
import { FacialVerification } from '@/components/facial-verification';
import { FacialLiveness } from '@/components/facial-liveness';
import { getFacialDescriptor, saveFacialDescriptor } from '@/app/actions';

export function LoginForm() {
  const [stage, setStage] = useState<
    'login' | 'enrollment' | 'verification' | 'liveness'
  >('login');
  
  const [user, setUser] = useState<User | null>(null);
  const [descriptor, setDescriptor] = useState<number[] | null>(null);

  // 1️⃣ Usuario ingresa usuario/contraseña
  const handleTraditionalLogin = async (username: string, password: string) => {
    const user = await authenticate(username, password);
    setUser(user);

    // Buscar si tiene descriptor registrado
    const savedDescriptor = await getFacialDescriptor(user.id);
    
    if (savedDescriptor) {
      // Tiene facial → pasar a verificación
      setDescriptor(JSON.parse(savedDescriptor));
      setStage('verification');
    } else {
      // No tiene facial → ofrecer registro
      setStage('enrollment');
    }
  };

  // 2️⃣ Usuario registra su cara (OPCIONAL o REQUERIDO)
  const handleEnrollmentSuccess = async (facialDescriptor: FacialDescriptor) => {
    if (!user) return;

    // Guardar descriptor en BD
    const serialized = JSON.stringify(facialDescriptor.descriptor);
    await saveFacialDescriptor(user.id, serialized);

    // Pasar a liveness
    setDescriptor(facialDescriptor.descriptor);
    setStage('liveness');
  };

  // 3️⃣ Usuario verifica su cara (REQUERIDO si tiene facial)
  const handleVerificationSuccess = () => {
    // Pasar a liveness
    setStage('liveness');
  };

  // 4️⃣ Usuario completa prueba de vida
  const handleLivenessSuccess = () => {
    // ✓ AUTENTICACIÓN COMPLETA
    redirectToDashboard(user);
  };

  return (
    <>
      {stage === 'login' && (
        <TraditionalLoginForm onSuccess={handleTraditionalLogin} />
      )}

      {stage === 'enrollment' && (
        <FacialEnrollment
          onSuccess={handleEnrollmentSuccess}
          onCancel={() => {
            // Permitir acceso sin facial
            redirectToDashboard(user);
          }}
        />
      )}

      {stage === 'verification' && descriptor && (
        <FacialVerification
          storedDescriptor={descriptor}
          onSuccess={handleVerificationSuccess}
          onCancel={() => setStage('login')}
          userName={user?.name}
        />
      )}

      {stage === 'liveness' && (
        <FacialLiveness
          onSuccess={handleLivenessSuccess}
          onCancel={() => setStage('login')}
          challenge="blink"
        />
      )}
    </>
  );
}
```

---

## 🗄️ Base de Datos

### Agregar Campos (Migration SQL)

```sql
-- Ejecutar ONCE para agregar soporte facial
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS (
  facial_descriptor JSONB,
  facial_enrolled_at TIMESTAMP,
  facial_enabled BOOLEAN DEFAULT true,
  facial_last_verified TIMESTAMP
);

-- Tabla de auditoría (recomendada)
CREATE TABLE IF NOT EXISTS facial_audit (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id BIGINT REFERENCES empleados(id),
  event_type TEXT CHECK (event_type IN ('enrollment', 'verification', 'liveness', 'failed')),
  distance DECIMAL(10,6),
  result BOOLEAN,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Ejemplo de Descriptor Guardado

```json
{
  "facial_descriptor": "[0.234, -0.156, 0.089, 0.567, ...]",
  "facial_enrolled_at": "2025-11-13T10:30:00Z",
  "facial_enabled": true,
  "facial_last_verified": "2025-11-13T15:45:00Z"
}
```

---

## 🎓 Conceptos Clave

### ¿Qué es un Descriptor Facial?

Es un **vector de 128 números** que resume las características únicas de una cara:

```
Cara de Juan:      [0.234, -0.156, 0.089, 0.567, ..., 0.423]
Cara de María:     [-0.145, 0.234, -0.567, 0.089, ..., -0.234]
Foto de Juan:      [0.236, -0.154, 0.091, 0.565, ..., 0.425]

Distancia(Juan, Juan foto) = 0.015  ✓ Muy similar
Distancia(Juan, María)     = 2.134  ✗ Muy diferente
```

### ¿Cómo se Calcula la Distancia Euclidiana?

```
d = √[(d₁)² + (d₂)² + (d₃)² + ... + (d₁₂₈)²]

Donde dᵢ = valor₁[i] - valor₂[i]

Ejemplo con 3 dimensiones (en realidad son 128):
d = √[(0.234-0.236)² + (-0.156-(-0.154))² + (0.089-0.091)²]
d = √[0.000004 + 0.000004 + 0.000004]
d = 0.003 (muy pequeño = caras similares)
```

### Umbral de Decisión (0.6)

```
Distancia < 0.6  →  ✓ Es la misma persona (ACEPTADO)
Distancia ≥ 0.6  →  ✗ Es otra persona (RECHAZADO)
```

Puedes ajustar este valor según tu nivel de seguridad deseado.

---

## 🔒 Seguridad

### ✅ YA IMPLEMENTADO

- ✓ Client-side (imágenes NO se envían a servidores)
- ✓ Bajo costo (librerías gratuitas)
- ✓ Detección de Vida (parpadeo/movimiento)
- ✓ Distancia euclidiana de 128 dimensiones

### ⚠️ IMPORTANTE IMPLEMENTAR DESPUÉS

- [ ] Rate limiting (máx. 5 intentos, bloqueo 15 min)
- [ ] Auditoría (registrar todos los intentos)
- [ ] HTTPS en producción (face-api requiere)
- [ ] Permitir login alternativo sin facial
- [ ] Re-enrollment periódico (cada 6 meses)
- [ ] Almacenar descriptor HASHEADO

---

## 🧪 Pruebas Rápidas

### Test 1: ¿Cargan los modelos?

```typescript
import { loadFaceAPIModels } from '@/lib/facial-recognition';

await loadFaceAPIModels();
console.log('✓ Modelos listos');
```

### Test 2: ¿Accede a la cámara?

```typescript
import { startCamera } from '@/lib/facial-recognition';

const video = document.getElementById('video') as HTMLVideoElement;
const stream = await startCamera(video);
console.log('✓ Cámara iniciada');
```

### Test 3: ¿Detecta descriptores?

```typescript
import { enrollMultipleSamples } from '@/lib/facial-recognition';

const descriptor = await enrollMultipleSamples(video);
console.log('✓ Descriptor:', descriptor.length, 'valores');
```

---

## 📚 Documentación Completa

Ver: `docs/FACIAL_RECOGNITION.md`

Contiene:
- Explicación detallada de cada función
- Fórmulas matemáticas
- Código comentado
- Casos de uso
- Seguridad
- Troubleshooting

---

## 🚨 Troubleshooting Común

### ❌ Error: "Models not loaded"

```typescript
// ✓ Solución: Cargar modelos antes de usar
await loadFaceAPIModels();
```

### ❌ Error: "Cannot access camera"

```typescript
// ✓ Solución 1: Usar HTTPS (o localhost en desarrollo)
// ✓ Solución 2: Verificar permisos en navegador
// ✓ Solución 3: Otro sitio está usando la cámara
```

### ❌ "Descriptor is undefined"

```typescript
// ❌ Incorrecto:
const detection = await faceapi
  .detectSingleFace(videoElement)
  .withFaceLandmarks();
// No tiene .withFaceDescriptor()

// ✓ Correcto:
const detection = await faceapi
  .detectSingleFace(videoElement)
  .withFaceLandmarks()
  .withFaceDescriptor();  // ← Agregar esto
```

### ❌ "Verification always fails"

```typescript
// ✓ Verificar:
// 1. ¿Se registró el descriptor correctamente?
// 2. ¿El usuario está en la misma posición que en el registro?
// 3. ¿Hay suficiente iluminación?
// 4. ¿El umbral de 0.6 es correcto?

const distance = 0.65;  // Mayor que 0.6
console.log('Distancia:', distance);  // Ajustar umbral o posición
```

---

## 🎬 Próximos Pasos

1. **Probar demo** → Abrir `facial-demo.html`
2. **Integrar Fase 1** → Agregar `FacialEnrollment` al login
3. **Integrar Fase 2** → Agregar `FacialVerification` después del login
4. **Integrar Fase 3** → Agregar `FacialLiveness` antes del dashboard
5. **Configurar BD** → Ejecutar migraciones SQL
6. **Testing** → Probar en diferentes dispositivos
7. **Producción** → Activar HTTPS, configurar rate limiting

---

**Última actualización:** Noviembre 13, 2025
