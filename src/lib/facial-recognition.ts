/**
 * facial-recognition.ts
 * 
 * Utilidades para reconocimiento facial usando face-api.js y MediaPipe
 * Maneja enrolamiento, verificación y detección de vida
 */

import * as faceapi from '@vladmandic/face-api';
// MediaPipe Pose will be dynamically loaded at runtime in the browser

// Tipos para los descriptores faciales
export interface FacialDescriptor {
  descriptor: number[];
  timestamp: number;
}

export interface EnrollmentResult {
  success: boolean;
  descriptor?: FacialDescriptor;
  error?: string;
}

export interface VerificationResult {
  success: boolean;
  distance: number;
  isMatch: boolean;
  confidence: number; // 0-100, porcentaje de coincidencia
  error?: string;
}

export interface LivenessResult {
  success: boolean;
  passed: boolean;
  challenge: 'blink' | 'head-turn' | 'none';
  direction?: 'up' | 'down' | 'left' | 'right';
  fingerNumber?: number;
  blinkCount?: number;
  details?: string;
  error?: string;
}

// Configuración (exponible para ajuste dinámico)
let DISTANCE_THRESHOLD = 0.6; // Umbral de similitud (menor = más similar)
const MODEL_PATH = '/models/'; // Ruta a los modelos en public/
let DETECTION_OPTIONS = new faceapi.TinyFaceDetectorOptions({
  inputSize: 416,
  scoreThreshold: 0.5,
});

/**
 * Ajusta el umbral de distancia (por ejemplo 0.5). Útil para pruebas.
 */
export function setDistanceThreshold(t: number) {
  DISTANCE_THRESHOLD = Number(t) || DISTANCE_THRESHOLD;
}

/**
 * Ajusta las opciones del detector TinyFaceDetector (inputSize, scoreThreshold)
 * Ejemplo: setDetectionOptions({ inputSize: 512, scoreThreshold: 0.35 })
 */
export function setDetectionOptions(opts: { inputSize?: number; scoreThreshold?: number }) {
  const inputSize = opts.inputSize || (DETECTION_OPTIONS as any).inputSize || 416;
  const scoreThreshold = typeof opts.scoreThreshold === 'number' ? opts.scoreThreshold : (DETECTION_OPTIONS as any).scoreThreshold || 0.5;
  DETECTION_OPTIONS = new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold });
}

/**
 * UTILIDADES DE INICIALIZACIÓN
 */

/**
 * Carga los modelos necesarios de face-api
 * Debe ser llamada una sola vez al inicio de la aplicación
 */
export async function loadFaceAPIModels(): Promise<void> {
  try {
    console.log('[FaceAPI] Cargando modelos...');

    // Wait for TensorFlow backend to be ready
    await (faceapi.tf as any).ready();

    // Cargar los 3 modelos esenciales
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_PATH),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_PATH),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_PATH),
    ]);

    console.log('[FaceAPI] Modelos cargados exitosamente');
  } catch (error) {
    console.error('[FaceAPI] Error al cargar modelos:', error);
    throw new Error('No se pudieron cargar los modelos de reconocimiento facial');
  }
}

/**
 * Inicia la cámara web
 */
export async function startCamera(videoElement: HTMLVideoElement): Promise<MediaStream> {
  // Check if mediaDevices exists (requires HTTPS or localhost)
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Tu navegador no soporta acceso a cámara o no estás en un sitio seguro (HTTPS).');
  }

  try {
    // Try with ideal constraints first
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user',
      },
      audio: false,
    });

    videoElement.srcObject = stream;

    return new Promise((resolve) => {
      videoElement.onloadedmetadata = () => {
        videoElement.play().catch(e => console.error("Error playing video:", e));
        resolve(stream);
      };
    });
  } catch (error: any) {
    console.error('[FaceAPI] Error al acceder a la cámara:', error);

    // Handle specific error types
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      throw new Error('Permiso de cámara denegado. Por favor permite el acceso.');
    } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      throw new Error('No se encontró ninguna cámara.');
    } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      throw new Error('La cámara está en uso por otra aplicación.');
    } else if (error.name === 'OverconstrainedError') {
      // Fallback: try without constraints if specific resolution fails
      try {
        console.warn('[FaceAPI] Retrying without resolution constraints...');
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        videoElement.srcObject = stream;
        return new Promise((resolve) => {
          videoElement.onloadedmetadata = () => {
            videoElement.play().catch(e => console.error("Error playing video fallback:", e));
            resolve(stream);
          };
        });
      } catch (fallbackError) {
        throw new Error('No se pudo acceder a la cámara incluso sin restricciones.');
      }
    }

    throw new Error(`Error de cámara: ${error.message || 'Desconocido'}`);
  }
}

