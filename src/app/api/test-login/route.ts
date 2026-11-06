import { NextResponse } from 'next/server';
import { authenticate } from '@/app/actions';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, password } = body || {};
    if (!username || !password) return NextResponse.json({ ok: false, message: 'username and password required' }, { status: 400 });
    const user = await authenticate(String(username), String(password));
    // Don't return the password
    return NextResponse.json({ ok: true, user });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err?.message || String(err) }, { status: 401 });
  }
}
