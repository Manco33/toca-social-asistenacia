import { NextResponse } from 'next/server';
import { loginBoco } from '@/app/boco-actions';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const res = await loginBoco(body.identificador || '', body.password || '');
    return NextResponse.json(res);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Error en el servidor al autenticar.' },
      { status: 500 }
    );
  }
}
