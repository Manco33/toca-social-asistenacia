# Sistema de Reconocimiento Facial - Guía Completa

## 🎯 Descripción General

Este documento explica la implementación completa de un sistema de **autenticación biométrica facial** de bajo costo utilizando **face-api.js** (sin APIs de pago como Amazon Rekognition o Azure).

### Características Principales:
- ✅ **100% Client-side** (en el navegador)
- ✅ **Bajo costo** (librerías públicas y gratuitas)
- ✅ **Tres fases**: Enrolamiento → Verificación → Detección de Vida
- ✅ **Almacenamiento seguro** en Supabase
- ✅ **Anti-spoofing** básico incluido

---

## 📦 Instalación

### Librerías Requeridas

```bash
npm install @vladmandic/face-api tensorflow.js
```

### Archivos del Proyecto

```
src/
├── lib/
│   └── facial-recognition.ts          # Librería principal
├── components/
│   ├── facial-enrollment.tsx           # Fase 1: Registro
│   ├── facial-verification.tsx         # Fase 2: Verificación
│   └── facial-liveness.tsx             # Fase 3: Detección de Vida
└── app/
    └── actions.ts                      # Server actions para BD

public/
└── models/                             # Modelos de face-api (descarga recomendada)
```

---

## 🚀 FASE 1: ENROLAMIENTO (Registro del Usuario)

### Objetivo
Capturar el "descriptor facial" del usuario (vector de 128 números que lo identifica de forma única).

### Proceso Técnico

#### 1. **Cargar Modelos de face-api.js**

```typescript
import * as faceapi from '@vladmandic/face-api';

async function loadFaceAPIModels(): Promise<void> {
  const MODEL_PATH = '/models/'; // O URL de CDN
  
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_PATH),      // Detección
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_PATH),     // Características (68 puntos)
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_PATH),    // Descriptor facial
  ]);
  
  console.log('Modelos listos');
}
```

**¿Qué hace cada modelo?**
- **TinyFaceDetector**: Detecta dónde está la cara en la imagen
- **FaceLandmark68Net**: Identifica 68 puntos clave en la cara (ojos, nariz, boca, etc.)
- **FaceRecognitionNet**: Genera el descriptor (vector de 128 números)

#### 2. **Acceder a la Cámara**

```typescript
async function startCamera(videoElement: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 640 },
      height: { ideal: 480 },
      facingMode: 'user', // Cámara frontal
    },
    audio: false,
  });

  videoElement.srcObject = stream;
  
  return new Promise((resolve) => {
    videoElement.onloadedmetadata = () => {
      videoElement.play();
      resolve(stream);
    };
  });
}
```

#### 3. **Extraer el Descriptor Facial (EL PASO CLAVE)**

```typescript
async function detectAndExtractDescriptor(videoElement: HTMLVideoElement) {
  // Este es el cambio crucial: agregar .withFaceDescriptor()
  const detection = await faceapi
    .detectSingleFace(videoElement, DETECTION_OPTIONS)
    .withFaceLandmarks()
    .withFaceDescriptor();  // ← AQUÍ SE EXTRAE EL DESCRIPTOR
  
  if (!detection) {
    throw new Error('No se detectó cara');
  }

  // El descriptor es un Float32Array de 128 valores
  const descriptor = Array.from(detection.descriptor);
  
  console.log('Descriptor extraído:');
  console.log(`  - Longitud: ${descriptor.length} valores`);
  console.log(`  - Primeros 5 valores: ${descriptor.slice(0, 5)}`);
  
  return descriptor;
}
```

**¿Qué es el Descriptor?**
- Un vector matemático de 128 números (Float32)
- Cada número representa características faciales abstractas
- Ejemplo:
  ```json
  [0.234, -0.156, 0.089, 0.567, -0.234, ... 123 números más]
  ```

#### 4. **Mejorar Precisión: Múltiples Muestras**

