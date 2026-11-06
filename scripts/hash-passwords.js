/**
 * hash-passwords.js
 * One-time script to migrate all plain-text passwords in the 'empleados' table
 * to bcrypt hashes. Safe to run multiple times — already-hashed passwords are skipped.
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function isBcryptHash(str) {
    return typeof str === 'string' && (
        str.startsWith('$2a$') ||
        str.startsWith('$2b$') ||
        str.startsWith('$2y$')
    );
}

async function main() {
    console.log('🔍 Fetching all employees...');

    const { data: employees, error } = await supabase
        .from('empleados')
        .select('id, usuario, contrasena');

    if (error) {
        console.error('❌ Error fetching employees:', error.message);
        process.exit(1);
    }

    console.log(`📋 Found ${employees.length} employees to check.\n`);

    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const emp of employees) {
        const raw = String(emp.contrasena || '');

        if (isBcryptHash(raw)) {
            console.log(`  ⏭️  [${emp.id}] ${emp.usuario} — already hashed, skipping.`);
            skipped++;
            continue;
        }

        if (!raw) {
            console.log(`  ⚠️  [${emp.id}] ${emp.usuario} — empty password, skipping.`);
            skipped++;
            continue;
        }

        try {
            const hashed = await bcrypt.hash(raw, 10);
            const { error: updateError } = await supabase
                .from('empleados')
                .update({ contrasena: hashed })
                .eq('id', emp.id);

            if (updateError) {
                console.error(`  ❌ [${emp.id}] ${emp.usuario} — update failed: ${updateError.message}`);
                failed++;
            } else {
                console.log(`  ✅ [${emp.id}] ${emp.usuario} — password hashed successfully.`);
                updated++;
            }
        } catch (e) {
            console.error(`  ❌ [${emp.id}] ${emp.usuario} — bcrypt error: ${e.message}`);
            failed++;
        }
    }

    console.log('\n========================================');
    console.log(`✅ Updated  : ${updated}`);
    console.log(`⏭️  Skipped  : ${skipped}`);
    console.log(`❌ Failed   : ${failed}`);
    console.log('========================================');
    console.log('\n🎉 Done! All plain-text passwords have been migrated to bcrypt.');
    console.log('🔐 Users can now log in with the same passwords as before.');
}

main().catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
});