/**
 * Detiene la cámara
 */
export function stopCamera(stream: MediaStream | null): void {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }
}

/**
 * Dibuja un canvas con el video y las detecciones
 */
export function drawDetectionCanvas(
  videoElement: HTMLVideoElement,
  canvasElement: HTMLCanvasElement
): void {
  const displaySize = {
    width: videoElement.videoWidth,
    height: videoElement.videoHeight,
  };

  faceapi.matchDimensions(canvasElement, displaySize);
  const ctx = canvasElement.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  }
}

/**
 * FASE 1: ENROLAMIENTO (Registro del Descriptor Facial)
 */

/**
 * Detecta la cara en el video y extrae el descriptor facial
 * Retorna el vector de 128 números que identifica al usuario
 */
export async function detectAndExtractDescriptor(
  videoElement: HTMLVideoElement
): Promise<EnrollmentResult> {
  try {
    if (!videoElement.srcObject) {
      return {
        success: false,
        error: 'La cámara no está inicializada',
      };
    }

    // Detectar cara con landmarks y descriptor
    let detection = await faceapi
      .detectSingleFace(videoElement, DETECTION_OPTIONS)
      .withFaceLandmarks()
      .withFaceDescriptor();

    // Si no detectó con tiny, intentar con parámetros más tolerantes una o dos veces
    if (!detection) {
      try {
        // intentar con menor umbral si es posible
        const fallbackOpts = new faceapi.TinyFaceDetectorOptions({ inputSize: Math.max(320, (DETECTION_OPTIONS as any).inputSize || 416), scoreThreshold: 0.35 });
        detection = await faceapi
          .detectSingleFace(videoElement, fallbackOpts)
          .withFaceLandmarks()
          .withFaceDescriptor();
      } catch (e) {
        // ignore fallback errors
      }
    }

    if (!detection) {
      return {
        success: false,
        error: 'No se detectó ninguna cara. Asegúrate de estar frente a la cámara.',
      };
    }

    // Extraer el descriptor (array de 128 números)
    const descriptor = Array.from(detection.descriptor);

    const result: FacialDescriptor = {
      descriptor,
      timestamp: Date.now(),
    };

    console.log('[FaceAPI] Descriptor extraído:', descriptor.length, 'valores');

    return {
      success: true,
      descriptor: result,
    };
  } catch (error) {
    console.error('[FaceAPI] Error al extraer descriptor:', error);
    return {
      success: false,
      error: 'Error al procesar la imagen facial',
    };
  }
}

/**
 * Realiza múltiples capturas para mejorar el registro
 * (Captura 3-5 descriptores y calcula el promedio)
 */
