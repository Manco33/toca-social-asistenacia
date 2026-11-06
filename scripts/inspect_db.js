require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function check() {
    try {
        const conn = await mysql.createConnection({
            host: '127.0.0.1',
            user: 'root',
            password: process.env.DB_PASSWORD || 'M3g4Gr3n1nj41!',
            database: 'tiempo_Aktiva'
        });

        console.log("--- Empleados ---");
        const [emp] = await conn.query('DESCRIBE empleados');
        console.table(emp);

        console.log("--- Horarios GPS ---");
        const [gps] = await conn.query('DESCRIBE horarios_gps');
        console.table(gps);

        await conn.end();
    } catch (err) {
        console.error(err);
    }
}

check();
