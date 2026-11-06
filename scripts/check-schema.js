const mysql = require('mysql2/promise');

async function check() {
    try {
        const conn = await mysql.createConnection({
            host: '127.0.0.1',
            user: 'root',
            password: process.env.DB_PASSWORD || 'M3g4Gr3n1nj41!',
            database: 'tiempo_Aktiva'
        });

        const [rows] = await conn.query('DESCRIBE proyectos');
        console.table(rows);
        await conn.end();
    } catch (err) {
        console.error(err);
    }
}

check();