export async function enrollMultipleSamples(
  videoElement: HTMLVideoElement,
  samples: number = 5,
  delayMs: number = 600
): Promise<EnrollmentResult> {
  try {
    const descriptors: number[][] = [];
    const maxAttempts = samples * 3; // permitir reintentos en caso de fallos temporales
    let attempts = 0;

    while (descriptors.length < samples && attempts < maxAttempts) {
      attempts++;
      // Esperar entre capturas (si no es la primera)
      if (attempts > 1) await new Promise((resolve) => setTimeout(resolve, delayMs));

      const result = await detectAndExtractDescriptor(videoElement);

      if (!result.success || !result.descriptor) {
        console.warn(`[FaceAPI] Intento ${attempts}: no se detectó cara. Mensaje: ${result.error || 'sin detalle'}`);
        continue; // reintentar
      }

      descriptors.push(result.descriptor.descriptor);
      console.log(`[FaceAPI] Muestra válida ${descriptors.length}/${samples} capturada (intent ${attempts})`);
    }

    if (descriptors.length === 0) {
      return { success: false, error: 'No se pudieron capturar muestras faciales. Revisa la iluminación y posición.' };
    }

    // Si no alcanzamos el número de muestras, pero tenemos al menos 3, continuar con lo obtenido
    if (descriptors.length < samples) {
      console.warn(`[FaceAPI] Se completó con menos muestras de las solicitadas: ${descriptors.length}/${samples}`);
    }

    // Promediar los descriptores para mayor precisión
    const averagedDescriptor = averageDescriptors(descriptors);

    return {
      success: true,
      descriptor: {
        descriptor: averagedDescriptor,
        timestamp: Date.now(),
      },
    };
  } catch (error) {
    console.error('[FaceAPI] Error al registrar múltiples muestras:', error);
    return {
      success: false,
      error: 'Error al registrar las muestras faciales',
    };
  }
}

/**
 * Promedia múltiples descriptores
 */
function averageDescriptors(descriptors: number[][]): number[] {
  if (descriptors.length === 0) return [];

  const size = descriptors[0].length;
  const average: number[] = new Array(size).fill(0);

  for (const descriptor of descriptors) {
    for (let i = 0; i < size; i++) {
      average[i] += descriptor[i];
    }
  }

  return average.map((val) => val / descriptors.length);
}

/**
 * FASE 2: VERIFICACIÓN (Login Facial)
 */

/**
 * Compara dos descriptores faciales
 * Utiliza distancia euclidiana
 */
export function compareDescriptors(
  liveDescriptor: number[],
  storedDescriptor: number[]
): { distance: number; isMatch: boolean } {
  // Distancia euclidiana entre dos vectores
  const distance = euclideanDistance(liveDescriptor, storedDescriptor);
  const isMatch = distance < DISTANCE_THRESHOLD;

  return { distance, isMatch };
}

/**
 * Juego de liveness: realiza varios escaneos rápidos (captura descriptor) y
 * compara con el descriptor almacenado. Útil cuando no se quiere usar
 * parpadeos: hace N scans y requiere que al menos `requiredMatches` coincidan.
 */
export async function performLivenessScans(
  videoElement: HTMLVideoElement,
  storedDescriptor: number[],
  scans: number = 3,
  delayMs: number = 600,
  requiredMatches: number = 2
): Promise<{ success: boolean; attempts: Array<{ distance: number; isMatch: boolean }>; details?: string }> {
  const attempts: Array<{ distance: number; isMatch: boolean }> = [];

  for (let i = 0; i < scans; i++) {
    // esperar un poco entre escaneos
    if (i > 0) await new Promise((r) => setTimeout(r, delayMs));

    const res = await detectAndExtractDescriptor(videoElement);
    if (!res.success || !res.descriptor) {
      // marcar como no coincidencia con distancia alta
      attempts.push({ distance: 1, isMatch: false });
      continue;
    }

    const { distance, isMatch } = compareDescriptors(res.descriptor.descriptor, storedDescriptor);
    attempts.push({ distance, isMatch });
  }

  const matches = attempts.filter(a => a.isMatch).length;
  const success = matches >= requiredMatches;

  return {
    success,
    attempts,
    details: `Matches: ${matches}/${scans} (required ${requiredMatches})`
  };
}

/**
 * Calcula la distancia euclidiana entre dos vectores
 * (También disponible en face-api.euclideanDistance)
 */
function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Los vectores deben tener la misma longitud');
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Verifica una cara en vivo contra un descriptor almacenado
 */