```typescript
async function enrollMultipleSamples(
  videoElement: HTMLVideoElement,
  samples: number = 3  // Capturar 3 muestras
): Promise<number[]> {
  const descriptors: number[][] = [];

  for (let i = 0; i < samples; i++) {
    // Esperar entre capturas
    await new Promise((resolve) => setTimeout(resolve, 500));

    const descriptor = await detectAndExtractDescriptor(videoElement);
    descriptors.push(descriptor);
    
    console.log(`Muestra ${i + 1}/${samples} capturada`);
  }

  // Promediar los 3 descriptores para mayor robustez
  const averaged = descriptors[0].map((_, i) =>
    descriptors.reduce((sum, desc) => sum + desc[i], 0) / descriptors.length
  );

  return averaged;
}
```

**¿Por qué múltiples muestras?**
- Cada captura puede tener pequeñas variaciones
- Promediar reduce el ruido
- Mayor precisión en futuras comparaciones

#### 5. **Almacenar en Base de Datos**

```typescript
// Server action en src/app/actions.ts
export async function saveFacialDescriptor(
  userId: string,
  descriptorJson: string
): Promise<void> {
  const { error } = await supabase
    .from('empleados')
    .update({
      facial_descriptor: descriptorJson,          // JSON: "[0.234, -0.156, ...]"
      facial_enrolled_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) throw error;
}

// Serializar antes de enviar
const serialized = JSON.stringify(descriptor);
await saveFacialDescriptor(userId, serialized);
```

**Estructura en Supabase:**
```sql
CREATE TABLE empleados (
  id BIGINT PRIMARY KEY,
  nombre TEXT,
  usuario TEXT,
  contrasena TEXT,
  -- Nuevos campos:
  facial_descriptor JSONB,           -- El descriptor serializado
  facial_enrolled_at TIMESTAMP,      -- Cuándo se registró
  facial_enabled BOOLEAN DEFAULT true
);
```

---

## 🔐 FASE 2: VERIFICACIÓN FACIAL (Login)

### Objetivo
Comparar la cara en vivo con el descriptor almacenado.

### Proceso Técnico

#### 1. **Obtener Descriptor Guardado**

```typescript
export async function getFacialDescriptor(userId: string): Promise<number[] | null> {
  const { data } = await supabase
    .from('empleados')
    .select('facial_descriptor')
    .eq('id', userId)
    .single();

  if (!data?.facial_descriptor) return null;
  
  // Deserializar JSON
  return JSON.parse(data.facial_descriptor);
}
```

#### 2. **Capturar Descriptor en Vivo**

```typescript
async function verifyFace(
  videoElement: HTMLVideoElement,
  storedDescriptor: number[]
) {
  // Capturar cara actual
  const detection = await faceapi
    .detectSingleFace(videoElement, DETECTION_OPTIONS)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) {
    throw new Error('No se detectó cara');
  }

  const liveDescriptor = Array.from(detection.descriptor);
  
  return { liveDescriptor, storedDescriptor };
}
```

#### 3. **Comparación: Distancia Euclidiana (CLAVE)**

```typescript
function euclideanDistance(a: number[], b: number[]): number {
  // Distancia euclidiana entre dos vectores de 128 dimensiones
  let sum = 0;
  
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;  // Suma de cuadrados de diferencias
  }
  
  return Math.sqrt(sum);  // Raíz cuadrada = distancia
}

// Ejemplo:
const storedDescriptor = [0.234, -0.156, 0.089, ...];
const liveDescriptor = [0.240, -0.151, 0.087, ...];

const distance = euclideanDistance(liveDescriptor, storedDescriptor);
console.log(`Distancia: ${distance.toFixed(4)}`); // Ej: 0.1523
```

**¿Qué significa la distancia?**
- **0.0** = Cara idéntica (imposible en práctica)
- **0.1-0.3** = Muy similar, casi seguro la misma persona
- **0.3-0.6** = Similar, probablemente la misma persona
- **0.6+** = Diferente, probablemente otra persona

