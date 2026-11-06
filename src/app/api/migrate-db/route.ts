import { NextResponse } from 'next/server';
import { getPool } from '@/lib/mysql';

export async function GET() {
    try {
        const pool = getPool();
        // Check if column exists
        const [cols]: any = await pool.query('SHOW COLUMNS FROM empleados LIKE "telefono"');

        if (cols.length === 0) {
            await pool.query('ALTER TABLE empleados ADD COLUMN telefono VARCHAR(20) AFTER usuario');
            return NextResponse.json({ message: 'Column telefono added successfully' });
        } else {
            return NextResponse.json({ message: 'Column telefono already exists' });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
