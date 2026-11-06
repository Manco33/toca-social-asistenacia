'use server';

import { supabaseAdmin as supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import type { Project, User, Geolocation, TimeEntryType, TimeEntry, Role } from '@/lib/types';
import { format, parse, differenceInMinutes } from 'date-fns';
import { format as formatTz } from 'date-fns-tz';

// Helper to convert a local Guatemala date+time (strings) into a UTC Date
// Guatemala is UTC-6 (no DST). To get the UTC instant: UTC = local + 6 hours
// Helper to convert a local Guatemala date+time (strings) into a UTC Date
// Input: "YYYY-MM-DD", "HH:MM:SS" (in Guatemala time)
// Output: Date object representing that moment in UTC
function guatemalaLocalToUtc(fecha: string, hora?: string) {
  if (!fecha) return new Date();
  const [y, m, d] = fecha.split('-').map(Number);
  const [hh = 0, mm = 0, ss = 0] = String(hora || '00:00:00').split(':').map(Number);

  // Create a date object where the inputs are treated as UTC, then subtract 6 hours?
  // No, simpler: create the specific ISO string with offset and let Date parse it
  // Guatemala is UTC-06:00.
  // "2023-01-01T12:00:00-06:00"

  const paddedM = String(m).padStart(2, '0');
  const paddedD = String(d).padStart(2, '0');
  const paddedH = String(hh).padStart(2, '0');
  const paddedMin = String(mm).padStart(2, '0');
  const paddedS = String(ss).padStart(2, '0');

  const isoString = `${y}-${paddedM}-${paddedD}T${paddedH}:${paddedMin}:${paddedS}-06:00`;
  return new Date(isoString);
}

export type AuthResult =
  | { success: true; user: User }
  | { success: false; error: string };

export async function authenticate(username: string, pass: string): Promise<AuthResult> {
  try {
    const cleanUser = String(username || '').trim();
    const provided = String(pass || '');

    console.log(`[Auth] Attempting login for user: ${cleanUser}`);

    if (!cleanUser || !provided) {
      return { success: false, error: 'El usuario y contraseña son requeridos.' };
    }

    // Construir email: username@aktivacorp.com
    // Si el usuario ingresa un email, usar tal cual; si es username, agregar dominio
    let email = cleanUser;
    if (!cleanUser.includes('@')) {
      email = `${cleanUser}@aktivacorp.com`;
    } else if (!cleanUser.endsWith('@aktivacorp.com')) {
      // Rechazar emails que no sean @aktivacorp.com
      console.log(`[Auth] Email domain not allowed: ${cleanUser}`);
      return { success: false, error: 'Solo se permiten emails @aktivacorp.com' };
    }

    email = email.toLowerCase();

    // Autenticar contra Supabase Auth (seguro, no contra tabla empleados)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: provided,
    });

    if (authError || !authData.user) {
      console.log(`[Auth] Authentication failed for ${email}: ${authError?.message}`);
      return { success: false, error: 'Usuario o contraseña no válidos.' };
    }

    const supabaseId = authData.user.id;
    console.log(`[Auth] User authenticated via Supabase Auth: ${email} (${supabaseId})`);

    // PRIMERO: Buscar en tabla users (tiene el rol autorizado por RRHH)
    let userRecord: any | null = null;
    let resp = await supabase
      .from('users')
      .select('*')
      .eq('supabase_id', supabaseId)
      .limit(1);

    if (resp.error) {
      console.error('[Auth] Error fetching users record:', resp.error);
    } else if (resp.data && resp.data.length > 0) {
      userRecord = resp.data[0];
    }

    // Verificar si usuario está en pending_role (no aprobado aún)
    if (userRecord && userRecord.role === 'pending_role') {
      console.log(`[Auth] User not yet approved by RRHH: ${email}`);
      return {
        success: true,
        user: {
          id: supabaseId,
          name: userRecord.full_name || email.split('@')[0],
          email: email,
          role: 'pending_role', // usuario va a /dashboard/pending-role
          avatarUrl: `https://picsum.photos/seed/${email}/100/100`,
        }
      };
    }

    // SEGUNDO: Buscar empleado relacionado por supabase_id
    let empleadoRow: any | null = null;
    resp = await supabase
      .from('empleados')
      .select('*')
      .eq('supabase_id', supabaseId)
      .limit(1);

    if (resp.error) {
      console.error('[Auth] Error fetching empleado by supabase_id:', resp.error);
    } else if (resp.data && resp.data.length > 0) {
      empleadoRow = resp.data[0];
    }

    // Si no hay relación supabase_id, buscar por usuario (compatibilidad)
    if (!empleadoRow) {
      const username_from_email = email.split('@')[0];
      resp = await supabase
        .from('empleados')
        .select('*')
        .eq('usuario', username_from_email)
        .limit(1);

      if (resp.error) {
        console.error('[Auth] Error fetching empleado by usuario:', resp.error);
      } else if (resp.data && resp.data.length > 0) {
        empleadoRow = resp.data[0];
        console.log(`[Auth] Found empleado by usuario: ${username_from_email}`);
      }
    }

    // Determinar rol: usar tabla users prioritariamente (asignado por RRHH)
    let appRole: Role = 'technician'; // Default

    if (userRecord && userRecord.role && userRecord.role !== 'pending_role') {
      // Usar rol de tabla users (asignado por RRHH)
      const usersRole = String(userRecord.role).toLowerCase();
      if (usersRole === 'administrator') appRole = 'admin';
      else if (usersRole === 'rrhh') appRole = 'recursos';
      else if (usersRole === 'technician') appRole = 'technician';
      else if (usersRole === 'admin') appRole = 'admin';
      else if (usersRole === 'contabilidad') appRole = 'contabilidad';
      else if (usersRole === 'soporte') appRole = 'soporte';
      else if (usersRole === 'ingenieria') appRole = 'ingenieria';
      else appRole = 'technician'; // Default fallback
      console.log(`[Auth] Using role from users table: ${appRole}`);
    } else if (empleadoRow) {
      // Fallback: usar rol de tabla empleados
      const dbRole = String(empleadoRow.rol || '').toLowerCase();
      if (dbRole === 'administrador' || dbRole === 'admin') appRole = 'admin';
      else if (dbRole === 'recursos' || dbRole === 'rrhh') appRole = 'recursos';
      else if (dbRole === 'contabilidad') appRole = 'contabilidad';
      else if (dbRole === 'soporte') appRole = 'soporte';
      else if (dbRole === 'ingenieria') appRole = 'ingenieria';
      else appRole = 'technician';
      console.log(`[Auth] Using role from empleados table: ${appRole}`);
    }

    // Construir usuario con datos de empleado si existe
    const user: User = {
      id: empleadoRow ? String(empleadoRow.id) : supabaseId,
      name: empleadoRow ? String(empleadoRow.nombre || '') : (userRecord?.full_name || email.split('@')[0]),
      email: email,
      role: appRole,
      avatarUrl: empleadoRow
        ? `https://picsum.photos/seed/${Number(empleadoRow.id) + 100}/100/100`
        : `https://picsum.photos/seed/${email}/100/100`,
    };

    console.log(`[Auth] Final user: ${JSON.stringify({ id: user.id, name: user.name, email: user.email, role: user.role })}`);
    return { success: true, user };

  } catch (error: any) {
    console.error('[Auth] Critical error:', error);
    return { success: false, error: 'Error del sistema: ' + (error.message || 'Desconocido') };
  }
}

