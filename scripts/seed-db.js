const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function seed() {
  const conn = await mysql.createConnection({ host: process.env.DB_HOST || 'localhost', user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || 'M3g4Gr3n1nj41!', database: process.env.DB_NAME || 'tiempo_Aktiva' });

  // Create sample users (plain-text for testing)
  const adminPass = 'adminpass';
  const techPass = 'techpass';

  await conn.query(`INSERT INTO empleados (nombre, usuario, contrasena, rol) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE usuario = usuario`, ['Admin Usuario', 'admin', adminPass, 'administrador']);
  await conn.query(`INSERT INTO empleados (nombre, usuario, contrasena, rol) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE usuario = usuario`, ['Tecnico Prueba', 'tech', techPass, 'tecnico']);

  // Create sample projects
  await conn.query(`INSERT INTO proyectos (nombre, ubicacion_del_proyecto, soluciones) VALUES (?, ?, ?)`, ['Proyecto A', 'Av. Principal 123', 'Ing. Perez']);
  await conn.query(`INSERT INTO proyectos (nombre, ubicacion_del_proyecto, soluciones) VALUES (?, ?, ?)`, ['Proyecto B', 'Calle Secundaria 45', 'Sra. Lopez']);

  // Optionally insert an initial time entry for technician
  const [techRows] = await conn.query(`SELECT usuario FROM empleados WHERE usuario = ? LIMIT 1`, ['tech']);
  const tech = techRows[0];
  const [projRows] = await conn.query(`SELECT nombre FROM proyectos LIMIT 1`);
  const proj = projRows[0];
  if (tech && proj) {
    await conn.query(`INSERT INTO horarios_gps (usuario, fecha, tipo_actividad, coordenadas, hora_marcaje, proyecto) VALUES (?, ?, ?, ?, ?, ?)`, [tech.usuario, new Date().toISOString().slice(0,10), 'Llegada a oficina', '19.4326, -99.1332', new Date().toTimeString().slice(0,8), proj.nombre]);
  }

  console.log('Seed complete');
  await conn.end();
}

seed().catch(err => { console.error(err); process.exit(1); });