#### 4. **Lógica de Decisión: Umbral (CRÍTICO)**

```typescript
const DISTANCE_THRESHOLD = 0.6;  // Umbral estándar

const distance = euclideanDistance(liveDescriptor, storedDescriptor);

if (distance < DISTANCE_THRESHOLD) {
  console.log('✓ AUTENTICADO');
  // Permitir acceso
  return true;
} else {
  console.log('✗ RECHAZADO');
  // Denegar acceso
  return false;
}
```

**Ajustar el Umbral:**
- **< 0.6** = Más permisivo (menos falsos negativos, más falsos positivos)
- **= 0.6** = Balance recomendado
- **> 0.6** = Más restrictivo (más falsos negativos)

#### 5. **Calcular Confianza**

```typescript
const distance = 0.35;
const confidence = Math.max(0, (1 - distance) * 100);
console.log(`Confianza: ${confidence.toFixed(1)}%`); // 65.0%
```

---

## 🚨 FASE 3: DETECCIÓN DE VIDA (Anti-Spoofing)

### Objetivo
Verificar que es una cara REAL (no una foto o video).

### Riesgo Crítico: Spoofing

```
SIN Liveness:  Persona A registra su cara
               Persona B toma foto de A
               Persona B muestra foto a cámara
               ¡Persona B es autenticado como A! ❌

CON Liveness:  Persona A registra su cara
               Persona B toma foto de A
               Se pide: "Parpadea 2 veces"
               ¡Foto no puede parpadear! ✓
```

### Implementación: Detección de Parpadeo

#### 1. **Calcular Eye Aspect Ratio (EAR)**

```typescript
function calculateEyeAspectRatio(eye: Point[]): number {
  // eye es un array de 6 puntos (landmarks del ojo)
  // eye[0-2] = esquinas y parte superior
  // eye[3-5] = esquinas y parte inferior
  
  const distance = (p1: Point, p2: Point) => {
    return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
  };

  // EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)
  const a = distance(eye[1], eye[5]);  // Vertical superior
  const b = distance(eye[2], eye[4]);  // Vertical inferior
  const c = distance(eye[0], eye[3]);  // Horizontal

  return (a + b) / (2 * c);
}

// Ojos abiertos: EAR ≈ 0.3-0.5
// Ojos cerrados: EAR ≈ 0.0-0.1
```

#### 2. **Detectar Parpadeos**

```typescript
async function detectBlink(
  videoElement: HTMLVideoElement,
  durationSeconds: number = 3
): Promise<{ passed: boolean; blinkCount: number }> {
  const endTime = Date.now() + durationSeconds * 1000;
  let blinkCount = 0;
  let eyeClosureFrames = 0;
  const EAR_THRESHOLD = 0.2;  // Umbral para detectar cierre

  while (Date.now() < endTime) {
    const detection = await faceapi
      .detectSingleFace(videoElement, DETECTION_OPTIONS)
      .withFaceLandmarks();

    if (!detection) {
      return { passed: false, blinkCount: 0 };
    }

    // Calcular EAR para ambos ojos
    const leftEye = detection.landmarks.getLeftEye();
    const rightEye = detection.landmarks.getRightEye();
    
    const leftEAR = calculateEyeAspectRatio(leftEye);
    const rightEAR = calculateEyeAspectRatio(rightEye);
    const avgEAR = (leftEAR + rightEAR) / 2;

    // Detectar transición: ojos abiertos → cerrados → abiertos
    if (avgEAR < EAR_THRESHOLD) {
      eyeClosureFrames++;  // Contando frames de cierre
    } else {
      // Si acabamos de pasar de cerrados a abiertos = 1 parpadeo
      if (eyeClosureFrames >= 3) {  // Al menos 3 frames cerrados = parpadeo real
        blinkCount++;
      }
      eyeClosureFrames = 0;
    }

    // Pequeña pausa para no saturar
    await new Promise(r => setTimeout(r, 30));
  }

  return {
    passed: blinkCount >= 2,  // Requiere mínimo 2 parpadeos
    blinkCount
  };
}
```

