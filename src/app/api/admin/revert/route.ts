import { NextResponse } from 'next/server';
import { getPool } from '@/lib/mysql';
import { format } from 'date-fns';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { technicianId } = body;
    if (!technicianId) return NextResponse.json({ ok: false, error: 'technicianId required' }, { status: 400 });

    const p = getPool();
    const today = format(new Date(), 'yyyy-MM-dd');

    // Resolve technician id -> usuario
    const [rowsu] = await p.query(`SELECT usuario FROM empleados WHERE id = ? OR usuario = ? LIMIT 1`, [technicianId, technicianId]);
    const foundu = (rowsu as any[])[0];
    const usuario = foundu && foundu.usuario ? String(foundu.usuario) : String(technicianId);

    // Fetch today's entries for this user ordered by hora_marcaje desc
    const [rows] = await p.query(`SELECT * FROM horarios_gps WHERE usuario = ? AND fecha = ? ORDER BY hora_marcaje DESC`, [usuario, today]);
    const entries = (rows as any[]);

    if (!entries || entries.length < 2) {
      return NextResponse.json({ ok: false, error: 'Not enough entries to revert' }, { status: 400 });
    }

    // Strategy: Insert a corrective log that re-applies the previous action.
    // We'll insert a new row with tipo_actividad = 'Corrección: <prev.tipo_actividad>' so history is preserved.
    const last = entries[0];
    const prev = entries[1];

    const correctiveTipo = `Corrección: ${prev.tipo_actividad}`;
    const nowTime = format(new Date(), 'HH:mm:ss');
    await p.query(`INSERT INTO horarios_gps (usuario, fecha, tipo_actividad, coordenadas, hora_marcaje, proyecto) VALUES (?, ?, ?, ?, ?, ?)`, [usuario, today, correctiveTipo, last.coordenadas || 'N/A', nowTime, prev.proyecto || '']);

    return NextResponse.json({ ok: true, inserted: true });
  } catch (e) {
    console.error('admin revert error', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
