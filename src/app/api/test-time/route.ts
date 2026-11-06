import { NextResponse } from 'next/server';
import { format as formatTz } from 'date-fns-tz';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    const now = new Date();
    const guateTime = formatTz(now, 'yyyy-MM-dd HH:mm:ss', { timeZone: 'America/Guatemala' });
    const utcTime = now.toISOString();

    // Fetch last 5 entries from Supabase
    const { data: rows, error } = await supabaseAdmin
        .from('horarios_gps')
        .select('*')
        .order('id', { ascending: false })
        .limit(5);

    return NextResponse.json({
        serverTimeISO: utcTime,
        serverTimeGuateQuery: guateTime,
        environmentIndex: 2, // simple tracking
        dbRows: rows,
        dbError: error
    });
}