export async function getProjects(): Promise<Project[]> {
  const { data: rows, error } = await supabase
    .from('proyectos')
    .select('*')
    .order('id', { ascending: true })
    .limit(1000);

  if (error) throw error;

  return (rows || []).map(r => ({
    id: r.id,
    name: r.nombre,
    address: r.ubicacion_del_proyecto,
    contactPerson: r.soluciones,
    latitud: (r.latitud != null && r.latitud !== 0) ? Number(r.latitud) : undefined,
    longitud: (r.longitud != null && r.longitud !== 0) ? Number(r.longitud) : undefined,
    radio: r.radio != null ? Number(r.radio) : undefined
  } as Project));
}

export async function getEmployees(supabaseId?: string): Promise<(User & { password?: string })[]> {
  try {
    console.log(`[getEmployees] Requested by user: ${supabaseId}`);

    // Si no se pasa supabaseId, retornar vacío por seguridad
    if (!supabaseId) {
      console.warn('[getEmployees] ⚠️ No supabaseId provided - retornando array vacío');
      return [];
    }

    // Obtener datos del usuario actual
    const { data: currentUser, error: userError } = await supabase
      .from('empleados')
      .select('id, usuario, rol')
      .eq('supabase_id', supabaseId)
      .single();

    if (userError || !currentUser) {
      console.warn('[getEmployees] Usuario no encontrado en empleados');
      return [];
    }

    const userRole = String(currentUser.rol || '').toLowerCase();
    const isAdmin = userRole === 'administrador' || userRole === 'admin';
    const isRRHH = userRole === 'recursos' || userRole === 'rrhh';

    console.log(`[getEmployees] User ${currentUser.usuario} (role: ${userRole}) - isAdmin: ${isAdmin}, isRRHH: ${isRRHH}`);

    // ✅ ADMIN y RRHH ven TODOS
    if (isAdmin || isRRHH) {
      console.log('[getEmployees] ✅ Acceso permitido - retornando TODOS los empleados');
      const { data: rows, error } = await supabase
        .from('empleados')
        .select('*')
        .order('id', { ascending: true })
        .limit(5000);

      if (error) throw error;

      return (rows || []).map(r => {
        const dbRole = String(r.rol || '').toLowerCase();
        let appRole: any = 'technician';

        if (dbRole === 'administrador' || dbRole === 'admin') appRole = 'admin';
        else if (dbRole === 'recursos') appRole = 'recursos';
        else if (dbRole === 'contabilidad') appRole = 'contabilidad';
        else if (dbRole === 'soporte') appRole = 'soporte';
        else if (dbRole === 'ingenieria') appRole = 'ingenieria';

        return {
          id: String(r.id),
          name: r.nombre,
          email: r.usuario,
          role: appRole,
          password: r.contrasena,
          avatarUrl: `https://picsum.photos/seed/${100 + Number(r.id)}/100/100`
        };
      });
    }

    // ❌ Otros roles no pueden acceder (seguridad)
    console.log(`[getEmployees] ❌ Acceso denegado para rol: ${userRole}`);
    return [];
  } catch (error) {
    console.error('[getEmployees] Error:', error);
    throw error;
  }
}

