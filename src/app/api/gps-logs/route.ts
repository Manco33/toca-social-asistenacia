import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase';

// Helper to get formatted date string for today if not provided
function getTodayDate() {
    const now = new Date();
    return now.toISOString().split('T')[0];
}

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const user = url.searchParams.get('user');
        const date = url.searchParams.get('date') || getTodayDate();

        if (!user) {
            return NextResponse.json({ ok: false, error: 'User is required' }, { status: 400 });
        }

        // Fetch logs from horarios_gps
        let q = supabase
            .from('horarios_gps')
            .select('*')
            .eq('usuario', user) // Filter by user email/username
            .eq('fecha', date)    // Filter by date
            .order('hora_marcaje', { ascending: true });

        const { data, error } = await q;

        if (error) {
            return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
        }

        // Fetch approved overtime
        const { data: extras, error: extrasError } = await supabase
            .from('horas_extras')
            .select('*')
            .eq('usuario', user)
            .eq('fecha', date)
            .eq('aceptado', true);

        return NextResponse.json({ ok: true, logs: data || [], extras: extras || [] });

    } catch (e: any) {
        return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
    }
}