export async function verifyFace(
  videoElement: HTMLVideoElement,
  storedDescriptor: number[]
): Promise<VerificationResult> {
  try {
    const liveResult = await detectAndExtractDescriptor(videoElement);

    if (!liveResult.success || !liveResult.descriptor) {
      return {
        success: false,
        distance: 1,
        isMatch: false,
        confidence: 0,
        error: liveResult.error,
      };
    }

    const { distance, isMatch } = compareDescriptors(
      liveResult.descriptor.descriptor,
      storedDescriptor
    );

    // Calcular confianza (0-100%)
    // Distancia 0 = 100% confianza, Distancia 1 = 0% confianza
    const confidence = Math.max(0, (1 - distance) * 100);

    return {
      success: true,
      distance,
      isMatch,
      confidence: Math.round(confidence),
    };
  } catch (error) {
    console.error('[FaceAPI] Error al verificar cara:', error);
    return {
      success: false,
      distance: 1,
      isMatch: false,
      confidence: 0,
      error: 'Error al verificar la cara',
    };
  }
}

/**
 * FASE 3: DETECCIÓN DE VIDA (Liveness Detection)
 */

/**
 * Obtiene el desafío de movimiento del día
 * Usa la fecha actual como seed para generar un desafío consistente durante todo el día
 * Posibles desafíos: 'up', 'down', 'left', 'right'
 */
export function getDailyMovementChallenge(): 'up' | 'down' | 'left' | 'right' {
  const today = new Date();
  const dayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Usar la fecha como seed para determinar el desafío
  const hash = dayString.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const challenges: Array<'up' | 'down' | 'left' | 'right'> = ['up', 'down', 'left', 'right'];
  const index = hash % challenges.length;

  return challenges[index];
}

/**
 * Obtiene el desafío de número con los dedos para el día (1-5)
 * Usa la fecha actual como seed para generar un número consistente durante todo el día
 */
export function getDailyHandNumberChallenge(): number {
  const today = new Date();
  const dayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const hash = dayString.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  // números del 1 al 5
  return (hash % 5) + 1;
}

/**
 * Detecta parpadeos del usuario
 * Análisis robusto con tolerancia para cámaras de baja calidad
 */
export async function detectBlink(
  videoElement: HTMLVideoElement,
  durationSeconds: number = 5
): Promise<LivenessResult> {
  try {
    const endTime = Date.now() + durationSeconds * 1000;
    let blinkCount = 0;
    let eyeClosureFrames = 0;
    let wasClosed = false;
    const requiredFramesForBlink = 1; // Muy tolerante - solo 1 frame de cierre
    const sampleDelayMs = 100; // 100ms entre muestras
    const earThreshold = 0.20; // Umbral bajo para detectar cualquier parpadeo

    while (Date.now() < endTime) {
      const detection = await faceapi
        .detectSingleFace(videoElement, DETECTION_OPTIONS)
        .withFaceLandmarks();

      if (!detection) {
        // Permitir algunos frames sin detección
        continue;
      }

      // Calcular EAR (Eye Aspect Ratio)
      const leftEye = detection.landmarks.getLeftEye();
      const rightEye = detection.landmarks.getRightEye();

      const leftEAR = calculateEyeAspectRatio(leftEye);
      const rightEAR = calculateEyeAspectRatio(rightEye);
      const avgEAR = (leftEAR + rightEAR) / 2;

      console.log(`[Blink Detection] EAR: ${avgEAR.toFixed(3)}, Closed: ${avgEAR < earThreshold}`);

      if (avgEAR < earThreshold) {
        // Ojo cerrado
        eyeClosureFrames++;
        wasClosed = true;
      } else {
        // Ojo abierto
        if (wasClosed && eyeClosureFrames >= requiredFramesForBlink) {
          blinkCount++;
          console.log(`[Blink Detection] ✓ Parpadeo detectado #${blinkCount}`);
        }
        eyeClosureFrames = 0;
        wasClosed = false;
      }

      await new Promise((resolve) => setTimeout(resolve, sampleDelayMs));
    }

    // Requiere al menos 2 parpadeos (tolerante pero no demasiado)
    const passed = blinkCount >= 2;

    console.log(`[Blink Detection] Total blinks: ${blinkCount}, Passed: ${passed}`);

    return {
      success: true,
      passed,
      challenge: 'blink',
      blinkCount,
      details: `Se detectaron ${blinkCount} parpadeos. Se requieren 2 como mínimo.`,
    };
  } catch (error) {
    console.error('[Blink Detection] Error:', error);
    return {
      success: false,
      passed: false,
      challenge: 'blink',
      blinkCount: 0,
      error: 'Error al detectar parpadeos',
    };
  }
}

