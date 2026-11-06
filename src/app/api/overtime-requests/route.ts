import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Table: overtime_requests (id, user_id, user_name, requested_at, status, reason, reviewed_by, reviewed_at, response)
// status: 'pending' | 'approved' | 'rejected'

export async function GET(req: NextRequest) {
  const supabase = supabaseAdmin;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  let query = supabase.from('overtime_requests').select('*').order('requested_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, requests: data });
}

export async function POST(req: NextRequest) {
  const supabase = supabaseAdmin;
  const body = await req.json();
  const { user_id, user_name, reason, estimated_hours, tasks, latitude, longitude } = body;
  if (!user_id || !user_name) return Response.json({ ok: false, error: 'Faltan datos' }, { status: 400 });

  // sanitize/normalize types
  const userIdNum = Number(user_id);
  const estHoursNum = typeof estimated_hours !== 'undefined' && estimated_hours !== null ? Number(estimated_hours) : null;

  // Insert the overtime request
  const insertObj: any = {
    user_id: userIdNum || user_id,
    user_name,
    reason: reason || '',
    status: 'pending',
    requested_at: new Date().toISOString(),
  };

  // include optional fields if provided (DB may or may not have these columns)
  if (estHoursNum !== null && !Number.isNaN(estHoursNum)) insertObj.estimated_hours = estHoursNum;
  if (typeof tasks !== 'undefined') insertObj.tasks = tasks;

  const { data, error } = await supabase.from('overtime_requests').insert(insertObj).select();
  if (error) {
    console.error('[Overtime API] insert error:', error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
  // Attempt to write an audit log into horarios_gps with timestamp and coordinates
  // We require both inserts to succeed. If the audit insert fails, remove the overtime_requests row to keep consistency.
  let auditWritten = false;
  let auditErrorMsg: string | null = null;
  let auditData: any = null;
  let auditErr: any = null;
  try {
    // Resolve usuario (username) from empleados by id if possible
    // NOTA: Ahora incluye JOIN con users para obtener información de Supabase Auth
    let usuario = user_name;
    try {
      const emp = await supabase
        .from('empleados')
        .select(`
          usuario,
          supabase_id,
          users:supabase_id (
            email,
            role,
            status
          )
        `)
        .eq('id', userIdNum || user_id)
        .single();
      
      if (!emp.error && emp.data && emp.data.usuario) {
        usuario = emp.data.usuario;
      }
    } catch (e) {
      // ignore
    }

    const now = new Date();
    // Use Guatemala local date/time similar to other parts of the app
    const { format: formatDateFns } = await import('date-fns');
    const { format: formatTz } = await import('date-fns-tz');
    const fecha = formatTz(now, 'yyyy-MM-dd', { timeZone: 'America/Guatemala' });
    const hora_marcaje = formatTz(now, 'HH:mm:ss', { timeZone: 'America/Guatemala' });

    const coordsText = (typeof latitude === 'number' && typeof longitude === 'number') ? `${latitude},${longitude}` : 'N/A';
    const createdId = data?.[0]?.id;
    const notaParts = [];
    notaParts.push(`overtime_request_id:${createdId}`);
    notaParts.push(`Estado: pending`);
    if (reason) notaParts.push(`Motivo: ${reason}`);
    if (estimated_hours) notaParts.push(`Horas estimadas: ${estimated_hours}`);
    if (tasks) notaParts.push(`Tareas: ${tasks}`);
    const nota = notaParts.join(' | ');

    const auditResp = await supabase.from('horarios_gps').insert([{ usuario, fecha, hora_marcaje, tipo_actividad: 'Solicitud Horas Extra', coordenadas: coordsText, proyecto: '', nota }]).select();
    auditData = auditResp.data;
    auditErr = auditResp.error;
    if (auditErr) {
      auditErrorMsg = auditErr.message;
      console.error('[Overtime API] failed to write audit log:', auditErr);
    } else if (!auditData || auditData.length === 0) {
      auditErrorMsg = 'Unknown error writing audit row';
      console.error('[Overtime API] audit insert returned no rows');
    } else {
      auditWritten = true;
    }
  } catch (logErr) {
    auditErrorMsg = String(logErr);
    console.error('[Overtime API] failed to write audit log:', logErr);
  }
  // If audit was not written, keep the overtime_requests row but report audit failure to the client.
  // This allows admins to see the created request even if the audit insert failed (e.g., missing service key or RLS).
  if (!auditWritten) {
    console.warn('[Overtime API] audit row was not written, but overtime_requests was created. auditError:', auditErrorMsg);
    return Response.json({ ok: true, request: data?.[0], auditWritten: false, auditError: auditErrorMsg });
  }

  // Return both created overtime request and the audit row id for reference
  const auditRowId = (auditData && auditData[0] && auditData[0].id) ? auditData[0].id : null;
  return Response.json({ ok: true, request: data?.[0], auditWritten: true, auditRowId });
}

export async function PUT(req: NextRequest) {
  const supabase = supabaseAdmin;
  const body = await req.json();
  const { id, status, reviewed_by, response } = body;
  if (!id || !status || !reviewed_by) return Response.json({ ok: false, error: 'Faltan datos' }, { status: 400 });
  const { data, error } = await supabase.from('overtime_requests').update({
    status,
    reviewed_by,
    reviewed_at: new Date().toISOString(),
    response: response || '',
  }).eq('id', id).select();
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  // Also update the corresponding horarios_gps audit row(s) that reference this overtime_request
  try {
    // Find rows where nota contains the overtime_request id marker
    const marker = `overtime_request_id:${id}`;
    // Append reviewer and status to the nota and set pago_horas_extra when approved
    const { data: existing, error: selErr } = await supabase.from('horarios_gps').select('*').ilike('nota', `%${marker}%`);
    if (!selErr && existing && existing.length > 0) {
      for (const row of existing) {
        const originalNota = row.nota || '';
        const updatedParts = [originalNota, `Decision: ${status}`, `RevisadoPor: ${reviewed_by}`];
        if (response) updatedParts.push(`ComentarioAdmin: ${response}`);
        const newNota = updatedParts.join(' | ');
        const updates: any = { nota: newNota };
        if (status === 'approved') updates.pago_horas_extra = true;
        else updates.pago_horas_extra = false;
        await supabase.from('horarios_gps').update(updates).eq('id', row.id);
      }
    }
    // If no audit rows were found, optionally create one so the technician sees the log in horarios_gps
    if (!selErr && (!existing || existing.length === 0)) {
      try {
        // Create a new audit row reflecting the admin decision
        const now = new Date();
        const { format: formatTz } = await import('date-fns-tz');
        const fecha = formatTz(now, 'yyyy-MM-dd', { timeZone: 'America/Guatemala' });
        const hora_marcaje = formatTz(now, 'HH:mm:ss', { timeZone: 'America/Guatemala' });
        const markerNota = `overtime_request_id:${id} | Estado: ${status} | RevisadoPor: ${reviewed_by}` + (response ? ` | ComentarioAdmin: ${response}` : '');
        const pago = status === 'approved';
        await supabase.from('horarios_gps').insert([{ usuario: reviewed_by, fecha, hora_marcaje, tipo_actividad: 'Solicitud Horas Extra', coordenadas: 'N/A', proyecto: '', nota: markerNota, pago_horas_extra: pago }]);
      } catch (createErr) {
        console.error('[Overtime API] failed to create audit row after review:', createErr);
      }
    }
  } catch (e) {
    console.error('[Overtime API] failed to update audit rows on review:', e);
  }

  return Response.json({ ok: true, request: data?.[0] });
}
