const mysql = require('mysql2/promise');

async function migrate() {
    try {
        const conn = await mysql.createConnection({
            host: '127.0.0.1',
            user: 'root',
            password: process.env.DB_PASSWORD || 'M3g4Gr3n1nj41!',
            database: 'tiempo_Aktiva'
        });

        console.log('Adding columns to proyectos table...');

        // Add columns if they don't exist. 
        // Note: 'IF NOT EXISTS' for columns is not standard MySQL syntax in older versions, 
        // so we'll just try to add them and ignore 'duplicate column' errors or check first.

        const [cols] = await conn.query('SHOW COLUMNS FROM proyectos');
        const colNames = cols.map(c => c.Field);

        if (!colNames.includes('latitud')) {
            await conn.query('ALTER TABLE proyectos ADD COLUMN latitud DECIMAL(10, 8) NULL');
            console.log('Added latitud');
        }

        if (!colNames.includes('longitud')) {
            await conn.query('ALTER TABLE proyectos ADD COLUMN longitud DECIMAL(11, 8) NULL');
            console.log('Added longitud');
        }

        if (!colNames.includes('radio')) {
            await conn.query('ALTER TABLE proyectos ADD COLUMN radio INT DEFAULT 500');
            console.log('Added radio');
        }

        console.log('Migration complete.');
        await conn.end();
    } catch (err) {
        console.error('Migration failed:', err);
    }
}

migrate();
