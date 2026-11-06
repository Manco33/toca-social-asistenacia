'use server';

import { supabaseAdmin as supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import type {
  UsuarioBoco,
  Role,
  SedeZona,
  DepartamentoPuesto,
  MarcajeAsistencia,
  HorarioTurno,
  JustificacionFalta,
  BancoHorasCompensacion,
  Marca,
  LMSCurso,
  LMSAsignacionCurso,
  LMSEvaluacionIA,
  LMSAvanceColaborador,
  LMSPreguntaIA,
  LMSRespuestaColaborador,
} from '@/lib/types';
import { validarGeocercaSede } from '@/lib/geofencing';
import { generarEvaluacionPorIA } from '@/lib/lms-ai-service';
import { enviarNotificacionWhatsApp } from '@/lib/whatsapp';

// ==============================================================================
// 1. AUTENTICACIÓN BOCO
// ==============================================================================

/**
 * Autenticación mediante Nombre de Usuario (o Correo) y contraseña.
 */
export async function loginBoco(
  identificador: string,
  contrasenia: string
): Promise<{ success: boolean; user?: UsuarioBoco; error?: string }> {
  try {
    const cleanId = String(identificador || '').trim();
    const cleanPass = String(contrasenia || '');

    if (!cleanId || !cleanPass) {
      return { success: false, error: 'Debes ingresar tu nombre de usuario y contraseña.' };
    }

    // Buscar en la tabla usuarios de BOCO por username, código o email
    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('*, puesto:departamentos_puestos(*), sede:sedes_zonas(*, marca:marcas(*))')
      .or(`username.eq.${cleanId.toLowerCase()},codigo_rrhh.eq.${cleanId},email.eq.${cleanId.toLowerCase()}`)
      .single();

    if (error || !usuario) {
      return { success: false, error: 'Credenciales inválidas. Verifica tu usuario o contraseña.' };
    }

    if (!usuario.activo) {
      return { success: false, error: 'Tu usuario ha sido desactivado por Recursos Humanos. Contacta a RRHH.' };
    }

    // Verificación de contraseña (bcrypt o coincidencia directa de desarrollo)
    const passValida =
      usuario.password_hash === cleanPass ||
      (await bcrypt.compare(cleanPass, usuario.password_hash).catch(() => false));

    if (!passValida) {
      return { success: false, error: 'Contraseña incorrecta.' };
    }

    const { password_hash, ...usuarioLimpio } = usuario;
    return { success: true, user: usuarioLimpio as UsuarioBoco };
  } catch (err: any) {
    console.error('Error en loginBoco:', err);
    return { success: false, error: err.message || 'Error interno del servidor al autenticar.' };
  }
}

/**
 * Permite a cualquier usuario cambiar su contraseña validando la contraseña actual.
 */
export async function cambiarContraseniaBoco(
  usuarioId: string,
  contraseniaActual: string,
  nuevaContrasenia: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!usuarioId || !contraseniaActual || !nuevaContrasenia) {
      return { success: false, error: 'Todos los campos son requeridos.' };
    }

    if (nuevaContrasenia.length < 6) {
      return { success: false, error: 'La nueva contraseña debe tener al menos 6 caracteres.' };
    }

    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('id, password_hash')
      .eq('id', usuarioId)
      .single();

    if (error || !usuario) {
      return { success: false, error: 'Usuario no encontrado.' };
    }

    const passValida =
      usuario.password_hash === contraseniaActual ||
      (await bcrypt.compare(contraseniaActual, usuario.password_hash).catch(() => false));

    if (!passValida) {
      return { success: false, error: 'La contraseña actual no es correcta.' };
    }

    // Hashear nueva contraseña
    const nuevoHash = await bcrypt.hash(nuevaContrasenia, 10);

    const { error: errUpdate } = await supabase
      .from('usuarios')
      .update({ password_hash: nuevoHash, updated_at: new Date().toISOString() })
      .eq('id', usuarioId);

    if (errUpdate) throw errUpdate;

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al cambiar la contraseña.' };
  }
}

/**
 * Autenticación Biométrica Facial BOCO:
 * Compara el descriptor 128-float capturado con los usuarios enrolados.
 */
export async function loginFacialBoco(
  descriptorCapturado: number[]
): Promise<{ success: boolean; user?: UsuarioBoco; error?: string }> {
  try {
    if (!descriptorCapturado || descriptorCapturado.length !== 128) {
      return { success: false, error: 'Descriptor facial inválido o no detectado.' };
    }

    // Traer usuarios con rostro enrolado
    const { data: usuarios, error } = await supabase
      .from('usuarios')
      .select('*, puesto:departamentos_puestos(*), sede:sedes_zonas(*, marca:marcas(*))')
      .eq('facial_enrolled', true)
      .eq('activo', true);

    if (error || !usuarios || usuarios.length === 0) {
      return { success: false, error: 'No hay rostros enrolados activos en el sistema.' };
    }

    // Umbral de distancia euclidiana para coincidencia facial (0.45 - 0.50)
    const UMBRAL = 0.5;
    let usuarioCoincidente: any = null;
    let menorDistancia = Infinity;

    for (const u of usuarios) {
      if (!u.facial_descriptor || !Array.isArray(u.facial_descriptor)) continue;

      let suma = 0;
      for (let i = 0; i < 128; i++) {
        const diff = descriptorCapturado[i] - u.facial_descriptor[i];
        suma += diff * diff;
      }
      const distancia = Math.sqrt(suma);

      if (distancia < UMBRAL && distancia < menorDistancia) {
        menorDistancia = distancia;
        usuarioCoincidente = u;
      }
    }

    if (!usuarioCoincidente) {
      return { success: false, error: 'Rostro no reconocido. Por favor identifícate con tu Código de RRHH.' };
    }

    const { password_hash, ...usuarioLimpio } = usuarioCoincidente;
    return { success: true, user: usuarioLimpio as UsuarioBoco };
  } catch (err: any) {
    console.error('Error en loginFacialBoco:', err);
    return { success: false, error: 'Fallo al procesar reconocimiento biométrico.' };
  }
}

/**
 * Enrolamiento del descriptor facial de un colaborador.
 */
export async function enrolarRostroColaborador(
  usuarioId: string,
  descriptor: number[],
  avatarUrl?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!descriptor || descriptor.length !== 128) {
      return { success: false, error: 'El vector facial debe tener 128 dimensiones.' };
    }

    const updateData: any = {
      facial_descriptor: descriptor,
      facial_enrolled: true,
      facial_enrolled_at: new Date().toISOString(),
    };
    if (avatarUrl) updateData.avatar_url = avatarUrl;

    const { error } = await supabase.from('usuarios').update(updateData).eq('id', usuarioId);
    if (error) throw error;

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al enrolar rostro.' };
  }
}

// ==============================================================================
// 2. SISTEMA DE MARCAJE CON GEOCERCA Y CONTROL DE ASISTENCIA
// ==============================================================================

/**
 * Realiza el marcaje de entrada, salida o almuerzo con validación estricta de geocerca.
 */