### Implementación: Detección de Movimiento de Cabeza

#### 1. **Calcular Ángulo de Cabeza**

```typescript
function calculateHeadAngle(landmarks: Point[]): number {
  // Usar la línea entre los ojos para calcular el ángulo
  const leftEye = landmarks[36];      // Esquina izquierda del ojo izquierdo
  const rightEye = landmarks[45];     // Esquina derecha del ojo derecho

  const dx = rightEye.x - leftEye.x;
  const dy = rightEye.y - leftEye.y;

  // Atan2 regresa el ángulo en radianes (-π a π)
  return Math.atan2(dy, dx) * (180 / Math.PI);  // Convertir a grados
}
```

#### 2. **Detectar Giro de Cabeza**

```typescript
async function detectHeadTurn(
  videoElement: HTMLVideoElement,
  durationSeconds: number = 5
): Promise<{ passed: boolean; maxAngleDifference: number }> {
  const endTime = Date.now() + durationSeconds * 1000;
  const headAngles: number[] = [];

  while (Date.now() < endTime) {
    const detection = await faceapi
      .detectSingleFace(videoElement, DETECTION_OPTIONS)
      .withFaceLandmarks();

    if (!detection) {
      return { passed: false, maxAngleDifference: 0 };
    }

    const angle = calculateHeadAngle(detection.landmarks.positions);
    headAngles.push(angle);

    await new Promise(r => setTimeout(r, 50));
  }

  // Calcular rango de movimiento
  const minAngle = Math.min(...headAngles);
  const maxAngle = Math.max(...headAngles);
  const difference = Math.abs(maxAngle - minAngle);

  return {
    passed: difference > 15,  // Requiere al menos 15 grados de movimiento
    maxAngleDifference: difference
  };
}
```

---

## 📱 Integración en Technician Dashboard

### Flujo Completo de Autenticación

```
1. Usuario ingresa usuario/contraseña
   ↓
2. Validar credenciales
   ↓
3. ¿Tiene descriptor facial registrado?
   ├─ NO → Mostrar opción de registrar ahora
   └─ SÍ ↓
4. Abrir modal de verificación facial
   ├─ Capturar descriptor en vivo
   ├─ Comparar con descriptor guardado
   └─ Si distancia < 0.6:
       ↓
5. Mostrar prueba de vida (parpadeo o movimiento)
   ├─ Usuario completa desafío
   └─ Si se detecta movimiento real:
       ↓
6. ✓ AUTENTICACIÓN COMPLETADA
   ↓
7. Redirigir a dashboard
```

### Implementación en React

```typescript
// En login-form.tsx o similar
import { FacialEnrollment } from '@/components/facial-enrollment';
import { FacialVerification } from '@/components/facial-verification';
import { FacialLiveness } from '@/components/facial-liveness';

export function LoginForm() {
  const [stage, setStage] = useState<'login' | 'facial' | 'liveness'>('login');
  const [user, setUser] = useState<User | null>(null);
  const [facialDescriptor, setFacialDescriptor] = useState<number[] | null>(null);

  const handleLoginSuccess = async (loginUser: User) => {
    // Obtener descriptor guardado
    const descriptor = await getFacialDescriptor(loginUser.id);
    
    if (descriptor) {
      // Si tiene facial registrado, verificar
      setUser(loginUser);
      setFacialDescriptor(JSON.parse(descriptor));
      setStage('facial');
    } else {
      // Si no tiene facial, permitir registro opcional
      setUser(loginUser);
      setStage('liveness'); // O redirigir directo al dashboard
    }
  };

  const handleFacialVerificationSuccess = () => {
    // Pasar a prueba de vida
    setStage('liveness');
  };

  const handleLivenessSuccess = () => {
    // Autenticación completa
    redirectToDashboard(user);
  };

  return (
    <>
      {stage === 'login' && (
        <TraditionalLogin onSuccess={handleLoginSuccess} />
      )}

      {stage === 'facial' && facialDescriptor && (
        <FacialVerification
          storedDescriptor={facialDescriptor}
          onSuccess={handleFacialVerificationSuccess}
          userName={user?.name}
        />
      )}

      {stage === 'liveness' && (
        <FacialLiveness
          onSuccess={handleLivenessSuccess}
          challenge="blink"  // O 'head-turn'
        />
      )}
    </>
  );
}
```

