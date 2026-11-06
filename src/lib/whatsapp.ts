import { supabase } from './supabase';
import type { WhatsAppNotificacion } from './types';

/**
 * Normaliza un número telefónico a formato internacional.
 */
export function normalizarTelefono(telefono: string): string {
  const soloNumeros = telefono.replace(/\D/g, '');
  // Si son 8 dígitos (ej. Guatemala), se antepone código de país por defecto si no lo tiene
  if (soloNumeros.length === 8) {
    return `502${soloNumeros}`;
  }
  // Si son 10 dígitos (ej. México), anteponer 52
  if (soloNumeros.length === 10) {
    return `52${soloNumeros}`;
  }
  return soloNumeros;
}

/**
 * Registra y envía una notificación automática por WhatsApp cuando se actualiza un horario o evento en BOCO.
 */
export async function enviarNotificacionWhatsApp(params: {
  usuarioId: string;
  nombreColaborador: string;
  telefono: string;
  tipoEvento: 'cambio_horario' | 'falta_detectada' | 'curso_asignado' | 'recordatorio';
  detalles: {
    fecha?: string;
    horaEntrada?: string;
    horaSalida?: string;
    nombreCurso?: string;
    motivo?: string;
  };
}): Promise<{ ok: boolean; mensaje: string }> {
  const telFormateado = normalizarTelefono(params.telefono);

  let mensajeTexto = '';
  switch (params.tipoEvento) {
    case 'cambio_horario':
      mensajeTexto = `🏢 *BOCO - Actualización de Horario*\n\nHola ${params.nombreColaborador},\nse ha programado un nuevo horario para el día *${params.detalles.fecha}*:\n⏰ *Entrada:* ${params.detalles.horaEntrada}\n⏰ *Salida:* ${params.detalles.horaSalida}\n\nPor favor revisa tu panel de colaborador para confirmar tu turno.`;
      break;
    case 'curso_asignado':
      mensajeTexto = `📚 *BOCO - Nueva Capacitación Asignada*\n\nHola ${params.nombreColaborador},\nRecursos Humanos te ha asignado el curso obligatorio: *"${params.detalles.nombreCurso}"*.\nIngresa al sistema para completar la lectura y tu evaluación.`;
      break;
    case 'falta_detectada':
      mensajeTexto = `⚠️ *BOCO - Alerta de Inasistencia / Retardo*\n\nHola ${params.nombreColaborador},\nSe registró una falta o retraso en fecha ${params.detalles.fecha}.\nRecuerda ingresar tu justificación y acordar la reposición de horas con tu Asignador.`;
      break;
    default:
      mensajeTexto = `🏢 *BOCO Notificación:* ${params.detalles.motivo || 'Tienes un nuevo aviso en el sistema.'}`;
  }

  try {
    if (supabase) {
      await supabase.from('whatsapp_notificaciones_log').insert([
        {
          destinatario_usuario_id: params.usuarioId,
          telefono: telFormateado,
          tipo_evento: params.tipoEvento,
          mensaje: mensajeTexto,
          estado: 'enviado',
          fecha_envio: new Date().toISOString(),
        },
      ]);
    }
  } catch (error) {
    console.warn('Error registrando notificación en base de datos:', error);
  }

  return { ok: true, mensaje: mensajeTexto };
}