export async function getTodaysEntries(supabaseId?: string): Promise<any[]> {
  const today = format(new Date(), 'yyyy-MM-dd');

  try {
    console.log(`[getTodaysEntries] Requested by user: ${supabaseId}`);

    // Si no se pasa supabaseId, retornar vacío por seguridad
    if (!supabaseId) {
      console.warn('[getTodaysEntries] ⚠️ No supabaseId provided - retornando array vacío');
      return [];
    }

    // Obtener datos del usuario actual
    const { data: currentUser, error: userError } = await supabase
      .from('empleados')
      .select('id, usuario, rol')
      .eq('supabase_id', supabaseId)
      .single();

    if (userError || !currentUser) {
      console.warn('[getTodaysEntries] Usuario no encontrado');
      return [];
    }

    const userRole = String(currentUser.rol || '').toLowerCase();
    const isAdmin = userRole === 'administrador' || userRole === 'admin';
    const isRRHH = userRole === 'recursos' || userRole === 'rrhh';

    console.log(`[getTodaysEntries] User ${currentUser.usuario} (role: ${userRole})`);

    let baseQuery = supabase
      .from('horarios_gps')
      .select(`
        *,
        empleados (
          id
        )
      `)
      .eq('fecha', today);

    // ✅ ADMIN y RRHH ven TODOS los registros
    if (isAdmin || isRRHH) {
      console.log('[getTodaysEntries] ✅ Admin/RRHH - retornando TODOS los registros de hoy');
    } else {
      // ❌ Otros roles solo ven sus registros
      console.log('[getTodaysEntries] ⚠️ Usuario regular - filtrando por usuario actual');
      baseQuery = baseQuery.eq('usuario', currentUser.usuario);
    }

    const { data: rows, error } = await baseQuery.order('hora_marcaje', { ascending: true });

    if (error) throw error;

    return (rows || []).map(r => {
      // Construir timestamp seguro
      let ts: Date;
      try {
        if (r.hora_marcaje) {
          ts = guatemalaLocalToUtc(r.fecha, r.hora_marcaje);
        } else {
          ts = guatemalaLocalToUtc(r.fecha, '00:00:00');
        }
        if (isNaN(ts.getTime())) ts = guatemalaLocalToUtc(r.fecha, '00:00:00');
      } catch (e) {
        ts = guatemalaLocalToUtc(r.fecha, '00:00:00');
      }

      // Clean project info when activity indicates return to office
      const proyecto = (/(llegada a oficina|regreso a oficina|regreso)/i.test(String(r.tipo_actividad || '')) ? '' : (r.proyecto || ''));

      return {
        timestamp: ts,
        usuario: r.usuario,
        userId: r.empleados?.id ? String(r.empleados.id) : String(r.usuario),
        type: r.tipo_actividad,
        location: r.coordenadas ? {
          latitude: parseFloat(r.coordenadas.split(',')[0] || '0'),
          longitude: parseFloat(r.coordenadas.split(',')[1] || '0')
        } : undefined,
        projectName: proyecto,
        projectId: r.proyecto_id,
        note: r.nota
      };
    });
  } catch (error) {
    console.error('[getTodaysEntries] Error:', error);
    throw error;
  }
}