/**
 * Detecta presencia de cara en múltiples escaneos rápidos.
 * Útil como alternativa a la prueba de parpadeos: verifica que la cara
 * sea detectada varias veces seguidas (usuario presente y estable).
 */
export async function detectFaceScans(
  videoElement: HTMLVideoElement,
  scans: number = 3,
  delayMs: number = 600,
  requiredDetections: number = 2
): Promise<LivenessResult> {
  if (typeof window === 'undefined') {
    return {
      success: false,
      passed: false,
      challenge: 'none',
      error: 'Liveness detection is client-side only',
    };
  }

  try {
    let detections = 0;
    const detailsArr: string[] = [];

    for (let i = 0; i < scans; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, delayMs));

      const det = await faceapi.detectSingleFace(videoElement, DETECTION_OPTIONS).withFaceLandmarks();
      const ok = !!det;
      detailsArr.push(ok ? 'detected' : 'no-detect');
      if (ok) detections++;
    }

    const passed = detections >= requiredDetections;

    return {
      success: true,
      passed,
      challenge: 'none',
      blinkCount: detections,
      details: `Detections: ${detections}/${scans}. Sequence: ${detailsArr.join(',')}`,
    };
  } catch (error) {
    console.error('[FaceScan] Error during face scans:', error);
    return {
      success: false,
      passed: false,
      challenge: 'none',
      error: 'Error during face scans',
    };
  }
}

/**
 * Detecta un número mostrado con los dedos usando MediaPipe Hands
 * Retorna si el número requerido fue mostrado durante la ventana de tiempo
 */
export async function detectHandNumber(
  videoElement: HTMLVideoElement,
  requiredNumber: number,
  durationSeconds: number = 5
): Promise<LivenessResult> {
  if (typeof window === 'undefined') {
    return {
      success: false,
      passed: false,
      challenge: 'none',
      fingerNumber: 0,
      error: 'Liveness detection is client-side only',
    };
  }

  try {
    // dynamic import of MediaPipe Hands or load from CDN
    let HandsClass: any = undefined;
    try {
      // Intentar cargar del npm, pero probablemente no exista (es ok)
      // eslint-disable-next-line global-require, import/no-extraneous-dependencies
      const mh = require('@mediapipe/hands');
      HandsClass = (mh as any).Hands || (mh as any).default || undefined;
    } catch (e) {
      // fallback to CDN
    }

    if (!HandsClass) {
      if (!(window as any).Hands) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js';
          s.onload = () => resolve();
          s.onerror = () => reject(new Error('Failed to load MediaPipe hands from CDN'));
          document.head.appendChild(s);
        });
      }
      HandsClass = (window as any).Hands;
    }

    if (!HandsClass) {
      return {
        success: false,
        passed: false,
        challenge: 'none',
        fingerNumber: 0,
        error: 'MediaPipe Hands is not available',
      };
    }

    const hands = new HandsClass({ locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
    (hands as any).setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    const detections: Array<number> = [];
    let endTime = Date.now() + durationSeconds * 1000;

    (hands as any).onResults((results: any) => {
      if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
        detections.push(0);
        return;
      }

      const landmarks = results.multiHandLandmarks[0];
      const count = countFingersFromLandmarks(landmarks, results.multiHandedness);
      detections.push(count);
      console.log(`[MediaPipe Hands] Frame detected: ${count} fingers`);
    });

    // manual frame loop - more frequent sampling for better detection
    const frameDelay = 50; // ms - increased sampling frequency
    while (Date.now() < endTime) {
      try {
        await (hands as any).send({ image: videoElement });
      } catch (e) {
        // ignore frame errors
      }
      await new Promise((r) => setTimeout(r, frameDelay));
    }

    try { (hands as any).close(); } catch (e) { /* ignore */ }

    // Determine the most frequently seen number in detections
    const freq: Record<number, number> = {};
    detections.forEach((n) => { freq[n] = (freq[n] || 0) + 1; });
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    const most = sorted.length > 0 ? Number(sorted[0][0]) : 0;

    // Allow ±1 tolerance for finger detection (e.g., if we need 5 and detect 4-5, pass)
    const tolerance = 1;
    const passed = Math.abs(most - requiredNumber) <= tolerance;

    console.log(`[Hand Detection] Detected: ${most}, Required: ${requiredNumber}, Passed: ${passed}, Frequency: ${JSON.stringify(freq)}`);

    return {
      success: true,
      passed,
      challenge: 'none',
      fingerNumber: most,
      details: `Número detectado: ${most}. Requerido: ${requiredNumber}. ${passed ? '✓ Aceptado' : '✗ No coincide'}`,
    };
  } catch (error) {
    console.error('[MediaPipe] Error detecting hand number:', error);
    return {
      success: false,
      passed: false,
      challenge: 'none',
      fingerNumber: 0,
      error: 'Error al detectar número con la mano',
    };
  }
}