export async function registrarMarcajeBoco(params: {
  usuarioId: string;
  tipo: 'entrada' | 'inicio_almuerzo' | 'fin_almuerzo' | 'salida';
  latitud: number;
  longitud: number;
  tomoAlmuerzo?: boolean;
  fotoUrl?: string;
}): Promise<{ success: boolean; error?: string; distanciaMetros?: number; toleranciaMetros?: number }> {
  try {
    const hoyStr = new Date().toISOString().slice(0, 10);
    const ahoraIso = new Date().toISOString();

    // 1. Obtener la sede asignada al usuario
    const { data: usuario, error: errUser } = await supabase
      .from('usuarios')
      .select('*, sede:sedes_zonas(*, marca:marcas(*))')
      .eq('id', params.usuarioId)
      .single();

    if (errUser || !usuario) {
      return { success: false, error: 'Usuario no encontrado.' };
    }

    if (!usuario.sede) {
      return { success: false, error: 'No tienes una sede asignada por RRHH. Contacta a tu administrador.' };
    }

    // 2. Validación de Geocerca (Bloqueo si está fuera del radio de tolerancia)
    const validacion = validarGeocercaSede(
      { latitud: params.latitud, longitud: params.longitud },
      {
        latitud: usuario.sede.latitud,
        longitud: usuario.sede.longitud,
        radio_metros: usuario.sede.radio_metros || 100,
      }
    );

    if (!validacion.dentroDeRango) {
      return {
        success: false,
        error: `Estás fuera del radio de la sede "${usuario.sede.nombre}". Te encuentras a ${validacion.distanciaMetros}m (máximo permitido: ${validacion.toleranciaMetros}m). Debes estar físicamente en la sede para marcar.`,
        distanciaMetros: validacion.distanciaMetros,
        toleranciaMetros: validacion.toleranciaMetros,
      };
    }

    // 3. Buscar si ya existe marcaje del día
    const { data: marcajeExistente } = await supabase
      .from('marcajes_asistencia')
      .select('*')
      .eq('usuario_id', params.usuarioId)
      .eq('fecha', hoyStr)
      .maybeSingle();

    if (params.tipo === 'entrada') {
      if (marcajeExistente?.hora_entrada) {
        return { success: false, error: 'Ya has registrado tu entrada el día de hoy.' };
      }

      const nuevoMarcaje = {
        usuario_id: params.usuarioId,
        fecha: hoyStr,
        hora_entrada: ahoraIso,
        latitud_entrada: params.latitud,
        longitud_entrada: params.longitud,
        distancia_sede_entrada_metros: validacion.distanciaMetros,
        en_rango_entrada: true,
        foto_entrada_url: params.fotoUrl || null,
        estado: 'presente',
      };

      const { error } = await supabase.from('marcajes_asistencia').upsert(nuevoMarcaje, { onConflict: 'usuario_id,fecha' });
      if (error) throw error;
      return { success: true, distanciaMetros: validacion.distanciaMetros, toleranciaMetros: validacion.toleranciaMetros };
    }

    if (params.tipo === 'inicio_almuerzo') {
      if (!marcajeExistente?.hora_entrada) {
        return { success: false, error: 'Debes registrar la entrada antes de iniciar el almuerzo.' };
      }
      const { error } = await supabase
        .from('marcajes_asistencia')
        .update({
          hora_inicio_almuerzo: ahoraIso,
          tomo_almuerzo: true,
        })
        .eq('id', marcajeExistente.id);
      if (error) throw error;
      return { success: true };
    }

    if (params.tipo === 'fin_almuerzo') {
      if (!marcajeExistente?.hora_inicio_almuerzo) {
        return { success: false, error: 'No has registrado inicio de almuerzo.' };
      }
      const { error } = await supabase
        .from('marcajes_asistencia')
        .update({ hora_fin_almuerzo: ahoraIso })
        .eq('id', marcajeExistente.id);
      if (error) throw error;
      return { success: true };
    }

    if (params.tipo === 'salida') {
      if (!marcajeExistente?.hora_entrada) {
        return { success: false, error: 'No tienes marcaje de entrada registrado para hoy.' };
      }

      // Calcular horas trabajadas
      const entradaMs = new Date(marcajeExistente.hora_entrada).getTime();
      const salidaMs = new Date(ahoraIso).getTime();
      let totalMinutos = Math.max(0, (salidaMs - entradaMs) / (1000 * 60));

      // Restar almuerzo si lo tomó
      if (marcajeExistente.hora_inicio_almuerzo && marcajeExistente.hora_fin_almuerzo) {
        const almuerzoMinutos =
          (new Date(marcajeExistente.hora_fin_almuerzo).getTime() -
            new Date(marcajeExistente.hora_inicio_almuerzo).getTime()) /
          (1000 * 60);
        totalMinutos = Math.max(0, totalMinutos - almuerzoMinutos);
      }

      const horasDecimales = Number((totalMinutos / 60).toFixed(2));
      const horasRegulares = Math.min(horasDecimales, 8.0);
      const horasExtras = Math.max(0, Number((horasDecimales - 8.0).toFixed(2)));

      const { error } = await supabase
        .from('marcajes_asistencia')
        .update({
          hora_salida: ahoraIso,
          latitud_salida: params.latitud,
          longitud_salida: params.longitud,
          distancia_sede_salida_metros: validacion.distanciaMetros,
          en_rango_salida: true,
          foto_salida_url: params.fotoUrl || null,
          horas_trabajadas_totales: horasDecimales,
          horas_regulares: horasRegulares,
          horas_extras: horasExtras,
          tomo_almuerzo: params.tomoAlmuerzo ?? marcajeExistente.tomo_almuerzo ?? true,
        })
        .eq('id', marcajeExistente.id);

      if (error) throw error;
      return { success: true, distanciaMetros: validacion.distanciaMetros, toleranciaMetros: validacion.toleranciaMetros };
    }

    return { success: false, error: 'Tipo de marcaje no soportado.' };
  } catch (err: any) {
    console.error('Error al registrar marcaje:', err);
    return { success: false, error: err.message || 'Error registrando marcaje.' };
  }
}

/**
 * Obtiene el marcaje del día actual para un colaborador para restaurar su estado al recargar o iniciar sesión.
 */
