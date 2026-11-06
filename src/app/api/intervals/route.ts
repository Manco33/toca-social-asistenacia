import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase';
import { differenceInMinutes } from 'date-fns';
import { format as formatTz } from 'date-fns-tz';

// Helper to convert Guatemala local date+time (strings) into a UTC Date
function guatemalaLocalToUtc(fecha: string, hora?: string) {
  const [y, m, d] = String(fecha || '').split('-').map(Number);
  const [hh = 0, mm = 0, ss = 0] = String(hora || '00:00:00').split(':').map(Number);
  return new Date(Date.UTC(y || 1970, (m || 1) - 1, d || 1, (hh || 0) + 6, mm || 0, ss || 0));
}

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const user = url.searchParams.get('user') || undefined;
    const from = url.searchParams.get('from') || undefined;
    const to = url.searchParams.get('to') || undefined;

    let q = supabase.from('horarios_gps').select('*');
    if (user) q = q.eq('usuario', user);
    if (from) q = q.gte('fecha', from);
    if (to) q = q.lte('fecha', to);
    q = q.order('fecha', { ascending: true }).order('hora_marcaje', { ascending: true });

    const { data: rows, error } = await q;
    if (error) throw error;

    const gps = (rows || []) as any[];

    const intervals: any[] = [];
    const used = new Set<number>();

    // Activity regexes
    const reSalida = /\bsalida\b|salida de oficina|hora de salida|salir|salida oficina/i;
    const reLlegadaOffice = /llegada a oficina|regreso a oficina|llegada oficina|entrada oficina/i;
    const reLlegadaProject = /llegada a proyecto|llegada al proyecto|llegada a sitio|entrada a proyecto/i;
    const reSalidaProject = /salida de proyecto|salida del proyecto|salida proyecto|salida a proyecto/i;
    const reHoraSalida = /hora de salida|fin de jornada|fin jornada|termino de jornada/i;

    const toTs = (row: any) => guatemalaLocalToUtc(row.fecha, row.hora_marcaje || '00:00:00');

    // Build consecutive pairs (i -> i+1) and classify according to requested flows.
    for (let i = 0; i < gps.length - 1; i++) {
      const a = gps[i];
      const b = gps[i + 1];
      const actA = String(a.tipo_actividad || '').toLowerCase();
      const actB = String(b.tipo_actividad || '').toLowerCase();

      const startTs = toTs(a);
      const endTs = toTs(b);
      const mins = differenceInMinutes(endTs, startTs);
      if (isNaN(mins) || mins < 0) continue;

      let flow: string | null = null;

      if (reLlegadaOffice.test(actA) && reSalida.test(actB)) {
        flow = 'arrivalOffice->departureOffice';
      } else if (reSalida.test(actA) && (reLlegadaProject.test(actB) || (b.proyecto && String(b.proyecto).trim() !== ''))) {
        flow = 'office->project';
      } else if ((reLlegadaProject.test(actA) || (a.proyecto && String(a.proyecto).trim() !== '')) && (reSalidaProject.test(actB) || reSalida.test(actB))) {
        flow = 'projectSession';
      } else if (reSalidaProject.test(actA) && reLlegadaOffice.test(actB)) {
        flow = 'project->office';
      } else if (reLlegadaOffice.test(actA) && reHoraSalida.test(actB)) {
        flow = 'arrivalOffice->endOfDay';
      } else {
        // generic consecutive pair
        flow = 'consecutive';
      }

      intervals.push({
        user: a.usuario,
        date: a.fecha,
        flow,
        start_fecha: a.fecha,
        start_hora: a.hora_marcaje,
        start_ts: startTs.toISOString(),
        start_local: formatTz(startTs, 'yyyy-MM-dd HH:mm:ss', { timeZone: 'America/Guatemala' }),
        start_tipo: a.tipo_actividad,
        start_coords: a.coordenadas || null,
        end_fecha: b.fecha,
        end_hora: b.hora_marcaje,
        end_ts: endTs.toISOString(),
        end_local: formatTz(endTs, 'yyyy-MM-dd HH:mm:ss', { timeZone: 'America/Guatemala' }),
        end_tipo: b.tipo_actividad,
        end_coords: b.coordenadas || null,
        project: b.proyecto || a.proyecto || null,
        minutes: mins,
        hhmm: formatDuration(mins),
      });
    }

    return NextResponse.json({ ok: true, intervals });
  } catch (e: any) {
    console.error('/api/intervals error', e);
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}

