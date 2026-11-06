import { NextResponse } from 'next/server';
import { getRegistroHoras } from '@/app/actions';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const user = url.searchParams.get('user') || undefined;
    const start = url.searchParams.get('start') || undefined;
    const end = url.searchParams.get('end') || undefined;

    const result = await getRegistroHoras(user, start, end);
    const rows = result && result.registro ? result.registro : [];

    // Build CSV
    const header = ['fecha', 'usuario', 'horas_trabajadas', 'horas_extras'];
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push([r.fecha, (r.usuario || r.empleados?.nombre || ''), (r.horas_trabajadas || ''), (r.horas_extras || '')].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    }

    const csv = lines.join('\n');

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="registro_horas.csv"`
      }
    });
  } catch (e: any) {
    return new NextResponse(JSON.stringify({ ok: false, error: e.message || String(e) }), { status: 500 });
  }
}
