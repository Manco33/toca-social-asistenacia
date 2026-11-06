import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase';
import { format as formatTz } from 'date-fns-tz';
import { calculateTimeStats } from '@/lib/time-calculations';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const from = url.searchParams.get('from') || undefined;
    const to = url.searchParams.get('to') || undefined;

    // Fetch projects
    const { data: projectsRows, error: projectsErr } = await supabase.from('proyectos').select('*').order('id', { ascending: true }).limit(1000);
    if (projectsErr) return NextResponse.json({ ok: false, error: String(projectsErr) }, { status: 500 });

    const projects = (projectsRows || []).map((r: any) => ({
      id: r.id,
      name: r.nombre,
      horas_totales: r.horas_totales ?? null,
      horas_usadas_manual: r.horas_usadas_manual ?? null
    }));

    // Fetch GPS logs in range
    let q = supabase.from('horarios_gps').select('usuario, proyecto, fecha, hora_marcaje, tipo_actividad, proyecto_id').order('fecha', { ascending: true }).order('hora_marcaje', { ascending: true }).limit(50000);
    if (from) q = q.gte('fecha', from as string);
    if (to) q = q.lte('fecha', to as string);

    const { data: gpsRows, error: gpsErr } = await q;
    if (gpsErr) return NextResponse.json({ ok: false, error: String(gpsErr) }, { status: 500 });

    // Fetch approved overtime
    let qExtras = supabase.from('horas_extras').select('*').eq('aceptado', true);
    if (from) qExtras = qExtras.gte('fecha', from);
    if (to) qExtras = qExtras.lte('fecha', to);
    const { data: extrasRows, error: extrasErr } = await qExtras;

    // --- SHARED CALCULATION LOGIC ---

    // Build usage map: projectName -> minutes (regular GPS time)
    const usageMinutesByProject: Record<string, number> = {};
    const usageMinutesByProjectAndUser: Record<string, Record<string, number>> = {};
    const usageMinutesByProjectId: Record<string, number> = {};
    const usageMinutesByProjectIdAndUser: Record<string, Record<string, number>> = {};

    // Overtime minutes by project (approved horas_extras only)
    const overtimeMinutesByProject: Record<string, number> = {};
    const overtimeMinutesByProjectId: Record<string, number> = {};

    // Group entries by usuario
    const byUser: Record<string, any[]> = {};
    (gpsRows || []).forEach((r: any) => {
      const u = String(r.usuario || 'unknown');
      byUser[u] = byUser[u] || [];
      byUser[u].push(r);
    });

    const byUserExtras: Record<string, any[]> = {};
    (extrasRows || []).forEach((r: any) => {
      const u = String(r.usuario || 'unknown');
      byUserExtras[u] = byUserExtras[u] || [];
      byUserExtras[u].push(r);
    });

    const allUsers = new Set([...Object.keys(byUser), ...Object.keys(byUserExtras)]);

    allUsers.forEach(user => {
      const logs = byUser[user] || [];
      const extras = byUserExtras[user] || [];

      // Use Shared Logic
      const { projectBreakdown, projectsById, projectMinutes } = calculateTimeStats(logs, extras);

      // Aggregate by Name
      Object.keys(projectBreakdown).forEach(projName => {
        const mins = projectBreakdown[projName];
        const pKey = projName.toLowerCase();

        usageMinutesByProject[pKey] = (usageMinutesByProject[pKey] || 0) + mins;

        if (!usageMinutesByProjectAndUser[pKey]) usageMinutesByProjectAndUser[pKey] = {};
        usageMinutesByProjectAndUser[pKey][user] = (usageMinutesByProjectAndUser[pKey][user] || 0) + mins;
      });

      // Aggregate by ID
      Object.keys(projectsById).forEach(projId => {
        const mins = projectsById[projId];
        const pKey = String(projId);

        usageMinutesByProjectId[pKey] = (usageMinutesByProjectId[pKey] || 0) + mins;

        if (!usageMinutesByProjectIdAndUser[pKey]) usageMinutesByProjectIdAndUser[pKey] = {};
        usageMinutesByProjectIdAndUser[pKey][user] = (usageMinutesByProjectIdAndUser[pKey][user] || 0) + mins;
      });

      // --- NEW: Process Extras explicitly for Project Attribution ---
      // calculateTimeStats aggregates overtime globally but doesn't break it down by project
      // So we do it here manually for the usage report
      extras.forEach(ex => {
        const pName = String(ex.proyecto || '').trim();
        const pId = ex.proyecto_id;

        let mins = 0;
        if (ex.hora_inicio && ex.hora_fin) {
          const [h1, m1] = String(ex.hora_inicio).split(':').map(Number);
          const [h2, m2] = String(ex.hora_fin).split(':').map(Number);
          let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
          if (diff < 0) diff += 24 * 60;
          mins = diff;
        } else {
          mins = Math.round(Number(ex.horas || 0) * 60);
        }

        if (mins > 0) {
          // Add to By-Name map (contribute to total used)
          if (pName) {
            const key = pName.toLowerCase();
            usageMinutesByProject[key] = (usageMinutesByProject[key] || 0) + mins;
            overtimeMinutesByProject[key] = (overtimeMinutesByProject[key] || 0) + mins;

            if (!usageMinutesByProjectAndUser[key]) usageMinutesByProjectAndUser[key] = {};
            usageMinutesByProjectAndUser[key][user] = (usageMinutesByProjectAndUser[key][user] || 0) + mins;
          }

          // Add to By-ID map
          if (pId) {
            const key = String(pId);
            usageMinutesByProjectId[key] = (usageMinutesByProjectId[key] || 0) + mins;
            overtimeMinutesByProjectId[key] = (overtimeMinutesByProjectId[key] || 0) + mins;

            if (!usageMinutesByProjectIdAndUser[key]) usageMinutesByProjectIdAndUser[key] = {};
            usageMinutesByProjectIdAndUser[key][user] = (usageMinutesByProjectIdAndUser[key][user] || 0) + mins;
          }
        }
      });
    });

    // Map into final structure
    const now = new Date();
    const timestamp = formatTz(now, "yyyy-MM-dd'T'HH:mm:ssXXX", { timeZone: 'America/Guatemala' });

    // Fetch empleados map
    // NOTA: Ahora incluye JOIN con users para obtener información de Supabase Auth
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
        auth_role: e.users?.[0]?.role || null
      };
    });

    const result = (projects || []).map((p: any) => {
      const pNameKey = String(p.name).trim().toLowerCase();

      let usedMin = usageMinutesByProject[pNameKey] || 0;
      let userBreakdown = usageMinutesByProjectAndUser[pNameKey] || {};
      let overtimeMin = overtimeMinutesByProject[pNameKey] || 0;

      // Fallback to ID-based logic if available and meaningful
      if (p.id) {
        const idKey = String(p.id);
        const idMins = usageMinutesByProjectId[idKey] || 0;
        const idBreakdown = usageMinutesByProjectIdAndUser[idKey] || {};
        const idOvertimeMins = overtimeMinutesByProjectId[idKey] || 0;

        // Simple logic: If Name has 0 but ID has something, use ID.
        if (usedMin === 0 && idMins > 0) {
          usedMin = idMins;
          userBreakdown = idBreakdown;
          overtimeMin = idOvertimeMins;
        }
      }

      const computedUsedHours = Number((usedMin / 60).toFixed(2));
      const overtimeHours = Number((overtimeMin / 60).toFixed(2));
      const regularComputedHours = Number(Math.max(0, computedUsedHours - overtimeHours).toFixed(2));
      const manual = p.horas_usadas_manual != null ? Number(p.horas_usadas_manual) : 0;
      const usedHours = Number((computedUsedHours + manual).toFixed(2));
      const total = p.horas_totales != null ? Number(p.horas_totales) : null;
      const remaining = total != null ? Number((total - usedHours).toFixed(2)) : null;
      const overrun = remaining != null ? remaining < 0 : false;

      const technicians = Object.keys(userBreakdown).map(userId => ({
        usuario: userId,
        name: empleadosByUsername[String(userId).toLowerCase()]?.nombre || 'N/A',
        email: empleadosByUsername[String(userId).toLowerCase()]?.email || null,
        auth_role: empleadosByUsername[String(userId).toLowerCase()]?.auth_role || null,
        total_hours: Number((userBreakdown[userId] / 60).toFixed(2)),
        lastActivity: null
      }));

      return {
        id: p.id,
        name: p.name,
        horas_totales: total,
        manual_used_hours: manual,
        computed_used_hours: computedUsedHours,
        overtime_hours: overtimeHours,
        regular_computed_hours: regularComputedHours,
        used_hours: usedHours,
        remaining_hours: remaining,
        overrun: overrun,
        lastUpdated: timestamp,
        technicians
      };
    });

    return NextResponse.json({ ok: true, projects: result });
  } catch (e: any) {
    console.error('/api/projects/usage GET error:', e);
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