export async function saveTimeEntry(
  userId: string,
  type: TimeEntryType,
  location: Geolocation | null,
  project: string | null = null
): Promise<TimeEntry> {
  if (!userId) throw new Error('Se requiere el ID del usuario');

  // Si es UUID, buscar por supabase_id; si es número, buscar por id
  let user;
  let usuarioText: string = '';

  if (userId.includes('-')) {
    // UUID - buscar por supabase_id en empleados
    const { data } = await supabase
      .from('empleados')
      .select('usuario, id')
      .eq('supabase_id', userId)
      .single();
    user = data;

    // Si no encontró en empleados, buscar en users table
    if (!user) {
      const { data: userRecord } = await supabase
        .from('users')
        .select('email')
        .eq('supabase_id', userId)
        .single();

      if (userRecord?.email) {
        usuarioText = userRecord.email.split('@')[0]; // usa parte antes del @
        user = { usuario: usuarioText, id: userId };
      }
    }
  } else {
    // Número - buscar por id en empleados
    const { data } = await supabase
      .from('empleados')
      .select('usuario, id')
      .eq('id', userId)
      .single();
    user = data;
  }

  if (!user) throw new Error('Usuario no encontrado');

  const now = new Date();
  // Manual fixed conversion for Guatemala (UTC-6) to ensure stability regardless of server env
  // Create a date object that represents the local time as if it were UTC
  const guateOffset = -6 * 60 * 60 * 1000;
  const guateTime = new Date(now.getTime() + guateOffset);

  // Format as ISO string parts (guateTime is 'shifted' so getUTCHours gives us local hours)
  const nowDate = guateTime.toISOString().split('T')[0];
  const nowTime = guateTime.toISOString().split('T')[1].split('.')[0];

  const coordsText = location ? `${location.latitude},${location.longitude}` : 'N/A';

  const dbEntry: any = {
    usuario: user.usuario,
    fecha: nowDate,
    hora_marcaje: nowTime,
    tipo_actividad: type,
    coordenadas: coordsText
  };

  // Only include proyecto if it's provided
  if (project) {
    // If it's pure numbers, it's an ID
    if (/^\d+$/.test(project)) {
      dbEntry.proyecto_id = parseInt(project, 10);
    } else {
      dbEntry.proyecto = project; // Keep as text if not numeric
    }
  }

  // Crear objeto de entrada para retornar
  const timeEntry: TimeEntry = {
    id: `temp-${Date.now()}`,
    userId: userId,
    type: type,
    timestamp: guatemalaLocalToUtc(nowDate, nowTime),
    location: location,
    projectId: project || undefined,
    projectName: project || undefined
  };

  // Intentar guardar en Supabase
  try {
    console.log('[saveTimeEntry] Attempting to insert:', JSON.stringify(dbEntry));

    const { data, error } = await supabase
      .from('horarios_gps')
      .insert([dbEntry])
      .select()
      .single();

    if (error) {
      console.error('[saveTimeEntry] Database error:', JSON.stringify(error));
      throw error;
    }

    console.log('[saveTimeEntry] Success! Inserted ID:', data?.id);

    // Si tiene éxito, actualizar el ID con el del servidor
    timeEntry.id = String(data.id);
    timeEntry.timestamp = guatemalaLocalToUtc(data.fecha, data.hora_marcaje || '00:00:00');

    // Marcar como sincronizado no aplica en server
    return timeEntry;
  } catch (serverError) {
    console.error('[saveTimeEntry] Server error details:', {
      error: serverError,
      message: serverError instanceof Error ? serverError.message : 'Unknown error',
      code: (serverError as any)?.code,
      details: (serverError as any)?.details
    });

    throw serverError;
  }
}

/**
 * RECONOCIMIENTO FACIAL - Server Actions
 */

export async function saveFacialDescriptor(
  userId: string,
  descriptorJson: string
): Promise<void> {
  try {
    // Detectar si es UUID (usuario en la tabla users en lugar de empleados)
    if (userId.includes('-')) {
      console.log('[FacialAPI] UUID detectado para usuario:', userId);
      const { error } = await supabase.from('users').update({
        facial_descriptor: descriptorJson,
        facial_enrolled_at: new Date().toISOString(),
      }).eq('supabase_id', userId);

      if (error) {
        throw new Error(`Error guardando descriptor en users: ${error.message}`);
      }
      console.log('[FacialAPI] Descriptor guardado para usuario nuevo:', userId);
      return;
    }

    let query = supabase.from('empleados').update({
      facial_descriptor: descriptorJson,
      facial_enrolled_at: new Date().toISOString(),
    });

    // If it's a pure number, query by ID. Otherwise query by username.
    if (/^\d+$/.test(userId)) {
      query = query.eq('id', Number(userId));
    } else {
      query = query.eq('usuario', userId);
    }

    const { error } = await query;

    if (error) {
      throw new Error(`Error guardando descriptor: ${error.message}`);
    }

    console.log('[FacialAPI] Descriptor guardado para usuario:', userId);
  } catch (e) {
    console.error('[FacialAPI] Error en saveFacialDescriptor:', e);
    throw e;
  }
}

