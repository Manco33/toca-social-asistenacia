import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase';

function formatError(e: any) {
  if (!e) return 'Unknown error';
  return e?.message || (typeof e === 'object' ? JSON.stringify(e) : String(e));
}

// Helper: check which columns exist in `proyectos` (returns a Set of column names)
async function getProjectColumns(): Promise<Set<string>> {
  try {
    const { data, error } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'proyectos')
      .eq('table_schema', 'public');

    if (error || !data) return new Set<string>();
    const cols = new Set<string>((data as any[]).map((r: any) => String(r.column_name)));
    return cols;
  } catch (e) {
    return new Set<string>();
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const search = url.searchParams.get('search') || '';
    const limit = Number(url.searchParams.get('limit') || '50');

    let q = supabase.from('proyectos').select('*').order('id', { ascending: true }).limit(limit);
    if (search) {
      // simple ilike search on nombre and ubicacion
      q = q.ilike('nombre', `%${search}%`);
    }

    const { data: rows, error } = await q;
    if (error) return NextResponse.json({ ok: false, error: formatError(error) }, { status: 500 });

    const projects = (rows || []).map((r: any) => ({
      id: r.id,
      name: r.nombre,
      address: r.ubicacion_del_proyecto,
      contactPerson: r.soluciones,
      horas_totales: r.horas_totales ?? null,
      horas_usadas_manual: r.horas_usadas_manual ?? 0,
      latitud: r.latitud,
      longitud: r.longitud,
      radio: r.radio
    }));
    return NextResponse.json({ ok: true, projects });
  } catch (e: any) {
    console.error('/api/projects GET error:', e);
    return NextResponse.json({ ok: false, error: formatError(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const nombre = (body.nombre || '').trim();
    const ubicacion = (body.ubicacion || '').trim();
    const soluciones = (body.contactPerson || '').trim();
    const id = body.id ? (typeof body.id === 'string' ? body.id.trim() : String(body.id)) : undefined;
    const horas_totales = body.horas_totales != null ? Number(body.horas_totales) : null;

    if (!nombre) return NextResponse.json({ ok: false, error: 'El nombre del proyecto es requerido' }, { status: 400 });

    // check duplicates: same nombre or same name+address
    const { data: existing, error: e2 } = await supabase.from('proyectos').select('*').or(`nombre.eq.${nombre},ubicacion_del_proyecto.eq.${ubicacion}`)
      .limit(1);
    if (e2) return NextResponse.json({ ok: false, error: formatError(e2) }, { status: 500 });
    if (existing && existing.length) return NextResponse.json({ ok: false, exists: true, project: existing[0] }, { status: 409 });

    // Only include optional columns if they exist in the schema
    const cols = await getProjectColumns();
    const insertObj: any = { nombre, ubicacion_del_proyecto: ubicacion, soluciones };
    if (id) insertObj.id = id;
    if (cols.has('horas_totales') && horas_totales != null && !isNaN(horas_totales)) insertObj.horas_totales = horas_totales;
    if (cols.has('horas_usadas_manual') && body.horas_usadas_manual != null && !isNaN(Number(body.horas_usadas_manual))) insertObj.horas_usadas_manual = Number(body.horas_usadas_manual);

    // Geofencing fields
    if (body.latitud !== undefined) insertObj.latitud = body.latitud;
    if (body.longitud !== undefined) insertObj.longitud = body.longitud;
    if (body.radio !== undefined) insertObj.radio = Number(body.radio);

    const { data, error } = await supabase.from('proyectos').insert([insertObj]).select().maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: formatError(error) }, { status: 500 });

    return NextResponse.json({ ok: true, project: data });
  } catch (e: any) {
    console.error('/api/projects POST error:', e);
    return NextResponse.json({ ok: false, error: formatError(e) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const id = body.id;
    const newId = body.newId;
    if (!id) return NextResponse.json({ ok: false, error: 'id requerido' }, { status: 400 });

    console.log('[projects PUT] Recibido:', { id, newId, body });

    // If newId is provided and different from current id, we need to delete and recreate
    if (newId && newId !== id) {
      // Fetch the current project
      const { data: currentProject, error: fetchError } = await supabase.from('proyectos').select('*').eq('id', id).single();
      if (fetchError || !currentProject) return NextResponse.json({ ok: false, error: 'Proyecto no encontrado' }, { status: 404 });

      // Check if new ID already exists
      const { data: existingWithNewId, error: checkError } = await supabase.from('proyectos').select('*').eq('id', newId).single();
      if (!checkError && existingWithNewId) return NextResponse.json({ ok: false, error: `Ya existe un proyecto con ID: ${newId}` }, { status: 409 });

      // Create new project with new ID
      const { data: newProject, error: insertError } = await supabase.from('proyectos').insert([{ ...currentProject, id: newId }]).select().maybeSingle();
      if (insertError) return NextResponse.json({ ok: false, error: `Error creando nuevo proyecto: ${formatError(insertError)}` }, { status: 500 });

      // Delete old project
      const { error: deleteError } = await supabase.from('proyectos').delete().eq('id', id);
      if (deleteError) return NextResponse.json({ ok: false, error: `Error eliminando proyecto anterior: ${formatError(deleteError)}` }, { status: 500 });

      return NextResponse.json({ ok: true, project: newProject });
    }

    const updates: any = {};
    if (body.nombre) updates.nombre = body.nombre;
    if (body.ubicacion) updates.ubicacion_del_proyecto = body.ubicacion;
    if (body.contactPerson) updates.soluciones = body.contactPerson;

    // Only include updates for columns that exist. Some environments may
    // block querying information_schema; if `getProjectColumns()` returns
    // an empty set, assume the common columns exist to avoid silently
    // skipping updates (this was causing horas_* not to be saved).
    const cols = await getProjectColumns();
    console.log('[projects PUT] Columnas disponibles:', Array.from(cols));
    const hasHorasTotales = cols.size === 0 ? true : cols.has('horas_totales');
    const hasHorasUsadas = cols.size === 0 ? true : cols.has('horas_usadas_manual');

    if (hasHorasTotales && body.horas_totales != null && !isNaN(Number(body.horas_totales))) {
      updates.horas_totales = Number(body.horas_totales);
      console.log('[projects PUT] Actualizando horas_totales:', updates.horas_totales);
    }
    if (hasHorasUsadas && body.horas_usadas_manual != null && !isNaN(Number(body.horas_usadas_manual))) {
      updates.horas_usadas_manual = Number(body.horas_usadas_manual);
      console.log('[projects PUT] Actualizando horas_usadas_manual:', updates.horas_usadas_manual);
    }

    // Geofencing fields
    if (body.latitud !== undefined) updates.latitud = body.latitud;
    if (body.longitud !== undefined) updates.longitud = body.longitud;
    if (body.radio !== undefined) updates.radio = Number(body.radio);

    console.log('[projects PUT] Updates finales:', updates);

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: false, error: 'No hay campos para actualizar' }, { status: 400 });
    }

    // Ensure we compare using the correct type: use number when id is numeric
    const idToMatch: any = !isNaN(Number(id)) ? Number(id) : String(id);
    const { data, error } = await supabase.from('proyectos').update(updates).eq('id', idToMatch).select().maybeSingle();
    if (error) {
      console.error('[projects PUT] Error DB:', error);
      return NextResponse.json({ ok: false, error: formatError(error) }, { status: 500 });
    }
    console.log('[projects PUT] Exitoso:', data);
    return NextResponse.json({ ok: true, project: data });
  } catch (e: any) {
    console.error('/api/projects PUT error:', e);
    return NextResponse.json({ ok: false, error: formatError(e) }, { status: 500 });
  }
}
