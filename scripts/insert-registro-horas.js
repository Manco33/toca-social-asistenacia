#!/usr/bin/env node
// Usage: node insert-registro-horas.js <usuario> <fecha> <horas_trabajadas> <horas_extras>
const mysql = require('mysql2/promise');

async function main() {
  const [usuario, fecha, horas_trabajadas, horas_extras] = process.argv.slice(2);
  if (!usuario || !fecha) {
    console.error('Usage: node insert-registro-horas.js <usuario> <fecha> <horas_trabajadas> <horas_extras>');
    process.exit(1);
  }

  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    port: process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DB || 'tiempo_Aktiva',
    waitForConnections: true,
  });

  await pool.query('INSERT INTO registro_horas (usuario, fecha, horas_trabajadas, horas_extras) VALUES (?, ?, ?, ?)', [usuario, fecha, horas_trabajadas || 0, horas_extras || 0]);
  console.log('Inserted registro_horas for', usuario, fecha);
  await pool.end();
}

main().catch(e=>{console.error(e); process.exit(1)});
