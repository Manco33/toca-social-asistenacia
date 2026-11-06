import { NextResponse } from 'next/server';
import { saveTimeEntry } from '@/app/actions';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const user = url.searchParams.get('user') || 'aquelex';
  const project = url.searchParams.get('project') || 'Prueba Proyecto';

  try {
    // activity 'Llegada a proyecto' for testing
    await saveTimeEntry(user, 'Llegada a proyecto', null, project);
    return NextResponse.json({ ok: true, user, project });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
