import { GoogleGenerativeAI } from '@google/generative-ai';
import type { LMSPreguntaIA } from './types';

/**
 * Servicio de IA (Gemini) para generar evaluaciones automáticamente
 * a partir del material formativo cargado por Recursos Humanos de BOCO.
 */
export async function generarEvaluacionPorIA(
  contenidoCurso: string,
  tituloCurso: string,
  cantidadPreguntas: number = 4
): Promise<LMSPreguntaIA[]> {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

  if (apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

      const prompt = `
Eres un pedagogo experto en capacitación laboral para la empresa BOCO.
A partir del siguiente contenido formativo del curso "${tituloCurso}", genera un examen de evaluación con exactamente ${cantidadPreguntas} preguntas.

Reglas obligatorias:
1. Debes alternar entre preguntas de tipo "true_false" (Verdadero o Falso) y "multiple_choice" (Opción múltiple con 4 opciones).
2. La justificación de respuesta por parte del colaborador es OPCIONAL ("requiere_justificacion": false).
3. Incluye la explicación pedagógica fundamentada en el texto.
4. Devuelve ÚNICAMENTE un arreglo JSON válido (sin formato markdown ni texto adicional).

Formato de salida esperado:
[
  {
    "id": 1,
    "tipo": "true_false",
    "pregunta": "¿Texto de la pregunta...?",
    "opciones": ["Verdadero", "Falso"],
    "respuesta_correcta": "Verdadero",
    "explicacion_ia": "Razón fundamentada en el manual...",
    "requiere_justificacion": false
  },
  {
    "id": 2,
    "tipo": "multiple_choice",
    "pregunta": "¿Texto de la pregunta...?",
    "opciones": ["Opción A", "Opción B", "Opción C", "Opción D"],
    "respuesta_correcta": "Opción B",
    "explicacion_ia": "Explicación correcta...",
    "requiere_justificacion": false
  }
]

CONTENIDO FORMATIVO:
${contenidoCurso}
`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as LMSPreguntaIA[];
      }
    } catch (err) {
      console.warn('Fallo en la llamada a Gemini, recurriendo al generador estructurado:', err);
    }
  }

  // Generador estructurado de respaldo (fallback de alta fidelidad)
  return generarEvaluacionEstructuradaFallback(contenidoCurso, tituloCurso, cantidadPreguntas);
}

/**
 * Generador pedagógico de respaldo cuando la clave de IA no está disponible o falla la red.
 */
function generarEvaluacionEstructuradaFallback(
  contenido: string,
  titulo: string,
  cantidad: number
): LMSPreguntaIA[] {
  const oraciones = contenido
    .split(/[.\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25);

  const preguntas: LMSPreguntaIA[] = [];

  for (let i = 0; i < Math.min(cantidad, Math.max(oraciones.length, 2)); i++) {
    const oracion = oraciones[i] || `El protocolo de seguridad y estándares de calidad para ${titulo} debe cumplirse rigurosamente`;
    
    if (i % 2 === 0) {
      preguntas.push({
        id: i + 1,
        tipo: 'true_false',
        pregunta: `De acuerdo con el manual de "${titulo}": ¿Es correcta la siguiente directiva? "${oracion}".`,
        opciones: ['Verdadero', 'Falso'],
        respuesta_correcta: 'Verdadero',
        explicacion_ia: `Conforme a las normas operativas de BOCO, la directiva es obligatoria para garantizar la excelencia en el puesto.`,
        requiere_justificacion: false,
      });
    } else {
      preguntas.push({
        id: i + 1,
        tipo: 'multiple_choice',
        pregunta: `En relación a "${titulo}", ¿cuál es el procedimiento indicado ante: "${oracion.slice(0, 70)}..."?`,
        opciones: [
          'Aplicar de inmediato el estándar documentado por BOCO',
          'Omitir la instrucción si hay alta demanda de clientes',
          'Delegar la responsabilidad sin previo aviso',
          'Esperar al fin de turno para revisar la anomalía',
        ],
        respuesta_correcta: 'Aplicar de inmediato el estándar documentado por BOCO',
        explicacion_ia: 'Los lineamientos de BOCO priorizan la consistencia y seguridad del servicio en todo momento.',
        requiere_justificacion: false,
      });
    }
  }

  return preguntas;
}