/**
 * Contar dedos levantados a partir de landmarks (MediaPipe Hands 21 puntos)
 * Usa normalización basada en tamaño de la mano para mejor precisión
 */
function countFingersFromLandmarks(landmarks: any[], handednessInfo: any): number {
  if (!landmarks || landmarks.length < 21) return 0;

  // Punto de referencia: wrist (punto 0)
  const wrist = landmarks[0];

  // indices of tips and pip joints
  const tips = [4, 8, 12, 16, 20];
  const pips = [2, 6, 10, 14, 18];
  const mcp = [5, 9, 13, 17, 21 - 1]; // metakarpal joints for better reference

  // Calculate hand size as distance from wrist to middle finger tip
  const handSize = Math.sqrt(
    Math.pow(landmarks[12].x - wrist.x, 2) +
    Math.pow(landmarks[12].y - wrist.y, 2)
  );

  if (handSize < 0.01) return 0; // Hand too small or invalid

  // Normalize threshold based on hand size
  const threshold = handSize * 0.15; // 15% of hand size

  let count = 0;
  const isRightHand = handednessInfo && handednessInfo[0] && handednessInfo[0].label === 'Right';

  for (let i = 0; i < 5; i++) {
    const tip = landmarks[tips[i]];
    const pip = landmarks[pips[i]];

    if (!tip || !pip) continue;

    if (i === 0) {
      // Thumb: special handling based on handedness
      // Check if tip is further from wrist than pip
      const tipDist = Math.sqrt(Math.pow(tip.x - wrist.x, 2) + Math.pow(tip.y - wrist.y, 2));
      const pipDist = Math.sqrt(Math.pow(pip.x - wrist.x, 2) + Math.pow(pip.y - wrist.y, 2));

      // Thumb is extended if tip is further from wrist
      if (tipDist > pipDist + threshold * 0.5) {
        count++;
      }
    } else {
      // Other fingers: tip should be above pip (smaller y value, since y increases downward)
      // Also use vertical distance from wrist as reference
      const tipDist = Math.sqrt(Math.pow(tip.x - wrist.x, 2) + Math.pow(tip.y - wrist.y, 2));
      const pipDist = Math.sqrt(Math.pow(pip.x - wrist.x, 2) + Math.pow(pip.y - wrist.y, 2));

      // Finger is up if tip is further from wrist AND tip.y < pip.y
      if (tipDist > pipDist && tip.y < pip.y - threshold * 0.3) {
        count++;
      }
    }
  }

  return count;
}

/**
 * Calcula el "Eye Aspect Ratio" (EAR)
 * Usado para detectar parpadeos
 */
export function calculateEyeAspectRatio(eye: faceapi.Point[]): number {
  if (eye.length < 6) return 1;

  // Distancia euclidiana entre puntos
  const distance = (p1: faceapi.Point, p2: faceapi.Point) => {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  };

  // EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)
  const a = distance(eye[1], eye[5]);
  const b = distance(eye[2], eye[4]);
  const c = distance(eye[0], eye[3]);

  return (a + b) / (2 * c);
}

