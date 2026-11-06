import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase';
import { format as formatTz } from 'date-fns-tz';
import { differenceInMinutes } from 'date-fns';

function guatemalaLocalToUtc(fecha: string, hora?: string) {
  const [y, m, d] = String(fecha || '').split('-').map(Number);
  const [hh = 0, mm = 0, ss = 0] = String(hora || '00:00:00').split(':').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, (hh || 0) + 6, mm || 0, ss || 0));
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const projectName = url.searchParams.get('name') || url.searchParams.get('project') || undefined;
    if (!projectName) return NextResponse.json({ ok: false, error: 'project name required' }, { status: 400 });

    // fetch GPS logs for that project
    const { data: rows, error } = await supabase
      .from('horarios_gps')
      .select('usuario, fecha, hora_marcaje, tipo_actividad')
      .eq('proyecto', projectName)
      .order('fecha', { ascending: true })
      .order('hora_marcaje', { ascending: true })
      .limit(50000);

    if (error) return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });

    // Fetch approved overtime for this project
    const { data: extrasRows } = await supabase
      .from('horas_extras')
      .select('usuario, horas')
      .eq('proyecto', projectName) // Note: Case sensitive match implies project naming must be consistent
      .eq('aceptado', true);

    const extrasByUser: Record<string, number> = {};
    (extrasRows || []).forEach((e: any) => {
      const u = String(e.usuario || '').trim();
      if (u) {
        extrasByUser[u] = (extrasByUser[u] || 0) + Number(e.horas || 0);
      }
    });

    // Fetch empleados to map usuario (username) -> nombre
    // NOTA: Ahora incluye JOIN con users para obtener rols y emails de Supabase Auth
    const { data: empleadosRows } = await supabase
      .from('empleados')
      .select(`
        usuario,
        nombre,
        supabase_id,
        users:supabase_id (
          email,
          role,
          status
        )
      `);
    
    const empleadosByUsername: Record<string, any> = {};
    (empleadosRows || []).forEach((e: any) => {
      empleadosByUsername[String(e.usuario).toLowerCase()] = {
        nombre: String(e.nombre || 'N/A'),
        email: e.users?.[0]?.email || null,
        auth_role: e.users?.[0]?.role || null,
        auth_status: e.users?.[0]?.status || null
      };
    });

    // group by usuario and compute total minutes and last activity
    const byUser: Record<string, any[]> = {};
    (rows || []).forEach((r: any) => {
      const u = String(r.usuario || 'unknown');
      byUser[u] = byUser[u] || [];
      byUser[u].push(r);
    });

    const usersSummary: Array<any> = [];

    // Combine users from GPS and Overtime
    const allUsers = new Set([...Object.keys(byUser), ...Object.keys(extrasByUser)]);

    for (const usuario of Array.from(allUsers)) {
      const items = (byUser[usuario] || []).map((r: any) => ({ ...r, ts: guatemalaLocalToUtc(r.fecha, r.hora_marcaje || '00:00:00') })).sort((a: any, b: any) => a.ts.getTime() - b.ts.getTime());

      let totalMin = 0;
      let lastActivity: string | null = null;
      for (let i = 0; i < items.length - 1; i++) {
        const a = items[i];
        const b = items[i + 1];
        const ta = String(a.tipo_actividad || '').toLowerCase();
        const tb = String(b.tipo_actividad || '').toLowerCase();
        if (ta.includes('almuerzo') || tb.includes('almuerzo')) continue;
        const mins = differenceInMinutes(b.ts, a.ts);
        if (!isNaN(mins) && mins > 0) totalMin += mins;
      }
      if (items.length) lastActivity = items[items.length - 1].ts.toISOString();

      // Add Overtime Hours
      const extraHours = extrasByUser[usuario] || 0;
      const extraMinutes = Math.round(extraHours * 60);
      totalMin += extraMinutes;

      usersSummary.push({
        usuario,
        name: empleadosByUsername[String(usuario).toLowerCase()]?.nombre || 'N/A',
        email: empleadosByUsername[String(usuario).toLowerCase()]?.email || null,
        auth_role: empleadosByUsername[String(usuario).toLowerCase()]?.auth_role || null,
        total_hours: Number((totalMin / 60).toFixed(2)),
        total_minutes: totalMin,
        lastActivity
      });
    }

    return NextResponse.json({ ok: true, project: projectName, details: usersSummary, technicians: usersSummary });
  } catch (e: any) {
    console.error('/api/projects/details error:', e);
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
