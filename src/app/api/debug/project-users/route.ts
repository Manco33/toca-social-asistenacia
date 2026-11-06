import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const projectName = url.searchParams.get('name') || 'CMI INA';

    console.log('[debug/project-users] Buscando proyecto:', projectName);

    // Fetch GPS logs
    const { data: gpsRows } = await supabase
      .from('horarios_gps')
      .select('usuario, proyecto, fecha, hora_marcaje')
      .eq('proyecto', projectName)
      .limit(10);

    console.log('[debug/project-users] GPS rows encontrados:', gpsRows?.length, gpsRows?.slice(0, 3));

    // Get unique usuarios
    const usuarios = [...new Set((gpsRows || []).map(r => r.usuario))];
    console.log('[debug/project-users] Usuarios únicos:', usuarios);

    // Fetch empleados - ALL, not just 5
    const { data: empleados } = await supabase.from('empleados').select('*');
    console.log('[debug/project-users] Empleados totales:', empleados?.length);
    console.log('[debug/project-users] Todos los usuarios en empleados:', empleados?.map(e => ({ id: e.id, usuario: e.usuario, nombre: e.nombre })));

    // Build maps by different possible fields
    const mapByEmail: Record<string, string> = {};
    const mapById: Record<string, string> = {};
    const mapByUsername: Record<string, string> = {};
    
    (empleados || []).forEach((e: any) => {
      if (e.id) mapById[String(e.id)] = e.name || e.nombre || '';
      if (e.email) mapByEmail[String(e.email).toLowerCase()] = e.name || e.nombre || '';
      if (e.username) mapByUsername[String(e.username).toLowerCase()] = e.name || e.nombre || '';
    });

    console.log('[debug/project-users] Mapeos construidos:', { mapById, mapByEmail, mapByUsername });

    // Try lookups with all possible maps
    const lookups = usuarios.map(u => ({
      usuario_raw: u,
      found_by_id: mapById[String(u)] || 'NOT FOUND',
      found_by_email: mapByEmail[String(u).toLowerCase()] || 'NOT FOUND',
      found_by_username: mapByUsername[String(u).toLowerCase()] || 'NOT FOUND',
    }));

    return NextResponse.json({
      project: projectName,
      usuarios,
      lookups,
      empleados_sample: empleados,
    });
  } catch (e: any) {
    console.error('[debug/project-users] error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