export async function getFacialDescriptor(userId: string): Promise<string | null> {
  try {
    // Si el userId parece un UUID (contiene guiones), significa que es supabase_id de un usuario nuevo
    if (userId && userId.includes('-')) {
      console.log(`[FacialAPI] User ${userId} is a UUID, checking new users table`);
      const { data, error } = await supabase.from('users').select('facial_descriptor, facial_enrolled_at').eq('supabase_id', userId).single();
      if (error) {
        console.log(`[FacialAPI] No facial descriptor found in users table for ${userId}`);
        return null;
      }
      return data?.facial_descriptor || null;
    }

    let query = supabase.from('empleados').select('facial_descriptor, facial_enrolled_at');

    // If it's a pure number, query by ID. Otherwise query by username.
    if (/^\d+$/.test(userId)) {
      query = query.eq('id', Number(userId));
    } else {
      query = query.eq('usuario', userId);
    }

    const { data, error } = await query.single();

    if (error) {
      console.log(`[FacialAPI] No facial descriptor found for usuario ${userId}`);
      return null;
    }

    return data?.facial_descriptor || null;
  } catch (e) {
    console.log(`[FacialAPI] Error en getFacialDescriptor: ${e}`);
    return null;
  }
}

export async function saveFinalHours(
  userId: string,
  totalHours: string,
  overtimeHours: string
): Promise<void> {
  console.log('[saveFinalHours] INICIO - userId:', userId, 'type:', typeof userId, 'totalHours:', totalHours, 'overtimeHours:', overtimeHours);

  const formatHoursForDB = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return Number((hours + minutes / 60).toFixed(2));
  };

  try {
    let user;

    if (userId && userId.includes('-')) {
      console.log('[saveFinalHours] Búsqueda por UUID (supabase_id)...');
      const { data } = await supabase.from('empleados').select('id, usuario').eq('supabase_id', userId).single();
      user = data;
    } else if (/^\d+$/.test(userId)) {
      console.log('[saveFinalHours] Búsqueda por ID numérico...');
      const { data } = await supabase.from('empleados').select('id, usuario').eq('id', Number(userId)).single();
      user = data;
    } else {
      console.log('[saveFinalHours] Búsqueda por nombre de usuario...');
      const { data } = await supabase.from('empleados').select('id, usuario').eq('usuario', userId).single();
      user = data;
    }

    if (!user) {
      throw new Error(`Usuario no encontrado después de todas las búsquedas. Buscado: "${userId}" (type: ${typeof userId}).`);
    }

    // Get employee standard hours configuration (optional columns)
    let standardHours = 9;
    let lunchHours = 1;
    try {
      const { data: cfg, error: cfgErr } = await supabase
        .from('empleados')
        .select('horas_estandar, tiempo_almuerzo')
        .eq('id', Number(user.id))
        .single();
      if (!cfgErr && cfg) {
        standardHours = Number(cfg.horas_estandar ?? 9);
        lunchHours = Number(cfg.tiempo_almuerzo ?? 1);
      } else if (cfgErr) {
        console.warn('[saveFinalHours] columnas opcionales no disponibles en empleados:', cfgErr.message);
      }
    } catch (cfgEx) {
      console.warn('[saveFinalHours] excepción leyendo configuración de empleado:', cfgEx);
    }

    // convert string format (HH:MM) to decimal hours for DB
    const totalHoursDecimal = formatHoursForDB(totalHours);
    const overtimeHoursDecimal = formatHoursForDB(overtimeHours);

    // Buscar horas extra aprobadas por el admin en la tabla `horas_extras` para la fecha actual
    const today = formatTz(new Date(), 'yyyy-MM-dd', { timeZone: 'America/Guatemala' });
    let approvedExtrasDecimal = 0;
    try {
      const { data: approvedRows, error: extrasErr } = await supabase
        .from('horas_extras')
        .select('horas')
        .eq('usuario', user.usuario)
        .eq('fecha', today)
        .eq('aceptado', true);

      if (extrasErr) {
        console.warn('[saveFinalHours] No se pudieron obtener horas extras aprobadas:', extrasErr.message);
      } else if (approvedRows && approvedRows.length > 0) {
        // `horas` puede estar guardado como string o número; convertir a decimal
        approvedExtrasDecimal = approvedRows.reduce((acc: number, r: any) => {
          const val = Number(r.horas || 0);
          return acc + (isNaN(val) ? 0 : val);
        }, 0);
      }
    } catch (ex) {
      console.warn('[saveFinalHours] Excepción al consultar horas_extras:', ex);
    }

    const totalOvertimeToSave = Number((overtimeHoursDecimal + approvedExtrasDecimal).toFixed(2));

    console.log('[saveFinalHours] Guardando - usuario:', user.usuario, 'horas:', totalHoursDecimal, 'extras_calculadas:', overtimeHoursDecimal, 'extras_aprobadas:', approvedExtrasDecimal, 'extras_totales:', totalOvertimeToSave);

    const { error } = await supabase
      .from('registro_horas')
      .insert({
        usuario: user.usuario,
        fecha: today,
        horas_trabajadas: totalHoursDecimal,
        horas_extras: totalOvertimeToSave
      });

    if (error) {
      console.error('[saveFinalHours] Error al insertar registro_horas:', error);
      throw new Error('No se pudo guardar el resumen de horas: ' + error.message);
    }

    console.log('[saveFinalHours] ✅ ÉXITO - Resumen guardado para:', user.usuario);
  } catch (e) {
    console.error('[saveFinalHours] ❌ ERROR FINAL:', e);
    throw e;
  }
}