/**
 * Detecta movimiento de cabeza usando MediaPipe Pose (mucho más robusto)
 * Requiere que el usuario gire la cabeza hacia la dirección indicada
 */
export async function detectHeadTurn(
  videoElement: HTMLVideoElement,
  direction: 'up' | 'down' | 'left' | 'right',
  durationSeconds: number = 5
): Promise<LivenessResult> {
  // This function must run in the browser (client). If called on server, return an error.
  if (typeof window === 'undefined') {
    return {
      success: false,
      passed: false,
      challenge: 'head-turn',
      direction,
      error: 'Liveness detection is client-side only',
    };
  }

  try {
    // Try to dynamically import MediaPipe Pose; if not available, load from CDN
    let PoseClass: any = undefined;
    try {
      const mp = await import('@mediapipe/pose');
      PoseClass = (mp as any).Pose || (mp as any).default || undefined;
    } catch (e) {
      // ignore, fallback to CDN
    }

    if (!PoseClass) {
      if (!(window as any).Pose) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js';
          s.onload = () => resolve();
          s.onerror = () => reject(new Error('Failed to load MediaPipe pose from CDN'));
          document.head.appendChild(s);
        });
      }
      PoseClass = (window as any).Pose;
    }

    if (!PoseClass) {
      return {
        success: false,
        passed: false,
        challenge: 'head-turn',
        direction,
        error: 'MediaPipe Pose is not available',
      };
    }

    const pose = new PoseClass({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });

    const headRotations: Array<{ x: number; y: number; z: number }> = [];
    let detectionFailed = false;
    const endTime = Date.now() + durationSeconds * 1000;

    pose.onResults((results: any) => {
      if (!results.poseLandmarks || results.poseLandmarks.length === 0) {
        detectionFailed = true;
        return;
      }

      const nose = results.poseLandmarks[0];
      const leftEye = results.poseLandmarks[2];
      const rightEye = results.poseLandmarks[5];
      const leftEar = results.poseLandmarks[3];
      const rightEar = results.poseLandmarks[4];

      if (nose.visibility < 0.5 || leftEye.visibility < 0.5 || rightEye.visibility < 0.5) {
        detectionFailed = true;
        return;
      }

      const headRotation = calculateHeadRotationMediaPipe(nose, leftEye, rightEye, leftEar, rightEar);
      headRotations.push(headRotation);
    });

    const frameDelay = 100; // ms
    while (Date.now() < endTime) {
      try {
        // send current video frame to MediaPipe
        // eslint-disable-next-line @typescript-eslint/await-thenable
        await (pose as any).send({ image: videoElement });
      } catch (err) {
        detectionFailed = true;
        break;
      }
      await new Promise((r) => setTimeout(r, frameDelay));
    }

    try {
      pose.close();
    } catch (e) {
      /* ignore */
    }

    if (detectionFailed || headRotations.length === 0) {
      return {
        success: false,
        passed: false,
        challenge: 'head-turn',
        direction,
        error: 'No se pudo detectar el movimiento de cabeza',
      };
    }

    return analyzeHeadMovement(headRotations, direction);
  } catch (error) {
    console.error('[MediaPipe] Error en detección de movimiento:', error);
    return {
      success: false,
      passed: false,
      challenge: 'head-turn',
      direction,
      error: 'Error al detectar movimiento de cabeza',
    };
  }
}

/**
 * Calcula la rotación de la cabeza en 3 ejes usando MediaPipe landmarks
 * Retorna ángulos en grados para X (arriba/abajo), Y (izq/der), Z (inclinación)
 */
