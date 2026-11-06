import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const log = [];

        // 1. Check existing columns using information_schema
        // Note: In Supabase/Postgres, we can simply execute DDL via RPC if enabled, 
        // or more typically, we rely on the SQL Editor. 
        // However, if we want to do it via code using the JS client, we usually can't execute raw SQL 
        // unless we have a specific RPC function set up for it.
        // 
        // BUT, the user specifically asked for the SQL code. 
        // I will return a JSON response explaining that they should run the SQL manually 
        // OR, if they have the sql() helper setup (which we don't seem to have), we could try.
        //
        // Actually, looking at the project structure, `src/lib/supabase.ts` handles the connection.
        // Since Supabase JS client doesn't support raw queries directly without RPC, 
        // the previous "api/migrate" route strategy is flawed for Supabase unless we use `pg` driver directly.
        //
        // Changing strategy: This route will now just return the Instructions or try to inspect if columns exist.
        //
        // However, since the user is owner, the BEST way is for them to run SQL in the Supabase Dashboard.

        return NextResponse.json({
            message: "Por favor ejecuta este SQL en tu Supabase SQL Editor:",
            sql: [
                "ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS latitud DECIMAL(10, 8);",
                "ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS longitud DECIMAL(11, 8);",
                "ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS radio INTEGER DEFAULT 500;"
            ]
        });

    } catch (err: any) {
        console.error('Migration API Error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