export async function getRegistroHoras(usernameOrId?: string | undefined, supabaseId?: string | undefined, startDate?: string, endDate?: string): Promise<any> {
  const today = format(new Date(), 'yyyy-MM-dd');
  const start = startDate || today;
  const end = endDate || today;

  try {
    console.log(`[getRegistroHoras] Requested by user: ${supabaseId}, for: ${usernameOrId}`);

    // Si no se pasa supabaseId, retornar vacío por seguridad
    if (!supabaseId) {
      console.warn('[getRegistroHoras] ⚠️ No supabaseId provided - retornando array vacío');
      return [];
    }

    // Obtener datos del usuario actual
    const { data: currentUser, error: userError } = await supabase
      .from('empleados')
      .select('id, usuario, rol')
      .eq('supabase_id', supabaseId)
      .single();

    if (userError || !currentUser) {
      console.warn('[getRegistroHoras] Usuario no encontrado');
      return [];
    }

    const userRole = String(currentUser.rol || '').toLowerCase();
    const isAdmin = userRole === 'administrador' || userRole === 'admin';
    const isRRHH = userRole === 'recursos' || userRole === 'rrhh';

    console.log(`[getRegistroHoras] User ${currentUser.usuario} (role: ${userRole})`);

    // 🚨 VALIDACIÓN DE PERMISOS
    let targetUsuario = usernameOrId;

    if (usernameOrId && !isAdmin && !isRRHH && usernameOrId !== currentUser.usuario) {
      console.error(`[getRegistroHoras] ❌ ACCESO DENEGADO: ${currentUser.usuario} intenta ver datos de ${usernameOrId}`);
      throw new Error('No tienes permiso para ver los datos de otro empleado');
    }

    // Si es técnico y no especifica usuario, ver sus propios datos
    if (!usernameOrId && !isAdmin && !isRRHH) {
      targetUsuario = currentUser.usuario;
      console.log('[getRegistroHoras] ⚠️ Técnico - mostrando sus propios registros');
    }

    // Obtener usuario objetivo
    let user: any | null = null;
    if (targetUsuario) {
      const candidate = String(targetUsuario).trim();

      // 1) try exact usuario
      try {
        const resp = await supabase.from('empleados').select('usuario').eq('usuario', candidate).limit(1);
        if (!resp.error && resp.data && resp.data.length > 0) {
          user = resp.data[0];
        }
      } catch (e) {
        // ignore
      }

      // 2) if not found and looks numeric, try id
      const isNumericId = /^\d+$/.test(candidate);
      if (!user && isNumericId) {
        try {
          const resp = await supabase.from('empleados').select('usuario').eq('id', Number(candidate)).limit(1);
          if (!resp.error && resp.data && resp.data.length > 0) user = resp.data[0];
        } catch (e) { /* ignore */ }
      }

      // 3) if still not found, try searching by nombre (ilike)
      if (!user) {
        try {
          const resp = await supabase.from('empleados').select('usuario').ilike('nombre', `%${candidate}%`).limit(1);
          if (!resp.error && resp.data && resp.data.length > 0) user = resp.data[0];
        } catch (e) { /* ignore */ }
      }
    }

    if (!user) {
      console.warn('[getRegistroHoras] Usuario objetivo no encontrado');
      return [];
    }

    console.log('[getRegistroHoras] ✅ Acceso permitido');

    const { data: rows } = await supabase
      .from('registro_horas')
      .select(`
        *,
        empleados (
          nombre
        )
      `)
      .eq('usuario', user.usuario)
      .gte('fecha', start)
      .lte('fecha', end)
      .order('fecha', { ascending: false });

    // Also get GPS logs for that user in the same date range
    const { data: gpsRows } = await supabase
      .from('horarios_gps')
      .select('*')
      .eq('usuario', user.usuario)
      .gte('fecha', start)
      .lte('fecha', end)
      .order('fecha', { ascending: false })
      .order('hora_marcaje', { ascending: true });

    // NEW: Fetch horas_extras to patch the summary for today/missing entries or ensure accuracy
    const { data: rawExtras } = await supabase
      .from('horas_extras')
      .select('*') // include project and ID safely
      .eq('usuario', user.usuario)
      .eq('aceptado', true) // Only approved/accepted? Or all? User said "log shows request but hours 0". Probably wants to see it. 
      // Using accepted=true is safer for "official" reports. 
      // BUT if user wants to see "Solicitud" impact pending approval, we might include all or check status.
      // The screenshot showed "0 HRS" for "Horas extra".
      // I'll stick to 'aceptado' -> true for now as that's "Horas Extra" (Verified).
      // A pending request shouldn't count as hours worked yet properly. 
      // Wait, user screenshot shows "Solicitud Horas Extra" line item.
      // I will assume they want to see it if it's approved. 
      // If they want pending, I'd remove the filter. Let's start with approved to avoiding inflating payroll with unapproved hours.
      .gte('fecha', start)
      .lte('fecha', end);

    // Aggregate extras by date
    const extrasMap: Record<string, number> = {};
    (rawExtras || []).forEach((e: any) => {
      const f = e.fecha;
      extrasMap[f] = (extrasMap[f] || 0) + Number(e.horas || 0);
    });

    const gpsMapped = (gpsRows || []).map((r: any) => {
      // Stored `fecha` and `hora_marcaje` are in America/Guatemala local time (UTC-6).
      // Convert that local Guatemala datetime to an actual UTC Date for correct processing.
      const hora = r.hora_marcaje || '00:00:00';
      const ts = guatemalaLocalToUtc(r.fecha, hora);

      // Format into America/Guatemala (UTC-6) for display (this will match the original stored values)
      const fecha_local = formatTz(ts, 'yyyy-MM-dd', { timeZone: 'America/Guatemala' });
      const hora_local = formatTz(ts, 'HH:mm:ss', { timeZone: 'America/Guatemala' });

      // If the activity represents a return to office, clear the proyecto field to avoid showing stale project names
      const activity = String(r.tipo_actividad || '').toLowerCase();
      const isReturnToOffice = /llegada a oficina|regreso a oficina|regreso/.test(activity);
      const proyectoClean = isReturnToOffice ? '' : (r.proyecto || '');

      return {
        ...r,
        proyecto: proyectoClean,
        timestamp_utc: ts.toISOString(),
        fecha_local,
        hora_local,
      };
    });

    // Compute totals per day: sum of consecutive differences (in minutes) for each fecha
    const totalsByDate: Record<string, { totalMinutes: number; totalHoursDecimal: number; totalHHMM: string }> = {};
    const grouped: Record<string, any[]> = {};
    (gpsRows || []).forEach((r: any) => {
      const key = r.fecha || 'unknown';
      grouped[key] = grouped[key] || [];
      grouped[key].push(r);
    });

    Object.keys(grouped).forEach(dateKey => {
      const items = (grouped[dateKey] || []).map((r: any) => {
        const hora = r.hora_marcaje || '00:00:00';
        return guatemalaLocalToUtc(r.fecha, hora);
      }).sort((a: Date, b: Date) => a.getTime() - b.getTime());

      let totalMin = 0;
      for (let i = 0; i < items.length - 1; i++) {
        try {
          const d = differenceInMinutes(items[i + 1], items[i]);
          if (!isNaN(d) && d > 0) totalMin += d;
        } catch (e) {
          // ignore single bad pair
        }
      }

      const decimal = Number((totalMin / 60).toFixed(2));
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      const hhmm = `${h}:${String(m).padStart(2, '0')}`;
      totalsByDate[dateKey] = { totalMinutes: totalMin, totalHoursDecimal: decimal, totalHHMM: hhmm };
    });



    // Merge extrasMap into rows (registro_horas)
    // 1. Update existing rows
    const finalRows = (rows || []).map((r: any) => {
      const dbExtras = Number(r.horas_extras || 0);
      // We take the MAX of stored vs calculated from table? Or Sum?
      // Usually stored in registro_horas is the final truth. 
      // But if registro_horas is old (e.g. from morning) and new request added afternoon, we might miss it.
      // Let's use the extrasMap if it's greater, or add if distinct?
      // Simplest: If `saveFinalHours` sums them, then `horas_extras` table is the source.
      // Let's Override r.horas_extras with extrasMap[date] if present, assuming extrasMap is authoritative for "requested/approved extras"
      // BUT `registro_horas` might contain "Automatic Overtime" (after 5pm etc) which isn't in `horas_extras` table.
      // So we should probably ADD them if `saveFinalHours` logic separates them.
      // However, `saveFinalHours` stored `overtimeHoursDecimal + approvedExtrasDecimal`.
      // If we confirm `horas_extras` table contains the "Manual" part, and `registro_horas` contains "Total".
      // If the day is today, `registro_horas` might not exist.
      // Strategy:
      // If row exists, use its value (as it should be final). 
      //    EXCEPTION: If for "Today", maybe it's stale. 
      // If row does NOT exist, create one using extrasMap.
      if (extrasMap[r.fecha] !== undefined) {
        // If stored is 0 but we have map, use map.
        // If stored > 0, trust stored.
        if (dbExtras === 0) r.horas_extras = extrasMap[r.fecha];
        delete extrasMap[r.fecha]; // consumed
      }
      return r;
    });

    // 2. Add virtual rows for days with Extras but no Registro
    Object.keys(extrasMap).forEach(date => {
      finalRows.push({
        fecha: date,
        usuario: user.usuario,
        horas_trabajadas: 0,
        horas_extras: extrasMap[date],
        empleados: { nombre: user.nombre || 'Usuario' } // Mock
      });
    });

    // Re-sort finalRows
    finalRows.sort((a: any, b: any) => b.fecha.localeCompare(a.fecha));

    return { registro: finalRows, gps: gpsMapped, totals: totalsByDate, extras: rawExtras || [] };
  } catch (error) {
    console.error('[getRegistroHoras] Error:', error);
    throw error;
  }
}

