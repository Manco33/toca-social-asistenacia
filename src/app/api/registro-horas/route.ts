import { NextResponse } from 'next/server';
import { getRegistroHoras } from '@/app/actions';

export async function GET(request: Request) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_KEY) {
      throw new Error('Supabase configuration is required');
    }

    const url = new URL(request.url);
    const formatParam = url.searchParams.get('format') || 'json'; // json or csv

    // Support both sets of params (legacy/new)
    const user = url.searchParams.get('user') || undefined;
    const start = url.searchParams.get('from') || url.searchParams.get('start') || undefined;
    const end = url.searchParams.get('to') || url.searchParams.get('end') || undefined;

    const result = await getRegistroHoras(user, start, end);
    // result is { registro, gps, totals } -> for CSV we mainly use result.registro

    if (formatParam === 'csv') {
      // Build CSV
      const header = ['fecha', 'usuario', 'horas_trabajadas', 'horas_extras'];
      // result.registro is the array of summary rows
      const rows = result.registro || [];
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
    }

    // Default: JSON
    return NextResponse.json({ ok: true, registro: result.registro || [], gps: result.gps || [], totals: result.totals || {}, extras: result.extras || [] });

  } catch (e: any) {
    console.error('Error in /api/registro-horas:', e);
    return NextResponse.json({
      ok: false,
      error: process.env.NODE_ENV === 'development' ? String(e) : 'Internal server error'
    }, {
      status: 500
    });
  }
}
