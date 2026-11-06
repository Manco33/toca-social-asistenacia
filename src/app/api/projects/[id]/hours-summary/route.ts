import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase';
import { differenceInMinutes } from 'date-fns';

function guatemalaLocalToUtc(fecha: string, hora?: string) {
  const [y, m, d] = String(fecha || '').split('-').map(Number);
  const [hh = 0, mm = 0, ss = 0] = String(hora || '00:00:00').split(':').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, (hh || 0) + 6, mm || 0, ss || 0));
}

/**
 * GET /api/projects/[id]/hours-summary
 * 
 * Calcula automáticamente las horas reales trabajadas (desde GPS) para un proyecto
 * y las combina con horas manuales para obtener el total usado.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = Number(id);
    if (isNaN(projectId)) {
      return NextResponse.json({ ok: false, error: 'Invalid project ID' }, { status: 400 });
    }

    // Fetch proyecto
    const { data: project, error: projErr } = await supabase
      .from('proyectos')
      .select('id, nombre, horas_totales, horas_usadas_manual')
      .eq('id', projectId)
      .single();

    if (projErr || !project) {
      return NextResponse.json({ ok: false, error: 'Project not found' }, { status: 404 });
    }

    // Fetch GPS logs para este proyecto
    const { data: gpsRows } = await supabase
      .from('horarios_gps')
      .select('usuario, fecha, hora_marcaje, tipo_actividad')
      .eq('proyecto', project.nombre)
      .limit(50000);

    // Calcular horas reales desde GPS (mismo logic que en /api/projects/usage)
    const byUser: Record<string, any[]> = {};
    (gpsRows || []).forEach((r: any) => {
      const u = String(r.usuario || 'unknown');
      byUser[u] = byUser[u] || [];
      byUser[u].push(r);
    });

    let totalComputedMinutes = 0;
    Object.keys(byUser).forEach(usuario => {
      const items = (byUser[usuario] || [])
        .map((r: any) => ({
          ...r,
          ts: guatemalaLocalToUtc(r.fecha, r.hora_marcaje || '00:00:00')
        }))
        .sort((a: any, b: any) => a.ts.getTime() - b.ts.getTime());

      for (let i = 0; i < items.length - 1; i++) {
        const a = items[i];
        const b = items[i + 1];
        const ta = String(a.tipo_actividad || '').toLowerCase();
        const tb = String(b.tipo_actividad || '').toLowerCase();
        
        // Skip lunch breaks
        if (ta.includes('almuerzo') || tb.includes('almuerzo')) continue;
        
        const mins = differenceInMinutes(b.ts, a.ts);
        if (!isNaN(mins) && mins > 0) {
          totalComputedMinutes += mins;
        }
      }
    });

    const computedUsedHours = Number((totalComputedMinutes / 60).toFixed(2));
    const manualUsedHours = Number(project.horas_usadas_manual || 0);
    const totalUsedHours = Number((computedUsedHours + manualUsedHours).toFixed(2));
    const totalAvailable = Number(project.horas_totales || 0);
    const remainingHours = totalAvailable > 0 ? Number((totalAvailable - totalUsedHours).toFixed(2)) : null;
    const overrun = remainingHours != null && remainingHours < 0;

    return NextResponse.json({
      ok: true,
      project: {
        id: project.id,
        nombre: project.nombre,
        horas_totales: totalAvailable,
        horas_computadas_gps: computedUsedHours,
        horas_usadas_manual: manualUsedHours,
        horas_usadas_total: totalUsedHours,
        horas_restantes: remainingHours,
        sobregiro: overrun
      }
    });
  } catch (e: any) {
    console.error('[projects/[id]/hours-summary] error:', e);
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