function calculateHeadRotationMediaPipe(
  nose: any,
  leftEye: any,
  rightEye: any,
  leftEar: any,
  rightEar: any
): { x: number; y: number; z: number } {
  // Eje Y (horizontal - izquierda/derecha)
  const yawAngle = Math.atan2(nose.x - (leftEye.x + rightEye.x) / 2, nose.z - (leftEye.z + rightEye.z) / 2) * (180 / Math.PI);

  // Eje X (vertical - arriba/abajo)
  const pitchAngle = Math.atan2((leftEye.y + rightEye.y) / 2 - nose.y, (leftEye.z + rightEye.z) / 2 - nose.z) * (180 / Math.PI);

  // Eje Z (inclinación)
  const rollAngle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * (180 / Math.PI);

  return {
    x: pitchAngle,  // Arriba/Abajo
    y: yawAngle,    // Izquierda/Derecha
    z: rollAngle,   // Inclinación
  };
}

/**
 * Analiza el movimiento de cabeza para determinar si se completó el desafío
 */
function analyzeHeadMovement(
  headRotations: Array<{ x: number; y: number; z: number }>,
  direction: 'up' | 'down' | 'left' | 'right'
): LivenessResult {
  const xValues = headRotations.map((r) => r.x);
  const yValues = headRotations.map((r) => r.y);

  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);

  const xRange = xMax - xMin;
  const yRange = yMax - yMin;

  let passed = false;
  let description = '';

  if (direction === 'up') {
    passed = xMin < -15; // Debe mirar hacia arriba (valores negativos)
    description = `Movimiento vertical: ${xRange.toFixed(1)}°. Ángulo mínimo alcanzado: ${xMin.toFixed(1)}°. Se requiere < -15°.`;
  } else if (direction === 'down') {
    passed = xMax > 15; // Debe mirar hacia abajo (valores positivos)
    description = `Movimiento vertical: ${xRange.toFixed(1)}°. Ángulo máximo alcanzado: ${xMax.toFixed(1)}°. Se requiere > 15°.`;
  } else if (direction === 'left') {
    passed = yMin < -15; // Debe girar hacia la izquierda (valores negativos)
    description = `Movimiento horizontal: ${yRange.toFixed(1)}°. Ángulo mínimo alcanzado: ${yMin.toFixed(1)}°. Se requiere < -15°.`;
  } else if (direction === 'right') {
    passed = yMax > 15; // Debe girar hacia la derecha (valores positivos)
    description = `Movimiento horizontal: ${yRange.toFixed(1)}°. Ángulo máximo alcanzado: ${yMax.toFixed(1)}°. Se requiere > 15°.`;
  }

  return {
    success: true,
    passed,
    challenge: 'head-turn',
    direction,
    details: description,
  };
}

/**
 * UTILIDADES DE SERIALIZACIÓN
 */

/**
 * Convierte un descriptor (Float32Array) a JSON para almacenamiento
 */
export function serializeDescriptor(descriptor: number[]): string {
  return JSON.stringify(descriptor);
}

/**
 * Deserializa un descriptor desde JSON
 */
export function deserializeDescriptor(json: string): number[] {
  return JSON.parse(json);
}

/**
 * UTILIDADES DE CANVAS
 */

/**
 * Dibuja las detecciones en un canvas
 */
export async function drawDetections(
  videoElement: HTMLVideoElement,
  canvasElement: HTMLCanvasElement
): Promise<void> {
  const displaySize = {
    width: videoElement.videoWidth,
    height: videoElement.videoHeight,
  };

  faceapi.matchDimensions(canvasElement, displaySize);
  const ctx = canvasElement.getContext('2d');

  if (!ctx) return;

  // Detectar y dibujar
  const detections = await faceapi
    .detectAllFaces(videoElement, DETECTION_OPTIONS)
    .withFaceLandmarks()
    .withFaceDescriptors();

  // Limpiar canvas
  ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  // Dibujar cajas de detección
  detections.forEach((detection) => {
    const box = detection.detection.box;
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.strokeRect(box.x, box.y, box.width, box.height);

    // Dibujar landmarks
    const landmarks = detection.landmarks;
    ctx.fillStyle = '#00ff00';
    landmarks.positions.forEach((point) => {
      ctx.fillRect(point.x - 2, point.y - 2, 4, 4);
    });
  });
}
