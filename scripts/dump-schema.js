const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    const { data: usersData } = await supabase.from('users').select('*').limit(1);
    const { data: empData } = await supabase.from('empleados').select('*').limit(1);

    fs.writeFileSync(path.resolve(__dirname, '../schema.json'), JSON.stringify({
        usersKeys: Object.keys(usersData?.[0] || {}),
        empKeys: Object.keys(empData?.[0] || {})
    }, null, 2));
}

checkSchema();
