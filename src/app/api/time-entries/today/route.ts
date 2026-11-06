import { NextResponse } from 'next/server';
import { getTodaysEntries } from '@/app/actions';

export async function GET() {
  try {
    const entries = await getTodaysEntries();
    return NextResponse.json({ ok: true, entries });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