export async function getTechnicianTodaysEntries(technicianId: string) {
  const today = formatTz(new Date(), 'yyyy-MM-dd', { timeZone: 'America/Guatemala' });

  // Obtener el usuario y su configuración
  let user;
  if (technicianId.includes('-')) {
    const { data } = await supabase.from('empleados').select('usuario').eq('supabase_id', technicianId).single();
    user = data;
    if (!user) {
      const { data: userRecord } = await supabase.from('users').select('email').eq('supabase_id', technicianId).single();
      if (userRecord?.email) user = { usuario: userRecord.email.split('@')[0] };
    }
  } else if (/^\d+$/.test(technicianId)) {
    const { data } = await supabase.from('empleados').select('usuario').eq('id', Number(technicianId)).single();
    user = data;
  }

  if (!user && !technicianId.includes('-')) {
    const { data } = await supabase.from('empleados').select('usuario').eq('usuario', technicianId).single();
    user = data;
  }

  if (!user) {
    console.log(`[getTechnicianTodaysEntries] No se encontró usuario: ${technicianId}, devolviendo array vacío`);
    return [];
  }

  // Obtener entradas del día
  const { data: rows } = await supabase
    .from('horarios_gps')
    .select('*')
    .eq('usuario', user.usuario)
    .eq('fecha', today)
    .order('hora_marcaje', { ascending: true });

  return (rows || []).map(r => ({
    id: String(r.id),
    type: r.tipo_actividad,
    timestamp: guatemalaLocalToUtc(r.fecha, r.hora_marcaje || '00:00:00'),
    location: r.coordenadas && r.coordenadas !== 'N/A' ? (() => {
      const [lat, lng] = String(r.coordenadas).split(',').map(s => parseFloat(s.trim()));
      if (!isNaN(lat) && !isNaN(lng)) return { latitude: lat, longitude: lng };
      return null;
    })() : null,
    userId: technicianId,
    // Clean project info when activity indicates return to office or end of day
    projectId: (/(llegada a oficina|regreso a oficina|regreso|hora de salida|salida de oficina|salida)/i.test(String(r.tipo_actividad || '')) ? undefined : (r.proyecto || undefined)),
    projectName: (/(llegada a oficina|regreso a oficina|regreso|hora de salida|salida de oficina|salida)/i.test(String(r.tipo_actividad || '')) ? undefined : (r.proyecto || undefined)),
    note: r.nota,
    overtimePay: r.pago_horas_extra
  }));
}
