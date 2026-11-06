import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase';

/**
 * PUT /api/projects/[id]/hours
 * 
 * Actualiza horas totales y horas usadas manualmente de un proyecto.
 * 
 * Body:
 * {
 *   horas_totales: number (limit del proyecto),
 *   horas_usadas_manual: number (override manual de horas gastadas),
 *   change_reason: string (por qué se hace este cambio)
 * }
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = Number(id);
    if (isNaN(projectId)) {
      return NextResponse.json({ ok: false, error: 'Invalid project ID' }, { status: 400 });
    }

    const body = await request.json();
    const { horas_totales, horas_usadas_manual, change_reason } = body;

    // Validar que al menos uno de los valores sea válido
    if (
      (horas_totales === undefined || horas_totales === null) &&
      (horas_usadas_manual === undefined || horas_usadas_manual === null)
    ) {
      return NextResponse.json(
        { ok: false, error: 'Must provide horas_totales or horas_usadas_manual' },
        { status: 400 }
      );
    }

    // Convertir a números
    const newTotalHours = horas_totales !== undefined ? Number(horas_totales) : undefined;
    const newManualHours = horas_usadas_manual !== undefined ? Number(horas_usadas_manual) : undefined;

    // Validar que sean números positivos
    if (newTotalHours !== undefined && (isNaN(newTotalHours) || newTotalHours < 0)) {
      return NextResponse.json({ ok: false, error: 'horas_totales must be a positive number' }, { status: 400 });
    }
    if (newManualHours !== undefined && (isNaN(newManualHours) || newManualHours < 0)) {
      return NextResponse.json({ ok: false, error: 'horas_usadas_manual must be a positive number' }, { status: 400 });
    }

    // Fetch proyecto actual
    const { data: projectRow, error: fetchErr } = await supabase
      .from('proyectos')
      .select('*')
      .eq('id', projectId)
      .single();

    if (fetchErr || !projectRow) {
      return NextResponse.json({ ok: false, error: 'Project not found' }, { status: 404 });
    }

    // Preparar update
    const updateData: any = {};
    if (newTotalHours !== undefined) updateData.horas_totales = newTotalHours;
    if (newManualHours !== undefined) updateData.horas_usadas_manual = newManualHours;

    // Update proyecto
    const { data: updated, error: updateErr } = await supabase
      .from('proyectos')
      .update(updateData)
      .eq('id', projectId)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ ok: false, error: String(updateErr) }, { status: 500 });
    }

    // Log el cambio
    const { error: logErr } = await supabase.from('proyecto_horas_log').insert({
      proyecto_id: projectId,
      proyecto_nombre: projectRow.nombre,
      horas_totales_anterior: projectRow.horas_totales,
      horas_totales_nuevo: newTotalHours !== undefined ? newTotalHours : projectRow.horas_totales,
      horas_usadas_manual_anterior: projectRow.horas_usadas_manual,
      horas_usadas_manual_nuevo: newManualHours !== undefined ? newManualHours : projectRow.horas_usadas_manual,
      changed_by: 'admin', // TODO: get from auth token
      change_reason: change_reason || 'Manual update',
    });

    if (logErr) {
      console.warn('[projects/hours] Warning logging change:', logErr);
      // No falles si el log falla, es solo auditoría
    }

    return NextResponse.json({ ok: true, project: updated });
  } catch (e: any) {
    console.error('[projects/[id]/hours] error:', e);
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
