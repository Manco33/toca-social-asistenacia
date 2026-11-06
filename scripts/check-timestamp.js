const mysql = require('mysql2/promise');

async function check() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: process.env.DB_PASSWORD || 'M3g4Gr3n1nj41!',
    database: 'tiempo_Aktiva'
  });

  const [rows] = await conn.query(`
    SELECT id, usuario, fecha, hora_marcaje, tipo_actividad
    FROM horarios_gps
    ORDER BY id DESC
    LIMIT 10
  `);

  console.log('Last 10 entries:');
  console.table(rows);
  await conn.end();
}

check().catch(console.error);