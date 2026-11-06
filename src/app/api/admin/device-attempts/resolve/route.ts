// This endpoint was added in a recent change but the project requested a rollback.
// Returning 410 to indicate the endpoint is intentionally removed.
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ ok: false, error: 'Endpoint removed in rollback' }, { status: 410 });
}
