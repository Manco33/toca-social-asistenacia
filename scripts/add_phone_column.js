require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function checkAndMigrate() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || 'M3g4Gr3n1nj41!',
        database: process.env.DB_NAME || 'tiempo_Aktiva'
    };

    console.log('DB Config:', { host: config.host, user: config.user, database: config.database });

    const conn = await mysql.createConnection(config);

    try {
        console.log('Checking table empleados...');
        const [cols] = await conn.query('SHOW COLUMNS FROM empleados LIKE "telefono"');
        if (cols.length === 0) {
            console.log('Column "telefono" missing. Adding it...');
            await conn.query('ALTER TABLE empleados ADD COLUMN telefono VARCHAR(20) AFTER usuario');
            console.log('Column added.');
        } else {
            console.log('Column "telefono" already exists.');
        }
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await conn.end();
    }
}

checkAndMigrate();