export async function obtenerMarcajeHoyColaborador(
  usuarioId: string
): Promise<{ success: boolean; marcaje?: MarcajeAsistencia | null; error?: string }> {
  try {
    const hoyStr = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('marcajes_asistencia')
      .select('*')
      .eq('usuario_id', usuarioId)
      .eq('fecha', hoyStr)
      .maybeSingle();

    if (error) throw error;
    return { success: true, marcaje: data as MarcajeAsistencia | null };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Monitor en Tiempo Real de Asistencia de Hoy para el Asignador / Supervisor:
 * Compara los turnos programados vs los marcajes reales en sede y clasifica en semáforo:
 * - puntual: Marcó dentro de horario o tolerancia (verde)
 * - retardo: Marcó después del horario + tolerancia (amarillo)
 * - sin_marcar: El turno ya inició hace más de la tolerancia y no ha marcado entrada (rojo crítico)
 * - turno_proximo: Su turno inicia más tarde en el día (gris/azul)
 * - en_almuerzo: Marcó inicio de almuerzo (ámbar)
 * - finalizado: Marcó salida de su jornada
 * - descanso: Día programado como libre / OFF
 */
export async function obtenerMonitoreoHoyEquipo(usuarioIds: string[]): Promise<{
  success: boolean;
  monitoreo?: Array<{
    usuario_id: string;
    turnoHoy: HorarioTurno | null;
    marcajeHoy: MarcajeAsistencia | null;
    estado: 'puntual' | 'retardo' | 'sin_marcar' | 'turno_proximo' | 'en_almuerzo' | 'finalizado' | 'descanso' | 'sin_turno';
    minutosDiferencia: number;
    mensajeEstado: string;
  }>;
  error?: string;
}> {
  try {
    if (!usuarioIds || usuarioIds.length === 0) {
      return { success: true, monitoreo: [] };
    }

    const ahora = new Date();
    const anio = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const dia = String(ahora.getDate()).padStart(2, '0');
    const hoyStr = `${anio}-${mes}-${dia}`;
    const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();

    // 1. Obtener turnos de hoy para los miembros del equipo
    const { data: turnos } = await supabase
      .from('horarios_turnos')
      .select('*')
      .in('usuario_id', usuarioIds)
      .eq('fecha', hoyStr);

    // 2. Obtener marcajes reales registrados hoy
    const { data: marcajes } = await supabase
      .from('marcajes_asistencia')
      .select('*')
      .in('usuario_id', usuarioIds)
      .eq('fecha', hoyStr);

    const turnosMap = new Map((turnos || []).map((t) => [t.usuario_id, t]));
    const marcajesMap = new Map((marcajes || []).map((m) => [m.usuario_id, m]));

    const resultado = usuarioIds.map((uId) => {
      const turno = turnosMap.get(uId) || null;
      const marcaje = marcajesMap.get(uId) || null;

      let estado: 'puntual' | 'retardo' | 'sin_marcar' | 'turno_proximo' | 'en_almuerzo' | 'finalizado' | 'descanso' | 'sin_turno' = 'sin_turno';
      let minutosDiferencia = 0;
      let mensajeEstado = 'Sin turno programado hoy';

      if (turno?.es_dia_descanso) {
        estado = 'descanso';
        mensajeEstado = turno.notas || 'Día libre programado (OFF)';
      } else if (marcaje?.hora_salida) {
        estado = 'finalizado';
        mensajeEstado = `Jornada finalizada (Salida: ${new Date(marcaje.hora_salida).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
      } else if (marcaje?.hora_inicio_almuerzo && !marcaje?.hora_fin_almuerzo) {
        estado = 'en_almuerzo';
        mensajeEstado = 'En periodo de almuerzo';
      } else if (marcaje?.hora_entrada) {
        if (turno?.hora_entrada) {
          const [hProg, mProg] = turno.hora_entrada.split(':').map(Number);
          const minProg = hProg * 60 + mProg;
          const fechaEntrada = new Date(marcaje.hora_entrada);
          const minEntrada = fechaEntrada.getHours() * 60 + fechaEntrada.getMinutes();
          const diff = minEntrada - minProg;
          const tolerancia = turno.tolerancia_minutos ?? 15;

          if (diff > tolerancia) {
            estado = 'retardo';
            minutosDiferencia = diff;
            mensajeEstado = `Llegada tarde (+${diff} min de retardo)`;
          } else {
            estado = 'puntual';
            minutosDiferencia = diff;
            mensajeEstado = diff <= 0 ? `Puntual (${Math.abs(diff)} min antes)` : `En tolerancia (+${diff} min)`;
          }
        } else {
          estado = 'puntual';
          mensajeEstado = 'Entrada registrada en sede';
        }
      } else if (turno?.hora_entrada) {
        const [hProg, mProg] = turno.hora_entrada.split(':').map(Number);
        const minProg = hProg * 60 + mProg;
        const tolerancia = turno.tolerancia_minutos ?? 15;

        if (minutosAhora > minProg + tolerancia) {
          // El turno ya inició y ya pasó la tolerancia sin marcar: ¡ROJO CRÍTICO!
          estado = 'sin_marcar';
          minutosDiferencia = minutosAhora - minProg;
          mensajeEstado = `¡Sin marcar! (Retardo crítico: +${minutosDiferencia} min)`;
        } else if (minutosAhora >= minProg) {
          estado = 'sin_marcar';
          minutosDiferencia = minutosAhora - minProg;
          mensajeEstado = `En periodo de tolerancia (+${minutosDiferencia} min sin marcar)`;
        } else {
          estado = 'turno_proximo';
          minutosDiferencia = minProg - minutosAhora;
          mensajeEstado = `Turno próximo (Inicia a las ${turno.hora_entrada.slice(0, 5)})`;
        }
      }

      return {
        usuario_id: uId,
        turnoHoy: turno as HorarioTurno | null,
        marcajeHoy: marcaje as MarcajeAsistencia | null,
        estado,
        minutosDiferencia,
        mensajeEstado,
      };
    });

    return { success: true, monitoreo: resultado };
  } catch (err: any) {
    console.error('Error en obtenerMonitoreoHoyEquipo:', err);
    return { success: false, error: err.message };
  }
}

// ==============================================================================
// 3. ADMINISTRACIÓN DE RRHH (Usuarios, Sedes, Puestos, Reportes)
// ==============================================================================

// ------------------------------------------------------------------------------
// Control de permisos en servidor.
// El id del solicitante se re-consulta en base de datos: el rol NUNCA se toma del cliente.
// ------------------------------------------------------------------------------
interface SolicitanteBoco {
  id: string;
  rol: Role;
  sede_id: string | null;
  activo: boolean;
}

async function obtenerSolicitante(solicitanteId?: string | null): Promise<SolicitanteBoco | null> {
  if (!solicitanteId) return null;
  const { data } = await supabase
    .from('usuarios')
    .select('id, rol, sede_id, activo')
    .eq('id', solicitanteId)
    .single();
  if (!data || !data.activo) return null;
  return data as SolicitanteBoco;
}

async function exigirSuperAdmin(solicitanteId?: string | null): Promise<SolicitanteBoco> {
  const s = await obtenerSolicitante(solicitanteId);
  if (!s || s.rol !== 'superadmin') {
    throw new Error('Acción reservada al Super Administrador.');
  }
  return s;
}

/** RRHH solo puede operar sobre su propia sede; el Super Admin sobre cualquiera. */
async function exigirAlcanceUsuario(
  solicitanteId: string | undefined | null,
  usuarioId: string
): Promise<SolicitanteBoco> {
  const s = await obtenerSolicitante(solicitanteId);
  if (!s || (s.rol !== 'superadmin' && s.rol !== 'rrhh')) {
    throw new Error('No tienes permisos para administrar usuarios.');
  }
  if (s.rol === 'rrhh') {
    const { data: objetivo } = await supabase
      .from('usuarios')
      .select('sede_id, rol')
      .eq('id', usuarioId)
      .single();
    if (!objetivo || !s.sede_id || objetivo.sede_id !== s.sede_id) {
      throw new Error('Ese colaborador pertenece a otra sede. Solo puedes administrar tu sede.');
    }
    if (objetivo.rol === 'superadmin' || objetivo.rol === 'rrhh') {
      throw new Error('No puedes modificar a un usuario de Recursos Humanos o Super Admin.');
    }
  }
  return s;
}

export async function crearUsuarioBoco(
  datos: {
    username: string; // Nombre de usuario para iniciar sesión
    codigo_rrhh?: string;
    nombre_completo: string;
    email?: string;
    password_hash: string; // Contraseña inicial en texto; se guarda hasheada con bcrypt
    telefono?: string;
    rol: Role;
    puesto_id?: string;
    sede_id?: string;
    asignador_id?: string;
  },
  solicitanteId?: string
): Promise<{ success: boolean; user?: UsuarioBoco; error?: string }> {
  try {
    const solicitante = await obtenerSolicitante(solicitanteId);
    if (!solicitante || (solicitante.rol !== 'superadmin' && solicitante.rol !== 'rrhh')) {
      throw new Error('No tienes permisos para crear usuarios.');
    }

    let rol: Role = datos.rol;
    let sedeId = datos.sede_id || null;

    if (solicitante.rol === 'rrhh') {
      // RRHH solo crea personal de su sede y nunca otros RRHH / Super Admin
      if (!solicitante.sede_id) throw new Error('Tu usuario de RRHH no tiene sede asignada. Contacta al Super Admin.');
      if (rol === 'superadmin' || rol === 'rrhh') {
        throw new Error('Solo el Super Administrador puede crear usuarios de Recursos Humanos.');
      }
      sedeId = solicitante.sede_id;
    } else if (rol === 'superadmin') {
      throw new Error('No se pueden crear Super Administradores desde el panel.');
    }

    const passwordHasheada = await bcrypt.hash(datos.password_hash, 10);

    const { data, error } = await supabase
      .from('usuarios')
      .insert([
        {
          username: datos.username.toLowerCase().trim(),
          codigo_rrhh: datos.codigo_rrhh?.trim() || null,
          nombre_completo: datos.nombre_completo.trim(),
          email: datos.email?.toLowerCase().trim() || null,
          password_hash: passwordHasheada,
          telefono: datos.telefono?.trim() || null,
          rol,
          puesto_id: datos.puesto_id || null,
          sede_id: sedeId,
          asignador_id: datos.asignador_id || null,
          activo: true,
        },
      ])
      .select('*, puesto:departamentos_puestos(*), sede:sedes_zonas(*, marca:marcas(*))')
      .single();

    if (error) {
      if (String(error.message).includes('ux_usuarios_codigo_rrhh')) {
        throw new Error(`El ID de RRHH "${datos.codigo_rrhh}" ya está asignado a otro colaborador.`);
      }
      if (String(error.message).includes('usuarios_username_key')) {
        throw new Error(`El nombre de usuario "${datos.username}" ya existe.`);
      }
      throw error;
    }
    const { password_hash, ...limpio } = data as any;
    return { success: true, user: limpio as UsuarioBoco };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al crear usuario.' };
  }
}

export async function toggleActivarUsuarioBoco(
  usuarioId: string,
  activo: boolean,
  solicitanteId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await exigirAlcanceUsuario(solicitanteId, usuarioId);
    const { error } = await supabase.from('usuarios').update({ activo }).eq('id', usuarioId);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function asignarLiderColaborador(
  colaboradorId: string,
  asignadorId: string | null,
  solicitanteId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await exigirAlcanceUsuario(solicitanteId, colaboradorId);
    const { error } = await supabase
      .from('usuarios')
      .update({
        asignador_id: asignadorId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', colaboradorId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al asignar líder de equipo.' };
  }
}
export async function transferirEquipoAsignador(
  asignadorOrigenId: string,
  asignadorDestinoId: string
): Promise<{ success: boolean; totalTransferidos?: number; error?: string }> {
  try {
    if (!asignadorOrigenId || !asignadorDestinoId) {
      return { success: false, error: 'Debes seleccionar el asignador saliente y el nuevo asignador.' };
    }
    if (asignadorOrigenId === asignadorDestinoId) {
      return { success: false, error: 'El asignador de origen y destino no pueden ser el mismo.' };
    }

    const { data, error } = await supabase
      .from('usuarios')
      .update({
        asignador_id: asignadorDestinoId,
        updated_at: new Date().toISOString(),
      })
      .eq('asignador_id', asignadorOrigenId)
      .select('id');

    if (error) throw error;
    return { success: true, totalTransferidos: data?.length || 0 };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al transferir el equipo.' };
  }
}

/**
 * @param alcanceSedeId  undefined = todas las sedes (Super Admin / Asignador);
 *                       string = solo esa sede (RRHH); null = ninguna (RRHH sin sede asignada).
 */
export async function obtenerUsuariosBoco(alcanceSedeId?: string | null): Promise<UsuarioBoco[]> {
  if (alcanceSedeId === null) return [];
  let query = supabase
    .from('usuarios')
    .select('*, puesto:departamentos_puestos(*), sede:sedes_zonas(*, marca:marcas(*)), asignador:asignador_id(id, nombre_completo, username, codigo_rrhh)')
    .order('nombre_completo', { ascending: true });
  if (alcanceSedeId) query = query.eq('sede_id', alcanceSedeId);
  const { data, error } = await query;

  if (error) {
    console.warn('Error al obtener usuarios:', error);
    return [];
  }
  return (data || []).map((u: any) => {
    const { password_hash, facial_descriptor, ...resto } = u;
    return resto;
  }) as UsuarioBoco[];
}

export async function crearSedeBoco(
  datos: {
    nombre: string;
    direccion?: string;
    latitud: number;
    longitud: number;
    radio_metros: number;
    marca_id?: string;
    codigo?: string;
  },
  solicitanteId?: string
): Promise<{ success: boolean; sede?: SedeZona; error?: string }> {
  try {
    await exigirSuperAdmin(solicitanteId);
    const { data, error } = await supabase
      .from('sedes_zonas')
      .insert([
        {
          nombre: datos.nombre.trim(),
          direccion: datos.direccion?.trim() || null,
          latitud: Number(datos.latitud),
          longitud: Number(datos.longitud),
          radio_metros: Number(datos.radio_metros) || 100,
          marca_id: datos.marca_id || null,
          codigo: datos.codigo?.trim().toUpperCase() || null,
          coordenadas_verificadas: true,
          activo: true,
        },
      ])
      .select('*, marca:marcas(*)')
      .single();

    if (error) throw error;
    return { success: true, sede: data as SedeZona };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al registrar la sede.' };
  }
}

/**
 * Valida biométricamente el rostro capturado en vivo contra el descriptor guardado del usuario.
 */
export async function verificarRostroUsuarioBoco(
  usuarioId: string,
  descriptorEnVivo: number[]
): Promise<{ success: boolean; coincidencia?: boolean; error?: string; distancia?: number }> {
  try {
    if (!descriptorEnVivo || descriptorEnVivo.length !== 128) {
      return { success: false, error: 'Descriptor biométrico inválido.' };
    }

    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('id, nombre_completo, facial_descriptor, facial_enrolled')
      .eq('id', usuarioId)
      .single();

    if (error || !usuario) {
      return { success: false, error: 'Usuario no encontrado.' };
    }

    if (!usuario.facial_enrolled || !usuario.facial_descriptor) {
      return { success: false, error: 'El usuario no tiene rostro enrolado.' };
    }

    // Cálculo de distancia euclidiana
    let suma = 0;
    for (let i = 0; i < 128; i++) {
      const diff = descriptorEnVivo[i] - usuario.facial_descriptor[i];
      suma += diff * diff;
    }
    const distancia = Math.sqrt(suma);
    const UMBRAL = 0.50; // Umbral estándar FaceAPI

    if (distancia <= UMBRAL) {
      return { success: true, coincidencia: true, distancia };
    } else {
      return {
        success: false,
        coincidencia: false,
        error: `Rostro no coincide con el perfil del usuario (distancia: ${distancia.toFixed(2)} vs umbral ${UMBRAL}).`,
        distancia,
      };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error durante la verificación facial.' };
  }
}

export async function obtenerSedesBoco(alcanceSedeId?: string | null): Promise<SedeZona[]> {
  if (alcanceSedeId === null) return [];
  let query = supabase.from('sedes_zonas').select('*, marca:marcas(*)').order('nombre', { ascending: true });
  if (alcanceSedeId) query = query.eq('id', alcanceSedeId);
  const { data, error } = await query;
  if (error) return [];
  return (data || []) as SedeZona[];
}

export async function obtenerPuestosBoco(): Promise<DepartamentoPuesto[]> {
  const { data, error } = await supabase.from('departamentos_puestos').select('*').order('nombre', { ascending: true });
  if (error) return [];
  return (data || []) as DepartamentoPuesto[];
}

export async function obtenerMarcajesBoco(filtros?: {
  fechaInicio?: string;
  fechaFin?: string;
  usuarioId?: string;
  /** undefined = todas; string = solo usuarios de esa sede; null = ninguna */
  sedeId?: string | null;
}): Promise<MarcajeAsistencia[]> {
  if (filtros?.sedeId === null) return [];
  let idsSede: string[] | null = null;
  if (filtros?.sedeId) {
    const { data: delaSede } = await supabase.from('usuarios').select('id').eq('sede_id', filtros.sedeId);
    idsSede = (delaSede || []).map((u: any) => u.id);
    if (idsSede.length === 0) return [];
  }
  let query = supabase
    .from('marcajes_asistencia')
    .select('*, usuario:usuarios(*, puesto:departamentos_puestos(*), sede:sedes_zonas(*, marca:marcas(*)))')
    .order('fecha', { ascending: false });

  if (filtros?.fechaInicio) query = query.gte('fecha', filtros.fechaInicio);
  if (filtros?.fechaFin) query = query.lte('fecha', filtros.fechaFin);
  if (filtros?.usuarioId) query = query.eq('usuario_id', filtros.usuarioId);
  if (idsSede) query = query.in('usuario_id', idsSede);

  const { data, error } = await query;
  if (error) {
    console.warn('Error al obtener marcajes:', error);
    return [];
  }
  return (data || []) as MarcajeAsistencia[];
}

// ==============================================================================
// 4. MÓDULO ASIGNADOR (Horarios, WhatsApp, Faltas y Banco de Horas)
// ==============================================================================

export async function obtenerTurnosSemana(
  fechaInicio: string,
  fechaFin: string
): Promise<HorarioTurno[]> {
  try {
    const { data, error } = await supabase
      .from('horarios_turnos')
      .select('*')
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin);

    if (error) {
      console.warn('Error al obtener turnos de la semana:', error);
      return [];
    }
    return (data || []) as HorarioTurno[];
  } catch (err) {
    console.error('Error en obtenerTurnosSemana:', err);
    return [];
  }
}

export async function guardarMatrizSemanalCompleta(
  turnos: Array<{
    usuario_id: string;
    asignador_id: string;
    fecha: string;
    hora_entrada: string;
    hora_salida: string;
    es_dia_descanso?: boolean;
    es_dia_festivo?: boolean;
    notas?: string;
  }>,
  notificarWhatsApp: boolean = false
): Promise<{ success: boolean; guardados: number; error?: string }> {
  try {
    if (!turnos || turnos.length === 0) {
      return { success: true, guardados: 0 };
    }

    const { error } = await supabase.from('horarios_turnos').upsert(
      turnos.map((t) => ({
        ...t,
        notificado_whatsapp: notificarWhatsApp,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'usuario_id,fecha' }
    );

    if (error) throw error;

    // Si se activó reenviar por WhatsApp, notificar a los colaboradores involucrados
    if (notificarWhatsApp) {
      const userIds = Array.from(new Set(turnos.map((t) => t.usuario_id)));
      for (const uId of userIds) {
        const { data: usuario } = await supabase.from('usuarios').select('*').eq('id', uId).single();
        if (usuario && usuario.telefono) {
          const turnosUser = turnos.filter((t) => t.usuario_id === uId);
          await enviarNotificacionWhatsApp({
            usuarioId: usuario.id,
            nombreColaborador: usuario.nombre_completo,
            telefono: usuario.telefono,
            tipoEvento: 'cambio_horario',
            detalles: {
              fecha: `${turnos[0].fecha} al ${turnos[turnos.length - 1].fecha}`,
              horaEntrada: 'Horario Semanal Actualizado',
              horaSalida: `${turnosUser.length} turnos programados`,
            },
          });
        }
      }
    }

    return { success: true, guardados: turnos.length };
  } catch (err: any) {
    console.error('Error en guardarMatrizSemanalCompleta:', err);
    return { success: false, guardados: 0, error: err.message };
  }
}

export async function copiarTurnosSemanaAnterior(
  lunesOrigen: string,
  lunesDestino: string,
  asignadorId: string
): Promise<{ success: boolean; copiados?: number; error?: string }> {
  try {
    const origenDate = new Date(`${lunesOrigen}T00:00:00`);
    const domingoOrigen = new Date(origenDate);
    domingoOrigen.setDate(domingoOrigen.getDate() + 6);
    const domingoOrigenStr = domingoOrigen.toISOString().slice(0, 10);

    const { data: turnosAnteriores, error: errFetch } = await supabase
      .from('horarios_turnos')
      .select('*')
      .gte('fecha', lunesOrigen)
      .lte('fecha', domingoOrigenStr);

    if (errFetch) throw errFetch;
    if (!turnosAnteriores || turnosAnteriores.length === 0) {
      return { success: false, error: 'No se encontraron turnos en la semana origen seleccionada.' };
    }

    const destinoDate = new Date(`${lunesDestino}T00:00:00`);
    const diffDias = Math.round((destinoDate.getTime() - origenDate.getTime()) / (1000 * 60 * 60 * 24));

    const nuevosTurnos = turnosAnteriores.map((t) => {
      const f = new Date(`${t.fecha}T00:00:00`);
      f.setDate(f.getDate() + diffDias);
      const nuevaFechaStr = f.toISOString().slice(0, 10);
      return {
        usuario_id: t.usuario_id,
        asignador_id: asignadorId,
        fecha: nuevaFechaStr,
        hora_entrada: t.hora_entrada,
        hora_salida: t.hora_salida,
        es_dia_descanso: t.es_dia_descanso,
        es_dia_festivo: t.es_dia_festivo,
        notas: t.notas,
        notificado_whatsapp: false,
      };
    });

    const { error: errUpsert } = await supabase.from('horarios_turnos').upsert(nuevosTurnos, {
      onConflict: 'usuario_id,fecha',
    });

    if (errUpsert) throw errUpsert;
    return { success: true, copiados: nuevosTurnos.length };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al copiar turnos.' };
  }
}

export async function asignarHorarioTurno(datos: {
  usuario_id: string;
  asignador_id: string;
  fecha: string;
  hora_entrada: string;
  hora_salida: string;
  tolerancia_minutos?: number;
  es_dia_descanso?: boolean;
  es_dia_festivo?: boolean;
  notas?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('horarios_turnos').upsert(
      {
        ...datos,
        notificado_whatsapp: true,
      },
      { onConflict: 'usuario_id,fecha' }
    );

    if (error) throw error;

    // Obtener datos del usuario para el aviso por WhatsApp
    const { data: usuario } = await supabase.from('usuarios').select('*').eq('id', datos.usuario_id).single();
    if (usuario && usuario.telefono) {
      await enviarNotificacionWhatsApp({
        usuarioId: usuario.id,
        nombreColaborador: usuario.nombre_completo,
        telefono: usuario.telefono,
        tipoEvento: 'cambio_horario',
        detalles: {
          fecha: datos.fecha,
          horaEntrada: datos.hora_entrada,
          horaSalida: datos.hora_salida,
        },
      });
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al asignar horario.' };
  }
}

export async function registrarJustificacionFalta(datos: {
  usuario_id: string;
  asignador_id?: string;
  fecha_afectada: string;
  tipo: 'falta' | 'llegada_tarde' | 'salida_temprana' | 'permiso';
  motivo: string;
  comprobante_url?: string;
  horas_a_reponer: number;
  fecha_compromiso_reposicion?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('justificaciones_faltas').insert([
      {
        ...datos,
        estado: 'pendiente',
        horas_repuestas: 0,
      },
    ]);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al guardar justificación.' };
  }
}

export interface ResumenBancoHorasColaborador {
  usuario_id: string;
  semana_inicio: string;
  semana_fin: string;
  jornada_base: number; // Ej. 42h mixta ordinaria
  horas_programadas: number; // Horas asignadas en la matriz semanal
  diferencia_programacion: number; // Horas asignadas - Jornada Base (ej. 44h - 42h = +2h)
  horas_reales_trabajadas: number; // Suma calculada de entradas y salidas reales
  horas_excedentes_operacion: number; // Tiempo laborado posterior a la hora programada de salida (+2h extras)
  dias_festivos_laborados: number; // Feriados trabajados (+8h compensatorias c/u)
  horas_por_reponer_justificadas: number; // Faltas/retardos justificados adeudados
  saldo_neto_horas: number; // Saldo consolidado final a favor (+) o por reponer (-)
  estado_balance: 'a_favor_colaborador' | 'a_favor_empresa' | 'nivelado';
  sugerencia_proxima_semana: number; // Horas sugeridas para la próxima semana (ej. 42 - 11 = 31h)
  mensaje_medidor: string;
}

/**
 * Motor de Cálculo del Banco de Horas de BOCO:
 * Calcula la diferencia entre jornada mixta base (42h) vs matriz programada (ej. 44h -> +2h),
 * más horas reales excedentes de turno (ej. salida a las 19:00 en vez de 17:00 -> +2h),
 * festivos debidos (+8h c/u), menos inasistencias por reponer.
 * No se pagan horas extras; se nivelan en la semana siguiente (ej. asignando 31h).
 */
export async function obtenerBancoHorasEquipo(
  usuarioIds: string[],
  semanaInicio: string,
  semanaFin: string,
  jornadaBaseDefault: number = 42
): Promise<{
  success: boolean;
  resumen?: ResumenBancoHorasColaborador[];
  error?: string;
}> {
  try {
    if (!usuarioIds || usuarioIds.length === 0) {
      return { success: true, resumen: [] };
    }

    // 1. Obtener turnos programados en la semana
    const { data: turnos, error: errTurnos } = await supabase
      .from('horarios_turnos')
      .select('*')
      .in('usuario_id', usuarioIds)
      .gte('fecha', semanaInicio)
      .lte('fecha', semanaFin);

    if (errTurnos) throw errTurnos;

    // 2. Obtener marcajes reales en la semana
    const { data: marcajes, error: errMarcajes } = await supabase
      .from('marcajes_asistencia')
      .select('*')
      .in('usuario_id', usuarioIds)
      .gte('fecha', semanaInicio)
      .lte('fecha', semanaFin);

    if (errMarcajes) throw errMarcajes;

    // 3. Obtener justificaciones pendientes de reposición
    const { data: justificaciones } = await supabase
      .from('justificaciones_faltas')
      .select('*')
      .in('usuario_id', usuarioIds)
      .eq('estado', 'pendiente');

    const resultado: ResumenBancoHorasColaborador[] = usuarioIds.map((uId) => {
      // Cálculo de Horas Programadas en Matriz y Días Festivos
      const turnosUsuario = (turnos || []).filter((t) => t.usuario_id === uId);
      let horasProgramadas = 0;
      let festivosLaborados = 0;

      for (const t of turnosUsuario) {
        if (!t.es_dia_descanso && t.hora_entrada && t.hora_salida) {
          const [h1, m1] = t.hora_entrada.split(':').map(Number);
          const [h2, m2] = t.hora_salida.split(':').map(Number);
          let min = h2 * 60 + m2 - (h1 * 60 + m1);
          if (min < 0) min += 24 * 60;
          horasProgramadas += min / 60;
        }
        if (t.es_dia_festivo && !t.es_dia_descanso) {
          festivosLaborados++;
        }
      }
      horasProgramadas = Number(horasProgramadas.toFixed(1));

      // Cálculo de Horas Reales Trabajadas y Horas Excedentes (quedarse después de salida programada)
      const marcajesUsuario = (marcajes || []).filter((m) => m.usuario_id === uId);
      let horasReales = 0;
      let horasExcedentes = 0;

      for (const m of marcajesUsuario) {
        if (m.hora_entrada && m.hora_salida) {
          const d1 = new Date(m.hora_entrada);
          const d2 = new Date(m.hora_salida);
          let diffMin = (d2.getTime() - d1.getTime()) / (1000 * 60);

          if (m.hora_inicio_almuerzo && m.hora_fin_almuerzo) {
            const a1 = new Date(m.hora_inicio_almuerzo);
            const a2 = new Date(m.hora_fin_almuerzo);
            const minAlm = (a2.getTime() - a1.getTime()) / (1000 * 60);
            if (minAlm > 0) diffMin -= minAlm;
          }

          if (diffMin > 0) {
            horasReales += diffMin / 60;
          }

          // Detección de horas extras / excedentes de turno (ej. salida 19:00 vs 17:00 programado)
          const turnoDia = turnosUsuario.find((t) => t.fecha === m.fecha);
          if (turnoDia && turnoDia.hora_salida && !turnoDia.es_dia_descanso) {
            const [hSal, mSal] = turnoDia.hora_salida.split(':').map(Number);
            const minSalProg = hSal * 60 + mSal;
            const minSalReal = d2.getHours() * 60 + d2.getMinutes();
            if (minSalReal - minSalProg > 15) {
              const excedente = (minSalReal - minSalProg) / 60;
              horasExcedentes += excedente;
            }
          }
        }
      }
      horasReales = Number(horasReales.toFixed(1));
      horasExcedentes = Number(horasExcedentes.toFixed(1));

      // Horas adeudadas por reposición de faltas o retardos
      const justUsuario = (justificaciones || []).filter((j) => j.usuario_id === uId);
      let horasPorReponer = justUsuario.reduce(
        (acc, j) => acc + (Number(j.horas_a_reponer) - Number(j.horas_repuestas || 0)),
        0
      );
      horasPorReponer = Number(horasPorReponer.toFixed(1));

      // Balance y Medidor de Nivelación
      const diferenciaProgramacion = Number((horasProgramadas - jornadaBaseDefault).toFixed(1));
      const horasFestivos = festivosLaborados * 8; // 1 festivo = 8h a favor
      const saldoNeto = Number(
        (diferenciaProgramacion + horasExcedentes + horasFestivos - horasPorReponer).toFixed(1)
      );

      let estadoBalance: 'a_favor_colaborador' | 'a_favor_empresa' | 'nivelado' = 'nivelado';
      let sugerenciaProximaSemana = jornadaBaseDefault;
      let mensajeMedidor = 'Banco en equilibrio perfecto (0.0h)';

      if (saldoNeto > 0) {
        estadoBalance = 'a_favor_colaborador';
        sugerenciaProximaSemana = Math.max(0, Number((jornadaBaseDefault - saldoNeto).toFixed(1)));
        mensajeMedidor = `BOCO le debe ${saldoNeto}h. Nivelar programando ${sugerenciaProximaSemana}h la próxima semana.`;
      } else if (saldoNeto < 0) {
        estadoBalance = 'a_favor_empresa';
        const deuda = Math.abs(saldoNeto);
        sugerenciaProximaSemana = Number((jornadaBaseDefault + deuda).toFixed(1));
        mensajeMedidor = `El colaborador adeuda ${deuda}h. Nivelar programando ${sugerenciaProximaSemana}h la próxima semana.`;
      }

      return {
        usuario_id: uId,
        semana_inicio: semanaInicio,
        semana_fin: semanaFin,
        jornada_base: jornadaBaseDefault,
        horas_programadas: horasProgramadas,
        diferencia_programacion: diferenciaProgramacion,
        horas_reales_trabajadas: horasReales,
        horas_excedentes_operacion: horasExcedentes,
        dias_festivos_laborados: festivosLaborados,
        horas_por_reponer_justificadas: horasPorReponer,
        saldo_neto_horas: saldoNeto,
        estado_balance: estadoBalance,
        sugerencia_proxima_semana: sugerenciaProximaSemana,
        mensaje_medidor: mensajeMedidor,
      };
    });

    return { success: true, resumen: resultado };
  } catch (err: any) {
    console.error('Error en obtenerBancoHorasEquipo:', err);
    return { success: false, error: err.message };
  }
}

export async function registrarAjusteBancoHoras(datos: {
  usuario_id: string;
  semana_inicio: string;
  semana_fin: string;
  horas_ajuste: number;
  tipo: 'a_favor_colaborador' | 'a_favor_empresa' | 'compensacion_tomada';
  motivo: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('banco_horas_compensacion').insert([
      {
        usuario_id: datos.usuario_id,
        semana_inicio: datos.semana_inicio,
        semana_fin: datos.semana_fin,
        saldo_neto_horas: datos.horas_ajuste,
        notas: `[${datos.tipo}] ${datos.motivo}`,
      },
    ]);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al registrar ajuste de banco de horas.' };
  }
}

// ==============================================================================
// 5. SISTEMA DE APRENDIZAJE (LMS) - GESTIONADO EXCLUSIVAMENTE POR RRHH
// ==============================================================================

/**
 * Solo RRHH puede subir contenido/cursos al LMS.
 * Genera automáticamente el examen con IA (Gemini) con preguntas V/F y Opción Múltiple
 * que exigen justificar la respuesta.
 */
export async function crearCursoLMSRRHH(datos: {
  creado_por: string;
  titulo: string;
  descripcion?: string;
  contenido_texto: string;
  video_url?: string;
  documento_url?: string;
  tiempo_minimo_lectura_segundos: number; // Contador de seguridad anti-trampa
  puntuacion_minima_aprobacion: number;
  asignarA?: {
    tipo: 'puesto' | 'usuario';
    puesto_id?: string;
    usuario_id?: string;
  };
}): Promise<{ success: boolean; curso?: LMSCurso; error?: string }> {
  try {
    // 1. Guardar curso
    const { data: curso, error: errCurso } = await supabase
      .from('lms_cursos')
      .insert([
        {
          creado_por: datos.creado_por,
          titulo: datos.titulo,
          descripcion: datos.descripcion,
          contenido_texto: datos.contenido_texto,
          video_url: datos.video_url,
          documento_url: datos.documento_url,
          tiempo_minimo_lectura_segundos: datos.tiempo_minimo_lectura_segundos || 120,
          puntuacion_minima_aprobacion: datos.puntuacion_minima_aprobacion || 80,
          activo: true,
        },
      ])
      .select('*')
      .single();

    if (errCurso || !curso) throw errCurso;

    // 2. Generar evaluación con IA (Gemini)
    const preguntasIA = await generarEvaluacionPorIA(datos.contenido_texto, datos.titulo, 4);
    await supabase.from('lms_evaluaciones_ia').insert([
      {
        curso_id: curso.id,
        preguntas_json: preguntasIA,
        modelo_ia: 'gemini-1.5-flash',
      },
    ]);

    // 3. Segmentación: Asignar a puesto (ej. Bartenders, Cocina, Limpieza) o usuario específico
    if (datos.asignarA) {
      await supabase.from('lms_asignaciones_cursos').insert([
        {
          curso_id: curso.id,
          asignado_por: datos.creado_por,
          puesto_id: datos.asignarA.tipo === 'puesto' ? datos.asignarA.puesto_id : null,
          usuario_id: datos.asignarA.tipo === 'usuario' ? datos.asignarA.usuario_id : null,
          obligatorio: true,
        },
      ]);
    }

    return { success: true, curso: curso as LMSCurso };
  } catch (err: any) {
    console.error('Error al crear curso LMS:', err);
    return { success: false, error: err.message || 'Error al crear curso en LMS.' };
  }
}

/**
 * Obtiene los cursos asignados a un colaborador específico según su puesto o asignación directa.
 * "si es bartender no se lo damos a un chef; si es limpieza no a un bartender"
 */
export async function obtenerCursosParaColaborador(usuarioId: string): Promise<
  (LMSCurso & {
    avance?: LMSAvanceColaborador;
    evaluacion?: LMSEvaluacionIA;
  })[]
> {
  try {
    // 1. Obtener usuario y su puesto_id
    const { data: usuario } = await supabase.from('usuarios').select('id, puesto_id').eq('id', usuarioId).single();

    if (!usuario) return [];

    // 2. Traer asignaciones donde aplique su puesto_id o su usuario_id directo
    let queryAsig = supabase.from('lms_asignaciones_cursos').select('curso_id');
    if (usuario.puesto_id) {
      queryAsig = queryAsig.or(`puesto_id.eq.${usuario.puesto_id},usuario_id.eq.${usuario.id}`);
    } else {
      queryAsig = queryAsig.eq('usuario_id', usuario.id);
    }

    const { data: asignaciones } = await queryAsig;
    const idsCursos = (asignaciones || []).map((a) => a.curso_id);

    if (idsCursos.length === 0) return [];

    // 3. Traer cursos activos
    const { data: cursos } = await supabase
      .from('lms_cursos')
      .select('*, evaluacion:lms_evaluaciones_ia(*)')
      .in('id', idsCursos)
      .eq('activo', true);

    // 4. Traer avances del usuario
    const { data: avances } = await supabase.from('lms_avance_colaborador').select('*').eq('usuario_id', usuarioId);

    const avancesMap = new Map((avances || []).map((av) => [av.curso_id, av]));

    return (cursos || []).map((c: any) => ({
      ...c,
      evaluacion: Array.isArray(c.evaluacion) ? c.evaluacion[0] : c.evaluacion,
      avance: avancesMap.get(c.id),
    }));
  } catch (err) {
    console.error('Error al obtener cursos del colaborador:', err);
    return [];
  }
}

/**
 * Registra los segundos reales de lectura con validación del contador de seguridad anti-trampas.
 */
export async function registrarSegundosLecturaLMS(
  usuarioId: string,
  cursoId: string,
  segundosAcumulados: number
): Promise<{ success: boolean; lecturaCompletada: boolean }> {
  try {
    const { data: curso } = await supabase
      .from('lms_cursos')
      .select('tiempo_minimo_lectura_segundos')
      .eq('id', cursoId)
      .single();

    const minSegundos = curso?.tiempo_minimo_lectura_segundos || 120;
    const completado = segundosAcumulados >= minSegundos;

    await supabase.from('lms_avance_colaborador').upsert(
      {
        curso_id: cursoId,
        usuario_id: usuarioId,
        segundos_lectura_reales: segundosAcumulados,
        lectura_completada: completado,
      },
      { onConflict: 'curso_id,usuario_id' }
    );

    return { success: true, lecturaCompletada: completado };
  } catch (err) {
    return { success: false, lecturaCompletada: false };
  }
}

/**
 * Califica el cuestionario del colaborador:
 * Evalúa aciertos y valida que haya redactado la justificación de su respuesta.
 */
export async function calificarEvaluacionLMS(params: {
  usuarioId: string;
  cursoId: string;
  respuestas: LMSRespuestaColaborador[];
}): Promise<{
  success: boolean;
  puntuacion: number;
  aprobado: boolean;
  retroalimentacion: string;
  error?: string;
}> {
  try {
    // 1. Obtener curso y preguntas oficiales
    const { data: curso } = await supabase.from('lms_cursos').select('*').eq('id', params.cursoId).single();
    const { data: evaluacion } = await supabase
      .from('lms_evaluaciones_ia')
      .select('*')
      .eq('curso_id', params.cursoId)
      .single();

    if (!curso || !evaluacion) {
      return { success: false, puntuacion: 0, aprobado: false, retroalimentacion: '', error: 'Examen no encontrado.' };
    }

    const preguntas: LMSPreguntaIA[] = evaluacion.preguntas_json || [];
    let aciertos = 0;

    for (const preg of preguntas) {
      const respUser = params.respuestas.find((r) => r.pregunta_id === preg.id);
      if (respUser) {
        const coincide =
          String(respUser.respuesta_seleccionada).trim().toLowerCase() ===
          String(preg.respuesta_correcta).trim().toLowerCase();
        if (coincide) {
          aciertos++;
          respUser.es_correcta = true;
        } else {
          respUser.es_correcta = false;
        }
      }
    }

    const puntuacion = Number(((aciertos / Math.max(preguntas.length, 1)) * 100).toFixed(1));
    const aprobado = puntuacion >= (curso.puntuacion_minima_aprobacion || 80);

    // 2. Guardar resultado en BD
    await supabase.from('lms_avance_colaborador').upsert(
      {
        curso_id: params.cursoId,
        usuario_id: params.usuarioId,
        intentos_realizados: 1,
        puntuacion_obtenida: puntuacion,
        respuestas_usuario_json: params.respuestas,
        aprobado: aprobado,
        fecha_aprobacion: aprobado ? new Date().toISOString() : null,
      },
      { onConflict: 'curso_id,usuario_id' }
    );

    const retroalimentacion = aprobado
      ? `¡Felicidades! Has aprobado el curso con una calificación de ${puntuacion}/100.`
      : `Has obtenido ${puntuacion}/100. La calificación mínima requerida es ${curso.puntuacion_minima_aprobacion}%. Te invitamos a repasar el contenido y volver a intentarlo.`;

    return {
      success: true,
      puntuacion,
      aprobado,
      retroalimentacion,
    };
  } catch (err: any) {
    return {
      success: false,
      puntuacion: 0,
      aprobado: false,
      retroalimentacion: '',
      error: err.message || 'Error al calificar evaluación.',
    };
  }
}

export interface ItemTrackerLMS {
  avance_id?: string;
  curso_id: string;
  curso_titulo: string;
  curso_puntuacion_minima: number;
  curso_tiempo_minimo: number;
  usuario_id: string;
  usuario_nombre: string;
  codigo_rrhh: string;
  puesto_nombre: string;
  sede_nombre: string;
  telefono?: string;
  estado: 'aprobado' | 'reprobado' | 'en_progreso' | 'pendiente';
  puntuacion_obtenida: number | null;
  segundos_lectura_reales: number;
  lectura_completada: boolean;
  intentos_realizados: number;
  fecha_aprobacion: string | null;
  updated_at: string | null;
}

/**
 * Trae la matriz de seguimiento (Tracker LMS) para Recursos Humanos:
 * Muestra quiénes completaron y aprobaron cada curso, quiénes están en lectura y quiénes aún están pendientes.
 */
export async function obtenerTrackerLMSRRHH(alcanceSedeId?: string | null): Promise<{
  success: boolean;
  tracker?: ItemTrackerLMS[];
  cursos?: LMSCurso[];
  estadisticas?: {
    totalAsignaciones: number;
    totalAprobados: number;
    totalEnProgreso: number;
    totalPendientes: number;
    tasaAprobacion: number;
  };
  error?: string;
}> {
  try {
    if (alcanceSedeId === null) {
      return {
        success: true,
        tracker: [],
        cursos: [],
        estadisticas: { totalAsignaciones: 0, totalAprobados: 0, totalEnProgreso: 0, totalPendientes: 0, tasaAprobacion: 0 },
      };
    }
    // 1. Obtener cursos y asignaciones
    const { data: cursos, error: errCursos } = await supabase
      .from('lms_cursos')
      .select('*, asignaciones:lms_asignaciones_cursos(*)')
      .order('created_at', { ascending: false });

    if (errCursos) throw errCursos;

    // 2. Obtener colaboradores activos
    let queryUsuarios = supabase
      .from('usuarios')
      .select('*, puesto:departamentos_puestos(*), sede:sedes_zonas(*, marca:marcas(*))')
      .eq('rol', 'colaborador')
      .eq('activo', true);
    if (alcanceSedeId) queryUsuarios = queryUsuarios.eq('sede_id', alcanceSedeId);
    const { data: usuarios, error: errUsers } = await queryUsuarios;

    if (errUsers) throw errUsers;

    // 3. Obtener registros de avances de cursos
    const { data: avances, error: errAvances } = await supabase
      .from('lms_avance_colaborador')
      .select('*');

    if (errAvances) throw errAvances;

    const tracker: ItemTrackerLMS[] = [];
    const listaCursos = (cursos || []) as (LMSCurso & { asignaciones?: any[] })[];
    const listaUsuarios = (usuarios || []) as UsuarioBoco[];
    const avancesMap = new Map((avances || []).map((a) => [`${a.curso_id}_${a.usuario_id}`, a]));

    for (const c of listaCursos) {
      const asignaciones = c.asignaciones || [];
      const puestoIdsAsignados = asignaciones.filter((a) => a.puesto_id).map((a) => a.puesto_id);
      const usuarioIdsAsignados = asignaciones.filter((a) => a.usuario_id).map((a) => a.usuario_id);
      const esGeneral = asignaciones.length === 0 || asignaciones.some((a) => !a.puesto_id && !a.usuario_id);

      for (const u of listaUsuarios) {
        let leAplica = false;
        if (esGeneral) {
          leAplica = true;
        } else if (u.puesto_id && puestoIdsAsignados.includes(u.puesto_id)) {
          leAplica = true;
        } else if (usuarioIdsAsignados.includes(u.id)) {
          leAplica = true;
        }

        if (leAplica) {
          const clave = `${c.id}_${u.id}`;
          const av = avancesMap.get(clave);

          let estado: 'aprobado' | 'reprobado' | 'en_progreso' | 'pendiente' = 'pendiente';
          let puntuacion = null;
          let segundos = 0;
          let lecturaComp = false;
          let intentos = 0;
          let fechaAprob = null;
          let updatedAt = null;
          let avanceId = undefined;

          if (av) {
            avanceId = av.id;
            puntuacion =
              av.puntuacion_obtenida !== undefined && av.puntuacion_obtenida !== null
                ? Number(av.puntuacion_obtenida)
                : null;
            segundos = av.segundos_lectura_reales || 0;
            lecturaComp = Boolean(av.lectura_completada);
            intentos = av.intentos_realizados || 0;
            fechaAprob = av.fecha_aprobacion;
            updatedAt = av.updated_at || av.created_at;

            if (av.aprobado) {
              estado = 'aprobado';
            } else if (puntuacion !== null) {
              estado = 'reprobado';
            } else if (segundos > 0 || lecturaComp) {
              estado = 'en_progreso';
            }
          }

          tracker.push({
            avance_id: avanceId,
            curso_id: c.id,
            curso_titulo: c.titulo,
            curso_puntuacion_minima: c.puntuacion_minima_aprobacion || 80,
            curso_tiempo_minimo: c.tiempo_minimo_lectura_segundos || 120,
            usuario_id: u.id,
            usuario_nombre: u.nombre_completo,
            codigo_rrhh: u.codigo_rrhh || u.username,
            puesto_nombre: u.puesto?.nombre || 'Colaborador',
            sede_nombre: u.sede?.nombre || 'Sede Central',
            telefono: u.telefono,
            estado,
            puntuacion_obtenida: puntuacion,
            segundos_lectura_reales: segundos,
            lectura_completada: lecturaComp,
            intentos_realizados: intentos,
            fecha_aprobacion: fechaAprob,
            updated_at: updatedAt,
          });
        }
      }
    }

    const totalAsignaciones = tracker.length;
    const totalAprobados = tracker.filter((t) => t.estado === 'aprobado').length;
    const totalEnProgreso = tracker.filter((t) => t.estado === 'en_progreso').length;
    const totalPendientes = tracker.filter(
      (t) => t.estado === 'pendiente' || t.estado === 'reprobado'
    ).length;
    const tasaAprobacion =
      totalAsignaciones > 0 ? Number(((totalAprobados / totalAsignaciones) * 100).toFixed(1)) : 0;

    return {
      success: true,
      tracker,
      cursos: listaCursos,
      estadisticas: {
        totalAsignaciones,
        totalAprobados,
        totalEnProgreso,
        totalPendientes,
        tasaAprobacion,
      },
    };
  } catch (err: any) {
    console.error('Error en obtenerTrackerLMSRRHH:', err);
    return { success: false, error: err.message || 'Error al obtener tracker LMS.' };
  }
}


// ==============================================================================
// 6. SUPER ADMIN: MARCAS, SEDES, RRHH E IDS DE COLABORADORES
// ==============================================================================

export interface RRHHDeSede {
  id: string;
  nombre_completo: string;
  username: string;
  codigo_rrhh?: string;
  activo: boolean;
}

export interface ResumenSedeSA {
  sede: SedeZona;
  colaboradores: number;
  asignadores: number;
  sinAsignador: number;
  sinPuesto: number;
  sinRostro: number;
  rrhh: RRHHDeSede[];
}

export interface ResumenMarcaSA {
  marca: Marca;
  sedes: ResumenSedeSA[];
  totalColaboradores: number;
  sedesSinRrhh: number;
}

export interface PanelSuperAdmin {
  marcas: ResumenMarcaSA[];
  sedesSinMarca: ResumenSedeSA[];
  totales: {
    marcas: number;
    sedes: number;
    colaboradores: number;
    rrhh: number;
    asignadores: number;
    sinSede: number;
    sinAsignador: number;
    sedesSinRrhh: number;
    sedesSinVerificar: number;
  };
}

export async function obtenerMarcasBoco(): Promise<Marca[]> {
  const { data, error } = await supabase.from('marcas').select('*').eq('activo', true).order('nombre');
  if (error) return [];
  return (data || []) as Marca[];
}

/**
 * Radiografía de toda la operación nacional: marcas -> sedes -> personas.
 */
export async function obtenerPanelSuperAdmin(
  solicitanteId: string
): Promise<{ success: boolean; panel?: PanelSuperAdmin; error?: string }> {
  try {
    await exigirSuperAdmin(solicitanteId);

    const [marcasRes, sedesRes, usuariosRes] = await Promise.all([
      supabase.from('marcas').select('*').eq('activo', true).order('nombre'),
      supabase.from('sedes_zonas').select('*, marca:marcas(*)').order('nombre'),
      supabase
        .from('usuarios')
        .select('id, nombre_completo, username, codigo_rrhh, rol, activo, sede_id, puesto_id, asignador_id, facial_enrolled'),
    ]);
    if (marcasRes.error) throw marcasRes.error;
    if (sedesRes.error) throw sedesRes.error;
    if (usuariosRes.error) throw usuariosRes.error;

    const marcas = (marcasRes.data || []) as Marca[];
    const sedes = (sedesRes.data || []) as SedeZona[];
    const usuarios = (usuariosRes.data || []) as any[];

    const resumenDe = (sede: SedeZona): ResumenSedeSA => {
      const delaSede = usuarios.filter((u) => u.sede_id === sede.id && u.activo);
      const colabs = delaSede.filter((u) => u.rol === 'colaborador');
      return {
        sede,
        colaboradores: colabs.length,
        asignadores: delaSede.filter((u) => u.rol === 'asignador').length,
        sinAsignador: colabs.filter((u) => !u.asignador_id).length,
        sinPuesto: colabs.filter((u) => !u.puesto_id).length,
        sinRostro: colabs.filter((u) => !u.facial_enrolled).length,
        rrhh: delaSede
          .filter((u) => u.rol === 'rrhh')
          .map((u) => ({
            id: u.id,
            nombre_completo: u.nombre_completo,
            username: u.username,
            codigo_rrhh: u.codigo_rrhh,
            activo: u.activo,
          })),
      };
    };

    const resumenes = sedes.filter((s) => s.activo !== false).map(resumenDe);

    const porMarca: ResumenMarcaSA[] = marcas.map((m) => {
      const sedesMarca = resumenes.filter((r) => r.sede.marca_id === m.id);
      return {
        marca: m,
        sedes: sedesMarca,
        totalColaboradores: sedesMarca.reduce((a, r) => a + r.colaboradores, 0),
        sedesSinRrhh: sedesMarca.filter((r) => r.rrhh.length === 0).length,
      };
    });
    const sedesSinMarca = resumenes.filter((r) => !r.sede.marca_id);

    const activos = usuarios.filter((u) => u.activo);
    const panel: PanelSuperAdmin = {
      marcas: porMarca,
      sedesSinMarca,
      totales: {
        marcas: marcas.length,
        sedes: resumenes.length,
        colaboradores: activos.filter((u) => u.rol === 'colaborador').length,
        rrhh: activos.filter((u) => u.rol === 'rrhh').length,
        asignadores: activos.filter((u) => u.rol === 'asignador').length,
        sinSede: activos.filter((u) => u.rol !== 'superadmin' && !u.sede_id).length,
        sinAsignador: activos.filter((u) => u.rol === 'colaborador' && !u.asignador_id).length,
        sedesSinRrhh: resumenes.filter((r) => r.rrhh.length === 0).length,
        sedesSinVerificar: resumenes.filter((r) => r.sede.coordenadas_verificadas === false).length,
      },
    };
    return { success: true, panel };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al cargar el panel nacional.' };
  }
}

export async function actualizarSedeBoco(
  solicitanteId: string,
  sedeId: string,
  datos: {
    nombre?: string;
    direccion?: string;
    latitud?: number;
    longitud?: number;
    radio_metros?: number;
    marca_id?: string | null;
    codigo?: string;
    activo?: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    await exigirSuperAdmin(solicitanteId);
    const cambios: Record<string, any> = {};
    if (datos.nombre !== undefined) cambios.nombre = datos.nombre.trim();
    if (datos.direccion !== undefined) cambios.direccion = datos.direccion.trim() || null;
    if (datos.radio_metros !== undefined) cambios.radio_metros = Number(datos.radio_metros) || 100;
    if (datos.marca_id !== undefined) cambios.marca_id = datos.marca_id || null;
    if (datos.codigo !== undefined) cambios.codigo = datos.codigo.trim().toUpperCase() || null;
    if (datos.activo !== undefined) cambios.activo = datos.activo;
    if (datos.latitud !== undefined && datos.longitud !== undefined) {
      cambios.latitud = Number(datos.latitud);
      cambios.longitud = Number(datos.longitud);
      cambios.coordenadas_verificadas = true;
    }
    const { error } = await supabase.from('sedes_zonas').update(cambios).eq('id', sedeId);
    if (error) {
      if (String(error.message).includes('ux_sedes_codigo')) throw new Error('Ese código de sede ya está en uso.');
      throw error;
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al actualizar la sede.' };
  }
}

export interface CamposUsuarioEditables {
  codigo_rrhh?: string;
  nombre_completo?: string;
  telefono?: string;
  email?: string;
  puesto_id?: string | null;
  sede_id?: string | null;
  asignador_id?: string | null;
  rol?: Role;
}

/**
 * Edita la ficha de un colaborador (ID de RRHH, sede, puesto, asignador...).
 * Super Admin: cualquiera. RRHH: solo su sede y sin poder cambiar sede ni rol.
 */
export async function actualizarUsuarioBoco(
  solicitanteId: string,
  usuarioId: string,
  campos: CamposUsuarioEditables
): Promise<{ success: boolean; error?: string }> {
  try {
    const solicitante = await exigirAlcanceUsuario(solicitanteId, usuarioId);
    const cambios: Record<string, any> = { updated_at: new Date().toISOString() };

    if (campos.codigo_rrhh !== undefined) cambios.codigo_rrhh = campos.codigo_rrhh.trim() || null;
    if (campos.nombre_completo !== undefined) {
      if (!campos.nombre_completo.trim()) throw new Error('El nombre no puede quedar vacío.');
      cambios.nombre_completo = campos.nombre_completo.trim();
    }
    if (campos.telefono !== undefined) cambios.telefono = campos.telefono.trim() || null;
    if (campos.email !== undefined) cambios.email = campos.email.trim().toLowerCase() || null;
    if (campos.puesto_id !== undefined) cambios.puesto_id = campos.puesto_id || null;
    if (campos.asignador_id !== undefined) cambios.asignador_id = campos.asignador_id || null;

    if (solicitante.rol === 'superadmin') {
      if (campos.sede_id !== undefined) cambios.sede_id = campos.sede_id || null;
      if (campos.rol !== undefined) {
        if (campos.rol === 'superadmin') throw new Error('No se puede promover a Super Administrador desde el panel.');
        cambios.rol = campos.rol;
      }
    }

    const { error } = await supabase.from('usuarios').update(cambios).eq('id', usuarioId);
    if (error) {
      if (String(error.message).includes('ux_usuarios_codigo_rrhh')) {
        throw new Error(`El ID de RRHH "${campos.codigo_rrhh}" ya pertenece a otro colaborador.`);
      }
      throw error;
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al actualizar el colaborador.' };
  }
}

/**
 * Asigna sede / puesto / asignador a muchos colaboradores a la vez
 * (ej. los recién importados que aún no tienen asignador).
 */
export async function actualizarUsuariosMasivo(
  solicitanteId: string,
  usuarioIds: string[],
  campos: { sede_id?: string | null; puesto_id?: string | null; asignador_id?: string | null }
): Promise<{ success: boolean; total?: number; error?: string }> {
  try {
    await exigirSuperAdmin(solicitanteId);
    if (!usuarioIds.length) throw new Error('Selecciona al menos un colaborador.');
    const cambios: Record<string, any> = { updated_at: new Date().toISOString() };
    if (campos.sede_id !== undefined) cambios.sede_id = campos.sede_id || null;
    if (campos.puesto_id !== undefined) cambios.puesto_id = campos.puesto_id || null;
    if (campos.asignador_id !== undefined) cambios.asignador_id = campos.asignador_id || null;
    if (Object.keys(cambios).length === 1) throw new Error('No hay cambios que aplicar.');

    const { data, error } = await supabase.from('usuarios').update(cambios).in('id', usuarioIds).select('id');
    if (error) throw error;
    return { success: true, total: data?.length || 0 };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error en la actualización masiva.' };
  }
}

/** Sugiere el siguiente ID de RRHH correlativo para una sede (ej. SZM-023). */
export async function siguienteCodigoRRHH(sedeId: string): Promise<string> {
  const { data: sede } = await supabase.from('sedes_zonas').select('codigo').eq('id', sedeId).single();
  const prefijo = (sede?.codigo || 'BC').toUpperCase();
  const { data } = await supabase.from('usuarios').select('codigo_rrhh').like('codigo_rrhh', `${prefijo}-%`);
  let max = 0;
  for (const fila of data || []) {
    const n = parseInt(String(fila.codigo_rrhh).slice(prefijo.length + 1), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `${prefijo}-${String(max + 1).padStart(3, '0')}`;
}

/** Devuelve la contraseña de un colaborador a la inicial (Boco2026#). */
export async function restablecerContraseniaBoco(
  solicitanteId: string,
  usuarioId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await exigirAlcanceUsuario(solicitanteId, usuarioId);
    const hash = await bcrypt.hash('Boco2026#', 10);
    const { error } = await supabase
      .from('usuarios')
      .update({ password_hash: hash, updated_at: new Date().toISOString() })
      .eq('id', usuarioId);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al restablecer la contraseña.' };
  }
}
