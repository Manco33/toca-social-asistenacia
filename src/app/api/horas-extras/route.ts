import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { format as formatTz } from 'date-fns-tz';

// GET: lista solicitudes (pendientes, aceptadas, negadas)
export async function GET(req: NextRequest) {
  try {
    const supabase = supabaseAdmin;
    const { searchParams } = new URL(req.url);
    const estado = searchParams.get('estado'); // 'pendiente', 'aceptado', 'negado', o null
    const usuario = searchParams.get('usuario'); // filtrar por usuario si se proporciona

    let query = supabase.from('horas_extras').select('*').order('fecha', { ascending: false });

    if (usuario) {
      query = query.eq('usuario', usuario);
    }
    if (estado === 'pendiente') query = query.is('aceptado', null);
    if (estado === 'aceptado') query = query.eq('aceptado', true);
    if (estado === 'negado') query = query.eq('aceptado', false);

    const { data, error } = await query;
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    return Response.json({ ok: true, solicitudes: data });
  } catch (e: any) {
    console.error('API horas-extras GET error:', e);
    return Response.json({ ok: false, error: e.message || 'Internal Server Error' }, { status: 500 });
  }
}

// POST: crear solicitud
export async function POST(req: NextRequest) {
  const supabase = supabaseAdmin;
  const body = await req.json();
  console.log('[API horas-extras] POST body:', JSON.stringify(body));

  const { usuario, fecha, motivo, latitud, longitud, hora_inicio, hora_fin, proyecto_id, proyecto } = body;

  // Validate required fields
  if (!usuario || !fecha || !motivo || !hora_inicio || !hora_fin) {
    return Response.json({ ok: false, error: 'Faltan datos obligatorios (Hora inicio/fin, motivo)' }, { status: 400 });
  }

  // Calculate duration (horas)
  let horas = 0;
  try {
    const start = new Date(`1970-01-01T${hora_inicio}:00`);
    const end = new Date(`1970-01-01T${hora_fin}:00`);
    const diffMs = end.getTime() - start.getTime();
    if (diffMs > 0) {
      horas = Number((diffMs / (1000 * 60 * 60)).toFixed(2));
    } else {
      return Response.json({ ok: false, error: 'La hora fin debe ser mayor a la hora inicio.' }, { status: 400 });
    }
  } catch (e) {
    return Response.json({ ok: false, error: 'Formato de hora inválido.' }, { status: 400 });
  }

  // Build nota for horas_extras
  const providedTareas = (body as any).tareas || (body as any).nota || null;
  const notaForHorasExtras = providedTareas ? String(providedTareas) : null;

  // Insert into horas_extras
  const { data, error } = await supabase.from('horas_extras').insert({
    usuario,
    fecha,
    horas,
    motivo,
    nota: notaForHorasExtras,
    hora_inicio,
    hora_fin,
    proyecto_id,
    proyecto: proyecto || ''
  }).select();

  if (error) {
    console.error('[API horas-extras] Insert horas_extras error:', error.message);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
  console.log('[API horas-extras] Insert horas_extras result:', JSON.stringify(data));

  // Insert into horarios_gps log
  let auditWritten = false;
  let auditError: string | null = null;
  try {
    const insertedId = data?.[0]?.id;
    const notaParts = [
      'Solicitud Horas Extra',
      'Estado: Esperando respuesta',
      `overtime_request_id:${insertedId}`,
      `Horario: ${hora_inicio} - ${hora_fin}`,
      `Motivo: ${motivo}`
    ];
    if (providedTareas) notaParts.push(`Tareas: ${providedTareas}`);
    const nota = notaParts.join(' | ');
    const now = new Date();
    const hora_marcaje = formatTz(now, 'HH:mm:ss', { timeZone: 'America/Guatemala' });

    await supabase.from('horarios_gps').insert({
      usuario,
      fecha,
      hora_marcaje,
      tipo_actividad: 'Solicitud Horas Extra',
      coordenadas: latitud && longitud ? `${latitud},${longitud}` : 'N/A',
      proyecto: proyecto || '', // Use project name for log
      nota
    });
    auditWritten = true;
  } catch (e: any) {
    auditError = e?.message || String(e);
    console.error('[API horas-extras] Insert horarios_gps exception:', auditError);
  }

  return Response.json({ ok: true, solicitud: data?.[0], auditWritten, auditError });
}

// PUT: actualizar estado (aceptado/negado)
export async function PUT(req: NextRequest) {
  const supabase = supabaseAdmin;
  const body = await req.json();
  const { id, aceptado } = body;
  if (!id || typeof aceptado !== 'boolean') return Response.json({ ok: false, error: 'Faltan datos' }, { status: 400 });
  // Fetch existing row to compute/update nota
  const { data: existingRow, error: fetchErr } = await supabase.from('horas_extras').select('*').eq('id', id).single();
  if (fetchErr) return Response.json({ ok: false, error: fetchErr.message }, { status: 500 });

  // Compute nueva nota for horas_extras: prefer existing nota and append estado
  const estadoTxt = aceptado ? 'Aceptado' : 'Negado';
  let nuevaNotaHorasExtras = existingRow?.nota ? String(existingRow.nota) : null;
  if (nuevaNotaHorasExtras) {
    if (/Estado:\s*Esperando respuesta/i.test(nuevaNotaHorasExtras)) {
      nuevaNotaHorasExtras = nuevaNotaHorasExtras.replace(/Estado:\s*Esperando respuesta/i, `Estado: ${estadoTxt}`);
    } else if (!/Estado:/i.test(nuevaNotaHorasExtras)) {
      nuevaNotaHorasExtras = `${nuevaNotaHorasExtras} | Estado: ${estadoTxt}`;
    } else {
      // replace any existing Estado: ... with new value
      nuevaNotaHorasExtras = nuevaNotaHorasExtras.replace(/Estado:\s*[^|]+/i, `Estado: ${estadoTxt}`);
    }
  } else {
    // Build a nota from motivo + estado
    const motivoTxt = existingRow?.motivo ? `Motivo: ${existingRow.motivo}` : '';
    nuevaNotaHorasExtras = `Estado: ${estadoTxt}` + (motivoTxt ? ` | ${motivoTxt}` : '');
  }

  const { data, error } = await supabase.from('horas_extras').update({ aceptado, nota: nuevaNotaHorasExtras }).eq('id', id).select();
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  // Actualizar nota en horarios_gps
  try {
    const { data: logs } = await supabase.from('horarios_gps').select('*').eq('tipo_actividad', 'Solicitud Horas Extra').eq('usuario', data?.[0]?.usuario).eq('fecha', data?.[0]?.fecha);
    if (logs && logs.length > 0) {
      for (const log of logs) {
        const nuevaNota = (log.nota || '').replace('Esperando respuesta', estadoTxt);
        await supabase.from('horarios_gps').update({ nota: nuevaNota }).eq('id', log.id);
      }
    }
  } catch (e) { }

  return Response.json({ ok: true, solicitud: data?.[0] });
}