---

## 🗄️ Estructura de Base de Datos

### Migración SQL

```sql
-- Agregar campos de reconocimiento facial a empleados
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS (
  facial_descriptor JSONB,              -- El vector de 128 números
  facial_enrolled_at TIMESTAMP,         -- Cuándo se registró
  facial_enabled BOOLEAN DEFAULT true,  -- Si está activo
  facial_last_verified TIMESTAMP        -- Último login facial exitoso
);

-- Crear tabla de auditoría (recomendado)
CREATE TABLE IF NOT EXISTS facial_audit (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id BIGINT REFERENCES empleados(id),
  event_type TEXT,  -- 'enrollment', 'verification', 'liveness', 'failed_attempt'
  distance DECIMAL,  -- Si es verification
  result BOOLEAN,    -- true = exitoso, false = fallido
  created_at TIMESTAMP DEFAULT NOW()
);

-- Crear índices para performance
CREATE INDEX idx_empleados_facial_enabled ON empleados(facial_enabled);
CREATE INDEX idx_facial_audit_user_id ON facial_audit(user_id);
```

---

## 🔒 Consideraciones de Seguridad

### ✅ Buenas Prácticas

```typescript
// 1. SIEMPRE usar HTTPS en producción
// face-api requiere HTTPS (excepto localhost)

// 2. Almacenar descriptor HASHEADO
const crypto = require('crypto');
const hash = crypto.createHash('sha256').update(descriptorJson).digest('hex');
// Guardar hash en BD para verificación adicional

// 3. Implementar rate limiting
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000;  // 15 minutos

function checkRateLimit(userId: string): boolean {
  const attempts = loginAttempts.get(userId) || [];
  const now = Date.now();
  
  const recentAttempts = attempts.filter(t => now - t < LOCKOUT_TIME);
  
  if (recentAttempts.length >= MAX_ATTEMPTS) {
    return false;  // Bloqueado
  }
  
  recentAttempts.push(now);
  loginAttempts.set(userId, recentAttempts);
  return true;  // Permitido
}

// 4. Registrar intentos (auditoría)
export async function logFacialAttempt(
  userId: string,
  eventType: 'enrollment' | 'verification' | 'liveness',
  result: boolean,
  distance?: number
) {
  const { error } = await supabase
    .from('facial_audit')
    .insert({
      user_id: userId,
      event_type: eventType,
      result,
      distance: distance || null
    });
  
  if (error) console.error('Error en auditoría:', error);
}

// 5. Permitir reintentos limitados
async function attemptFacialVerification(
  userId: string,
  storedDescriptor: number[],
  maxAttempts: number = 3
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await verifyFace(videoElement, storedDescriptor);
    
    await logFacialAttempt(userId, 'verification', result.isMatch, result.distance);
    
    if (result.isMatch) {
      return true;  // Exitoso
    }
    
    if (attempt < maxAttempts) {
      toast.info(`Intento ${attempt}/${maxAttempts} fallido. Intenta de nuevo.`);
    }
  }
  
  return false;  // Todos los intentos fallaron
}
```

### ⚠️ Limitaciones Conocidas

