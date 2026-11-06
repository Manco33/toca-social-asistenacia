import { NextResponse } from 'next/server';
import { saveTimeEntry } from '@/app/actions';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username } = body || {};
    if (!username) return NextResponse.json({ ok: false, message: 'username required' }, { status: 400 });
    await saveTimeEntry(String(username), 'Llegada a oficina', null, '');
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err?.message || String(err) }, { status: 500 });
  }
}