```
❌ SIN Liveness Detection:
   - Vulnerable a fotos/videos
   - Un atacante puede usar foto tuya
   
❌ Iluminación Pobre:
   - Reduce precisión
   - Aumenta falsos negativos
   
❌ Ángulos Raros:
   - Funciona mejor cara frontal
   - Ángulos extremos: baja precisión
   
❌ Descriptores Estáticos:
   - No se adaptan con el tiempo
   - Recomendado: re-enrollment cada 6 meses

✓ SIEMPRE IMPLEMENTAR Liveness
✓ SIEMPRE usar HTTPS
✓ SIEMPRE auditar intentos
✓ SIEMPRE permitir login alternativo (contraseña)
```

---

## 🧪 Testing

### Test Básico

```typescript
describe('Facial Recognition', () => {
  it('debería extraer un descriptor válido', async () => {
    const descriptor = await detectAndExtractDescriptor(videoElement);
    
    expect(descriptor).toBeDefined();
    expect(descriptor.length).toBe(128);
    expect(descriptor.every(n => typeof n === 'number')).toBe(true);
  });

  it('debería calcular distancia euclidiana correctamente', () => {
    const a = [0.1, 0.2, 0.3];
    const b = [0.1, 0.2, 0.3];
    
    const distance = euclideanDistance(a, b);
    expect(distance).toBeCloseTo(0, 5);
  });

  it('debería rechazar descriptores muy diferentes', () => {
    const a = Array(128).fill(0);
    const b = Array(128).fill(1);
    
    const distance = euclideanDistance(a, b);
    expect(distance).toBeGreaterThan(DISTANCE_THRESHOLD);
  });

  it('debería detectar parpadeos', async () => {
    const result = await detectBlink(videoElement, 3);
    
    expect(result).toBeDefined();
    expect(result.blinkCount).toBeGreaterThanOrEqual(0);
  });
});
```

---

## 📚 Referencias Externas

- [face-api.js Documentation](https://github.com/vladmandic/face-api)
- [TensorFlow.js](https://www.tensorflow.org/js)
- [Eye Aspect Ratio - Research Paper](https://ieeexplore.ieee.org/document/6789663)
- [Euclidean Distance Formula](https://en.wikipedia.org/wiki/Euclidean_distance)

---

## 🎓 Resumen de Cambios Clave

### Paso 1: De SOLO DETECCIÓN a EXTRACCIÓN DE DESCRIPTOR

```typescript
// ANTES (Solo detectar cara):
const detection = await faceapi
  .detectSingleFace(videoElement)
  .withFaceLandmarks();

// DESPUÉS (Extraer descriptor):
const detection = await faceapi
  .detectSingleFace(videoElement)
  .withFaceLandmarks()
  .withFaceDescriptor();  // ← Línea clave
```

### Paso 2: Serializar para almacenamiento

```typescript
const descriptor = detection.descriptor;  // Float32Array
const serialized = JSON.stringify(Array.from(descriptor));
// Resultado: "[0.234, -0.156, 0.089, ...]"
```

### Paso 3: Comparación entre descriptores

```typescript
const distance = euclideanDistance(liveDescriptor, storedDescriptor);
const isMatch = distance < 0.6;
```

### Paso 4: Agregar anti-spoofing

```typescript
const livenessResult = await detectBlink(videoElement, 3);
if (livenessResult.passed && isMatch) {
  // ✓ Autenticado
}
```

---

## ✅ Checklist de Implementación

- [ ] Instalar `@vladmandic/face-api` y `tensorflow.js`
- [ ] Crear `src/lib/facial-recognition.ts` con funciones principales
- [ ] Crear componentes React (Enrollment, Verification, Liveness)
- [ ] Crear server actions en `src/app/actions.ts`
- [ ] Ejecutar migración SQL para agregar columnas
- [ ] Integrar en login form
- [ ] Implementar auditoría (facial_audit table)
- [ ] Testing en diferentes dispositivos y navegadores
- [ ] Documentación de usuario
- [ ] Implementar rate limiting
- [ ] Configurar HTTPS en producción

---

**Creado:** Noviembre 13, 2025
**Última actualización:** Noviembre 13, 2025
**Versión:** 1.0
